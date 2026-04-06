/**
 * KYC Controller
 *
 * KYC確認APIのコントローラー
 */

import { NextRequest, NextResponse } from 'next/server';
import { KycService } from '../services/kyc.service';
import { NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

/**
 * KYC確認待ち一覧取得コントローラー
 *
 * @param serviceCode サービスコード
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @param getSignedUrlFn 署名付きURL取得関数
 * @returns KYC一覧
 */
export async function getKycList(
  serviceCode: string,
  request: NextRequest,
  prisma: any,
  getSignedUrlFn: (bucket: string, path: string) => Promise<string>
): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Service呼び出し
    const kycService = new KycService(prisma, getSignedUrlFn);
    const result = await kycService.getKycList(
      serviceCode,
      statusParam,
      page,
      pageSize
    );

    // レスポンス
    return NextResponse.json(result);
  } catch (error) {
    logger.logError('KYC確認待ち一覧取得エラー', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'KYC確認待ち一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
