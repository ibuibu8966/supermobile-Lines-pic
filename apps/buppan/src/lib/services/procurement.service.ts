/**
 * Procurement Service
 *
 * 発注管理のビジネスロジック
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { ProcurementRepository } from '../repositories/procurement.repository';

export interface CreatePurchaseOrderInput {
  supplierId: number;
  totalAmount?: number;
  lines: {
    carrierType: string;
    quantity: number;
    unitPrice: number;
  }[];
  note?: string;
}

export interface UpdatePurchaseOrderInput {
  status?: string;
  invoiceDate?: string | null;
  deliveryDate?: string | null;
  totalAmount?: number;
}

/**
 * 発注管理サービス
 */
export class ProcurementService {
  private repository: ProcurementRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new ProcurementRepository(prisma);
  }

  /**
   * 発注一覧を取得
   */
  async getAllPurchaseOrders(): Promise<any[]> {
    logger.info('発注一覧取得開始');

    const orders = await this.repository.findMany();

    logger.info('発注一覧取得完了', { count: orders.length });

    return orders;
  }

  /**
   * 発注を作成
   * ビジネスルール:
   * - supplierIdとlinesは必須
   * - 各lineにcarrierType, quantity, unitPriceが必要
   * - totalAmountが未指定の場合は自動計算
   */
  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<any> {
    logger.info('発注作成開始', { supplierId: input.supplierId });

    // バリデーション
    if (!input.supplierId || !input.lines || !Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ValidationError('必須項目が不足しています');
    }

    // 各ライン詳細のバリデーション
    for (const line of input.lines) {
      if (!line.carrierType || !line.quantity || !line.unitPrice) {
        throw new ValidationError('回線詳細に不足しています');
      }
    }

    // 合計金額: 渡された値を使用、なければ自動計算
    const totalAmount = input.totalAmount || input.lines.reduce((sum, line) => {
      const subtotal = line.quantity * line.unitPrice;
      return sum + subtotal;
    }, 0);

    // ライン詳細にsubtotalを追加
    const linesWithSubtotal = input.lines.map((line) => ({
      carrierType: line.carrierType,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.quantity * line.unitPrice,
    }));

    // 発注を作成
    const order = await this.repository.create({
      supplierId: input.supplierId,
      totalAmount,
      note: input.note,
      lines: linesWithSubtotal,
    });

    logger.info('発注作成完了', { id: order.id });

    return order;
  }

  /**
   * 発注を取得
   */
  async getPurchaseOrderById(id: string): Promise<any> {
    logger.info('発注取得', { id });

    const order = await this.repository.findById(id);

    if (!order) {
      throw new NotFoundError('発注', id);
    }

    return order;
  }

  /**
   * 発注を更新
   * ビジネスルール:
   * - status, invoiceDate, deliveryDate, totalAmountのみ更新可能
   */
  async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<any> {
    logger.info('発注更新開始', { id });

    // 存在確認
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('発注', id);
    }

    const updateData: any = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.invoiceDate !== undefined) {
      updateData.invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : null;
    }

    if (input.deliveryDate !== undefined) {
      updateData.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
    }

    if (input.totalAmount !== undefined) {
      updateData.totalAmount = input.totalAmount;
    }

    const updated = await this.repository.update(id, updateData);

    logger.info('発注更新完了', { id });

    return updated;
  }

  /**
   * 発注の画像パスを更新
   */
  async updateImagePath(id: string, fieldName: string, url: string): Promise<any> {
    logger.info('発注画像パス更新', { id, fieldName });

    // 存在確認
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('発注', id);
    }

    const updated = await this.repository.updateImagePath(id, fieldName, url);

    logger.info('発注画像パス更新完了', { id });

    return updated;
  }
}
