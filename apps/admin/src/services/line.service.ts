/**
 * Line Service
 *
 * 回線に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { PrismaClient } from '@prisma/client';
import { LineRepository, LineFilters } from '../repositories/line.repository';
import { LineWithRelations, LineUpdateInput } from '@/entities';

interface BulkLineUpdateInput {
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
  simLocationTagId?: number | null;
  shippedAt?: Date | string | null;
  returnedAt?: Date | string | null;
  contractMonth?: Date | null;
  status?: string;
}
import { PaginationInfo, createPaginationInfo } from '../shared/utils/helpers';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export interface LineListResult {
  lines: LineWithRelations[];
  pagination: PaginationInfo;
}

export class LineService {
  constructor(
    private lineRepo: LineRepository,
    private prisma?: PrismaClient
  ) {}

  /**
   * 回線一覧を取得
   */
  async getLineList(
    filters: LineFilters,
    pagination: PaginationParams
  ): Promise<LineListResult> {
    logger.info('回線一覧取得開始', { filters, pagination });

    // Repository経由でデータ取得
    const { lines, total } = await this.lineRepo.findMany(
      filters,
      { skip: pagination.skip, take: pagination.pageSize }
    );

    logger.debug('Repository取得完了', { count: lines.length, total });

    // ページネーション情報生成
    const paginationInfo = createPaginationInfo(
      pagination.page,
      pagination.pageSize,
      total
    );

    logger.info('回線一覧取得完了', {
      resultCount: lines.length,
      totalPages: paginationInfo.totalPages,
    });

    return {
      lines,
      pagination: paginationInfo,
    };
  }

  /**
   * 回線IDから単一の回線を取得
   */
  async getLineById(id: string): Promise<LineWithRelations | null> {
    logger.info('回線詳細取得', { lineId: id });

    const line = await this.lineRepo.findById(id);

    if (!line) {
      logger.warn('回線が見つかりません', { lineId: id });
      return null;
    }

    logger.debug('回線詳細取得完了', { lineId: id });

    return line;
  }

  /**
   * 申込IDに紐づく全回線を取得（一覧表示用）
   */
  async getLinesByApplicationId(applicationId: string): Promise<LineWithRelations[]> {
    logger.info('申込回線一覧取得', { applicationId });

    const lines = await this.lineRepo.findAllByApplicationId(applicationId);

    logger.debug('申込回線一覧取得完了', { applicationId, count: lines.length });

    return lines;
  }

  /**
   * 申込IDと回線IDから回線を取得
   */
  async getLineDetailByApplicationIdAndLineId(applicationId: string, lineId: string): Promise<LineWithRelations | null> {
    logger.info('回線詳細取得（申込ID＋回線ID）', { applicationId, lineId });

    const line = await this.lineRepo.findByApplicationIdAndLineId(applicationId, lineId);

    if (!line) {
      logger.warn('回線が見つかりません', { applicationId, lineId });
      return null;
    }

    logger.debug('回線詳細取得完了', { applicationId, lineId });

    return line;
  }

  /**
   * 回線を更新
   * ビジネスルール: shippedAt設定時に自動的にSHIPPEDステータスに変更
   * ビジネスルール: returnedAt設定時に自動的にRETURNEDステータスに変更
   * ビジネスルール: simLocationTagIdが指定された場合、関連SIMも更新
   */
  async updateLine(id: string, updateData: LineUpdateInput): Promise<LineWithRelations> {
    logger.info('回線更新開始', { lineId: id, updateData });

    // 存在確認
    const exists = await this.lineRepo.exists(id);
    if (!exists) {
      logger.warn('回線が見つかりません', { lineId: id });
      throw new NotFoundError('回線');
    }

    // 回線を更新
    const updated = await this.lineRepo.update(id, updateData);

    // SIMロケーションタグの更新（ビジネスロジック）
    if (updateData.simLocationTagId !== undefined && updated.simId) {
      logger.debug('SIMロケーションタグ更新', {
        simId: updated.simId,
        simLocationTagId: updateData.simLocationTagId,
      });

      await this.lineRepo.updateSimLocationTag(
        updated.simId,
        updateData.simLocationTagId
      );
    }

    logger.info('回線更新完了', { lineId: id });

    // 更新後のデータを再取得
    const refreshed = await this.lineRepo.findById(id);
    return refreshed!;
  }

  /**
   * 申込IDと回線IDで回線を更新（タグバリデーション付き）
   * ビジネスルール: lineTagId/lineReserveTagIdの存在確認
   */
  async updateLineWithValidation(
    applicationId: string,
    lineId: string,
    updateData: LineUpdateInput
  ): Promise<LineWithRelations> {
    logger.info('回線更新開始（バリデーション付き）', { applicationId, lineId, updateData });

    if (!this.prisma) {
      throw new Error('Prisma client is required for tag validation');
    }

    // 存在確認
    const existing = await this.lineRepo.findByApplicationIdAndLineId(applicationId, lineId);
    if (!existing) {
      logger.warn('回線が見つかりません', { applicationId, lineId });
      throw new NotFoundError('回線');
    }

    // lineTagIdの存在確認
    const updateDataExt = updateData as LineUpdateInput & { lineTagId?: number | null };
    if (updateDataExt.lineTagId !== undefined && updateDataExt.lineTagId !== null) {
      const tag = await this.prisma.lineTag.findUnique({
        where: { id: updateDataExt.lineTagId },
      });
      if (!tag) {
        logger.warn('回線タグが見つかりません', { lineTagId: updateDataExt.lineTagId });
        throw new ValidationError('指定された回線タグが見つかりません');
      }
    }

    // lineReserveTagIdの存在確認
    if (updateData.lineReserveTagId !== undefined && updateData.lineReserveTagId !== null) {
      const tag = await this.prisma.lineReserveTag.findUnique({
        where: { id: updateData.lineReserveTagId },
      });
      if (!tag) {
        logger.warn('回線予備タグが見つかりません', { lineReserveTagId: updateData.lineReserveTagId });
        throw new ValidationError('指定された回線予備タグが見つかりません');
      }
    }

    // 回線を更新
    const updated = await this.prisma.applicationLine.update({
      where: { id: lineId },
      data: updateData,
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

    logger.info('回線更新完了', { applicationId, lineId });

    return updated as unknown as LineWithRelations;
  }

  /**
   * 全回線を一括更新（申込IDなし）
   * ビジネスルール:
   * - shippedAt設定時に自動的にSHIPPEDステータスに変更
   * - returnedAt設定時に自動的にRETURNEDステータスに変更
   * - simLocationTagId更新時に関連SIMも更新
   */
  async bulkUpdateAllLines(
    lineIds: string[],
    updateData: BulkLineUpdateInput
  ): Promise<{ success: boolean; count: number }> {
    logger.info('全回線一括更新開始', { lineIds, updateData });

    if (!this.prisma) {
      throw new Error('Prisma client is required');
    }

    // 更新データを構築
    const finalUpdateData: Record<string, unknown> = {};

    if (updateData.lineReserveTagId !== undefined) {
      finalUpdateData.lineReserveTagId = updateData.lineReserveTagId;
    }

    if (updateData.shippedAt !== undefined) {
      finalUpdateData.shippedAt = updateData.shippedAt ? new Date(updateData.shippedAt) : null;
      // ビジネスルール: 発送日が設定された場合、ステータスも更新
      if (updateData.shippedAt && !updateData.status) {
        finalUpdateData.status = 'SHIPPED';
      }
    }

    if (updateData.returnedAt !== undefined) {
      finalUpdateData.returnedAt = updateData.returnedAt ? new Date(updateData.returnedAt) : null;
      // ビジネスルール: 返却日が設定された場合、ステータスも更新
      if (updateData.returnedAt && !updateData.status) {
        finalUpdateData.status = 'RETURNED';
      }
    }

    if (updateData.status !== undefined) {
      finalUpdateData.status = updateData.status;
    }

    // 回線を一括更新
    const updated = await this.prisma.applicationLine.updateMany({
      where: { id: { in: lineIds } },
      data: finalUpdateData,
    });

    // ビジネスルール: SIMロケーションタグ更新時、関連SIMも更新
    if (updateData.simLocationTagId !== undefined) {
      const lines = await this.prisma.applicationLine.findMany({
        where: { id: { in: lineIds }, simId: { not: null } },
        select: { simId: true },
      });

      const simIds = lines
        .map((line: { simId: string | null }) => line.simId)
        .filter((simId: string | null): simId is string => simId !== null);

      if (simIds.length > 0) {
        await this.prisma.sim.updateMany({
          where: { iccid: { in: simIds } },
          data: { simLocationTagId: updateData.simLocationTagId },
        });
      }
    }

    logger.info('全回線一括更新完了', { count: updated.count });

    return {
      success: true,
      count: updated.count,
    };
  }

  /**
   * 回線を一括更新（タグバリデーション付き）
   * ビジネスルール:
   * - 申込の存在確認
   * - 指定された回線が申込に属しているか確認
   * - lineTagId/lineReserveTagIdの存在確認
   * - shippedAt設定時に自動的にSHIPPEDステータスに変更
   * - returnedAt設定時に自動的にRETURNEDステータスに変更
   */
  async bulkUpdateLines(
    applicationId: string,
    lineIds: string[],
    updateData: BulkLineUpdateInput
  ): Promise<{ count: number; message: string }> {
    logger.info('回線一括更新開始', { applicationId, lineIds, updateData });

    if (!this.prisma) {
      throw new Error('Prisma client is required for tag validation');
    }

    // 申込の存在確認
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });

    if (!application) {
      logger.warn('申し込みが見つかりません', { applicationId });
      throw new NotFoundError('申し込み');
    }

    // 指定された回線が申込に属しているか確認
    const lines = await this.lineRepo.findManyByApplicationId(applicationId, lineIds);

    if (lines.length !== lineIds.length) {
      logger.warn('指定された回線の一部が見つからない', {
        applicationId,
        requestedCount: lineIds.length,
        foundCount: lines.length,
      });
      throw new ValidationError('指定された回線の一部が見つからないか、この申し込みに属していません');
    }

    // lineTagIdの存在確認
    if (updateData.lineTagId !== undefined && updateData.lineTagId !== null) {
      const tag = await this.prisma.lineTag.findUnique({
        where: { id: updateData.lineTagId },
      });
      if (!tag) {
        logger.warn('回線タグが見つかりません', { lineTagId: updateData.lineTagId });
        throw new ValidationError('指定された回線タグが見つかりません');
      }
    }

    // lineReserveTagIdの存在確認
    if (updateData.lineReserveTagId !== undefined && updateData.lineReserveTagId !== null) {
      const tag = await this.prisma.lineReserveTag.findUnique({
        where: { id: updateData.lineReserveTagId },
      });
      if (!tag) {
        logger.warn('回線予備タグが見つかりません', { lineReserveTagId: updateData.lineReserveTagId });
        throw new ValidationError('指定された回線予備タグが見つかりません');
      }
    }

    // 更新データを構築（undefinedは除外）
    const finalUpdateData: Record<string, unknown> = {};
    if (updateData.status !== undefined) {
      finalUpdateData.status = updateData.status;
    }
    if (updateData.lineTagId !== undefined) {
      finalUpdateData.lineTagId = updateData.lineTagId;
    }
    if (updateData.lineReserveTagId !== undefined) {
      finalUpdateData.lineReserveTagId = updateData.lineReserveTagId;
    }
    if (updateData.contractMonth !== undefined) {
      finalUpdateData.contractMonth = updateData.contractMonth;
    }
    if (updateData.shippedAt !== undefined) {
      finalUpdateData.shippedAt = updateData.shippedAt;
      // ビジネスルール: 発送日が設定された場合、ステータスも更新
      if (updateData.shippedAt) {
        finalUpdateData.status = 'SHIPPED';
      }
    }
    if (updateData.returnedAt !== undefined) {
      finalUpdateData.returnedAt = updateData.returnedAt;
      // ビジネスルール: 返却日が設定された場合、ステータスも更新
      if (updateData.returnedAt) {
        finalUpdateData.status = 'RETURNED';
      }
    }

    // 一括更新
    const count = await this.lineRepo.updateMany(applicationId, lineIds, finalUpdateData);

    logger.info('回線一括更新完了', { applicationId, count });

    return {
      count,
      message: `${count}件の回線を更新しました`,
    };
  }
}
