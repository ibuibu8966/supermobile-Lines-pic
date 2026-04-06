/**
 * Plan Repository
 *
 * プランのデータアクセス層
 * Prismaを使ってデータベース操作のみを担当
 */

import { PrismaClient } from '@prisma/client';
import { PlanWithRelations, PlanUpdateInput } from '@/lib/entities';
import { logger } from '../shared/utils/logger';

export interface PlanFilters {
  includeInactive?: boolean;
  serviceId?: string;
}

export class PlanRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * プラン一覧を取得
   */
  async findMany(filters: PlanFilters): Promise<PlanWithRelations[]> {
    logger.debug('PlanRepository.findMany', { filters });

    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) {
      where.isActive = true;
    }
    if (filters.serviceId) {
      where.serviceId = filters.serviceId;
    }

    return await this.prisma.plan.findMany({
      where,
      include: {
        service: true,
        usageTags: {
          include: {
            usageTag: true,
          },
        },
        pricings: {
          orderBy: { minQuantity: 'asc' },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: [{ service: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  /**
   * IDでプランを取得
   */
  async findById(id: string): Promise<PlanWithRelations | null> {
    logger.debug('PlanRepository.findById', { id });

    return await this.prisma.plan.findUnique({
      where: { id },
      include: {
        service: true,
        usageTags: {
          include: {
            usageTag: true,
          },
        },
        pricings: {
          orderBy: { minQuantity: 'asc' },
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
   * プランを更新（基本情報のみ）
   */
  async update(id: string, data: Partial<PlanUpdateInput>): Promise<void> {
    logger.debug('PlanRepository.update', { id, data });

    await this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  /**
   * サービス内でコードの重複チェック
   */
  async findByCodeInService(
    serviceId: string,
    code: string,
    excludeId?: string
  ): Promise<PlanWithRelations | null> {
    logger.debug('PlanRepository.findByCodeInService', {
      serviceId,
      code,
      excludeId,
    });

    return await this.prisma.plan.findFirst({
      where: {
        serviceId,
        code,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });
  }

  /**
   * プランを削除
   */
  async delete(id: string): Promise<void> {
    logger.debug('PlanRepository.delete', { id });

    await this.prisma.plan.delete({
      where: { id },
    });
  }

  /**
   * プランを無効化（論理削除）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug('PlanRepository.deactivate', { id });

    await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * 用途タグを全削除
   */
  async deleteAllUsageTags(planId: string): Promise<void> {
    logger.debug('PlanRepository.deleteAllUsageTags', { planId });

    await this.prisma.planUsageTag.deleteMany({
      where: { planId },
    });
  }

  /**
   * 用途タグを一括作成
   */
  async createUsageTags(planId: string, usageTagIds: number[]): Promise<void> {
    logger.debug('PlanRepository.createUsageTags', { planId, count: usageTagIds.length });

    await this.prisma.planUsageTag.createMany({
      data: usageTagIds.map((usageTagId) => ({
        planId,
        usageTagId,
      })),
    });
  }

  /**
   * 料金を全削除
   */
  async deleteAllPricings(planId: string): Promise<void> {
    logger.debug('PlanRepository.deleteAllPricings', { planId });

    await this.prisma.planPricing.deleteMany({
      where: { planId },
    });
  }

  /**
   * 料金を一括作成
   */
  async createPricings(
    planId: string,
    pricings: Array<{
      minQuantity: number;
      maxQuantity?: number | null;
      unitPrice: number;
      description?: string | null;
    }>
  ): Promise<void> {
    logger.debug('PlanRepository.createPricings', { planId, count: pricings.length });

    await this.prisma.planPricing.createMany({
      data: pricings.map((p) => ({
        planId,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity ?? null,
        unitPrice: p.unitPrice,
        description: p.description ?? null,
      })),
    });
  }

  /**
   * プランを作成
   */
  async create(data: any): Promise<PlanWithRelations> {
    logger.debug('PlanRepository.create', { data });

    return await this.prisma.plan.create({
      data,
      include: {
        service: true,
        usageTags: {
          include: {
            usageTag: true,
          },
        },
        pricings: true,
      },
    });
  }
}
