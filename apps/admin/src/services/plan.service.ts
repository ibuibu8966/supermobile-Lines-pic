/**
 * Plan Service
 *
 * プランに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PlanRepository, PlanFilters } from '../repositories/plan.repository';
import { PlanWithRelations, PlanUpdateInput, PlanCreateInput } from '@/entities';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ConflictError } from '../shared/errors/custom-errors';

type TransactionClient = Prisma.TransactionClient;

export class PlanService {
  constructor(
    private planRepo: PlanRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * プラン一覧を取得
   */
  async getPlanList(filters: PlanFilters): Promise<PlanWithRelations[]> {
    logger.info('プラン一覧取得開始', { filters });

    const plans = await this.planRepo.findMany(filters);

    logger.info('プラン一覧取得完了', { count: plans.length });
    return plans;
  }

  /**
   * プラン詳細を取得
   */
  async getPlanById(id: string): Promise<PlanWithRelations | null> {
    logger.info('プラン詳細取得', { id });

    const plan = await this.planRepo.findById(id);

    if (!plan) {
      logger.warn('プランが見つかりません', { id });
      return null;
    }

    logger.debug('プラン詳細取得完了', { id });
    return plan;
  }

  /**
   * プランを更新
   * ビジネスロジック:
   * - コードの重複チェック（同一サービス内）
   * - 用途タグと料金の削除→再作成（トランザクション）
   */
  async updatePlan(
    id: string,
    updateData: PlanUpdateInput
  ): Promise<PlanWithRelations> {
    logger.info('プラン更新開始', { id, updateData });

    const { usageTagIds, pricings, ...planData } = updateData;

    // 既存プランの確認
    const existingPlan = await this.planRepo.findById(id);
    if (!existingPlan) {
      throw new NotFoundError('Plan', id);
    }

    // コードの重複チェック（自分以外、同一サービス内）
    if (planData.code) {
      const duplicate = await this.planRepo.findByCodeInService(
        existingPlan.serviceId,
        planData.code,
        id
      );
      if (duplicate) {
        throw new ConflictError('このサービス内で同じコードが既に使用されています');
      }
    }

    // トランザクションで更新
    const plan = await this.prisma.$transaction(async (tx: TransactionClient) => {
      const txPlanRepo = new PlanRepository(tx as unknown as PrismaClient);

      // 基本情報更新
      await txPlanRepo.update(id, planData);

      // 用途タグの更新（削除→再作成）
      if (usageTagIds !== undefined) {
        await txPlanRepo.deleteAllUsageTags(id);
        if (usageTagIds.length > 0) {
          await txPlanRepo.createUsageTags(id, usageTagIds);
        }
      }

      // 料金の更新（削除→再作成）
      if (pricings !== undefined) {
        await txPlanRepo.deleteAllPricings(id);
        if (pricings.length > 0) {
          await txPlanRepo.createPricings(id, pricings);
        }
      }

      // 更新後のデータを取得
      const updated = await txPlanRepo.findById(id);
      if (!updated) {
        throw new Error('更新後のプランが取得できませんでした');
      }

      return updated;
    });

    logger.info('プラン更新完了', { id });
    return plan;
  }

  /**
   * プランを作成
   * ビジネスロジック:
   * - コードの重複チェック（同一サービス内）
   */
  async createPlan(input: PlanCreateInput): Promise<PlanWithRelations> {
    logger.info('プラン作成開始', { input });

    const { usageTagIds, pricings, ...planData } = input;

    // ビジネスルール: コードの重複チェック（同一サービス内）
    const existing = await this.planRepo.findByCodeInService(
      planData.serviceId,
      planData.code
    );
    if (existing) {
      logger.warn('コード重複エラー', { serviceId: planData.serviceId, code: planData.code });
      throw new ConflictError('このサービス内で同じコードが既に使用されています');
    }

    // プラン作成
    const plan = await this.planRepo.create({
      ...planData,
      usageTags: {
        create: (usageTagIds ?? []).map((usageTagId: number) => ({
          usageTagId,
        })),
      },
      pricings: {
        create: pricings ?? [],
      },
    });

    logger.info('プラン作成完了', { planId: plan.id });
    return plan;
  }

  /**
   * プランを削除
   * ビジネスロジック:
   * - 関連申込がある場合は論理削除（無効化）
   * - 関連申込がない場合は物理削除
   */
  async deletePlan(id: string): Promise<{ deleted: boolean; message: string }> {
    logger.info('プラン削除開始', { id });

    // プランの存在確認と関連データチェック
    const plan = await this.planRepo.findById(id);

    if (!plan) {
      throw new NotFoundError('Plan', id);
    }

    // 関連申込がある場合は論理削除
    if (plan._count && plan._count.applications > 0) {
      logger.info('関連申込が存在するため論理削除', {
        id,
        applicationCount: plan._count.applications,
      });
      await this.planRepo.deactivate(id);
      return {
        deleted: false,
        message: 'プランを無効化しました',
      };
    }

    // 物理削除
    await this.planRepo.delete(id);

    logger.info('プラン削除完了', { id });
    return {
      deleted: true,
      message: 'プランを削除しました',
    };
  }
}
