import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ProfitLossService } from '../services/profit-loss.service';
import { ProfitLossRepository } from '../repositories/profit-loss.repository';
import { logger } from '../shared/utils/logger';

/**
 * 17日締めの期間を計算
 * year月度 = (year, month-1, 18日) 〜 (year, month, 18日)
 * 例: 2026年2月度 = 2026-01-18 ~ 2026-02-18 (18日は含まない)
 */
function calculatePeriod(year: number, month: number) {
  const periodStart = new Date(Date.UTC(year, month - 2, 18, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month - 1, 18, 0, 0, 0));
  const periodLabel = `${year}年${month}月度`;

  return { periodStart, periodEnd, periodLabel };
}

/**
 * 現在の日付から当月度を判定
 * 1/18〜2/17 → 2月度、2/18〜3/17 → 3月度
 */
function getCurrentPeriod() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-indexed

  // 18日以降なら翌月度
  if (now.getDate() >= 18) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { year, month };
}

export async function getProfitLoss(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    // パラメータなしの場合は当月度
    const { year: defaultYear, month: defaultMonth } = getCurrentPeriod();
    const year = yearParam ? parseInt(yearParam, 10) : defaultYear;
    const month = monthParam ? parseInt(monthParam, 10) : defaultMonth;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'year/month パラメータが不正です' },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd, periodLabel } = calculatePeriod(year, month);

    const repository = new ProfitLossRepository(prisma);
    const service = new ProfitLossService(repository);
    const result = await service.getProfitLoss(periodStart, periodEnd, periodLabel);

    return NextResponse.json(result);
  } catch (error) {
    logger.logError('損益管理データ取得エラー', error);
    return NextResponse.json(
      { error: '損益管理データの取得に失敗しました' },
      { status: 500 }
    );
  }
}
