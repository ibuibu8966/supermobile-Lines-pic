/**
 * Application Repository
 *
 * 申込データアクセス層
 * Prismaクエリのみを担当し、ビジネスロジックは含まない
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import {
  ApplicationEntity,
  ApplicationWithRelations,
  ApplicationCreateInput,
  ApplicationUpdateInput,
} from '@/entities';
import { NotFoundError } from '../shared/errors/custom-errors';

export interface ApplicationFilters {
  search?: string;
  status?: string;
  serviceId?: string;
  customerType?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  addressStatus?: string;
  addressStatusNot?: string;
  addressStatusNull?: boolean;
  kycStatus?: string;
  kycStatusNull?: boolean;
  paymentStatus?: string;
  paymentStatusNull?: boolean;
  inoueCheck?: string;
  inoueCheckNot?: string;
  inoueCheckNull?: boolean;
  assignedUserId?: string;
  assignedUserNull?: boolean;
  hideFullyCompleted?: boolean;
}

export class ApplicationRepository {
  constructor(private prisma: PrismaClient) {}

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
      where.status = filters.status as $Enums.ApplicationStatus;
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
        type: filters.customerType as $Enums.CustomerType,
      };
    }

    // 本人確認フィルタ
    if (filters.kycStatus) {
      where.kycStatus = filters.kycStatus as $Enums.KycVerificationStatus;
    } else if (filters.kycStatusNull) {
      where.kycStatus = null;
    }

    // 決済確認フィルタ
    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus as $Enums.PaymentStatus;
    } else if (filters.paymentStatusNull) {
      where.paymentStatus = null;
    }

    // 住所確認フィルタ
    if (filters.addressStatus) {
      where.addressStatus = filters.addressStatus as $Enums.KycVerificationStatus;
    } else if (filters.addressStatusNot) {
      where.addressStatus = { not: filters.addressStatusNot as $Enums.KycVerificationStatus };
    } else if (filters.addressStatusNull) {
      where.addressStatus = null;
    }

    // 井上確認フィルタ
    if (filters.inoueCheck) {
      where.inoueCheck = filters.inoueCheck;
    } else if (filters.inoueCheckNot) {
      where.inoueCheck = { not: filters.inoueCheckNot };
    } else if (filters.inoueCheckNull) {
      where.inoueCheck = null;
    }

    // 担当者フィルタ
    if (filters.assignedUserId) {
      where.assignedUserId = filters.assignedUserId;
    } else if (filters.assignedUserNull) {
      where.assignedUserId = null;
    }

    // 完了案件の非表示（井上確認=完了の案件のみ非表示）
    if (filters.hideFullyCompleted) {
      where.OR = [
        { inoueCheck: { not: 'COMPLETED' } },
        { inoueCheck: null },
      ];
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
          serviceId: true,
          planId: true,
          customerId: true,
          status: true,
          kycStatus: true,
          paymentStatus: true,
          addressStatus: true,
          lineCount: true,
          unitPrice: true,
          totalAmount: true,
          note: true,
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
              status: true,
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
          noReferral: true,
          invoicePdfPath: true,
          invoiceUrl: true,
          invoiceEmailPath: true,
          paymentImagePath: true,
          shippingImagePath: true,
          referrals: {
            select: {
              id: true,
              referrerName: true,
              fee: true,
            },
          },
          trackings: {
            select: {
              id: true,
              carrier: true,
              trackingNumber: true,
            },
          },
          inoueCheck: true,
          assignedUserId: true,
          assignedUser: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              comments: true,
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

    return { applications: applications as unknown as ApplicationWithRelations[], total };
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
              select: {
                iccid: true,
                msisdn: true,
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
        referrals: {
          orderBy: { createdAt: 'asc' },
        },
        trackings: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return application as unknown as ApplicationWithRelations | null;
  }

  /**
   * 申込を作成
   */
  async create(data: ApplicationCreateInput): Promise<ApplicationEntity> {
    const application = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data,
      });

      // クーポン適用時にusageCountをインクリメント
      if (data.couponId) {
        await tx.coupon.update({
          where: { id: data.couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      return created;
    });

    return application as unknown as ApplicationEntity;
  }

  /**
   * 申込を更新
   */
  async update(id: string, data: ApplicationUpdateInput): Promise<ApplicationEntity> {
    // アーカイブ時にarchivedAtを自動設定
    const updateData: typeof data & { archivedAt?: Date | null; totalAmount?: number } = { ...data };
    if (data.isArchived === true) {
      updateData.archivedAt = new Date();
    } else if (data.isArchived === false) {
      updateData.archivedAt = null;
    }

    // クーポン削除時（couponId=null）にプラン本来の単価を復元
    if (data.couponId === null && !data.planId) {
      const current = await this.prisma.application.findUnique({
        where: { id },
        select: { planId: true, lineCount: true, couponId: true },
      });
      if (current && current.couponId) {
        const pricing = await this.prisma.planPricing.findFirst({
          where: {
            planId: current.planId,
            minQuantity: { lte: current.lineCount },
            OR: [
              { maxQuantity: { gte: current.lineCount } },
              { maxQuantity: null },
            ],
          },
          orderBy: { minQuantity: 'desc' },
        });
        if (pricing) {
          updateData.unitPrice = pricing.unitPrice;
          updateData.totalAmount = current.lineCount * pricing.unitPrice;
        }
      }
    }

    // planId が変更された場合、PlanPricingから単価を自動取得して再計算
    if (data.planId) {
      const current = await this.prisma.application.findUnique({
        where: { id },
        select: { lineCount: true },
      });
      if (current) {
        const pricing = await this.prisma.planPricing.findFirst({
          where: {
            planId: data.planId,
            minQuantity: { lte: current.lineCount },
            OR: [
              { maxQuantity: { gte: current.lineCount } },
              { maxQuantity: null },
            ],
          },
          orderBy: { minQuantity: 'desc' },
        });
        if (pricing) {
          updateData.unitPrice = pricing.unitPrice;
          updateData.totalAmount = current.lineCount * pricing.unitPrice;
        }
      }
    }

    // lineCount または unitPrice が変更された場合、totalAmount を再計算
    if (data.lineCount !== undefined || data.unitPrice !== undefined) {
      const current = await this.prisma.application.findUnique({
        where: { id },
        select: { lineCount: true, unitPrice: true },
      });
      if (current) {
        const newLineCount = data.lineCount ?? current.lineCount;
        const newUnitPrice = data.unitPrice ?? current.unitPrice;
        updateData.totalAmount = newLineCount * newUnitPrice;
      }
    }

    // lineCount が変更された場合、ApplicationLineも調整
    if (data.lineCount !== undefined) {
      const currentLines = await this.prisma.applicationLine.findMany({
        where: { applicationId: id },
        orderBy: { lineNumber: 'asc' },
      });
      const currentCount = currentLines.length;
      const newCount = data.lineCount;
      const assignedCount = currentLines.filter(l => l.simId !== null).length;

      if (newCount < assignedCount) {
        throw new Error(`SIM割当済みの回線が${assignedCount}件あるため、${assignedCount}回線未満には変更できません`);
      }

      if (newCount > currentCount) {
        // 増加: 新しい行を追加
        const newLines = Array.from({ length: newCount - currentCount }, (_, i) => ({
          applicationId: id,
          lineNumber: currentCount + i + 1,
          status: 'NOT_ACTIVATED' as const,
        }));
        await this.prisma.applicationLine.createMany({ data: newLines });
      } else if (newCount < currentCount) {
        // 減少: 未割当の行を末尾から削除
        const unassignedLines = currentLines
          .filter(l => l.simId === null)
          .sort((a, b) => b.lineNumber - a.lineNumber)
          .slice(0, currentCount - newCount);
        await this.prisma.applicationLine.deleteMany({
          where: { id: { in: unassignedLines.map(l => l.id) } },
        });
      }
    }

    const application = await this.prisma.application.update({
      where: { id },
      data: updateData,
    });

    return application as unknown as ApplicationEntity;
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
  async findByCustomerIds(customerIds: string[]): Promise<Array<{
    id: string;
    customerId: string;
    createdAt: Date;
    kycImages: { expiryDate: Date | null }[];
  }>> {
    return await this.prisma.application.findMany({
      where: { customerId: { in: customerIds } },
      select: {
        id: true,
        customerId: true,
        createdAt: true,
        kycImages: { select: { expiryDate: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * 申込の統計情報をDB側のWINDOW関数で一括計算（N+1クエリ回避）
   * - applicationOrdinal: 顧客内の申込順番
   * - needsKycCheck: KYC要確認フラグ
   * - latestExpiryDate: 顧客の全申込を通じた最新KYC有効期限
   */
  async findApplicationStats(
    applicationIds: string[],
    customerIds: string[]
  ): Promise<Map<string, { ordinal: number; needsKycCheck: boolean; latestExpiryDate: Date | null }>> {
    if (applicationIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      ordinal: bigint;
      needs_kyc_check: boolean;
      latest_expiry_date: Date | null;
    }>>(
      Prisma.sql`
        WITH app_kyc AS (
          SELECT
            a.id,
            a."customerId",
            a."createdAt",
            MAX(ki."expiryDate") as app_expiry
          FROM "Application" a
          LEFT JOIN "KycImage" ki ON ki."applicationId" = a.id
          WHERE a."customerId" = ANY(${customerIds})
          GROUP BY a.id, a."customerId", a."createdAt"
        ),
        app_stats AS (
          SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY "customerId" ORDER BY "createdAt", id) as ordinal,
            app_expiry,
            LAG(app_expiry) OVER (PARTITION BY "customerId" ORDER BY "createdAt", id) as prev_expiry,
            MAX(app_expiry) OVER (PARTITION BY "customerId") as latest_expiry
          FROM app_kyc
        )
        SELECT
          id,
          ordinal,
          latest_expiry as latest_expiry_date,
          CASE
            WHEN ordinal = 1 THEN true
            WHEN app_expiry IS NOT NULL AND prev_expiry IS NOT NULL AND app_expiry != prev_expiry THEN true
            WHEN app_expiry IS NOT NULL AND prev_expiry IS NULL THEN true
            ELSE false
          END as needs_kyc_check
        FROM app_stats
        WHERE id = ANY(${applicationIds})
      `
    );

    const result = new Map<string, { ordinal: number; needsKycCheck: boolean; latestExpiryDate: Date | null }>();
    for (const row of rows) {
      result.set(row.id, {
        ordinal: Number(row.ordinal),
        needsKycCheck: row.needs_kyc_check,
        latestExpiryDate: row.latest_expiry_date,
      });
    }
    return result;
  }

  // ─── 紹介者 ───────────────────────────────────────────

  async addReferral(applicationId: string, referrerName: string, fee: number) {
    return await this.prisma.applicationReferral.create({
      data: { applicationId, referrerName, fee },
    });
  }

  async deleteReferral(referralId: string) {
    return await this.prisma.applicationReferral.delete({
      where: { id: referralId },
    });
  }

  // ─── 追跡番号 ─────────────────────────────────────────

  async addTracking(applicationId: string, carrier: string, trackingNumber: string) {
    return await this.prisma.applicationTracking.create({
      data: { applicationId, carrier, trackingNumber },
    });
  }

  async deleteTracking(trackingId: string) {
    return await this.prisma.applicationTracking.delete({
      where: { id: trackingId },
    });
  }

  // ─── ワークフロー画像パス ─────────────────────────────

  async findWorkflowImagePaths(id: string) {
    return await this.prisma.application.findUnique({
      where: { id },
      select: {
        invoicePdfPath: true,
        invoiceEmailPath: true,
        paymentImagePath: true,
        shippingImagePath: true,
      },
    });
  }

  async updateWorkflowImagePath(id: string, field: string, path: string) {
    return await this.prisma.application.update({
      where: { id },
      data: { [field]: path },
    });
  }
}
