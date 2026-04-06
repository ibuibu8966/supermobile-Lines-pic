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
import { CustomerApplicationInput, CustomerInfo } from '@/lib/entities';
import { parsePaginationParams, parseBooleanParam } from '../shared/validators/validation';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

// Prismaクライアントと認証関数は呼び出し側から注入される想定
type GetAdminSession = () => Promise<
  | { id: string; role: string; scopedServiceId?: string | null }
  | NextResponse
>;
type AssertServiceAccess = (
  session: { scopedServiceId?: string | null },
  serviceId: string
) => NextResponse | undefined;

/**
 * 申込一覧取得コントローラー
 */
export async function getAllApplications(
  request: NextRequest,
  prisma: any,
  getAdminSession: GetAdminSession,
  getSignedUrl?: (bucket: string, path: string) => Promise<string>
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
    archivedOnly: parseBooleanParam(searchParams.get('archivedOnly') ?? searchParams.get('archived')),
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

  // 4. KYC画像の署名付きURL生成 & 有効期限マッピング
  const applications = await Promise.all(
    result.applications.map(async (app) => {
      // 有効期限
      const expirationDate = app.latestExpiryDate
        ? new Date(app.latestExpiryDate).toISOString()
        : null;

      // KYC画像URL
      let idCardFrontUrl: string | null = null;
      let idCardBackUrl: string | null = null;
      let registrationUrl: string | null = null;

      if (getSignedUrl && app.kycImages) {
        for (const img of app.kycImages) {
          try {
            const url = await getSignedUrl('kyc', img.storagePath);
            if (img.type === 'ID_FRONT') idCardFrontUrl = url;
            else if (img.type === 'ID_BACK') idCardBackUrl = url;
            else if (img.type === 'CORPORATE_REGISTRY') registrationUrl = url;
          } catch {
            // 署名URL生成失敗は無視
          }
        }
      }

      return {
        ...app,
        expirationDate,
        idCardFrontUrl,
        idCardBackUrl,
        registrationUrl,
      };
    })
  );

  // 5. レスポンス
  return NextResponse.json({
    applications,
    pagination: result.pagination,
  });
}

/**
 * 申込詳細取得コントローラー
 */
export async function getApplicationById(
  id: string,
  prisma: any,
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

  // 5. レスポンス
  return NextResponse.json({
    ...application,
    kycImages: kycImagesWithUrls,
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
  kycStatus: z.enum(['PENDING', 'DEFICIENT', 'RESUBMIT', 'COMPLETED']).optional(),
  paymentStatus: z.enum(['BEFORE_INVOICE', 'INVOICED', 'PAID']).optional(),
  addressStatus: z.enum(['PENDING', 'DEFICIENT', 'RESUBMIT', 'COMPLETED']).optional(),
  comment1: z.string().max(1000).optional().nullable(),
  comment2: z.string().max(1000).optional().nullable(),
  note: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export async function updateApplication(
  id: string,
  request: NextRequest,
  prisma: any,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. バリデーション
  const body = await request.json();
  const validated = updateApplicationSchema.parse(body);

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
  const updated = await applicationService.updateApplication(id, validated);

  // 5. レスポンス
  return NextResponse.json(updated);
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
  establishedDate: z.string().optional(),
  representativeLastName: z.string().optional(),
  representativeFirstName: z.string().optional(),
  representativeLastNameKana: z.string().optional(),
  representativeFirstNameKana: z.string().optional(),
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
  prisma: any,
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

    // KYCファイル（File直接 or 既アップロード済みパスのどちらかを受け付ける）
    const idFront = formData.get('idFront') as File | null;
    const idBack = formData.get('idBack') as File | null;
    const corporateRegistry = formData.get('corporateRegistry') as File | null;
    const idFrontPath = formData.get('idFrontPath') as string | null;
    const idBackPath = formData.get('idBackPath') as string | null;
    const corporateRegistryPath = formData.get('corporateRegistryPath') as string | null;
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

    // KYC書類チェック（FileオブジェクトまたはStorageパスのいずれかが必要）
    const hasIdFront = !!idFront || !!idFrontPath;
    const hasIdBack = !!idBack || !!idBackPath;
    if (!hasIdFront || !hasIdBack) {
      throw new ValidationError('本人確認書類をアップロードしてください');
    }

    const hasCorporateRegistry = !!corporateRegistry || !!corporateRegistryPath;
    if (customerType === 'CORPORATE' && !hasCorporateRegistry) {
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
      if (!customerData.representativeLastName || !customerData.representativeFirstName) {
        throw new ValidationError('代表者名を入力してください');
      }
      if (!customerData.representativeLastNameKana || !customerData.representativeFirstNameKana) {
        throw new ValidationError('代表者名（カナ）を入力してください');
      }
      if (!customerData.establishedDate) {
        throw new ValidationError('法人設立日を入力してください');
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
      idFrontPath,
      idBackPath,
      corporateRegistry,
      corporateRegistryPath,
      idExpiryDate,
      couponCode,
    };

    // 5. Service呼び出し
    const applicationService = new ApplicationService(
      new ApplicationRepository(prisma)
    );

    const result = await applicationService.createCustomerApplication(
      serviceCode,
      input,
      hashPasswordFn,
      uploadFileFn
    );

    // 6. レスポンス
    return NextResponse.json(result, { status: 201 });
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

/**
 * 顧客申込一覧取得コントローラー
 *
 * @param prisma Prismaクライアント
 * @param getSessionFn セッション取得関数（NextAuthのauth()等）
 * @returns 申込一覧
 */
export async function getCustomerApplications(
  prisma: any,
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

    const applications = await applicationService.getCustomerApplications(
      session.user.id
    );

    // 3. レスポンス
    return NextResponse.json({ applications });
  } catch (error) {
    logger.logError('顧客申込一覧取得エラー', error);

    return NextResponse.json(
      { error: '申込履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
