/**
 * KYC Image Repository
 *
 * KYC画像のデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { KycImageWithApplication } from '@/lib/entities';
import { logger } from '../shared/utils/logger';

export class KycImageRepository {
  constructor(private prisma: any) {}

  /**
   * IDでKYC画像を取得（申込情報含む）
   */
  async findByIdWithApplication(id: string): Promise<KycImageWithApplication | null> {
    logger.debug('KycImageRepository.findByIdWithApplication', { id });

    return await this.prisma.kycImage.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            kycImages: true,
          },
        },
      },
    });
  }

  /**
   * KYC画像を更新
   */
  async update(id: string, data: any): Promise<any> {
    logger.debug('KycImageRepository.update', { id, data });

    return await this.prisma.kycImage.update({
      where: { id },
      data,
    });
  }

  /**
   * 申込のKYCステータスを更新
   */
  async updateApplicationKycStatus(applicationId: string, kycStatus: string): Promise<void> {
    logger.debug('KycImageRepository.updateApplicationKycStatus', { applicationId, kycStatus });

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { kycStatus },
    });
  }
}
