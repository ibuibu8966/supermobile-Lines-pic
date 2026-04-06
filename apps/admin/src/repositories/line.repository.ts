/**
 * Line Repository
 *
 * 回線（ApplicationLine）のデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { LineWithRelations, LineUpdateInput, LineStatus } from '@/entities';
import { logger } from '../shared/utils/logger';

export interface LineFilters {
  search?: string;
  simLocationTagIds?: number[];
  lineReserveTagIds?: number[];
  statuses?: string[];
  includeArchived?: boolean;
  shippedDateRange?: {
    gte?: Date;
    lte?: Date;
  };
  returnedDateRange?: {
    gte?: Date;
    lte?: Date;
  };
}

export class LineRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 回線一覧を取得（フィルタリング・ページネーション対応）
   */
  async findMany(
    filters: LineFilters,
    pagination: { skip: number; take: number }
  ): Promise<{ lines: LineWithRelations[]; total: number }> {
    const where = this.buildWhereClause(filters);

    logger.debug('LineRepository.findMany', { where, pagination });

    const [lines, total] = await Promise.all([
      this.prisma.applicationLine.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              applicationNumber: true,
              isArchived: true,
              archivedAt: true,
              customer: {
                select: {
                  lastName: true,
                  firstName: true,
                  companyName: true,
                  type: true,
                  lastNameKana: true,
                  firstNameKana: true,
                  companyNameKana: true,
                  birthDate: true,
                  postalCode: true,
                  prefecture: true,
                  city: true,
                  address: true,
                  building: true,
                  companyPostalCode: true,
                  companyPrefecture: true,
                  companyCity: true,
                  companyAddress: true,
                  companyBuilding: true,
                  email: true,
                  phone: true,
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              plan: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          sim: {
            select: {
              iccid: true,
              msisdn: true,
              carrierType: true,
              simLocationTag: true,
              simLocationTagId: true,
            },
          },
          lineReserveTag: true,
        },
        orderBy: [
          { application: { createdAt: 'desc' } },
          { lineNumber: 'asc' },
        ],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.applicationLine.count({ where }),
    ]);

    return { lines: lines as unknown as LineWithRelations[], total };
  }

  /**
   * IDから回線を取得
   */
  async findById(id: string): Promise<LineWithRelations | null> {
    logger.debug('LineRepository.findById', { id });

    const line = await this.prisma.applicationLine.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            customer: {
              select: {
                lastName: true,
                firstName: true,
                companyName: true,
                type: true,
              },
            },
          },
        },
        sim: {
          select: {
            iccid: true,
            msisdn: true,
            carrierType: true,
            simLocationTag: true,
            simLocationTagId: true,
          },
        },
        lineReserveTag: true,
      },
    });
    return line as unknown as LineWithRelations | null;
  }

  /**
   * 申込IDと回線IDから回線を取得（詳細表示用）
   */
  async findByApplicationIdAndLineId(applicationId: string, lineId: string): Promise<LineWithRelations | null> {
    logger.debug('LineRepository.findByApplicationIdAndLineId', { applicationId, lineId });

    const line = await this.prisma.applicationLine.findFirst({
      where: {
        id: lineId,
        applicationId: applicationId,
      },
      include: {
        sim: {
          include: {
            simLocationTag: true,
          },
        },
        lineTag: true,
        lineReserveTag: true,
      },
    });
    return line as unknown as LineWithRelations | null;
  }

  /**
   * 回線を更新
   */
  async update(id: string, data: LineUpdateInput): Promise<LineWithRelations> {
    logger.debug('LineRepository.update', { id, data });

    // ステータス自動更新ロジック
    const updateData: LineUpdateInput & { status?: LineStatus } = { ...data };

    if (data.shippedAt !== undefined && data.shippedAt && !data.status) {
      updateData.status = LineStatus.SHIPPED;
    }

    if (data.returnedAt !== undefined && data.returnedAt && !data.status) {
      updateData.status = LineStatus.RETURNED;
    }

    // simLocationTagIdは除外（後で別途SIM更新）
    const { simLocationTagId: _, ...lineUpdateData } = updateData;

    const line = await this.prisma.applicationLine.update({
      where: { id },
      data: lineUpdateData,
      include: {
        application: {
          include: {
            customer: {
              select: {
                lastName: true,
                firstName: true,
                companyName: true,
                type: true,
              },
            },
          },
        },
        sim: {
          select: {
            iccid: true,
            msisdn: true,
            carrierType: true,
            simLocationTag: true,
            simLocationTagId: true,
          },
        },
        lineReserveTag: true,
      },
    });
    return line as unknown as LineWithRelations;
  }

  /**
   * SIMのロケーションタグを更新
   */
  async updateSimLocationTag(
    simId: string,
    simLocationTagId: number | null
  ): Promise<void> {
    logger.debug('LineRepository.updateSimLocationTag', { simId, simLocationTagId });

    await this.prisma.sim.update({
      where: { iccid: simId },
      data: { simLocationTagId },
    });
  }

  /**
   * 回線の存在確認
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.applicationLine.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * 申込IDに紐づく全回線を取得（一覧表示用）
   */
  async findAllByApplicationId(applicationId: string): Promise<LineWithRelations[]> {
    logger.debug('LineRepository.findAllByApplicationId', { applicationId });

    const lines = await this.prisma.applicationLine.findMany({
      where: { applicationId },
      include: {
        sim: {
          include: {
            simLocationTag: true,
          },
        },
        lineTag: true,
        lineReserveTag: true,
      },
      orderBy: { lineNumber: 'asc' },
    });
    return lines as unknown as LineWithRelations[];
  }

  /**
   * 申込に属する回線を複数取得
   */
  async findManyByApplicationId(applicationId: string, lineIds: string[]): Promise<LineWithRelations[]> {
    logger.debug('LineRepository.findManyByApplicationId', { applicationId, lineIds });

    const lines = await this.prisma.applicationLine.findMany({
      where: {
        id: { in: lineIds },
        applicationId,
      },
    });
    return lines as unknown as LineWithRelations[];
  }

  /**
   * 回線を一括更新
   */
  async updateMany(applicationId: string, lineIds: string[], data: Prisma.ApplicationLineUpdateManyMutationInput): Promise<number> {
    logger.debug('LineRepository.updateMany', { applicationId, lineIds, data });

    const result = await this.prisma.applicationLine.updateMany({
      where: {
        id: { in: lineIds },
        applicationId,
      },
      data,
    });

    return result.count;
  }

  /**
   * フィルタ条件からWhere句を構築
   */
  private buildWhereClause(filters: LineFilters): Prisma.ApplicationLineWhereInput {
    const where: Prisma.ApplicationLineWhereInput = {};

    // デフォルトでアーカイブ済み申し込みの回線を除外
    if (!filters.includeArchived) {
      where.application = {
        isArchived: false,
      };
    }

    // Search filter (customer name, company name, phone number, ICCID, MSISDN)
    if (filters.search) {
      where.OR = [
        // ICCID
        { simId: { contains: filters.search, mode: 'insensitive' } },
        // Phone number
        { msisdn: { contains: filters.search, mode: 'insensitive' } },
        // Customer name/company
        {
          application: {
            customer: {
              OR: [
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { companyName: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // SIM location filter (via Sim)
    if (filters.simLocationTagIds && filters.simLocationTagIds.length > 0) {
      where.sim = {
        simLocationTagId: { in: filters.simLocationTagIds },
      };
    }

    // Line reserve tag filter
    if (filters.lineReserveTagIds && filters.lineReserveTagIds.length > 0) {
      where.lineReserveTagId = { in: filters.lineReserveTagIds };
    }

    // Status filter
    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses as $Enums.ApplicationLineStatus[] };
    }

    // Shipped date range
    if (filters.shippedDateRange) {
      where.shippedAt = filters.shippedDateRange;
    }

    // Returned date range
    if (filters.returnedDateRange) {
      where.returnedAt = filters.returnedDateRange;
    }

    return where;
  }
}
