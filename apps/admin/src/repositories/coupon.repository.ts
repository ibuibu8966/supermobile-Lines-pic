/**
 * Coupon Repository
 *
 * クーポンのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { CouponWithRelations, CouponCreateInput, CouponPricingInput } from '@/entities';
import { logger } from '../shared/utils/logger';

export interface CouponFilters {
  includeInactive?: boolean;
}

export class CouponRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * クーポン一覧を取得
   */
  async findMany(filters: CouponFilters): Promise<CouponWithRelations[]> {
    const where = filters.includeInactive ? {} : { isActive: true };

    logger.debug('CouponRepository.findMany', { where });

    const coupons = await this.prisma.coupon.findMany({
      where,
      include: {
        pricings: { orderBy: { minQuantity: 'asc' } },
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
    return coupons as unknown as CouponWithRelations[];
  }

  /**
   * コードからクーポンを取得
   */
  async findByCode(code: string): Promise<CouponWithRelations | null> {
    logger.debug('CouponRepository.findByCode', { code });

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: {
        pricings: { orderBy: { minQuantity: 'asc' } },
        plan: {
          include: {
            service: true,
          },
        },
      },
    });
    return coupon as unknown as CouponWithRelations | null;
  }

  /**
   * IDからクーポンを取得
   */
  async findById(id: string): Promise<CouponWithRelations | null> {
    logger.debug('CouponRepository.findById', { id });

    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        pricings: { orderBy: { minQuantity: 'asc' } },
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
    return coupon as unknown as CouponWithRelations | null;
  }

  /**
   * クーポンを作成
   */
  async create(data: CouponCreateInput): Promise<CouponWithRelations> {
    logger.debug('CouponRepository.create', { code: data.code, planId: data.planId });

    const coupon = await this.prisma.coupon.create({
      data: {
        code: data.code,
        planId: data.planId,
        unitPrice: data.unitPrice ?? null,
        description: data.description ?? null,
        maxUsages: data.maxUsages ?? null,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: data.isActive ?? true,
        ...(data.pricings && data.pricings.length > 0 ? {
          pricings: {
            create: data.pricings.map((p) => ({
              minQuantity: p.minQuantity,
              maxQuantity: p.maxQuantity,
              unitPrice: p.unitPrice,
            })),
          },
        } : {}),
      },
      include: {
        pricings: { orderBy: { minQuantity: 'asc' } },
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
    return coupon as unknown as CouponWithRelations;
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

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code,
        id: { not: excludeId },
      },
    });
    return coupon as unknown as CouponWithRelations | null;
  }

  /**
   * クーポンを更新
   */
  async update(id: string, data: Prisma.CouponUpdateInput): Promise<CouponWithRelations> {
    logger.debug('CouponRepository.update', { id, data });

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data,
      include: {
        pricings: { orderBy: { minQuantity: 'asc' } },
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
    return coupon as unknown as CouponWithRelations;
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

  /**
   * クーポンのpricingsを全削除して再作成（トランザクション内で使用）
   */
  async replacePricings(couponId: string, pricings: CouponPricingInput[]): Promise<void> {
    logger.debug('CouponRepository.replacePricings', { couponId, count: pricings.length });

    await this.prisma.$transaction([
      this.prisma.couponPricing.deleteMany({ where: { couponId } }),
      ...pricings.map((p) =>
        this.prisma.couponPricing.create({
          data: {
            couponId,
            minQuantity: p.minQuantity,
            maxQuantity: p.maxQuantity,
            unitPrice: p.unitPrice,
          },
        })
      ),
    ]);
  }
}
