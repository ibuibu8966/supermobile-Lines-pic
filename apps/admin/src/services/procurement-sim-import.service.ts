/**
 * Procurement SIM Import Service
 *
 * 発注に紐づくSIMの一括インポート処理
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';

export interface ImportSimData {
  iccid: string;
  msisdn?: string;
  simType?: 'INDIVIDUAL' | 'CORPORATE' | 'BOTH';
  carrierType?: 'DOCOMO' | 'AU' | 'SOFTBANK' | 'RAKUTEN';
  plan?: string;
  supplierContractEnd?: string; // ISO date string
  isAutoCancel?: boolean;
  autoCancelDate?: string; // ISO date string
  eligibleTagIds?: number[];
}

export interface ImportRequest {
  sims: ImportSimData[];
  supplierId: number;
  updateExisting?: boolean;
}

export interface ImportError {
  iccid: string;
  error: string;
}

export interface ImportResult {
  success: number;
  updated: number;
  failed: number;
  errors: ImportError[];
}

/**
 * 発注SIMインポートサービス
 */
export class ProcurementSimImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * SIMを一括インポート
   * ビジネスルール:
   * - ICCIDは必須
   * - updateExisting=false: 重複するICCIDはスキップ（デフォルト）
   * - updateExisting=true: 重複するICCIDは更新（msisdn, supplierId, carrierType, plan等）
   * - 発注の仕入先とリクエストの仕入先が一致する必要がある
   */
  async importSims(
    purchaseOrderId: string,
    request: ImportRequest
  ): Promise<ImportResult> {
    logger.info('SIM一括インポート開始', {
      purchaseOrderId,
      count: request.sims.length,
      updateExisting: request.updateExisting ?? false,
    });

    const { sims, supplierId, updateExisting = false } = request;

    if (!sims || !Array.isArray(sims) || sims.length === 0) {
      throw new ValidationError('SIMデータが必要です');
    }

    // 発注の存在確認
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      throw new NotFoundError('発注', purchaseOrderId);
    }

    // 仕入先の一致確認
    if (purchaseOrder.supplierId !== supplierId) {
      throw new ValidationError('仕入先が一致しません');
    }

    const errors: ImportError[] = [];
    let successCount = 0;
    let updatedCount = 0;

    // 1. バリデーション: ICCID必須チェック
    const validSims: ImportSimData[] = [];
    for (const simData of sims) {
      if (!simData.iccid) {
        errors.push({
          iccid: '（未設定）',
          error: 'ICCIDが必要です',
        });
      } else {
        validSims.push(simData);
      }
    }

    if (validSims.length === 0) {
      logger.warn('有効なSIMデータがありません', { errorCount: errors.length });
      return {
        success: 0,
        updated: 0,
        failed: errors.length,
        errors,
      };
    }

    // 2. 重複チェック（一括）
    const allIccids = validSims.map((s) => s.iccid);
    const existingSims = await this.prisma.sim.findMany({
      where: { iccid: { in: allIccids } },
      select: { iccid: true },
    });

    const existingIccidSet = new Set(existingSims.map((s) => s.iccid));

    // 既存SIMと新規SIMを分類
    const simsToInsert: ImportSimData[] = [];
    const simsToUpdate: ImportSimData[] = [];

    for (const simData of validSims) {
      if (existingIccidSet.has(simData.iccid)) {
        if (updateExisting) {
          simsToUpdate.push(simData);
        } else {
          errors.push({
            iccid: simData.iccid,
            error: 'このICCIDは既に登録されています',
          });
        }
      } else {
        simsToInsert.push(simData);
      }
    }

    // 3. 既存SIMの更新（updateExistingモード）
    if (simsToUpdate.length > 0) {
      try {
        for (const simData of simsToUpdate) {
          const updateData: Record<string, unknown> = {
            supplierId,
            purchaseOrderId,
          };
          if (simData.msisdn) updateData.msisdn = simData.msisdn;
          if (simData.simType) updateData.simType = simData.simType;
          if (simData.carrierType) updateData.carrierType = simData.carrierType;
          if (simData.plan) updateData.plan = simData.plan;
          if (simData.supplierContractEnd) updateData.supplierContractEnd = new Date(simData.supplierContractEnd);
          if (simData.isAutoCancel !== undefined) updateData.isAutoCancel = simData.isAutoCancel;
          if (simData.autoCancelDate) updateData.autoCancelDate = new Date(simData.autoCancelDate);
          if (simData.eligibleTagIds) updateData.eligibleTagIds = simData.eligibleTagIds;

          await this.prisma.sim.update({
            where: { iccid: simData.iccid },
            data: updateData,
          });

          // ApplicationLine.msisdnも連動更新
          if (simData.msisdn) {
            await this.prisma.applicationLine.updateMany({
              where: { simId: simData.iccid },
              data: { msisdn: simData.msisdn },
            });
          }

          updatedCount++;
        }

        logger.info('既存SIM更新完了', {
          purchaseOrderId,
          updated: updatedCount,
        });
      } catch (err) {
        logger.error('既存SIM更新エラー', { error: err });
        throw new Error(
          err instanceof Error
            ? err.message
            : '既存SIMの更新に失敗しました'
        );
      }
    }

    // 4. 新規SIMのバッチINSERT
    if (simsToInsert.length > 0) {
      try {
        const insertData = simsToInsert.map((simData) => ({
          iccid: simData.iccid,
          msisdn: simData.msisdn || null,
          simType: simData.simType || 'INDIVIDUAL',
          carrierType: simData.carrierType || null,
          plan: simData.plan || null,
          supplierId: supplierId,
          purchaseOrderId: purchaseOrderId,
          supplierContractEnd: simData.supplierContractEnd
            ? new Date(simData.supplierContractEnd)
            : null,
          isAutoCancel: simData.isAutoCancel || false,
          autoCancelDate: simData.autoCancelDate
            ? new Date(simData.autoCancelDate)
            : null,
          eligibleTagIds: simData.eligibleTagIds || [],
        }));

        const result = await this.prisma.sim.createMany({
          data: insertData,
          skipDuplicates: true,
        });

        successCount = result.count;

        logger.info('新規SIMインポート完了', {
          purchaseOrderId,
          success: successCount,
        });
      } catch (err) {
        logger.error('バッチINSERTエラー', { error: err });
        throw new Error(
          err instanceof Error
            ? err.message
            : 'バッチインポートに失敗しました'
        );
      }
    }

    logger.info('SIM一括インポート完了', {
      purchaseOrderId,
      success: successCount,
      updated: updatedCount,
      failed: errors.length,
    });

    return {
      success: successCount,
      updated: updatedCount,
      failed: errors.length,
      errors,
    };
  }
}
