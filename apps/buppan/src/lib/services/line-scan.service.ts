/**
 * Line Scan Service
 *
 * 回線へのICCID一括割当に関するビジネスロジックを担当
 */

import { PrismaClient } from '@prisma/client';
import { LineScanInput, LineScanResult } from '@/lib/entities';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

export class LineScanService {
  constructor(private prisma: PrismaClient) {}

  /**
   * ICCID一括割当
   * ビジネスロジック:
   * - 申込の未割当回線を取得
   * - ICCID重複チェック
   * - SIMの存在・ステータス確認（存在しない場合は警告のみ）
   * - タグの存在確認
   * - トランザクションで回線・SIM更新
   */
  async scanIccids(
    applicationId: string,
    input: LineScanInput
  ): Promise<LineScanResult> {
    logger.info('ICCID一括割当開始', {
      applicationId,
      iccidCount: input.iccids.length,
    });

    // 1. 申し込みの存在確認と未割当回線取得
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        lines: {
          where: { status: 'NOT_ACTIVATED' },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundError('Application', applicationId);
    }

    const notActivatedLines = application.lines;

    if (notActivatedLines.length === 0) {
      throw new ValidationError('未割当の回線がありません');
    }

    // 2. ビジネスルール: ICCID重複チェック
    const uniqueIccids = [...new Set(input.iccids)];
    if (uniqueIccids.length !== input.iccids.length) {
      throw new ValidationError('重複したICCIDがあります');
    }

    // 3. ビジネスルール: SIMの存在・ステータス確認
    const sims = await this.prisma.sim.findMany({
      where: { iccid: { in: uniqueIccids } },
    });

    const simMap = new Map(sims.map((s) => [s.iccid, s]));
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const iccid of uniqueIccids) {
      const sim = simMap.get(iccid);
      if (!sim) {
        // SIMが存在しない場合は警告のみ（エラーにしない）
        warnings.push(`ICCID ${iccid} はSIMマスタに未登録です`);
      } else if (sim.status !== 'IN_STOCK') {
        // SIMが存在するが在庫状態でない場合はエラー
        errors.push(`ICCID ${iccid} は在庫状態ではありません (${sim.status})`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join('\n'));
    }

    // 4. ビジネスルール: 割当数の確認
    if (uniqueIccids.length > notActivatedLines.length) {
      throw new ValidationError(
        `未割当回線数(${notActivatedLines.length})より多くのICCIDが指定されています(${uniqueIccids.length})`
      );
    }

    // 5. タグの存在確認
    if (input.lineTagId) {
      const tag = await this.prisma.lineTag.findUnique({
        where: { id: input.lineTagId },
      });
      if (!tag) {
        throw new ValidationError('指定された回線タグが見つかりません');
      }
    }

    if (input.lineReserveTagId) {
      const tag = await this.prisma.lineReserveTag.findUnique({
        where: { id: input.lineReserveTagId },
      });
      if (!tag) {
        throw new ValidationError('指定された回線予備タグが見つかりません');
      }
    }

    // 6. トランザクションで一括更新（大量件数対応のため30秒タイムアウト）
    const results = await this.prisma.$transaction(
      async (tx) => {
        const updatedLines = [];

        for (let i = 0; i < uniqueIccids.length; i++) {
          const iccid = uniqueIccids[i];
          const line = notActivatedLines[i];
          const sim = simMap.get(iccid);

          // 回線にSIMを割当（SIMが存在する場合のみsimIdを設定）
          const updatedLine = await tx.applicationLine.update({
            where: { id: line.id },
            data: {
              simId: sim ? iccid : null,
              msisdn: sim?.msisdn || null,
              status: 'ACTIVATED',
              contractMonth: input.contractMonth,
              lineTagId: input.lineTagId,
              lineReserveTagId: input.lineReserveTagId,
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

          // SIMが存在する場合のみステータスを更新
          if (sim) {
            await tx.sim.update({
              where: { iccid },
              data: { status: 'ACTIVE' },
            });
          }

          updatedLines.push(updatedLine);
        }

        return updatedLines;
      },
      { timeout: 30000 }
    );

    logger.info('ICCID一括割当完了', {
      applicationId,
      assignedCount: results.length,
      warningCount: warnings.length,
    });

    return {
      message: `${results.length}件の回線にICCIDを割り当てました`,
      assignedCount: results.length,
      lines: results,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
