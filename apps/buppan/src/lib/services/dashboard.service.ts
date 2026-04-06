/**
 * Dashboard Service
 *
 * ダッシュボード情報に関するビジネスロジックを担当
 */

import { DashboardResult } from '@/lib/entities';
import { NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';
import type { PrismaClient } from '@prisma/client';

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 管理ダッシュボード情報取得
   *
   * @param serviceCode サービスコード
   * @returns ダッシュボード情報
   */
  async getDashboard(serviceCode: string): Promise<DashboardResult> {
    logger.info('ダッシュボード情報取得開始', { serviceCode });

    // サービスを取得
    const service = await this.prisma.service.findUnique({
      where: { code: serviceCode },
    });

    if (!service) {
      throw new NotFoundError('サービスが見つかりません');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 全クエリはservice.idにのみ依存 → Promise.allで並列実行
    const [
      todayApplicationCount,
      kycPendingCount,
      shippingPendingCount,
      activeCustomers,
      recentApplications,
      kycPendingList,
    ] = await Promise.all([
      // 本日の申込数
      this.prisma.application.count({
        where: {
          serviceId: service.id,
          createdAt: { gte: today },
        },
      }),
      // KYC待ち件数
      this.prisma.application.count({
        where: {
          serviceId: service.id,
          status: 'SUBMITTED',
        },
      }),
      // 発送待ち件数（入金確認済み）
      this.prisma.application.count({
        where: {
          serviceId: service.id,
          status: 'PAID',
        },
      }),
      // アクティブ顧客数（COMPLETED状態の申込がある顧客）
      this.prisma.application.groupBy({
        by: ['customerId'],
        where: {
          serviceId: service.id,
          status: 'COMPLETED',
        },
      }),
      // 最新の申込一覧
      this.prisma.application.findMany({
        where: { serviceId: service.id },
        include: {
          customer: true,
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // KYC確認待ち一覧
      this.prisma.application.findMany({
        where: {
          serviceId: service.id,
          status: 'SUBMITTED',
        },
        include: {
          customer: true,
          kycImages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
    ]);

    logger.info('ダッシュボード情報取得完了', {
      serviceCode,
      todayApplicationCount,
      kycPendingCount,
    });

    return {
      stats: {
        todayApplicationCount,
        kycPendingCount,
        shippingPendingCount,
        activeCustomerCount: activeCustomers.length,
      },
      recentApplications: recentApplications.map((app) => ({
        id: app.id,
        applicationNumber: app.applicationNumber,
        customerName:
          app.customer.type === 'CORPORATE'
            ? app.customer.companyName || ''
            : app.customer.lastName + app.customer.firstName,
        planName: app.plan.name,
        lineCount: app.lineCount,
        status: app.status,
        createdAt: app.createdAt,
      })),
      kycPendingList: kycPendingList.map((app) => ({
        id: app.id,
        applicationNumber: app.applicationNumber,
        customerName: app.customer.lastName + app.customer.firstName,
        documentType: app.kycImages[0]?.type || '未提出',
        createdAt: app.createdAt,
      })),
    };
  }
}
