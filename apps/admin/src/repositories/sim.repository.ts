/**
 * Sim Repository
 *
 * SIMカードのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { SimWithRelations, SimUpdateInput } from '@/entities';
import { logger } from '../shared/utils/logger';

/**
 * SIMステータスをApplicationLineの最新ステータスから導出
 * - 回線なし or 最新が CANCELLED/RETURNED → IN_STOCK
 * - 最新が ACTIVATED/SHIPPED → ACTIVE
 * - その他（NOT_ACTIVATED等）→ IN_STOCK
 */
export function computeSimStatus(
  applicationLines: Array<{ status: string; createdAt?: Date | null; updatedAt?: Date | null }>
): 'IN_STOCK' | 'ACTIVE' {
  if (!applicationLines || applicationLines.length === 0) return 'IN_STOCK';
  // updatedAt降順で最新を取得
  const sorted = [...applicationLines].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
  const latest = sorted[0];
  if (latest.status === 'ACTIVATED' || latest.status === 'SHIPPED') return 'ACTIVE';
  return 'IN_STOCK';
}

/** ICCID連続登録の検証情報 */
export interface SimIccidValidation {
  isInStock: boolean;       // IN_STOCK状態か
  hasEligibleTag: boolean;  // SIMがプランの用途タグを持つか
  isConsumed: boolean;      // プランの用途タグが既に消費済みか
  planTagNames: string[];   // プランの用途タグ名（エラー表示用）
}

export interface SimFilters {
  search?: string;
  status?: string;
  carrier?: string;
  simType?: string;
  autoCancelDateFrom?: string;
  autoCancelDateTo?: string;
  supplierId?: number;
  simLocationTagId?: number;
}

export class SimRepository {
  constructor(private prisma: PrismaClient) {}

  /** Prisma select定義（findMany / findManyWithStatusFilter で共通利用） */
  private readonly simListSelect = {
    iccid: true,
    msisdn: true,
    simType: true,
    carrierType: true,
    autoCancelDate: true,
    updatedAt: true,
    supplierId: true,
    simLocationTagId: true,
    eligibleTagIds: true,
    supplier: {
      select: { id: true, code: true, name: true },
    },
    simLocationTag: {
      select: { id: true, code: true, name: true },
    },
    contracts: {
      select: {
        id: true,
        serviceName: true,
        contractStart: true,
        contractEnd: true,
        status: true,
        usageTags: {
          select: {
            usageTag: {
              select: { id: true, code: true, name: true },
            },
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
      orderBy: { createdAt: 'desc' as const },
      take: 10,
    },
    applicationLines: {
      select: {
        id: true,
        status: true,
        updatedAt: true,
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
  } as const;

  /** Prisma結果から consumedTagIds / status を計算 */
  private enrichSimResults(sims: Array<Record<string, unknown>>): SimWithRelations[] {
    return sims.map((sim) => {
      const consumedTagIds = new Set<number>();
      for (const contract of (sim.contracts as Array<Record<string, unknown>>) || []) {
        for (const ut of (contract.usageTags as Array<Record<string, unknown>>) || []) {
          const usageTag = ut.usageTag as { id?: number } | undefined;
          if (usageTag?.id) {
            consumedTagIds.add(usageTag.id);
          }
        }
      }
      return {
        ...sim,
        consumedTagIds: Array.from(consumedTagIds),
        status: computeSimStatus(
          (sim.applicationLines as Array<{ status: string; updatedAt?: Date | null }>) || []
        ),
      };
    }) as unknown as SimWithRelations[];
  }

  /**
   * SIM一覧を取得（フィルタリング・ページネーション対応）
   * ステータスフィルタがある場合はDB側でフィルタリング（10万件メモリ読み込みを回避）
   */
  async findMany(
    filters: SimFilters,
    pagination: { skip: number; take: number }
  ): Promise<{ sims: SimWithRelations[]; total: number }> {
    // ステータスフィルタがある場合はDB側でフィルタリング
    if (filters.status) {
      return this.findManyWithStatusFilter(filters, pagination);
    }

    const where = this.buildWhereClause(filters);

    logger.debug('SimRepository.findMany', { where, pagination });

    const [sims, total] = await Promise.all([
      this.prisma.sim.findMany({
        where,
        select: this.simListSelect,
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.sim.count({ where }),
    ]);

    return {
      sims: this.enrichSimResults(sims as unknown as Array<Record<string, unknown>>),
      total,
    };
  }

  /**
   * ステータスフィルタ付きSIM一覧取得
   * SIMステータスはApplicationLineの最新ステータスから導出されるため、
   * LATERAL JOINでDB側で計算・フィルタ・ページネーションする
   */
  private async findManyWithStatusFilter(
    filters: SimFilters,
    pagination: { skip: number; take: number }
  ): Promise<{ sims: SimWithRelations[]; total: number }> {
    logger.debug('SimRepository.findManyWithStatusFilter', { filters, pagination });

    // WHERE条件をSQL fragmentsで構築
    let query = Prisma.sql`
      SELECT s.iccid, COUNT(*) OVER() as total_count
      FROM "Sim" s
      LEFT JOIN LATERAL (
        SELECT al.status
        FROM "ApplicationLine" al
        WHERE al."simId" = s.iccid
        ORDER BY al."updatedAt" DESC LIMIT 1
      ) latest ON true
      WHERE 1=1
    `;

    // 検索フィルタ
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = Prisma.sql`${query} AND (s.iccid ILIKE ${term} OR s.msisdn ILIKE ${term})`;
    }

    // キャリアフィルタ
    if (filters.carrier) {
      if (filters.carrier === 'NULL') {
        query = Prisma.sql`${query} AND s."carrierType" IS NULL`;
      } else {
        query = Prisma.sql`${query} AND s."carrierType"::text = ${filters.carrier}`;
      }
    }

    // SIMタイプフィルタ
    if (filters.simType) {
      query = Prisma.sql`${query} AND s."simType"::text = ${filters.simType}`;
    }

    // 自動解約日フィルタ
    if (filters.autoCancelDateFrom) {
      query = Prisma.sql`${query} AND s."autoCancelDate" >= ${new Date(filters.autoCancelDateFrom)}`;
    }
    if (filters.autoCancelDateTo) {
      query = Prisma.sql`${query} AND s."autoCancelDate" <= ${new Date(filters.autoCancelDateTo)}`;
    }

    // 仕入れ先フィルタ
    if (filters.supplierId !== undefined) {
      query = Prisma.sql`${query} AND s."supplierId" = ${filters.supplierId}`;
    }

    // SIM場所タグフィルタ
    if (filters.simLocationTagId !== undefined) {
      query = Prisma.sql`${query} AND s."simLocationTagId" = ${filters.simLocationTagId}`;
    }

    // ステータスフィルタ（LATERAL JOINの結果で判定）
    if (filters.status === 'ACTIVE') {
      query = Prisma.sql`${query} AND latest.status IN ('ACTIVATED', 'SHIPPED')`;
    } else {
      // IN_STOCK: 回線なし or 最新がACTIVATED/SHIPPED以外
      query = Prisma.sql`${query} AND (latest.status IS NULL OR latest.status NOT IN ('ACTIVATED', 'SHIPPED'))`;
    }

    // ORDER BY + LIMIT + OFFSET
    query = Prisma.sql`${query} ORDER BY s."updatedAt" DESC LIMIT ${pagination.take} OFFSET ${pagination.skip}`;

    const rows = await this.prisma.$queryRaw<{ iccid: string; total_count: bigint }[]>(query);

    if (rows.length === 0) {
      return { sims: [], total: 0 };
    }

    const matchedIccids = rows.map((r) => r.iccid);
    const total = Number(rows[0].total_count);

    // マッチしたICCIDのフルデータをPrismaで取得
    const sims = await this.prisma.sim.findMany({
      where: { iccid: { in: matchedIccids } },
      select: this.simListSelect,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      sims: this.enrichSimResults(sims as unknown as Array<Record<string, unknown>>),
      total,
    };
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

    const sim = await this.prisma.sim.findUnique({
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

    if (!sim) return null;

    // 契約から消費済みタグIDを動的に計算、回線ステータスからSIMステータスを導出
    const consumedTagIds = new Set<number>();
    for (const contract of sim.contracts || []) {
      for (const ut of contract.usageTags || []) {
        if (ut.usageTag?.id) {
          consumedTagIds.add(ut.usageTag.id);
        }
      }
    }

    return {
      ...sim,
      consumedTagIds: Array.from(consumedTagIds),
      status: computeSimStatus(sim.applicationLines || []),
    } as unknown as SimWithRelations;
  }

  /**
   * SIMを更新
   */
  async update(iccid: string, data: SimUpdateInput): Promise<SimWithRelations> {
    logger.debug('SimRepository.update', { iccid, data });

    const { status: _status, ...dataWithoutStatus } = data as SimUpdateInput & { status?: unknown };
    const prismaData: Prisma.SimUpdateInput = {
      ...dataWithoutStatus,
      carrierType: data.carrierType ? (data.carrierType as $Enums.CarrierType) : undefined,
    };

    const sim = await this.prisma.sim.update({
      where: { iccid },
      data: prismaData,
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
    return {
      ...sim,
      status: computeSimStatus(sim.applicationLines || []),
    } as unknown as SimWithRelations;
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
   * IN_STOCK状態のSIM ICCIDリストを取得（IccidScanModal用プリフェッチ）
   * SIMステータスはApplicationLineの最新ステータスから導出:
   * - 回線なし → IN_STOCK
   * - 最新回線が CANCELLED/RETURNED/NOT_ACTIVATED → IN_STOCK
   * - 最新回線が ACTIVATED/SHIPPED → ACTIVE（除外）
   */
  async findInStockIccids(): Promise<string[]> {
    logger.debug('SimRepository.findInStockIccids');

    // LATERAL JOINでDB側でIN_STOCKフィルタ（全SIMメモリ読み込みを回避）
    const rows = await this.prisma.$queryRaw<{ iccid: string }[]>(
      Prisma.sql`
        SELECT s.iccid
        FROM "Sim" s
        LEFT JOIN LATERAL (
          SELECT al.status
          FROM "ApplicationLine" al
          WHERE al."simId" = s.iccid
          ORDER BY al."updatedAt" DESC LIMIT 1
        ) latest ON true
        WHERE latest.status IS NULL
           OR latest.status NOT IN ('ACTIVATED', 'SHIPPED')
      `
    );

    return rows.map(r => r.iccid);
  }

  /**
   * プランの用途タグに基づいてIN_STOCK SIMの検証情報を取得
   * ICCIDをキーとし、各SIMが登録可能かどうかの理由を返す
   */
  async findInStockIccidsWithValidation(planId: string): Promise<Record<string, SimIccidValidation>> {
    logger.debug('SimRepository.findInStockIccidsWithValidation', { planId });

    // プランの用途タグを取得
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        usageTags: {
          select: { usageTag: { select: { id: true, name: true } } },
        },
      },
    });

    const planTagIds = plan?.usageTags.map((ut) => ut.usageTag.id) ?? [];
    const planTagNames = plan?.usageTags.map((ut) => ut.usageTag.name) ?? [];

    // SIMを取得（プランにタグがある場合はeligibeTagIdsで絞り込んでパフォーマンス改善）
    const simWhere = planTagIds.length > 0
      ? { eligibleTagIds: { hasSome: planTagIds } }
      : {};
    const sims = await this.prisma.sim.findMany({
      where: simWhere,
      select: {
        iccid: true,
        eligibleTagIds: true,
        contracts: {
          select: {
            usageTags: {
              select: { usageTag: { select: { id: true } } },
            },
          },
        },
        applicationLines: {
          select: { status: true, updatedAt: true },
        },
      },
    });

    const result: Record<string, SimIccidValidation> = {};

    for (const sim of sims) {
      const isInStock = computeSimStatus(sim.applicationLines) === 'IN_STOCK';

      // 消費済みタグIDを計算
      const consumedTagIds = new Set<number>();
      for (const contract of sim.contracts) {
        for (const ut of contract.usageTags) {
          if (ut.usageTag?.id) consumedTagIds.add(ut.usageTag.id);
        }
      }

      // プランの用途タグ照合（プランにタグがなければ制限なし）
      let hasEligibleTag = true;
      let isConsumed = false;

      if (planTagIds.length > 0) {
        // SIMがプランの用途タグを1つ以上持つか
        hasEligibleTag = planTagIds.some((tid) => sim.eligibleTagIds.includes(tid));
        // プランの用途タグのいずれか1つでも消費済みであれば使用不可
        isConsumed = planTagIds.some((tid) => consumedTagIds.has(tid));
      }

      result[sim.iccid] = { isInStock, hasEligibleTag, isConsumed, planTagNames };
    }

    return result;
  }

  /**
   * フィルタ条件からWhere句を構築
   */
  private buildWhereClause(filters: SimFilters): Prisma.SimWhereInput {
    const where: Prisma.SimWhereInput = {};

    // Search filter (ICCID, MSISDN)
    if (filters.search) {
      where.OR = [
        { iccid: { contains: filters.search } },
        { msisdn: { contains: filters.search } },
      ];
    }

    // Status filter は廃止（SIMステータスはApplicationLineから導出するためDBフィルタ不可）
    // ステータスフィルタはService層でポストフィルタリングする

    // Carrier filter
    if (filters.carrier) {
      if (filters.carrier === 'NULL') {
        where.carrierType = null;
      } else {
        where.carrierType = filters.carrier as $Enums.CarrierType;
      }
    }

    // SIM type filter
    if (filters.simType) {
      where.simType = filters.simType as $Enums.SimType;
    }

    // Auto cancel date range filter
    if (filters.autoCancelDateFrom || filters.autoCancelDateTo) {
      where.autoCancelDate = {
        ...(filters.autoCancelDateFrom && { gte: new Date(filters.autoCancelDateFrom) }),
        ...(filters.autoCancelDateTo && { lte: new Date(filters.autoCancelDateTo) })
      };
    }

    // Supplier filter
    if (filters.supplierId !== undefined) {
      where.supplierId = filters.supplierId;
    }

    // SIM location tag filter (handle special "NULL" case from frontend)
    if (filters.simLocationTagId !== undefined) {
      where.simLocationTagId = filters.simLocationTagId;
    }

    return where;
  }
}
