/**
 * Procurement Service
 *
 * 仕入れ・経費管理のビジネスロジック
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { ProcurementRepository, PurchaseOrderWithRelations } from '../repositories/procurement.repository';
import type { PurchaseOrderType } from '../types/procurement';

export interface CreatePurchaseOrderInput {
  type: PurchaseOrderType;
  supplierId?: number | null;
  totalAmount?: number;
  customerName?: string | null;
  lines: {
    name?: string | null;
    carrierType?: string | null;
    quantity: number;
    unitPrice: number;
    isIncludedInUnitCost?: boolean;
  }[];
  note?: string | null;
  deliveryDate?: string | null;
  paymentDueDate?: string | null;
  taxType?: string;
  taxAmount?: number;
}

export interface UpdatePurchaseOrderInput {
  status?: string;
  paymentStatus?: string | null;
  paidAt?: string | null;
  invoiceDate?: string | null;
  deliveryDate?: string | null;
  paymentDueDate?: string | null;
  totalAmount?: number;
}

export interface UnitCostResult {
  includedAmount: number;
  simQuantity: number;
  unitCost: number | null;
}

/**
 * 仕入れ・経費管理サービス
 */
export class ProcurementService {
  private repository: ProcurementRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new ProcurementRepository(prisma);
  }

  /**
   * 一覧を取得（typeフィルター対応）
   */
  async getAllPurchaseOrders(typeFilter?: PurchaseOrderType): Promise<PurchaseOrderWithRelations[]> {
    logger.info('発注一覧取得開始', { typeFilter });
    const orders = await this.repository.findMany(typeFilter);
    logger.info('発注一覧取得完了', { count: orders.length });
    return orders;
  }

  /**
   * 発注を作成
   */
  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithRelations> {
    logger.info('発注作成開始', { type: input.type, supplierId: input.supplierId });

    // バリデーション: 発注/請求は仕入先必須
    if ((input.type === 'PURCHASE_ORDER' || input.type === 'SUPPLIER_INVOICE') && !input.supplierId) {
      throw new ValidationError('発注・請求には仕入先が必須です');
    }

    if (!input.lines || !Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ValidationError('明細は1件以上必要です');
    }

    const linesWithSubtotal = input.lines.map((line) => ({
      name: line.name || null,
      carrierType: line.carrierType || null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.quantity * line.unitPrice,
      isIncludedInUnitCost: line.isIncludedInUnitCost ?? false,
    }));

    const subtotalSum = linesWithSubtotal.reduce((sum, l) => sum + l.subtotal, 0);
    const taxType = input.taxType || "TAX_EXCLUDED";
    const taxAmount = taxType === "TAX_EXCLUDED" ? Math.floor(subtotalSum * 0.1) : 0; // TAX_INCLUDED, TAX_FREE は消費税なし
    const totalAmount = subtotalSum + taxAmount;

    // 請求/経費/追加請求のデフォルトpaymentStatus
    const paymentStatus = input.type !== 'PURCHASE_ORDER' ? 'UNPAID' : null;

    const order = await this.repository.create({
      type: input.type,
      supplierId: input.supplierId || null,
      totalAmount,
      taxType,
      taxAmount,
      customerName: input.customerName || null,
      paymentStatus,
      note: input.note,
      deliveryDate: input.deliveryDate || null,
      paymentDueDate: input.paymentDueDate || null,
      lines: linesWithSubtotal,
    });

    logger.info('発注作成完了', { id: order.id });
    return order;
  }

  /**
   * 発注を取得
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrderWithRelations> {
    logger.info('発注取得', { id });
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundError('発注', id);
    }
    return order;
  }

  /**
   * 発注を更新
   */
  async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithRelations> {
    logger.info('発注更新開始', { id });

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('発注', id);
    }

    const updateData: {
      status?: string;
      paymentStatus?: string | null;
      paidAt?: Date | string | null;
      invoiceDate?: Date | null;
      deliveryDate?: Date | null;
      paymentDueDate?: Date | null;
      totalAmount?: number;
    } = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.paymentStatus !== undefined) {
      updateData.paymentStatus = input.paymentStatus;
      if (input.paymentStatus === 'PAID' && !existing.paidAt) {
        updateData.paidAt = new Date();
      }
      if (input.paymentStatus === 'UNPAID') {
        updateData.paidAt = null;
      }
    }

    if (input.paidAt !== undefined) {
      updateData.paidAt = input.paidAt ? new Date(input.paidAt) : null;
    }

    if (input.invoiceDate !== undefined) {
      updateData.invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : null;
    }

    if (input.deliveryDate !== undefined) {
      updateData.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
    }

    if (input.paymentDueDate !== undefined) {
      updateData.paymentDueDate = input.paymentDueDate ? new Date(input.paymentDueDate) : null;
    }

    if (input.totalAmount !== undefined) {
      updateData.totalAmount = input.totalAmount;
    }

    const updated = await this.repository.update(id, updateData);
    logger.info('発注更新完了', { id });
    return updated;
  }

  /**
   * 発注を明細ごと更新
   */
  async updatePurchaseOrderFull(id: string, input: {
    supplierId?: number | null;
    customerName?: string | null;
    lines: {
      name?: string | null;
      carrierType?: string | null;
      quantity: number;
      unitPrice: number;
      isIncludedInUnitCost?: boolean;
    }[];
    note?: string | null;
    deliveryDate?: string | null;
    paymentDueDate?: string | null;
    taxType?: string;
    taxAmount?: number;
  }): Promise<PurchaseOrderWithRelations> {
    logger.info('発注明細更新開始', { id });

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('発注', id);
    }

    const linesWithSubtotal = input.lines.map((line) => ({
      name: line.name || null,
      carrierType: line.carrierType || null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.quantity * line.unitPrice,
      isIncludedInUnitCost: line.isIncludedInUnitCost ?? false,
    }));

    const subtotalSum = linesWithSubtotal.reduce((sum, l) => sum + l.subtotal, 0);
    const taxType = input.taxType || "TAX_EXCLUDED";
    const taxAmount = taxType === "TAX_EXCLUDED" ? Math.floor(subtotalSum * 0.1) : 0; // TAX_INCLUDED, TAX_FREE は消費税なし
    const totalAmount = subtotalSum + taxAmount;

    const updated = await this.repository.updateWithLines(id, {
      supplierId: input.supplierId,
      customerName: input.customerName,
      totalAmount,
      taxType,
      taxAmount,
      note: input.note,
      deliveryDate: input.deliveryDate,
      paymentDueDate: input.paymentDueDate,
      lines: linesWithSubtotal,
    });

    logger.info('発注明細更新完了', { id });
    return updated;
  }

  /**
   * 発注の画像パスを更新
   */
  async updateImagePath(id: string, fieldName: string, url: string): Promise<PurchaseOrderWithRelations> {
    logger.info('発注画像パス更新', { id, fieldName });
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('発注', id);
    }
    const updated = await this.repository.updateImagePath(id, fieldName, url);
    logger.info('発注画像パス更新完了', { id });
    return updated;
  }

  /**
   * 仕入れ単価を計算（発注用）
   */
  static calculateUnitCost(lines: { carrierType: string | null; quantity: number; subtotal: number; isIncludedInUnitCost: boolean }[]): UnitCostResult {
    const includedAmount = lines
      .filter((l) => l.isIncludedInUnitCost)
      .reduce((sum, l) => sum + l.subtotal, 0);

    const simQuantity = lines
      .filter((l) => l.carrierType !== null)
      .reduce((sum, l) => sum + l.quantity, 0);

    return {
      includedAmount,
      simQuantity,
      unitCost: simQuantity > 0 ? Math.round(includedAmount / simQuantity) : null,
    };
  }
}
