import { PrismaClient } from '@prisma/client';
/**
 * Application Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationService } from '../services/application.service';
import { ApplicationRepository } from '../repositories/application.repository';
import { ApplicationUpdateInput, CustomerApplicationInput, CustomerInfo } from '@/entities';
import { parsePaginationParams, parseBooleanParam } from '../shared/validators/validation';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';
import { AdminSession } from '../lib/auth/admin-session';

type GetAdminSession = () => Promise<AdminSession | NextResponse>;
type AssertServiceAccess = (
  session: AdminSession,
  serviceId: string | null
) => NextResponse | null;

/**
 * 申込一覧取得コントローラー
 */
export async function getAllApplications(
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    serviceId: searchParams.get('serviceId') || undefined,
    customerType: searchParams.get('customerType') || undefined,
    includeArchived: parseBooleanParam(searchParams.get('includeArchived')),
    archivedOnly: parseBooleanParam(searchParams.get('archivedOnly')),
    kycStatus: searchParams.get('kycStatus') || undefined,
    kycStatusNull: parseBooleanParam(searchParams.get('kycStatusNull')),
    paymentStatus: searchParams.get('paymentStatus') || undefined,
    paymentStatusNull: parseBooleanParam(searchParams.get('paymentStatusNull')),
    addressStatus: searchParams.get('addressStatus') || undefined,
    addressStatusNot: searchParams.get('addressStatusNot') || undefined,
    addressStatusNull: parseBooleanParam(searchParams.get('addressStatusNull')),
    inoueCheck: searchParams.get('inoueCheck') || undefined,
    inoueCheckNot: searchParams.get('inoueCheckNot') || undefined,
    inoueCheckNull: parseBooleanParam(searchParams.get('inoueCheckNull')),
    assignedUserId: searchParams.get('assignedUserId') || undefined,
    assignedUserNull: parseBooleanParam(searchParams.get('assignedUserNull')),
    hideFullyCompleted: parseBooleanParam(searchParams.get('hideFullyCompleted')),
  };

  const pagination = parsePaginationParams(searchParams);

  // 3. Service呼び出し
  const applicationService = new ApplicationService(
    new ApplicationRepository(prisma)
  );

  const result = await applicationService.getApplicationList(
    filters,
    pagination,
    session
  );

  // 4. レスポンス
  return NextResponse.json({
    data: result.applications,
    pagination: result.pagination,
  });
}

/**
 * 申込詳細取得コントローラー
 */
export async function getApplicationById(
  id: string,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess,
  getSignedUrl?: (bucket: string, path: string) => Promise<string>
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. Service呼び出し
  const applicationService = new ApplicationService(
    new ApplicationRepository(prisma)
  );

  const application = await applicationService.getApplicationById(id);

  if (!application) {
    throw new NotFoundError('申し込み');
  }

  // 3. 権限チェック
  const accessDenied = assertServiceAccess(session, application.serviceId);
  if (accessDenied) return accessDenied;

  // 4. KYC画像に署名付きURLを追加（オプショナル）
  let kycImagesWithUrls = application.kycImages;
  if (getSignedUrl && application.kycImages) {
    kycImagesWithUrls = await Promise.all(
      application.kycImages.map(async (img) => {
        try {
          const signedUrl = await getSignedUrl('kyc', img.storagePath);
          return { ...img, signedUrl };
        } catch {
          return { ...img, signedUrl: null };
        }
      })
    );
  }

  // 5. 同一顧客の全申込のkycImagesから最新の有効期限を取得
  const allCustomerKycImages = await prisma.kycImage.findMany({
    where: {
      application: { customerId: application.customerId },
      expiryDate: { not: null },
    },
    select: { expiryDate: true },
    orderBy: { expiryDate: 'desc' },
    take: 1,
  });
  const latestExpiryDate = allCustomerKycImages[0]?.expiryDate ?? null;

  // 6. レスポンス
  return NextResponse.json({
    ...application,
    kycImages: kycImagesWithUrls,
    latestExpiryDate,
  });
}

/**
 * 申込更新コントローラー
 */
const updateApplicationSchema = z.object({
  status: z
    .enum([
      'SUBMITTED',
      'PAYMENT_PENDING',
      'PAID',
      'SHIPPING',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
  kycStatus: z.enum(['PENDING', 'DEFICIENT', 'RESUBMIT', 'COMPLETED']).optional().nullable(),
  paymentStatus: z.enum(['INVOICED', 'PAID']).optional().nullable(),
  addressStatus: z.enum(['PENDING', 'DEFICIENT', 'RESUBMIT', 'COMPLETED']).optional().nullable(),
  comment1: z.string().max(1000).optional().nullable(),
  comment2: z.string().max(1000).optional().nullable(),
  note: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
  noReferral: z.boolean().optional(),
  invoiceUrl: z.string().max(500).optional().nullable(),
  inoueCheck: z.enum(['IN_PROGRESS', 'COMPLETED', 'PROCESSED']).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  lineCount: z.number().int().positive().optional(),
  unitPrice: z.number().int().min(0).optional().nullable(),
  couponCode: z.string().optional().nullable(),
  couponId: z.string().optional().nullable(),
  planId: z.string().cuid().optional(),
});

export async function updateApplication(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. バリデーション
  const body = await request.json();
  const appParseResult = updateApplicationSchema.safeParse(body);
  if (!appParseResult.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: appParseResult.error.flatten() },
      { status: 400 }
    );
  }
  const validated = appParseResult.data;

  // 3. 存在確認と権限チェック
  const applicationService = new ApplicationService(
    new ApplicationRepository(prisma)
  );

  const existing = await applicationService.getApplicationById(id);
  if (!existing) {
    throw new NotFoundError('申し込み');
  }

  const accessDenied = assertServiceAccess(session, existing.serviceId);
  if (accessDenied) return accessDenied;

  // 4. Service呼び出し
  try {
    const updated = await applicationService.updateApplication(id, validated as ApplicationUpdateInput);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('SIM割当済み')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

// 顧客情報スキーマ
const customerInfoSchema = z.object({
  lastName: z.string().min(1, '姓を入力してください').max(50),
  firstName: z.string().min(1, '名を入力してください').max(50),
  lastNameKana: z.string().min(1, 'セイを入力してください').regex(/^[ァ-ヶー]+$/, 'カタカナで入力してください'),
  firstNameKana: z.string().min(1, 'メイを入力してください').regex(/^[ァ-ヶー]+$/, 'カタカナで入力してください'),
  birthDate: z.string().min(1, '生年月日を入力してください'),
  phone: z.string().regex(/^0\d{9,10}$/, '電話番号の形式が正しくありません'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/, '郵便番号の形式が正しくありません'),
  prefecture: z.string().min(1, '都道府県を選択してください'),
  city: z.string().min(1, '市区町村を入力してください'),
  address: z.string().min(1, '番地を入力してください'),
  building: z.string().optional(),
  companyName: z.string().optional(),
  companyNameKana: z.string().optional(),
  companyPostalCode: z.string().optional(),
  companyPrefecture: z.string().optional(),
  companyCity: z.string().optional(),
  companyAddress: z.string().optional(),
  companyBuilding: z.string().optional(),
});

/**
 * 顧客申込作成コントローラー（フロントエンド向けAPI用）
 *
 * @param serviceCode サービスコード
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @param hashPasswordFn パスワードハッシュ化関数
 * @param uploadFileFn ファイルアップロード関数
 * @returns 作成された申込情報
 */
export async function createCustomerApplication(
  serviceCode: string,
  request: NextRequest,
  prisma: PrismaClient,
  hashPasswordFn: (password: string) => Promise<string>,
  uploadFileFn: (bucket: string, path: string, buffer: Buffer, contentType: string) => Promise<void>
): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    // 1. FormDataからパラメータ取得
    const planId = formData.get('planId') as string;
    const lineCount = parseInt(formData.get('lineCount') as string, 10);
    const customerType = formData.get('customerType') as 'INDIVIDUAL' | 'CORPORATE';
    const password = formData.get('password') as string;
    const customerJson = formData.get('customer') as string;
    const agreeTerms = formData.get('agreeTerms') === 'true';
    const agreePrivacy = formData.get('agreePrivacy') === 'true';
    const agreeTelecom = formData.get('agreeTelecom') === 'true';
    const agreeInitialCancellation = formData.get('agreeInitialCancellation') === 'true';
    const agreeAntiSocial = formData.get('agreeAntiSocial') === 'true';

    // KYCファイル
    const idFront = formData.get('idFront') as File | null;
    const idBack = formData.get('idBack') as File | null;
    const corporateRegistry = formData.get('corporateRegistry') as File | null;
    const idExpiryDateStr = formData.get('idExpiryDate') as string | null;
    const idExpiryDate = idExpiryDateStr ? new Date(idExpiryDateStr) : null;
    const couponCode = formData.get('couponCode') as string | null;

    // 2. 基本バリデーション
    if (!planId || !lineCount || !customerType || !password || !customerJson) {
      throw new ValidationError('必須項目が入力されていません');
    }

    if (lineCount < 10 || lineCount % 10 !== 0) {
      throw new ValidationError('回線数は10回線単位で指定してください');
    }

    if (password.length < 8) {
      throw new ValidationError('パスワードは8文字以上で入力してください');
    }

    if (!agreeTerms || !agreePrivacy || !agreeTelecom || !agreeInitialCancellation || !agreeAntiSocial) {
      throw new ValidationError('すべての同意事項にチェックしてください');
    }

    // KYC書類チェック
    if (!idFront || !idBack) {
      throw new ValidationError('本人確認書類をアップロードしてください');
    }

    if (customerType === 'CORPORATE' && !corporateRegistry) {
      throw new ValidationError('登記簿謄本をアップロードしてください');
    }

    // 3. 顧客情報パース・バリデーション
    let customerData: CustomerInfo;
    try {
      customerData = customerInfoSchema.parse(JSON.parse(customerJson));
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ValidationError(e.issues.map((i) => i.message).join(', '));
      }
      throw e;
    }

    // 法人の場合の追加バリデーション
    if (customerType === 'CORPORATE') {
      if (!customerData.companyName || !customerData.companyNameKana) {
        throw new ValidationError('法人名を入力してください');
      }
    }

    // 4. 入力データを構築
    const input: CustomerApplicationInput = {
      planId,
      lineCount,
      customerType,
      password,
      customer: customerData,
      agreeTerms,
      agreePrivacy,
      agreeTelecom,
      agreeInitialCancellation,
      agreeAntiSocial,
      idFront,
      idBack,
      corporateRegistry,
      idExpiryDate,
      couponCode,
    };

    // 5. Service呼び出し
    const applicationService = new ApplicationService(
      new ApplicationRepository(prisma)
    );

    // TODO: createCustomerApplication は未実装
    return NextResponse.json(
      { error: 'この機能は現在実装されていません' },
      { status: 501 }
    );
  } catch (error) {
    logger.logError('顧客申込作成エラー', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    return NextResponse.json(
      { error: '申込の作成に失敗しました', details: errorMessage },
      { status: 500 }
    );
  }
}

// ─── 紹介者 ───────────────────────────────────────────

/**
 * 紹介者追加コントローラー
 */
export async function addReferral(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const body = await request.json();
  const { referrerName, fee } = body;

  if (!referrerName || fee === undefined) {
    return NextResponse.json({ error: 'referrerName と fee は必須です' }, { status: 400 });
  }

  const service = new ApplicationService(new ApplicationRepository(prisma));
  const referral = await service.addReferral(id, String(referrerName), Number(fee));
  return NextResponse.json(referral, { status: 201 });
}

/**
 * 紹介者削除コントローラー
 */
export async function deleteReferral(
  referralId: string,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const service = new ApplicationService(new ApplicationRepository(prisma));
  await service.deleteReferral(referralId);
  return new NextResponse(null, { status: 204 });
}

// ─── 追跡番号 ─────────────────────────────────────────

/**
 * 追跡番号追加コントローラー
 */
export async function addTracking(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const body = await request.json();
  const { carrier, trackingNumber } = body;

  if (!carrier || !trackingNumber) {
    return NextResponse.json({ error: 'carrier と trackingNumber は必須です' }, { status: 400 });
  }

  const service = new ApplicationService(new ApplicationRepository(prisma));
  const tracking = await service.addTracking(id, String(carrier), String(trackingNumber));
  return NextResponse.json(tracking, { status: 201 });
}

/**
 * 追跡番号削除コントローラー
 */
export async function deleteTracking(
  trackingId: string,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const service = new ApplicationService(new ApplicationRepository(prisma));
  await service.deleteTracking(trackingId);
  return new NextResponse(null, { status: 204 });
}

// ─── ワークフロー画像 ─────────────────────────────────

/**
 * ワークフロー画像URL取得コントローラー
 */
export async function getWorkflowImageUrls(
  id: string,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const service = new ApplicationService(new ApplicationRepository(prisma));
  const urls = await service.getWorkflowImageUrls(id);
  return NextResponse.json(urls);
}

/**
 * ワークフロー画像アップロードコントローラー
 */
export async function uploadWorkflowImage(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const imageType = formData.get('imageType') as string | null;

  if (!file || !imageType) {
    return NextResponse.json({ error: 'file と imageType は必須です' }, { status: 400 });
  }

  const service = new ApplicationService(new ApplicationRepository(prisma));
  const result = await service.uploadWorkflowImage(id, imageType, file);
  return NextResponse.json(result);
}

/**
 * 顧客申込一覧取得コントローラー
 *
 * @param prisma Prismaクライアント
 * @param getSessionFn セッション取得関数（NextAuthのauth()等）
 * @returns 申込一覧
 */
export async function getCustomerApplications(
  prisma: PrismaClient,
  getSessionFn: () => Promise<{ user?: { id?: string } } | null>
): Promise<NextResponse> {
  try {
    // 1. 認証チェック
    const session = await getSessionFn();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 2. Service呼び出し
    const applicationService = new ApplicationService(
      new ApplicationRepository(prisma)
    );

    // TODO: getCustomerApplications は未実装
    return NextResponse.json(
      { error: 'この機能は現在実装されていません' },
      { status: 501 }
    );
  } catch (error) {
    logger.logError('顧客申込一覧取得エラー', error);

    return NextResponse.json(
      { error: '申込履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
