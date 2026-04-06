/**
 * KYC Image Service
 *
 * KYC画像に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { KycImageRepository } from '../repositories/kyc-image.repository';
import { KycImageUpdateInput, KycImageUpdateResult } from '@/lib/entities';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

export class KycImageService {
  constructor(private kycImageRepo: KycImageRepository) {}

  /**
   * KYC画像を更新
   * ビジネスルール:
   * - 有効期限のみの更新が可能
   * - ステータス更新時にreviewedAtを自動設定
   * - ステータス更新後、申込のkycStatusを自動更新
   *   - いずれかがREJECTED → DEFICIENT
   *   - 全てAPPROVED → COMPLETED
   *   - それ以外 → PENDING
   */
  async updateKycImage(id: string, updateData: KycImageUpdateInput): Promise<KycImageUpdateResult> {
    logger.info('KYC画像更新開始', { id, updateData });

    // 存在確認
    const kycImage = await this.kycImageRepo.findByIdWithApplication(id);
    if (!kycImage) {
      logger.warn('KYC画像が見つかりません', { id });
      throw new NotFoundError('KYC画像', id);
    }

    // ビジネスルール: 有効期限のみの更新
    if (updateData.expiryDate !== undefined && !updateData.status) {
      const updatedKycImage = await this.kycImageRepo.update(id, {
        expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null,
      });
      logger.info('KYC画像有効期限更新完了', { id });
      return {
        kycImage: updatedKycImage,
        kycStatus: kycImage.application.kycImages.some((img: any) => img.status === 'REJECTED')
          ? 'DEFICIENT'
          : kycImage.application.kycImages.every((img: any) => img.status === 'APPROVED')
          ? 'COMPLETED'
          : 'PENDING',
      };
    }

    // statusが必須
    if (!updateData.status) {
      logger.warn('statusまたはexpiryDateが必要', { id });
      throw new ValidationError('statusまたはexpiryDateが必要です');
    }

    // ビジネスルール: ステータス更新時にreviewedAtを自動設定
    const updatedKycImage = await this.kycImageRepo.update(id, {
      status: updateData.status,
      reviewNote: updateData.reviewNote || null,
      reviewedAt: new Date(),
      ...(updateData.expiryDate !== undefined && {
        expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null,
      }),
    });

    // ビジネスルール: 申込のkycStatusを自動更新
    const allKycImages = kycImage.application.kycImages.map((img: any) =>
      img.id === id ? { ...img, status: updateData.status } : img
    );

    const hasRejected = allKycImages.some((img: any) => img.status === 'REJECTED');
    const allApproved = allKycImages.every((img: any) => img.status === 'APPROVED');

    type KycVerificationStatus = 'PENDING' | 'DEFICIENT' | 'RESUBMIT' | 'COMPLETED';
    let newKycStatus: KycVerificationStatus = 'PENDING';
    if (hasRejected) {
      newKycStatus = 'DEFICIENT';
    } else if (allApproved && allKycImages.length > 0) {
      newKycStatus = 'COMPLETED';
    }

    await this.kycImageRepo.updateApplicationKycStatus(kycImage.application.id, newKycStatus);

    logger.info('KYC画像更新完了', { id, newKycStatus });

    return {
      kycImage: updatedKycImage,
      kycStatus: newKycStatus,
    };
  }
}
