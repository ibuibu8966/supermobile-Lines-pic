/**
 * Application Repository
 *
 * 申込データアクセス層
 * Prismaクエリのみを担当し、ビジネスロジックは含まない
 */

import { Prisma } from '@prisma/client';
import {
  ApplicationEntity,
  ApplicationWithRelations,
  ApplicationCreateInput,
  ApplicationUpdateInput,
} from '@/lib/entities';
import { NotFoundError } from '../shared/errors/custom-errors';

export interface ApplicationFilters {
  search?: string;
  status?: string;
  serviceId?: string;
  customerType?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

export class ApplicationRepository {
  constructor(private prisma: any) {} // PrismaClientの型は実行時に注入

  /**
   * フィルタ条件からWhereクエリを構築
   */
  private buildWhereClause(
    filters: ApplicationFilters,
    scopedServiceId?: string | null
  ): Prisma.ApplicationWhereInput {
    const where: Prisma.ApplicationWhereInput = {};

    // アーカイブフィルタリング
    if (filters.archivedOnly) {
      where.isArchived = true;
    } else if (!filters.includeArchived) {
      where.isArchived = false;
    }

    // 検索フィルタ
    if (filters.search) {
      where.OR = [
        { applicationNumber: { contains: filters.search } },
        { customer: { email: { contains: filters.search } } },
        { customer: { phone: { contains: filters.search } } },
        { customer: { lastName: { contains: filters.search } } },
        { customer: { firstName: { contains: filters.search } } },
        { customer: { companyName: { contains: filters.search } } },
      ];
    }

    // ステータスフィルタ
    if (filters.status) {
      where.status = filters.status;
    }

    // サービススコープ（ADMIN権限の場合）
    const effectiveServiceId = scopedServiceId || filters.serviceId;
    if (effectiveServiceId) {
      where.serviceId = effectiveServiceId;
    }

    // 顧客タイプフィルタ
    if (filters.customerType) {
      where.customer = {
        ...((where.customer as Record<string, unknown>) || {}),
        type: filters.customerType,
      };
    }

    return where;
  }

  /**
   * ページネーション付きで申込一覧を取得
   */
  async findMany(
    filters: ApplicationFilters,
    pagination: { skip: number; take: number },
    scopedServiceId?: string | null
  ): Promise<{ applications: ApplicationWithRelations[]; total: number }> {
    const where = this.buildWhereClause(filters, scopedServiceId);

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        select: {
          id: true,
          applicationNumber: true,
          status: true,
          kycStatus: true,
          paymentStatus: true,
          addressStatus: true,
          lineCount: true,
          unitPrice: true,
          totalAmount: true,
          comment1: true,
          comment2: true,
          isArchived: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              type: true,
              lastName: true,
              firstName: true,
              lastNameKana: true,
              firstNameKana: true,
              companyName: true,
              companyNameKana: true,
              email: true,
              phone: true,
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
            },
          },
          service: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          lines: {
            select: {
              id: true,
              lineNumber: true,
              status: true,
              shippedAt: true,
              returnedAt: true,
            },
          },
          kycImages: {
            select: {
              id: true,
              type: true,
              storagePath: true,
              status: true,
              expiryDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { applications, total };
  }

  /**
   * IDで申込を取得
   */
  async findById(id: string): Promise<ApplicationWithRelations | null> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        customer: true,
        service: true,
        plan: true,
        lines: {
          include: {
            sim: {
              include: {
                simLocationTag: true,
              },
            },
            lineTag: true,
            lineReserveTag: true,
          },
          orderBy: {
            lineNumber: 'asc',
          },
        },
        kycImages: true,
      },
    });

    return application;
  }

  /**
   * 申込を作成
   */
  async create(data: ApplicationCreateInput): Promise<ApplicationEntity> {
    const application = await this.prisma.application.create({
      data,
    });

    return application;
  }

  /**
   * 申込を更新
   */
  async update(id: string, data: ApplicationUpdateInput): Promise<ApplicationEntity> {
    // アーカイブ時にarchivedAtを自動設定
    const updateData: typeof data & { archivedAt?: Date | null } = { ...data };
    if (data.isArchived === true) {
      updateData.archivedAt = new Date();
    } else if (data.isArchived === false) {
      updateData.archivedAt = null;
    }

    const application = await this.prisma.application.update({
      where: { id },
      data: updateData,
    });

    return application;
  }

  /**
   * 申込を削除
   */
  async delete(id: string): Promise<void> {
    await this.prisma.application.delete({
      where: { id },
    });
  }

  /**
   * 申込の存在確認
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.application.count({
      where: { id },
    });

    return count > 0;
  }

  /**
   * 顧客IDから申込一覧を取得（申込順序計算用）
   */
  async findByCustomerIds(customerIds: string[]): Promise<Array<{ id: string; customerId: string; createdAt: Date }>> {
    return await this.prisma.application.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true, customerId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
