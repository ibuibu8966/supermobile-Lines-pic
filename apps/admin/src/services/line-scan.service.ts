/**
 * Line Scan Service
 *
 * 回線へのICCID一括割当に関するビジネスロジックを担当
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { LineScanInput, LineScanResult, SingleLineScanInput, SingleLineScanResult, ForceReassignInput, LineScanConflict } from '@/entities';
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
    const warnings: string[] = [];

    for (const iccid of uniqueIccids) {
      const sim = simMap.get(iccid);
      if (!sim) {
        // SIMが存在しない場合は警告のみ（エラーにしない）
        warnings.push(`ICCID ${iccid} はSIMマスタに未登録です`);
      }
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

    // 6. SIM競合チェック（ACTIVATED/SHIPPED回線に既に紐付いていないか）
    const conflicts: LineScanConflict[] = [];
    const existingAssignments = await this.prisma.applicationLine.findMany({
      where: {
        simId: { in: uniqueIccids },
        status: { in: ['ACTIVATED', 'SHIPPED'] },
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            customer: {
              select: { lastName: true, firstName: true, companyName: true },
            },
          },
        },
      },
    });

    for (const assignment of existingAssignments) {
      const customer = assignment.application.customer;
      const customerName = customer.companyName
        || `${customer.lastName} ${customer.firstName}`;
      conflicts.push({
        iccid: assignment.simId!,
        currentApplicationId: assignment.application.id,
        currentApplicationNumber: assignment.application.applicationNumber,
        currentCustomerName: customerName,
        currentLineId: assignment.id,
      });
    }

    if (conflicts.length > 0) {
      return {
        message: `${conflicts.length}件のICCIDが他の申込で使用中です`,
        assignedCount: 0,
        lines: [],
        conflicts,
      };
    }

    // 7. ICCID → 回線ID のマッピングを構築
    const lineUpdateData = uniqueIccids.map((iccid, i) => {
      const line = notActivatedLines[i];
      const sim = simMap.get(iccid);
      return {
        iccid,
        lineId: line.id,
        simId: sim ? iccid : null,
        msisdn: sim?.msisdn || null,
      };
    });

    // 8. 単一トランザクションで全件更新（全成功 or 全失敗）
    const timeoutMs = Math.min(Math.max(lineUpdateData.length * 500, 10_000), 60_000);

    await this.prisma.$transaction(
      async (tx) => {
        await Promise.all(
          lineUpdateData.map(({ lineId, simId, msisdn }) =>
            tx.applicationLine.update({
              where: { id: lineId },
              data: {
                simId,
                msisdn,
                status: 'ACTIVATED',
                contractMonth: input.contractMonth,
                lineTagId: input.lineTagId,
                lineReserveTagId: input.lineReserveTagId,
              },
            })
          )
        );
      },
      { timeout: timeoutMs }
    );

    const successLineIds = lineUpdateData.map(({ lineId }) => lineId);

    // 更新後の回線データを取得（include 付き）
    const results = await this.prisma.applicationLine.findMany({
      where: { id: { in: successLineIds } },
      include: {
        sim: {
          include: {
            simLocationTag: true,
          },
        },
        lineTag: true,
        lineReserveTag: true,
      },
      orderBy: { lineNumber: 'asc' },
    });

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

  /**
   * ICCID 1件登録（バックグラウンドキュー用）
   *
   * SELECT FOR UPDATE SKIP LOCKED で行ロック → 同時操作でも安全
   * SIM競合チェック → 他の申込で使用中ならconflictレスポンス
   */
  async scanSingleIccid(
    applicationId: string,
    input: SingleLineScanInput
  ): Promise<SingleLineScanResult> {
    logger.info('ICCID 1件登録開始', { applicationId, iccid: input.iccid });

    return await this.prisma.$transaction(async (tx) => {
      // 1. 次の未割当回線を取得 + 行ロック
      //    SKIP LOCKED: 他のトランザクションがロック中の行をスキップ → 同時スキャンでも安全に次の行を取得
      const lines = await tx.$queryRaw<{ id: string; lineNumber: number }[]>(
        Prisma.sql`
          SELECT id, "lineNumber" FROM "ApplicationLine"
          WHERE "applicationId" = ${applicationId} AND status = 'NOT_ACTIVATED'::"ApplicationLineStatus"
          ORDER BY "lineNumber" ASC LIMIT 1
          FOR UPDATE SKIP LOCKED
        `
      );

      if (lines.length === 0) {
        return { status: 'no_lines' as const };
      }

      // 2. SIM競合チェック（同じICCIDがACTIVE/SHIPPED回線に紐付いていないか）
      const existingAssignment = await tx.applicationLine.findFirst({
        where: {
          simId: input.iccid,
          status: { in: ['ACTIVATED', 'SHIPPED'] },
        },
        include: {
          application: {
            select: {
              id: true,
              applicationNumber: true,
              customer: {
                select: { lastName: true, firstName: true, companyName: true },
              },
            },
          },
        },
      });

      if (existingAssignment) {
        const customer = existingAssignment.application.customer;
        const customerName = customer.companyName
          || `${customer.lastName} ${customer.firstName}`;
        return {
          status: 'conflict' as const,
          conflict: {
            iccid: input.iccid,
            currentApplicationId: existingAssignment.application.id,
            currentApplicationNumber: existingAssignment.application.applicationNumber,
            currentCustomerName: customerName,
            currentLineId: existingAssignment.id,
          },
        };
      }

      // 3. SIM情報取得（msisdn）
      const sim = await tx.sim.findUnique({
        where: { iccid: input.iccid },
        select: { iccid: true, msisdn: true },
      });

      // 4. 回線更新（1件 Raw SQL）
      const lineId = lines[0].id;
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "ApplicationLine" SET
            "simId" = ${input.iccid},
            msisdn = ${sim?.msisdn || null},
            status = 'ACTIVATED'::"ApplicationLineStatus",
            "contractMonth" = ${input.contractMonth}::timestamp,
            "lineTagId" = ${input.lineTagId || null}::int,
            "lineReserveTagId" = ${input.lineReserveTagId || null}::int,
            "updatedAt" = now()
          WHERE id = ${lineId}
        `
      );

      logger.info('ICCID 1件登録完了', {
        applicationId,
        iccid: input.iccid,
        lineId,
        lineNumber: lines[0].lineNumber,
      });

      return {
        status: 'ok' as const,
        line: {
          id: lineId,
          lineNumber: lines[0].lineNumber,
          simId: input.iccid,
          msisdn: sim?.msisdn || null,
          status: 'ACTIVATED',
        },
      };
    }, { timeout: 10_000 });
  }

  /**
   * 競合解決（force-reassign）
   *
   * 旧回線をCANCELLED + simId解除し、新回線にICCIDを割当
   */
  async forceReassign(
    applicationId: string,
    input: ForceReassignInput
  ): Promise<SingleLineScanResult> {
    logger.info('競合解決開始', { applicationId, iccid: input.iccid, cancelLineId: input.cancelLineId });

    return await this.prisma.$transaction(async (tx) => {
      // 1. 旧回線を解除（CANCELLED + simId/msisdnクリア）
      await tx.applicationLine.update({
        where: { id: input.cancelLineId },
        data: {
          status: 'CANCELLED',
          simId: null,
          msisdn: null,
        },
      });

      // 2. 新回線に割当（scanSingleIccidと同じロジック）
      const lines = await tx.$queryRaw<{ id: string; lineNumber: number }[]>(
        Prisma.sql`
          SELECT id, "lineNumber" FROM "ApplicationLine"
          WHERE "applicationId" = ${applicationId} AND status = 'NOT_ACTIVATED'::"ApplicationLineStatus"
          ORDER BY "lineNumber" ASC LIMIT 1
          FOR UPDATE SKIP LOCKED
        `
      );

      if (lines.length === 0) {
        return { status: 'no_lines' as const };
      }

      // 3. SIM情報取得
      const sim = await tx.sim.findUnique({
        where: { iccid: input.iccid },
        select: { iccid: true, msisdn: true },
      });

      // 4. 回線更新
      const lineId = lines[0].id;
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "ApplicationLine" SET
            "simId" = ${input.iccid},
            msisdn = ${sim?.msisdn || null},
            status = 'ACTIVATED'::"ApplicationLineStatus",
            "contractMonth" = ${input.contractMonth}::timestamp,
            "lineTagId" = ${input.lineTagId || null}::int,
            "lineReserveTagId" = ${input.lineReserveTagId || null}::int,
            "updatedAt" = now()
          WHERE id = ${lineId}
        `
      );

      logger.info('競合解決完了', {
        applicationId,
        iccid: input.iccid,
        cancelledLineId: input.cancelLineId,
        newLineId: lineId,
      });

      return {
        status: 'ok' as const,
        line: {
          id: lineId,
          lineNumber: lines[0].lineNumber,
          simId: input.iccid,
          msisdn: sim?.msisdn || null,
          status: 'ACTIVATED',
        },
      };
    }, { timeout: 10_000 });
  }
}
