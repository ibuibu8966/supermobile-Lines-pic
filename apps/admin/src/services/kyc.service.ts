/**
 * KYC Service
 *
 * KYC確認に関するビジネスロジックを担当
 */

import { KycListResult } from '@/entities';
import { NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';
import { KycImageStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export class KycService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly getSignedUrlFn: (
      bucket: string,
      path: string
    ) => Promise<string>
  ) {}

  /**
   * KYC確認待ち一覧取得
   *
   * @param serviceCode サービスコード
   * @param statusParam KYC画像ステータス
   * @param page ページ番号
   * @param pageSize ページサイズ
   * @returns KYC一覧
   */
  async getKycList(
    serviceCode: string,
    statusParam: string,
    page: number,
    pageSize: number
  ): Promise<KycListResult> {
    logger.info('KYC確認待ち一覧取得開始', { serviceCode, statusParam });

    // サービスを取得
    const service = await this.prisma.service.findUnique({
      where: { code: serviceCode },
    });

    if (!service) {
      throw new NotFoundError('サービスが見つかりません');
    }

    // SUBMITTED状態の申込を取得（KYC確認待ち）
    const where: Record<string, unknown> = {
      serviceId: service.id,
      status: 'SUBMITTED',
    };

    const [applications, totalCount] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          customer: true,
          plan: true,
          kycImages: {
            where: statusParam ? { status: statusParam as KycImageStatus } : undefined,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);

    // 署名付きURLを生成
    const applicationsWithUrls = await Promise.all(
      applications.map(async (app) => {
        const kycImagesWithUrls = await Promise.all(
          app.kycImages.map(async (img) => {
            const signedUrl = await this.getSignedUrlFn('kyc', img.storagePath);
            return {
              id: img.id,
              type: img.type,
              status: img.status,
              storagePath: img.storagePath,
              signedUrl,
              createdAt: img.createdAt,
            };
          })
        );

        return {
          id: app.id,
          applicationNumber: app.applicationNumber,
          customer: {
            id: app.customer.id,
            type: app.customer.type,
            name:
              app.customer.type === 'CORPORATE'
                ? app.customer.companyName || ''
                : `${app.customer.lastName} ${app.customer.firstName}`,
            email: app.customer.email,
            phone: app.customer.phone,
            birthDate: app.customer.birthDate,
            postalCode: app.customer.postalCode,
            prefecture: app.customer.prefecture,
            city: app.customer.city,
            address: app.customer.address,
            building: app.customer.building,
          },
          plan: {
            id: app.plan.id,
            name: app.plan.name,
          },
          lineCount: app.lineCount,
          totalAmount: app.totalAmount,
          status: app.status,
          createdAt: app.createdAt,
          kycImages: kycImagesWithUrls,
        };
      })
    );

    logger.info('KYC確認待ち一覧取得完了', {
      serviceCode,
      count: applicationsWithUrls.length,
    });

    return {
      applications: applicationsWithUrls,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }
}
