/**
 * Dashboard Stats Service
 *
 * ダッシュボード統計に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、レスポンス用のデータ変換を行う
 */

import { DashboardStatsRepository } from '../repositories/dashboard-stats.repository';
import { logger } from '../shared/utils/logger';

/** 用途タグ別SIM在庫 */
export interface SimInventoryByUsageTag {
  usageTagId: number;
  usageTagCode: string;
  usageTagName: string;
  availableCount: number;
}

/** プラン別アクティブ回線（bigint変換済み） */
export interface ActiveLinesByPlan {
  planId: string;
  planCode: string;
  planName: string;
  serviceName: string;
  activeCount: number;
}

/** ダッシュボード統計レスポンス */
export interface DashboardStatsResult {
  overview: {
    totalInStockSims: number;
    totalActiveLines: number;
    totalReturningLines: number;
  };
  simInventoryByUsageTag: SimInventoryByUsageTag[];
  activeLinesByPlan: ActiveLinesByPlan[];
}

export class DashboardStatsService {
  constructor(private dashboardStatsRepo: DashboardStatsRepository) {}

  /**
   * ダッシュボード統計を取得
   *
   * 3つのクエリを並列実行し、bigintをnumberに変換してレスポンス形式に整形
   */
  async getDashboardStats(): Promise<DashboardStatsResult> {
    logger.info('ダッシュボード統計取得開始');

    // 3つのクエリを並列実行
    const [overviewResult, usageTags, activeLinesByPlanRaw] = await Promise.all([
      this.dashboardStatsRepo.getOverviewStats(),
      this.dashboardStatsRepo.getUsageTags(),
      this.dashboardStatsRepo.getActiveLinesByPlan(),
    ]);

    // bigintをnumberに変換
    const totalInStockSims = Number(overviewResult[0].in_stock);
    const totalActiveLines = Number(overviewResult[0].active);
    const totalReturningLines = Number(overviewResult[0].returned);

    // 用途タグ別SIM在庫（簡易実装: 全タグに総在庫数を表示）
    const simInventoryByUsageTag: SimInventoryByUsageTag[] = usageTags.map((tag) => ({
      usageTagId: tag.id,
      usageTagCode: tag.code,
      usageTagName: tag.name,
      availableCount: totalInStockSims,
    }));

    // プラン別アクティブ回線（bigintをnumberに変換）
    const activeLinesByPlan: ActiveLinesByPlan[] = activeLinesByPlanRaw.map((item) => ({
      ...item,
      activeCount: Number(item.activeCount),
    }));

    logger.info('ダッシュボード統計取得完了', {
      totalInStockSims,
      totalActiveLines,
      totalReturningLines,
      usageTagCount: simInventoryByUsageTag.length,
      planCount: activeLinesByPlan.length,
    });

    return {
      overview: {
        totalInStockSims,
        totalActiveLines,
        totalReturningLines,
      },
      simInventoryByUsageTag,
      activeLinesByPlan,
    };
  }
}
