/**
 * Procurement Repository
 *
 * 発注データのデータアクセス層
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';

export interface PurchaseOrderCreateInput {
  supplierId: number;
  totalAmount: number;
  note?: string | null;
  lines: {
    carrierType: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

export interface PurchaseOrderUpdateInput {
  status?: string;
  invoiceDate?: Date | null;
  deliveryDate?: Date | null;
  totalAmount?: number;
}

export interface PurchaseOrderInclude {
  supplier?: boolean | {
    select?: {
      id?: boolean;
      name?: boolean;
      code?: boolean;
    };
  };
  lines?: boolean;
  _count?: {
    select?: {
      sims?: boolean;
    };
  };
}

/**
 * 発注リポジトリ
 */
export class ProcurementRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 発注一覧を取得
   */
  async findMany(include?: PurchaseOrderInclude): Promise<any[]> {
    logger.debug('発注一覧取得');

    const defaultInclude: PurchaseOrderInclude = {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      lines: true,
      _count: {
        select: {
          sims: true,
        },
      },
    };

    const orders = await this.prisma.purchaseOrder.findMany({
      include: include || defaultInclude,
      orderBy: {
        orderedAt: 'desc',
      },
    });

    logger.debug('発注一覧取得完了', { count: orders.length });

    return orders;
  }

  /**
   * 発注を作成
   */
  async create(
    data: PurchaseOrderCreateInput,
    include?: PurchaseOrderInclude
  ): Promise<any> {
    logger.info('発注作成開始', { supplierId: data.supplierId });

    const order = await this.prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        totalAmount: data.totalAmount,
        note: data.note || null,
        lines: {
          create: data.lines,
        },
      },
      include: include || {
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

    return order;
  }

  /**
   * 発注を取得（IDで）
   */
  async findById(id: string): Promise<any | null> {
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

    return order;
  }

  /**
   * 発注を更新
   */
  async update(
    id: string,
    data: PurchaseOrderUpdateInput,
    include?: PurchaseOrderInclude
  ): Promise<any> {
    logger.info('発注更新開始', { id });

    const order = await this.prisma.purchaseOrder.update({
      where: { id },
      data,
      include: include || {
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

    return order;
  }

  /**
   * 発注の画像パスを更新
   */
  async updateImagePath(
    id: string,
    fieldName: string,
    url: string
  ): Promise<any> {
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

    return order;
  }
}
