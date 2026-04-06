/**
 * Coupon Service
 *
 * クーポンに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { CouponRepository, CouponFilters } from '../repositories/coupon.repository';
import { CouponWithRelations, CouponCreateInput, CouponUpdateInput } from '@/entities';
import { logger } from '../shared/utils/logger';
import { ConflictError, ValidationError, NotFoundError } from '../shared/errors/custom-errors';

export class CouponService {
  constructor(private couponRepo: CouponRepository) {}

  /**
   * クーポン一覧を取得
   */
  async getCouponList(filters: CouponFilters): Promise<CouponWithRelations[]> {
    logger.info('クーポン一覧取得開始', { filters });

    const coupons = await this.couponRepo.findMany(filters);

    logger.info('クーポン一覧取得完了', { count: coupons.length });

    return coupons;
  }

  /**
   * クーポンを作成
   * ビジネスルール:
   * - コード重複チェック
   * - プラン存在チェック
   * - 日付を当日の開始/終了時刻に正規化
   */
  async createCoupon(input: CouponCreateInput): Promise<CouponWithRelations> {
    logger.info('クーポン作成開始', { code: input.code, planId: input.planId });

    // ビジネスルール: コード重複チェック
    const codeExists = await this.couponRepo.existsByCode(input.code);
    if (codeExists) {
      logger.warn('コード重複エラー', { code: input.code });
      throw new ConflictError('このクーポンコードは既に使用されています');
    }

    // ビジネスルール: プラン存在チェック
    const planExists = await this.couponRepo.planExists(input.planId);
    if (!planExists) {
      logger.warn('プラン存在エラー', { planId: input.planId });
      throw new ValidationError('指定されたプランが見つかりません');
    }

    // ビジネスルール: 日付を当日の開始/終了時刻に設定
    const validFrom = new Date(input.validFrom);
    validFrom.setHours(0, 0, 0, 0);

    const validUntil = new Date(input.validUntil);
    validUntil.setHours(23, 59, 59, 999);

    const coupon = await this.couponRepo.create({
      ...input,
      validFrom,
      validUntil,
      pricings: input.pricings,
    });

    logger.info('クーポン作成完了', { couponId: coupon.id, code: coupon.code });

    return coupon;
  }

  /**
   * クーポンIDからクーポンを取得
   */
  async getCouponById(id: string): Promise<CouponWithRelations | null> {
    logger.info('クーポン詳細取得', { couponId: id });

    const coupon = await this.couponRepo.findById(id);

    if (!coupon) {
      logger.warn('クーポンが見つかりません', { couponId: id });
      return null;
    }

    logger.debug('クーポン詳細取得完了', { couponId: id });

    return coupon;
  }

  /**
   * コードからクーポンを取得
   */
  async getCouponByCode(code: string): Promise<CouponWithRelations | null> {
    logger.info('クーポン検索（コード）', { code });

    return await this.couponRepo.findByCode(code);
  }

  /**
   * クーポンを更新
   * ビジネスルール:
   * - コード重複チェック（自分以外）
   * - 日付を当日の開始/終了時刻に正規化
   */
  async updateCoupon(id: string, input: CouponUpdateInput): Promise<CouponWithRelations> {
    logger.info('クーポン更新開始', { couponId: id, input });

    // 存在確認
    const existing = await this.couponRepo.findById(id);
    if (!existing) {
      logger.warn('クーポンが見つかりません', { couponId: id });
      throw new NotFoundError('クーポン', id);
    }

    // ビジネスルール: コード重複チェック（自分以外）
    if (input.code) {
      const duplicate = await this.couponRepo.findByCodeExcept(input.code, id);
      if (duplicate) {
        logger.warn('コード重複エラー', { code: input.code });
        throw new ConflictError('このクーポンコードは既に使用されています');
      }
    }

    // データ整形
    const updateData: {
      code?: string;
      planId?: string;
      unitPrice?: number | null;
      description?: string | null;
      maxUsages?: number | null;
      validFrom?: Date;
      validUntil?: Date;
      isActive?: boolean;
    } = {};
    if (input.code !== undefined) updateData.code = input.code;
    if (input.planId !== undefined) updateData.planId = input.planId;
    if (input.unitPrice !== undefined) updateData.unitPrice = input.unitPrice;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.maxUsages !== undefined) updateData.maxUsages = input.maxUsages;

    // ビジネスルール: 日付を当日の開始/終了時刻に設定
    if (input.validFrom !== undefined) {
      const validFrom = new Date(input.validFrom);
      validFrom.setHours(0, 0, 0, 0);
      updateData.validFrom = validFrom;
    }
    if (input.validUntil !== undefined) {
      const validUntil = new Date(input.validUntil);
      validUntil.setHours(23, 59, 59, 999);
      updateData.validUntil = validUntil;
    }

    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const coupon = await this.couponRepo.update(id, updateData);

    // pricingsが送られてきた場合、削除→再作成
    if (input.pricings !== undefined) {
      await this.couponRepo.replacePricings(id, input.pricings);
      // 最新のデータを返す
      const updated = await this.couponRepo.findById(id);
      if (updated) {
        logger.info('クーポン更新完了（pricings含む）', { couponId: id });
        return updated;
      }
    }

    logger.info('クーポン更新完了', { couponId: id });

    return coupon;
  }

  /**
   * クーポンを削除
   * ビジネスルール:
   * - 使用済みクーポンは論理削除（無効化）
   * - 未使用クーポンは物理削除
   */
  async deleteCoupon(id: string): Promise<{ deleted: boolean; message: string }> {
    logger.info('クーポン削除開始', { couponId: id });

    // 存在確認と使用状況取得
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) {
      logger.warn('クーポンが見つかりません', { couponId: id });
      throw new NotFoundError('クーポン', id);
    }

    // ビジネスルール: 使用済みクーポンは無効化のみ
    if (coupon._count && coupon._count.applications > 0) {
      await this.couponRepo.deactivate(id);
      logger.info('クーポン無効化完了', { couponId: id });
      return { deleted: false, message: 'クーポンを無効化しました' };
    }

    // ビジネスルール: 未使用クーポンは物理削除
    await this.couponRepo.delete(id);
    logger.info('クーポン削除完了', { couponId: id });
    return { deleted: true, message: 'クーポンを削除しました' };
  }
}
