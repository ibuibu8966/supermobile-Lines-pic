/**
 * Sim Repository
 *
 * SIMカードのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { SimWithRelations } from '@/lib/entities';
import { logger } from '../shared/utils/logger';

export interface SimFilters {
  search?: string;
  status?: string;
  carrier?: string;
  supplierId?: number;
  simLocationTagId?: number;
}

export class SimRepository {
  constructor(private prisma: any) {}

  /**
   * SIM一覧を取得（フィルタリング・ページネーション対応）
   */
  async findMany(
    filters: SimFilters,
    pagination: { skip: number; take: number }
  ): Promise<{ sims: SimWithRelations[]; total: number }> {
    const where = this.buildWhereClause(filters);

    logger.debug('SimRepository.findMany', { where, pagination });

    const [sims, total] = await Promise.all([
      this.prisma.sim.findMany({
        where,
        include: {
          supplier: true,
          simLocationTag: true,
          contracts: {
            include: {
              usageTags: {
                include: {
                  usageTag: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  lastName: true,
                  firstName: true,
                  companyName: true,
                  type: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          applicationLines: {
            select: {
              id: true,
              application: {
                select: {
                  id: true,
                  applicationNumber: true,
                  isArchived: true,
                  archivedAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.sim.count({ where }),
    ]);

    return { sims, total };
  }

  /**
   * 消費済みタグ情報を取得
   */
  async findUsageTagsByIds(tagIds: number[]): Promise<Array<{ id: number; name: string }>> {
    if (tagIds.length === 0) return [];

    logger.debug('SimRepository.findUsageTagsByIds', { tagIds });

    return await this.prisma.usageTag.findMany({
      where: { id: { in: tagIds } },
    });
  }

  /**
   * ICCIDからSIMを取得
   */
  async findByIccid(iccid: string): Promise<SimWithRelations | null> {
    logger.debug('SimRepository.findByIccid', { iccid });

    return await this.prisma.sim.findUnique({
      where: { iccid },
      include: {
        supplier: true,
        simLocationTag: true,
        contracts: {
          include: {
            usageTags: {
              include: {
                usageTag: true,
              },
            },
            customer: true,
          },
        },
        applicationLines: {
          include: {
            application: true,
          },
        },
      },
    });
  }

  /**
   * SIMを更新
   */
  async update(iccid: string, data: any): Promise<SimWithRelations> {
    logger.debug('SimRepository.update', { iccid, data });

    return await this.prisma.sim.update({
      where: { iccid },
      data,
      include: {
        supplier: true,
        simLocationTag: true,
        contracts: {
          include: {
            usageTags: {
              include: {
                usageTag: true,
              },
            },
            customer: true,
          },
        },
        applicationLines: {
          include: {
            application: true,
          },
        },
      },
    });
  }

  /**
   * SIMの存在確認
   */
  async exists(iccid: string): Promise<boolean> {
    const count = await this.prisma.sim.count({
      where: { iccid },
    });
    return count > 0;
  }

  /**
   * フィルタ条件からWhere句を構築
   */
  private buildWhereClause(filters: SimFilters): any {
    const where: any = {};

    // Search filter (ICCID, MSISDN)
    if (filters.search) {
      where.OR = [
        { iccid: { contains: filters.search } },
        { msisdn: { contains: filters.search } },
      ];
    }

    // Status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Carrier filter
    if (filters.carrier) {
      where.carrierType = filters.carrier;
    }

    // Supplier filter
    if (filters.supplierId !== undefined) {
      where.supplierId = filters.supplierId;
    }

    // SIM location tag filter
    if (filters.simLocationTagId !== undefined) {
      where.simLocationTagId = filters.simLocationTagId;
    }

    return where;
  }
}
