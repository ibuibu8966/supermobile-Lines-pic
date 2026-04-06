/**
 * Cancellation Service
 *
 * 解約申請に関するビジネスロジックを担当
 */

import { CancellationRequest, CancellationResult } from '@/entities';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';
import type { PrismaClient } from '@prisma/client';

export class CancellationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 解約申請
   *
   * @param userId ユーザーID
   * @param request 解約リクエスト
   * @returns 解約結果
   */
  async requestCancellation(
    userId: string,
    request: CancellationRequest
  ): Promise<CancellationResult> {
    logger.info('解約申請開始', { userId, lineId: request.lineId });

    // ユーザーに紐づく顧客を取得
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundError('顧客情報が見つかりません');
    }

    // 回線が顧客のものか確認
    const line = await this.prisma.applicationLine.findFirst({
      where: {
        id: request.lineId,
        application: {
          customerId: customer.id,
        },
      },
    });

    if (!line) {
      throw new NotFoundError('回線が見つかりません');
    }

    // 解約可能なステータスか確認
    if (line.status !== 'ACTIVATED' && line.status !== 'SHIPPED') {
      throw new ValidationError('この回線は解約申請できません');
    }

    // 回線のnoteに解約理由を追加
    const now = new Date().toISOString();
    const cancelNote = request.reason
      ? `[${now}] 解約申請: ${request.reason}`
      : `[${now}] 解約申請`;

    await this.prisma.applicationLine.update({
      where: { id: request.lineId },
      data: {
        note: line.note ? `${line.note}\n${cancelNote}` : cancelNote,
      },
    });

    logger.info('解約申請完了', { userId, lineId: request.lineId });

    return { success: true };
  }
}
