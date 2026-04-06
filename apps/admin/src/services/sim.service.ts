/**
 * Sim Service
 *
 * SIMカードに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { SimRepository, SimFilters } from '../repositories/sim.repository';
import { SimWithRelations, SimUpdateInput } from '@/entities';
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

    // Repository経由でデータ取得（ステータスフィルタもDB側で処理）
    const { sims, total } = await this.simRepo.findMany(
      filters,
      { skip: pagination.skip, take: pagination.pageSize }
    );

    logger.debug('Repository取得完了', { count: sims.length, total });

    // ビジネスロジック: 消費済みタグIDからタグ名を取得
    const simsWithTags = await this.enrichWithConsumedTags(sims);

    // ページネーション情報生成
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
   * SIM詳細を取得
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

    logger.debug('SIM詳細取得完了', { iccid });

    return simWithConsumedTags as SimDetailResult;
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
    // 全SIMの消費済みタグIDと利用可能タグIDを収集
    const allConsumedTagIds: number[] = [];
    const allEligibleTagIds: number[] = [];
    for (const sim of sims) {
      allConsumedTagIds.push(...sim.consumedTagIds);
      if (sim.eligibleTagIds) {
        allEligibleTagIds.push(...sim.eligibleTagIds);
      }
    }
    const uniqueTagIds = [...new Set([...allConsumedTagIds, ...allEligibleTagIds])];

    // タグ情報を一括取得
    const usageTags = await this.simRepo.findUsageTagsByIds(uniqueTagIds);

    // Map化
    const tagMap = new Map<number, (typeof usageTags)[number]>();
    for (const tag of usageTags) {
      tagMap.set(tag.id, tag);
    }

    // SIMデータに消費済みタグ情報と利用可能タグ情報を追加
    return sims.map((sim) => ({
      ...sim,
      consumedTags: sim.consumedTagIds
        .map((id: number) => tagMap.get(id))
        .filter(Boolean) as Array<{ id: number; name: string }>,
      eligibleTags: (sim.eligibleTagIds || [])
        .map((id: number) => tagMap.get(id))
        .filter(Boolean) as Array<{ id: number; name: string }>,
    }));
  }

}
