/**
 * Service Repository
 *
 * サービスのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { ServiceWithRelations, ServiceCreateInput } from '@/lib/entities';
import { logger } from '../shared/utils/logger';

export interface ServiceFilters {
  includeInactive?: boolean;
}

export class ServiceRepository {
  constructor(private prisma: any) {}

  /**
   * サービス一覧を取得（プランを含む）
   */
  async findMany(filters: ServiceFilters): Promise<ServiceWithRelations[]> {
    const where = filters.includeInactive ? {} : { isActive: true };

    logger.debug('ServiceRepository.findMany', { where });

    return await this.prisma.service.findMany({
      where,
      include: {
        _count: {
          select: {
            plans: true,
            applications: true,
            users: true,
          },
        },
        plans: {
          where: { isActive: true },
          include: {
            usageTags: {
              include: {
                usageTag: true,
              },
            },
            pricings: {
              orderBy: { minQuantity: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * コードからサービスを取得
   */
  async findByCode(code: string): Promise<ServiceWithRelations | null> {
    logger.debug('ServiceRepository.findByCode', { code });

    return await this.prisma.service.findUnique({
      where: { code },
      include: {
        plans: {
          where: { isActive: true },
        },
      },
    });
  }

  /**
   * IDからサービスを取得
   */
  async findById(id: string): Promise<ServiceWithRelations | null> {
    logger.debug('ServiceRepository.findById', { id });

    return await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            plans: true,
            applications: true,
            users: true,
          },
        },
        plans: true,
      },
    });
  }

  /**
   * IDからサービスを取得（詳細版：プラン詳細含む）
   */
  async findByIdWithDetails(id: string): Promise<any> {
    logger.debug('ServiceRepository.findByIdWithDetails', { id });

    return await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            plans: true,
            applications: true,
            users: true,
          },
        },
        plans: {
          include: {
            usageTags: {
              include: {
                usageTag: true,
              },
            },
            pricings: {
              orderBy: { minQuantity: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * サービスを作成
   */
  async create(data: ServiceCreateInput): Promise<ServiceWithRelations> {
    logger.debug('ServiceRepository.create', { code: data.code, name: data.name });

    return await this.prisma.service.create({
      data: {
        code: data.code,
        name: data.name,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * サービスの存在確認（コード）
   */
  async existsByCode(code: string): Promise<boolean> {
    const count = await this.prisma.service.count({
      where: { code },
    });
    return count > 0;
  }

  /**
   * サービスの存在確認（ID）
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.service.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * サービスを更新
   */
  async update(id: string, data: any): Promise<any> {
    logger.debug('ServiceRepository.update', { id, data });

    return await this.prisma.service.update({
      where: { id },
      data,
    });
  }

  /**
   * サービスを削除
   */
  async delete(id: string): Promise<void> {
    logger.debug('ServiceRepository.delete', { id });

    await this.prisma.service.delete({
      where: { id },
    });
  }

  /**
   * サービスを無効化（論理削除）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug('ServiceRepository.deactivate', { id });

    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * コードの重複チェック（自分以外）
   */
  async findByCodeExcept(code: string, excludeId: string): Promise<any> {
    logger.debug('ServiceRepository.findByCodeExcept', { code, excludeId });

    return await this.prisma.service.findFirst({
      where: {
        code,
        id: { not: excludeId },
      },
    });
  }
}
