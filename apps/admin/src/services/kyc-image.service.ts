/**
 * KYC Image Service
 *
 * KYC画像に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { KycImageRepository } from '../repositories/kyc-image.repository';
import { KycImageUpdateInput, KycImageUpdateResult } from '@/entities';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

interface KycImageEntry {
  id: string;
  status: string;
}

type KycVerificationStatus = 'PENDING' | 'DEFICIENT' | 'RESUBMIT' | 'COMPLETED';

export class KycImageService {
  constructor(private kycImageRepo: KycImageRepository) {}

  /**
   * 申込のKYC画像の有効期限を一括更新
   * kycImagesが空の場合は前回の申込からコピーしてから更新（既存データ対応）
   */
  async updateExpiryByApplicationId(
    applicationId: string,
    expiryDate: string | null
  ): Promise<{ count: number; latestExpiryDate: Date | null }> {
    logger.info('KYC有効期限一括更新開始', { applicationId, expiryDate });

    const parsedDate = expiryDate ? new Date(expiryDate) : null;

    // kycImagesが空なら前回の申込からコピー（既存データ対応）
    await this.kycImageRepo.copyFromPreviousIfEmpty(applicationId);

    const count = await this.kycImageRepo.updateExpiryByApplicationId(applicationId, parsedDate);

    logger.info('KYC有効期限一括更新完了', { applicationId, count, expiryDate });

    return { count, latestExpiryDate: parsedDate };
  }

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

    // 有効期限のみの更新
    if (updateData.expiryDate !== undefined && !updateData.status) {
      const updatedKycImage = await this.kycImageRepo.update(id, {
        expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null,
      });
      logger.info('KYC画像有効期限更新完了', { id });
      return {
        kycImage: updatedKycImage,
        kycStatus: this.deriveKycStatus(kycImage.application.kycImages),
      };
    }

    // statusが必須
    if (!updateData.status) {
      logger.warn('statusまたはexpiryDateが必要', { id });
      throw new ValidationError('statusまたはexpiryDateが必要です');
    }

    // ステータス更新時にreviewedAtを自動設定
    const updatedKycImage = await this.kycImageRepo.update(id, {
      status: updateData.status,
      reviewNote: updateData.reviewNote || null,
      reviewedAt: new Date(),
      ...(updateData.expiryDate !== undefined && {
        expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null,
      }),
    });

    // 申込のkycStatusを自動更新（今回の変更を反映した状態で判定）
    const allKycImages: KycImageEntry[] = kycImage.application.kycImages.map((img) => ({
      id: img.id,
      status: img.id === id ? (updateData.status ?? img.status) : img.status,
    }));

    const newKycStatus = this.deriveKycStatus(allKycImages);
    await this.kycImageRepo.updateApplicationKycStatus(kycImage.application.id, newKycStatus);

    logger.info('KYC画像更新完了', { id, newKycStatus });

    return {
      kycImage: updatedKycImage,
      kycStatus: newKycStatus,
    };
  }

  /**
   * KYC画像一覧からkycStatusを導出
   */
  private deriveKycStatus(kycImages: KycImageEntry[]): KycVerificationStatus {
    if (kycImages.some((img) => img.status === 'REJECTED')) return 'DEFICIENT';
    if (kycImages.length > 0 && kycImages.every((img) => img.status === 'APPROVED')) return 'COMPLETED';
    return 'PENDING';
  }
}
