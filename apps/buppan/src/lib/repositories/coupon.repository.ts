/**
 * Coupon Repository
 *
 * クーポンのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { CouponWithRelations, CouponCreateInput } from '@/lib/entities';
import { logger } from '../shared/utils/logger';

export interface CouponFilters {
  includeInactive?: boolean;
}

export class CouponRepository {
  constructor(private prisma: any) {}

  /**
   * クーポン一覧を取得
   */
  async findMany(filters: CouponFilters): Promise<CouponWithRelations[]> {
    const where = filters.includeInactive ? {} : { isActive: true };

    logger.debug('CouponRepository.findMany', { where });

    return await this.prisma.coupon.findMany({
      where,
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * コードからクーポンを取得
   */
  async findByCode(code: string): Promise<CouponWithRelations | null> {
    logger.debug('CouponRepository.findByCode', { code });

    return await this.prisma.coupon.findUnique({
      where: { code },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
      },
    });
  }

  /**
   * IDからクーポンを取得
   */
  async findById(id: string): Promise<CouponWithRelations | null> {
    logger.debug('CouponRepository.findById', { id });

    return await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });
  }

  /**
   * クーポンを作成
   */
  async create(data: CouponCreateInput): Promise<CouponWithRelations> {
    logger.debug('CouponRepository.create', { code: data.code, planId: data.planId });

    return await this.prisma.coupon.create({
      data: {
        code: data.code,
        planId: data.planId,
        unitPrice: data.unitPrice,
        description: data.description ?? null,
        maxUsages: data.maxUsages ?? null,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: data.isActive ?? true,
      },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });
  }

  /**
   * クーポンの存在確認（コード）
   */
  async existsByCode(code: string): Promise<boolean> {
    const count = await this.prisma.coupon.count({
      where: { code },
    });
    return count > 0;
  }

  /**
   * クーポンの存在確認（ID）
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.coupon.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * プランの存在確認
   */
  async planExists(planId: string): Promise<boolean> {
    const count = await this.prisma.plan.count({
      where: { id: planId },
    });
    return count > 0;
  }

  /**
   * コード重複チェック（自分以外）
   */
  async findByCodeExcept(code: string, excludeId: string): Promise<CouponWithRelations | null> {
    logger.debug('CouponRepository.findByCodeExcept', { code, excludeId });

    return await this.prisma.coupon.findFirst({
      where: {
        code,
        id: { not: excludeId },
      },
    });
  }

  /**
   * クーポンを更新
   */
  async update(id: string, data: any): Promise<CouponWithRelations> {
    logger.debug('CouponRepository.update', { id, data });

    return await this.prisma.coupon.update({
      where: { id },
      data,
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });
  }

  /**
   * クーポンを無効化
   */
  async deactivate(id: string): Promise<void> {
    logger.debug('CouponRepository.deactivate', { id });

    await this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * クーポンを削除
   */
  async delete(id: string): Promise<void> {
    logger.debug('CouponRepository.delete', { id });

    await this.prisma.coupon.delete({
      where: { id },
    });
  }
}
