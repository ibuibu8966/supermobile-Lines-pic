/**
 * Procurement Repository
 *
 * 仕入れ・経費管理のデータアクセス層
 */

import { PrismaClient, $Enums, Prisma } from '@prisma/client';
import { logger } from '../shared/utils/logger';
import type { PurchaseOrderType } from '../types/procurement';

export interface PurchaseOrderCreateInput {
  type: string;
  supplierId?: number | null;
  totalAmount: number;
  taxType?: string;
  taxAmount?: number;
  customerName?: string | null;
  paymentStatus?: string | null;
  note?: string | null;
  deliveryDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  lines: {
    name?: string | null;
    carrierType?: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isIncludedInUnitCost?: boolean;
  }[];
}

export interface PurchaseOrderUpdateInput {
  status?: string;
  paymentStatus?: string | null;
  paidAt?: Date | string | null;
  invoiceDate?: Date | string | null;
  deliveryDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  totalAmount?: number;
}

export interface PurchaseOrderWithRelations {
  id: string;
  type: string;
  supplierId: number | null;
  totalAmount: number;
  taxType: string;
  taxAmount: number;
  status: string;
  paymentStatus: string | null;
  paidAt: Date | null;
  customerName: string | null;
  orderedAt: Date;
  invoiceDate: Date | null;
  deliveryDate: Date | null;
  paymentDueDate: Date | null;
  purchaseOrderImagePath: string | null;
  quoteImagePath: string | null;
  invoiceImagePath: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: {
    id: number;
    name: string;
    code: string;
  } | null;
  lines: {
    id: string;
    purchaseOrderId: string;
    name: string | null;
    carrierType: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isIncludedInUnitCost: boolean;
  }[];
  _count?: {
    sims: number;
  };
}

interface PurchaseOrderRawRow {
  id: string;
  type: string;
  supplierId: number | null;
  totalAmount: number;
  taxType: string;
  taxAmount: number;
  status: string;
  paymentStatus: string | null;
  paidAt: Date | null;
  customerName: string | null;
  orderedAt: Date;
  invoiceDate: Date | null;
  deliveryDate: Date | null;
  paymentDueDate: Date | null;
  purchaseOrderImagePath: string | null;
  quoteImagePath: string | null;
  invoiceImagePath: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier_id: number | null;
  supplier_name: string | null;
  supplier_code: string | null;
  _count_sims: number;
}

/**
 * 仕入れ・経費リポジトリ
 */
export class ProcurementRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 一覧を取得（typeフィルター対応）
   */
  async findMany(typeFilter?: PurchaseOrderType): Promise<PurchaseOrderWithRelations[]> {
    logger.debug('発注一覧取得', { typeFilter });

    const typeCondition = typeFilter
      ? Prisma.sql`AND po.type = ${typeFilter}::"PurchaseOrderType"`
      : Prisma.empty;

    const ordersData = await this.prisma.$queryRaw<PurchaseOrderRawRow[]>`
      SELECT
        po.id,
        po.type,
        po."supplierId",
        po."totalAmount",
        po."taxType",
        po."taxAmount",
        po.status,
        po."paymentStatus",
        po."paidAt",
        po."customerName",
        po."orderedAt",
        po."invoiceDate",
        po."deliveryDate",
        po."paymentDueDate",
        po."purchaseOrderImagePath",
        po."quoteImagePath",
        po."invoiceImagePath",
        po.note,
        po."createdAt",
        po."updatedAt",
        s.id as "supplier_id",
        s.name as "supplier_name",
        s.code as "supplier_code",
        COALESCE(sim_count.count, 0)::int as "_count_sims"
      FROM "PurchaseOrder" po
      LEFT JOIN "Supplier" s ON po."supplierId" = s.id
      LEFT JOIN (
        SELECT "purchaseOrderId", COUNT(*)::int as count
        FROM "Sim"
        GROUP BY "purchaseOrderId"
      ) sim_count ON po.id = sim_count."purchaseOrderId"
      WHERE 1=1 ${typeCondition}
      ORDER BY po."orderedAt" DESC
    `;

    // linesを別途取得
    const orderIds = ordersData.map((o) => o.id);
    const lines = orderIds.length > 0 ? await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: { in: orderIds } },
    }) : [];

    const orders = ordersData.map((order) => ({
      id: order.id,
      type: order.type,
      supplierId: order.supplierId,
      totalAmount: order.totalAmount,
      taxType: order.taxType,
      taxAmount: order.taxAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt,
      customerName: order.customerName,
      orderedAt: order.orderedAt,
      invoiceDate: order.invoiceDate,
      deliveryDate: order.deliveryDate,
      paymentDueDate: order.paymentDueDate,
      purchaseOrderImagePath: order.purchaseOrderImagePath,
      quoteImagePath: order.quoteImagePath,
      invoiceImagePath: order.invoiceImagePath,
      note: order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      supplier: order.supplier_id ? {
        id: order.supplier_id,
        name: order.supplier_name!,
        code: order.supplier_code!,
      } : null,
      lines: lines.filter((l) => l.purchaseOrderId === order.id),
      _count: {
        sims: order._count_sims,
      },
    }));

    logger.debug('発注一覧取得完了', { count: orders.length });

    return orders;
  }

  /**
   * 発注を作成
   */
  async create(data: PurchaseOrderCreateInput): Promise<PurchaseOrderWithRelations> {
    logger.info('発注作成開始', { type: data.type, supplierId: data.supplierId });

    const order = await this.prisma.purchaseOrder.create({
      data: {
        type: data.type as $Enums.PurchaseOrderType,
        supplierId: data.supplierId || null,
        totalAmount: data.totalAmount,
        ...(data.taxType !== undefined && { taxType: data.taxType }),
        ...(data.taxAmount !== undefined && { taxAmount: data.taxAmount }),
        customerName: data.customerName || null,
        paymentStatus: data.paymentStatus as $Enums.SimplePaymentStatus | null ?? null,
        note: data.note || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate as string) : null,
        paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate as string) : null,
        lines: {
          create: data.lines.map((l) => ({
            name: l.name || null,
            carrierType: l.carrierType ? (l.carrierType as $Enums.CarrierType) : null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            isIncludedInUnitCost: l.isIncludedInUnitCost ?? false,
          })),
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: true,
      },
    });

    logger.info('発注作成完了', { id: order.id });

    return order as unknown as PurchaseOrderWithRelations;
  }

  /**
   * 発注を取得（IDで）
   */
  async findById(id: string): Promise<PurchaseOrderWithRelations | null> {
    logger.debug('発注取得', { id });

    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: true,
      },
    });

    return order as unknown as PurchaseOrderWithRelations | null;
  }

  /**
   * 発注を更新
   */
  async update(id: string, data: PurchaseOrderUpdateInput): Promise<PurchaseOrderWithRelations> {
    logger.info('発注更新開始', { id });

    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) {
      updateData.status = data.status as $Enums.PurchaseOrderStatus;
    }
    if (data.paymentStatus !== undefined) {
      updateData.paymentStatus = data.paymentStatus as $Enums.SimplePaymentStatus | null;
    }
    if (data.paidAt !== undefined) {
      updateData.paidAt = data.paidAt ? new Date(data.paidAt as string) : null;
    }
    if (data.invoiceDate !== undefined) {
      updateData.invoiceDate = data.invoiceDate ? new Date(data.invoiceDate as string) : null;
    }
    if (data.deliveryDate !== undefined) {
      updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate as string) : null;
    }
    if (data.paymentDueDate !== undefined) {
      updateData.paymentDueDate = data.paymentDueDate ? new Date(data.paymentDueDate as string) : null;
    }
    if (data.totalAmount !== undefined) {
      updateData.totalAmount = data.totalAmount;
    }

    const order = await this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: true,
      },
    });

    logger.info('発注更新完了', { id });

    return order as unknown as PurchaseOrderWithRelations;
  }

  /**
   * 発注を明細ごと更新（トランザクション）
   */
  async updateWithLines(id: string, data: {
    supplierId?: number | null;
    customerName?: string | null;
    totalAmount: number;
    taxType?: string;
    taxAmount?: number;
    note?: string | null;
    deliveryDate?: Date | string | null;
    paymentDueDate?: Date | string | null;
    lines: {
      name?: string | null;
      carrierType?: string | null;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      isIncludedInUnitCost?: boolean;
    }[];
  }): Promise<PurchaseOrderWithRelations> {
    logger.info('発注明細更新開始', { id });

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: id },
      });

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          customerName: data.customerName,
          totalAmount: data.totalAmount,
          ...(data.taxType !== undefined && { taxType: data.taxType }),
          ...(data.taxAmount !== undefined && { taxAmount: data.taxAmount }),
          note: data.note,
          ...(data.deliveryDate !== undefined && {
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate as string) : null,
          }),
          ...(data.paymentDueDate !== undefined && {
            paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate as string) : null,
          }),
          lines: {
            create: data.lines.map((l) => ({
              name: l.name || null,
              carrierType: l.carrierType ? (l.carrierType as $Enums.CarrierType) : null,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
              isIncludedInUnitCost: l.isIncludedInUnitCost ?? false,
            })),
          },
        },
        include: {
          supplier: {
            select: { id: true, name: true, code: true },
          },
          lines: true,
        },
      });
    });

    logger.info('発注明細更新完了', { id });

    return order as unknown as PurchaseOrderWithRelations;
  }

  /**
   * 発注の画像パスを更新
   */
  async updateImagePath(id: string, fieldName: string, url: string): Promise<PurchaseOrderWithRelations> {
    logger.info('発注画像パス更新', { id, fieldName });

    const order = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        [fieldName]: url,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: true,
      },
    });

    logger.info('発注画像パス更新完了', { id });

    return order as unknown as PurchaseOrderWithRelations;
  }
}
