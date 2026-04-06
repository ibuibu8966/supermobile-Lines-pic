import { PrismaClient } from '@prisma/client';
/**
 * KYC Image Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { KycImageService } from '../services/kyc-image.service';
import { KycImageRepository } from '../repositories/kyc-image.repository';
import { logger } from '../shared/utils/logger';

/**
 * KYC画像更新コントローラー
 */
const updateKycImageSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  reviewNote: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
});

/**
 * KYC画像詳細取得コントローラー
 */
export async function getKycImageDetail(
  id: string,
  prisma: PrismaClient,
  getSignedUrlFn: (bucket: string, path: string) => Promise<string>
): Promise<NextResponse> {
  try {
    const kycImage = await prisma.kycImage.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            customer: true,
            plan: true,
          },
        },
      },
    });

    if (!kycImage) {
      return NextResponse.json(
        { error: 'KYC画像が見つかりません' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    const signedUrl = await getSignedUrlFn('kyc', kycImage.storagePath);

    return NextResponse.json({
      ...kycImage,
      signedUrl,
    });
  } catch (error) {
    logger.logError('KYC画像詳細取得エラー', error);
    return NextResponse.json(
      { error: 'KYC画像詳細の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function updateKycImage(
  id: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('KYC画像更新開始', { id });

  // 1. バリデーション
  const body = await request.json();
  const parseResult = updateKycImageSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const validated = parseResult.data;

  // 2. Service呼び出し
  const kycImageService = new KycImageService(new KycImageRepository(prisma));
  const result = await kycImageService.updateKycImage(id, validated);

  // 3. レスポンス
  logger.info('KYC画像更新完了', { id });
  return NextResponse.json(result);
}

/**
 * KYC画像一覧取得コントローラー
 */
export async function getKycImages(
  applicationId: string,
  prisma: PrismaClient
): Promise<NextResponse> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return NextResponse.json(
        { error: '申込が見つかりません' },
        { status: 404 }
      );
    }

    const kycImages = await prisma.kycImage.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ kycImages });
  } catch (error) {
    logger.logError('KYC画像一覧取得エラー', error);
    return NextResponse.json(
      { error: 'KYC画像一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * KYC画像登録スキーマ
 */
const kycImageSchema = z.object({
  type: z.enum(['ID_FRONT', 'ID_BACK', 'SELFIE', 'ADDRESS_PROOF']),
  storagePath: z.string().min(1, 'ストレージパスは必須です'),
});

/**
 * KYC画像登録コントローラー
 */
export async function createKycImage(
  applicationId: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const body = await request.json();
  const kycParseResult = kycImageSchema.safeParse(body);
  if (!kycParseResult.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: kycParseResult.error.flatten() },
      { status: 400 }
    );
  }
  const validated = kycParseResult.data;

  try {
    // 申込の存在確認
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return NextResponse.json(
        { error: '申込が見つかりません' },
        { status: 404 }
      );
    }

    // 同じタイプの既存画像があれば更新、なければ新規作成
    const existingImage = await prisma.kycImage.findFirst({
      where: {
        applicationId,
        type: validated.type,
      },
    });

    let kycImage;
    if (existingImage) {
      kycImage = await prisma.kycImage.update({
        where: { id: existingImage.id },
        data: {
          storagePath: validated.storagePath,
          status: 'PENDING',
          reviewedAt: null,
          reviewNote: null,
        },
      });
    } else {
      kycImage = await prisma.kycImage.create({
        data: {
          applicationId,
          type: validated.type,
          storagePath: validated.storagePath,
          status: 'PENDING',
        },
      });
    }

    return NextResponse.json(kycImage, { status: existingImage ? 200 : 201 });
  } catch (error) {
    logger.logError('KYC画像登録エラー', error);
    return NextResponse.json(
      { error: 'KYC画像の登録に失敗しました' },
      { status: 500 }
    );
  }
}
