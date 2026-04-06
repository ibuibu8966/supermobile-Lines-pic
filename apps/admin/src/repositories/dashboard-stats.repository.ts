/**
 * Dashboard Stats Repository
 *
 * ダッシュボード統計のデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';

/** 概要統計の生クエリ結果型 */
export interface OverviewRawResult {
  in_stock: bigint;
  active: bigint;
  returned: bigint;
}

/** プラン別アクティブ回線の生クエリ結果型 */
export interface ActiveLinesByPlanRawResult {
  planId: string;
  planCode: string;
  planName: string;
  serviceName: string;
  activeCount: bigint;
}

export class DashboardStatsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 概要統計（在庫SIM数・アクティブ回線数・返却済み回線数）を取得
   */
  async getOverviewStats(): Promise<OverviewRawResult[]> {
    logger.debug('DashboardStatsRepository.getOverviewStats');

    return await this.prisma.$queryRaw<OverviewRawResult[]>`
      SELECT
        (
          -- IN_STOCK: 回線なし or 最新回線がACTIVATED/SHIPPED以外
          SELECT COUNT(*) FROM "Sim" s
          WHERE NOT EXISTS (
            SELECT 1 FROM "ApplicationLine" al
            WHERE al."simId" = s.iccid
              AND al.status IN ('ACTIVATED', 'SHIPPED')
              AND al."updatedAt" = (
                SELECT MAX(al2."updatedAt") FROM "ApplicationLine" al2 WHERE al2."simId" = s.iccid
              )
          )
        ) as in_stock,
        (SELECT COUNT(*) FROM "ApplicationLine" WHERE status = 'ACTIVATED') as active,
        (SELECT COUNT(*) FROM "ApplicationLine" WHERE status = 'RETURNED') as returned
    `;
  }

  /**
   * 有効な用途タグ一覧を取得
   */
  async getUsageTags() {
    logger.debug('DashboardStatsRepository.getUsageTags');

    return await this.prisma.usageTag.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * プラン別アクティブ回線数を取得
   */
  async getActiveLinesByPlan(): Promise<ActiveLinesByPlanRawResult[]> {
    logger.debug('DashboardStatsRepository.getActiveLinesByPlan');

    return await this.prisma.$queryRaw<ActiveLinesByPlanRawResult[]>`
      SELECT
        p.id as "planId",
        p.code as "planCode",
        p.name as "planName",
        s.name as "serviceName",
        COUNT(al.id) as "activeCount"
      FROM "ApplicationLine" al
      JOIN "Application" a ON al."applicationId" = a.id
      JOIN "Plan" p ON a."planId" = p.id
      JOIN "Service" s ON p."serviceId" = s.id
      WHERE al.status = 'ACTIVATED'
      GROUP BY p.id, p.code, p.name, s.name
      ORDER BY "activeCount" DESC
    `;
  }

}
