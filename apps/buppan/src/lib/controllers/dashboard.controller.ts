/**
 * Dashboard Controller
 *
 * ダッシュボードAPIのコントローラー
 */

import { NextResponse } from 'next/server';
import { DashboardService } from '../services/dashboard.service';
import { NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

/**
 * ダッシュボード情報取得コントローラー
 *
 * @param serviceCode サービスコード
 * @param prisma Prismaクライアント
 * @returns ダッシュボード情報
 */
export async function getDashboard(
  serviceCode: string,
  prisma: any
): Promise<NextResponse> {
  try {
    // Service呼び出し
    const dashboardService = new DashboardService(prisma);
    const result = await dashboardService.getDashboard(serviceCode);

    // レスポンス
    return NextResponse.json(result);
  } catch (error) {
    logger.logError('ダッシュボード取得エラー', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'ダッシュボード情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
