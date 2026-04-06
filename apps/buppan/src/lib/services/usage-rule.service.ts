/**
 * Usage Rule Service
 *
 * 販売ルールに関するビジネスロジックを担当
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

export interface UsageRuleFilters {
  includeInactive?: boolean;
  usageTagId?: number;
}

export interface UsageRuleCreateInput {
  usageTagId: number;
  supplierFilter?: string | null;
  carrierFilter?: string | null;
  planFilter?: string | null;
  excludedTagIds?: number[];
  minContractDays?: number;
  requiresMnp?: boolean;
  conditions?: Record<string, unknown>;
  priority?: number;
  isActive?: boolean;
}

export interface UsageRuleUpdateInput {
  usageTagId?: number;
  supplierFilter?: string | null;
  carrierFilter?: string | null;
  planFilter?: string | null;
  excludedTagIds?: number[];
  minContractDays?: number;
  requiresMnp?: boolean;
  conditions?: Record<string, unknown>;
  priority?: number;
  isActive?: boolean;
}

export class UsageRuleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * ルール一覧を取得
   * ビジネスロジック: 排他タグ情報を解決
   */
  async getRuleList(filters: UsageRuleFilters): Promise<any[]> {
    logger.info('販売ルール一覧取得開始', { filters });

    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) {
      where.isActive = true;
    }
    if (filters.usageTagId) {
      where.usageTagId = filters.usageTagId;
    }

    const rules = await this.prisma.usageRule.findMany({
      where,
      include: {
        usageTag: true,
      },
      orderBy: [{ usageTagId: 'asc' }, { priority: 'desc' }],
    });

    // ビジネスロジック: 排他タグの情報を取得
    const allExcludedTagIds = rules.flatMap((r: any) => r.excludedTagIds);
    const uniqueTagIds = [...new Set(allExcludedTagIds)];

    const excludedTags =
      uniqueTagIds.length > 0
        ? await this.prisma.usageTag.findMany({
            where: { id: { in: uniqueTagIds } },
          })
        : [];

    const tagMap = new Map(excludedTags.map((t: any) => [t.id, t]));

    const rulesWithTags = rules.map((rule: any) => ({
      ...rule,
      excludedTags: rule.excludedTagIds.map((id: number) => tagMap.get(id)).filter(Boolean),
    }));

    logger.info('販売ルール一覧取得完了', { count: rulesWithTags.length });

    return rulesWithTags;
  }

  /**
   * ルールを作成
   * ビジネスロジック: usageTagIdをPrismaリレーション形式に変換
   */
  async createRule(input: UsageRuleCreateInput): Promise<any> {
    logger.info('販売ルール作成開始', { input });

    // ビジネスロジック: usageTagIdをリレーション形式に変換、conditionsをPrisma JSON型に変換
    const { usageTagId, conditions, ...otherFields } = input;

    const rule = await this.prisma.usageRule.create({
      data: {
        ...otherFields,
        conditions: conditions as Prisma.JsonObject,
        usageTag: { connect: { id: usageTagId } },
      },
      include: {
        usageTag: true,
      },
    });

    logger.info('販売ルール作成完了', { ruleId: rule.id });

    return rule;
  }

  /**
   * ルール詳細を取得
   * ビジネスロジック: 排他タグ情報を解決
   */
  async getRuleDetail(id: number): Promise<any> {
    logger.info('販売ルール詳細取得', { id });

    if (isNaN(id)) {
      throw new ValidationError('無効なIDです');
    }

    const rule = await this.prisma.usageRule.findUnique({
      where: { id },
      include: {
        usageTag: true,
      },
    });

    if (!rule) {
      throw new NotFoundError('UsageRule', id.toString());
    }

    // ビジネスロジック: 排他タグの情報を取得
    const excludedTags =
      rule.excludedTagIds.length > 0
        ? await this.prisma.usageTag.findMany({
            where: { id: { in: rule.excludedTagIds } },
          })
        : [];

    logger.debug('販売ルール詳細取得完了', { id, excludedTagCount: excludedTags.length });

    return {
      ...rule,
      excludedTags,
    };
  }

  /**
   * ルールを更新
   * ビジネスロジック: usageTagIdをPrismaリレーション形式に変換
   */
  async updateRule(id: number, updateData: UsageRuleUpdateInput): Promise<any> {
    logger.info('販売ルール更新開始', { id });

    if (isNaN(id)) {
      throw new ValidationError('無効なIDです');
    }

    // ビジネスロジック: usageTagIdとconditionsをPrisma形式に変換
    const { usageTagId, conditions, ...otherFields } = updateData;
    const prismaUpdateData: Prisma.UsageRuleUpdateInput = { ...otherFields };

    if (usageTagId !== undefined) {
      prismaUpdateData.usageTag = { connect: { id: usageTagId } };
    }
    if (conditions !== undefined) {
      prismaUpdateData.conditions = conditions as Prisma.JsonObject;
    }

    const updated = await this.prisma.usageRule.update({
      where: { id },
      data: prismaUpdateData,
      include: {
        usageTag: true,
      },
    });

    logger.info('販売ルール更新完了', { id });

    return updated;
  }

  /**
   * ルールを削除
   */
  async deleteRule(id: number): Promise<{ message: string }> {
    logger.info('販売ルール削除開始', { id });

    if (isNaN(id)) {
      throw new ValidationError('無効なIDです');
    }

    await this.prisma.usageRule.delete({
      where: { id },
    });

    logger.info('販売ルール削除完了', { id });

    return {
      message: '販売ルールを削除しました',
    };
  }
}
