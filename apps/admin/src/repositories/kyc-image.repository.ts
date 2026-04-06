/**
 * KYC Image Repository
 *
 * KYC画像のデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { KycImageWithApplication } from '@/entities';
import { logger } from '../shared/utils/logger';

export class KycImageRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * IDでKYC画像を取得（申込情報含む）
   */
  async findByIdWithApplication(id: string): Promise<KycImageWithApplication | null> {
    logger.debug('KycImageRepository.findByIdWithApplication', { id });

    const kycImage = await this.prisma.kycImage.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            kycImages: true,
          },
        },
      },
    });
    return kycImage as unknown as KycImageWithApplication | null;
  }

  /**
   * KYC画像を更新
   */
  async update(id: string, data: Prisma.KycImageUpdateInput): Promise<KycImageWithApplication> {
    logger.debug('KycImageRepository.update', { id, data });

    const kycImage = await this.prisma.kycImage.update({
      where: { id },
      data,
    });
    return kycImage as unknown as KycImageWithApplication;
  }

  /**
   * kycImagesが空の申込に前回の申込からコピー（既存データ対応）
   */
  async copyFromPreviousIfEmpty(applicationId: string): Promise<void> {
    logger.debug('KycImageRepository.copyFromPreviousIfEmpty', { applicationId });

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { kycImages: true },
    });

    if (!application || application.kycImages.length > 0) {
      return;
    }

    const prevApp = await this.prisma.application.findFirst({
      where: {
        customerId: application.customerId,
        id: { not: applicationId },
      },
      orderBy: { createdAt: 'desc' },
      include: { kycImages: true },
    });

    if (prevApp && prevApp.kycImages.length > 0) {
      await this.prisma.kycImage.createMany({
        data: prevApp.kycImages.map((img) => ({
          applicationId,
          type: img.type,
          storagePath: img.storagePath,
          status: 'APPROVED' as const,
          expiryDate: img.expiryDate,
        })),
      });
      logger.info('前回の申込からkycImagesをコピーしました', {
        applicationId,
        fromApplicationId: prevApp.id,
        count: prevApp.kycImages.length,
      });
    }
  }

  /**
   * 申込のKYC画像の有効期限を一括更新
   */
  async updateExpiryByApplicationId(applicationId: string, expiryDate: Date | null): Promise<number> {
    logger.debug('KycImageRepository.updateExpiryByApplicationId', { applicationId, expiryDate });

    const result = await this.prisma.kycImage.updateMany({
      where: { applicationId },
      data: { expiryDate },
    });
    return result.count;
  }

  /**
   * 申込のKYCステータスを更新
   */
  async updateApplicationKycStatus(applicationId: string, kycStatus: string): Promise<void> {
    logger.debug('KycImageRepository.updateApplicationKycStatus', { applicationId, kycStatus });

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { kycStatus: kycStatus as $Enums.KycVerificationStatus },
    });
  }
}
