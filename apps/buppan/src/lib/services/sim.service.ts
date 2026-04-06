/**
 * Sim Service
 *
 * SIMカードに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { SimRepository, SimFilters } from '../repositories/sim.repository';
import { SimWithRelations, SimUpdateInput } from '@/lib/entities';
import { PaginationInfo, createPaginationInfo } from '../shared/utils/helpers';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';
import { PrismaClient } from '@prisma/client';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export interface SimListResult {
  sims: SimWithRelations[];
  pagination: PaginationInfo;
}

export interface SimDetailResult extends SimWithRelations {
  consumedTags: Array<{ id: number; name: string }>;
  availableTags: Array<{
    id: number;
    name: string;
    description: string | null;
    isActive: boolean;
  }>;
}

interface UsageRule {
  id: number;
  usageTagId: number;
  supplierFilter: string | null;
  carrierFilter: string | null;
  planFilter: string | null;
  excludedTagIds: number[];
  requiresMnp: boolean;
  priority: number;
  isActive: boolean;
}

interface UsageTag {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export class SimService {
  constructor(
    private simRepo: SimRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * SIM一覧を取得
   * ビジネスロジック: 消費済みタグIDからタグ情報を解決
   */
  async getSimList(
    filters: SimFilters,
    pagination: PaginationParams
  ): Promise<SimListResult> {
    logger.info('SIM一覧取得開始', { filters, pagination });

    // 1. Repository経由でデータ取得
    const { sims, total } = await this.simRepo.findMany(
      filters,
      { skip: pagination.skip, take: pagination.pageSize }
    );

    logger.debug('Repository取得完了', { count: sims.length, total });

    // 2. ビジネスロジック: 消費済みタグIDからタグ名を取得
    const simsWithTags = await this.enrichWithConsumedTags(sims);

    // 3. ページネーション情報生成
    const paginationInfo = createPaginationInfo(
      pagination.page,
      pagination.pageSize,
      total
    );

    logger.info('SIM一覧取得完了', {
      resultCount: simsWithTags.length,
      totalPages: paginationInfo.totalPages,
    });

    return {
      sims: simsWithTags,
      pagination: paginationInfo,
    };
  }

  /**
   * SIM詳細を取得（販売可能タグ含む）
   */
  async getSimDetail(iccid: string): Promise<SimDetailResult | null> {
    logger.info('SIM詳細取得（タグ情報含む）', { iccid });

    const sim = await this.simRepo.findByIccid(iccid);

    if (!sim) {
      logger.warn('SIMが見つかりません', { iccid });
      return null;
    }

    // 消費済みタグ情報を追加
    const [simWithConsumedTags] = await this.enrichWithConsumedTags([sim]);

    // 販売可能な用途タグを取得
    const availableTags = await this.getAvailableTags(sim);

    logger.debug('SIM詳細取得完了', { iccid, availableTagCount: availableTags.length });

    return {
      ...simWithConsumedTags,
      availableTags,
    };
  }

  /**
   * SIMを更新
   */
  async updateSim(
    iccid: string,
    updateData: SimUpdateInput
  ): Promise<SimWithRelations> {
    logger.info('SIM更新開始', { iccid, updateData });

    // 存在確認
    const existing = await this.simRepo.findByIccid(iccid);
    if (!existing) {
      throw new NotFoundError('SIM', iccid);
    }

    // simLocationTagIdの存在確認
    if (updateData.simLocationTagId !== undefined && updateData.simLocationTagId !== null) {
      const tag = await this.prisma.simLocationTag.findUnique({
        where: { id: updateData.simLocationTagId },
      });
      if (!tag) {
        throw new ValidationError('指定されたSIMの場所タグが見つかりません');
      }
    }

    // 更新実行
    const updated = await this.simRepo.update(iccid, updateData);

    logger.info('SIM更新完了', { iccid });

    return updated;
  }

  /**
   * 消費済みタグ情報を追加
   * ビジネスロジック: consumedTagIds配列からタグオブジェクトを解決
   */
  private async enrichWithConsumedTags(
    sims: SimWithRelations[]
  ): Promise<SimWithRelations[]> {
    // 全SIMの消費済みタグIDを収集
    const allTagIds: number[] = [];
    for (const sim of sims) {
      allTagIds.push(...sim.consumedTagIds);
    }
    const uniqueTagIds = [...new Set(allTagIds)];

    // タグ情報を一括取得
    const usageTags = await this.simRepo.findUsageTagsByIds(uniqueTagIds);

    // Map化
    const tagMap = new Map<number, (typeof usageTags)[number]>();
    for (const tag of usageTags) {
      tagMap.set(tag.id, tag);
    }

    // SIMデータに消費済みタグ情報を追加
    return sims.map((sim) => ({
      ...sim,
      consumedTags: sim.consumedTagIds
        .map((id: number) => tagMap.get(id))
        .filter(Boolean) as Array<{ id: number; name: string }>,
    }));
  }

  /**
   * 販売可能な用途タグを取得
   * ビジネスロジック: 消費済みタグと用途ルールに基づいて販売可能なタグを算出
   */
  private async getAvailableTags(sim: {
    consumedTagIds: number[];
    supplierId: number;
    carrierType: string | null;
    plan: string | null;
    isMnpEligible: boolean;
    supplier: { code: string };
  }): Promise<UsageTag[]> {
    logger.debug('販売可能タグ取得開始', { iccid: (sim as any).iccid });

    // 全てのアクティブな用途タグとルールを一括取得（N+1問題回避）
    const [allTags, allRules] = await Promise.all([
      this.prisma.usageTag.findMany({ where: { isActive: true } }),
      this.prisma.usageRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      }),
    ]);

    // ルールをタグIDでグループ化
    const rulesByTagId = new Map<number, UsageRule[]>();
    for (const rule of allRules) {
      const existing = rulesByTagId.get(rule.usageTagId) || [];
      existing.push(rule);
      rulesByTagId.set(rule.usageTagId, existing);
    }

    const availableTags: UsageTag[] = [];

    for (const tag of allTags) {
      // 既に消費済みのタグは除外
      if (sim.consumedTagIds.includes(tag.id)) {
        continue;
      }

      const rules = rulesByTagId.get(tag.id) || [];

      // ルールが存在しない場合は販売可能
      if (rules.length === 0) {
        availableTags.push(tag);
        continue;
      }

      // いずれかのルールに合致すれば販売可能
      if (rules.some((rule) => this.checkRule(rule, sim))) {
        availableTags.push(tag);
      }
    }

    logger.debug('販売可能タグ取得完了', {
      totalTags: allTags.length,
      consumedTags: sim.consumedTagIds.length,
      availableTags: availableTags.length,
    });

    return availableTags;
  }

  /**
   * 用途ルールをチェック
   * ビジネスロジック: 仕入先/キャリア/プラン/排他タグ/MNP条件のフィルタリング
   */
  private checkRule(
    rule: UsageRule,
    sim: {
      consumedTagIds: number[];
      carrierType: string | null;
      plan: string | null;
      isMnpEligible: boolean;
      supplier: { code: string };
    }
  ): boolean {
    // 仕入れ先フィルタ
    if (rule.supplierFilter && rule.supplierFilter !== sim.supplier.code) {
      return false;
    }

    // キャリアフィルタ
    if (rule.carrierFilter && rule.carrierFilter !== sim.carrierType) {
      return false;
    }

    // プランフィルタ
    if (rule.planFilter && rule.planFilter !== sim.plan) {
      return false;
    }

    // 排他タグチェック（このタグを消費済みなら不可）
    if (rule.excludedTagIds.length > 0) {
      const hasExcludedTag = rule.excludedTagIds.some((id) =>
        sim.consumedTagIds.includes(id)
      );
      if (hasExcludedTag) {
        return false;
      }
    }

    // MNP必須チェック
    if (rule.requiresMnp && !sim.isMnpEligible) {
      return false;
    }

    return true;
  }
}
