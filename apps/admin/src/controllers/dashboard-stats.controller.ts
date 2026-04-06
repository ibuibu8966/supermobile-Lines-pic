/**
 * Dashboard Stats Controller
 *
 * ダッシュボード統計APIのコントローラー
 * Repository/Serviceのインスタンス生成とエラーハンドリングを担当
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { DashboardStatsRepository } from '../repositories/dashboard-stats.repository';
import { DashboardStatsService } from '../services/dashboard-stats.service';
import { handleApiError } from '../shared/errors/api-errors';

/**
 * ダッシュボード統計取得コントローラー
 */
export async function getDashboardStats(): Promise<NextResponse> {
  try {
    const repository = new DashboardStatsRepository(prisma);
    const service = new DashboardStatsService(repository);
    const result = await service.getDashboardStats();

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
