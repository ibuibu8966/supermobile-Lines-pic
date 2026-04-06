/**
 * Procurement Controller
 *
 * 仕入れ・経費管理のコントローラー層
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ProcurementService } from '../services/procurement.service';
import { ProcurementSimImportService } from '../services/procurement-sim-import.service';
import { ImageUploadService, StorageClient } from '../services/image-upload.service';
import { logger } from '../shared/utils/logger';
import type { PurchaseOrderType } from '../types/procurement';

// ==================== Validation Schemas ====================

const PURCHASE_ORDER_TYPES = ['PURCHASE_ORDER', 'SUPPLIER_INVOICE', 'EXPENSE', 'CUSTOMER_INVOICE'] as const;
const CARRIER_TYPES = ['DOCOMO', 'AU', 'SOFTBANK', 'RAKUTEN'] as const;
const PURCHASE_ORDER_STATUSES = ['ORDERED', 'CONFIRMED', 'AWAITING_SEAL', 'BEFORE_PAYMENT', 'AWAITING_DELIVERY', 'DELIVERED'] as const;
const PAYMENT_STATUSES = ['UNPAID', 'PAID'] as const;

const createPurchaseOrderSchema = z.object({
  type: z.enum(PURCHASE_ORDER_TYPES),
  supplierId: z.number().int().positive('仕入先IDは正の整数である必要があります').nullable().optional(),
  totalAmount: z.number().positive('金額は正の数である必要があります').optional(),
  customerName: z.string().max(200).nullable().optional(),
  lines: z
    .array(
      z.object({
        name: z.string().max(200).nullable().optional(),
        carrierType: z.enum(CARRIER_TYPES).nullable().optional(),
        quantity: z.number().int().positive('数量は正の整数である必要があります'),
        unitPrice: z.number().positive('単価は正の数である必要があります'),
        isIncludedInUnitCost: z.boolean().optional(),
      })
    )
    .min(1, '明細は1件以上必要です'),
  note: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  paymentDueDate: z.string().nullable().optional(),
  taxType: z.enum(['TAX_EXCLUDED', 'TAX_INCLUDED', 'TAX_FREE']).optional(),
  taxAmount: z.number().int().optional(),
});

const updatePurchaseOrderSchema = z.object({
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).nullable().optional(),
  paidAt: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  paymentDueDate: z.string().nullable().optional(),
  totalAmount: z.number().positive('金額は正の数である必要があります').optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  customerName: z.string().max(200).nullable().optional(),
  note: z.string().nullable().optional(),
  lines: z
    .array(
      z.object({
        name: z.string().max(200).nullable().optional(),
        carrierType: z.enum(CARRIER_TYPES).nullable().optional(),
        quantity: z.number().int().positive('数量は正の整数である必要があります'),
        unitPrice: z.number().positive('単価は正の数である必要があります'),
        isIncludedInUnitCost: z.boolean().optional(),
      })
    )
    .min(1, '明細は1件以上必要です')
    .optional(),
  taxType: z.enum(['TAX_EXCLUDED', 'TAX_INCLUDED', 'TAX_FREE']).optional(),
  taxAmount: z.number().int().optional(),
});

const importSimDataSchema = z.object({
  iccid: z.string().min(1, 'ICCIDは必須です'),
  msisdn: z.string().optional(),
  simType: z.enum(['INDIVIDUAL', 'CORPORATE', 'BOTH']).optional(),
  carrierType: z.enum(CARRIER_TYPES).optional(),
  plan: z.string().optional(),
  supplierContractEnd: z.string().optional(),
  isAutoCancel: z.boolean().optional(),
  autoCancelDate: z.string().optional(),
  eligibleTagIds: z.array(z.number().int()).optional(),
});

const importSimsSchema = z.object({
  sims: z.array(importSimDataSchema).min(1, 'SIMデータは1件以上必要です'),
  supplierId: z.number().int().positive('仕入先IDは正の整数である必要があります'),
  updateExisting: z.boolean().optional(),
});

/**
 * 一覧を取得（typeフィルター対応）
 */
export async function getAllPurchaseOrders(
  prisma: PrismaClient,
  request?: NextRequest
): Promise<NextResponse> {
  const typeFilter = request
    ? (new URL(request.url).searchParams.get('type') as PurchaseOrderType | null) ?? undefined
    : undefined;

  const service = new ProcurementService(prisma);
  const orders = await service.getAllPurchaseOrders(typeFilter);
  return NextResponse.json(orders);
}

/**
 * 発注を作成
 */
export async function createPurchaseOrder(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const body = await request.json();
  const result = createPurchaseOrderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: result.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const service = new ProcurementService(prisma);
    const order = await service.createPurchaseOrder(result.data);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    logger.error('発注作成エラー', { error: error instanceof Error ? error.message : error });
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '作成に失敗しました' },
      { status: statusCode }
    );
  }
}

/**
 * 発注を取得
 */
export async function getPurchaseOrderById(
  id: string,
  prisma: PrismaClient
): Promise<NextResponse> {
  const service = new ProcurementService(prisma);
  const order = await service.getPurchaseOrderById(id);
  return NextResponse.json(order);
}

/**
 * 発注を更新
 */
export async function updatePurchaseOrder(
  id: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const body = await request.json();
  const result = updatePurchaseOrderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: result.error.flatten() },
      { status: 400 }
    );
  }
  const service = new ProcurementService(prisma);

  if (result.data.lines) {
    const order = await service.updatePurchaseOrderFull(id, {
      supplierId: result.data.supplierId,
      customerName: result.data.customerName,
      lines: result.data.lines,
      note: result.data.note,
      deliveryDate: result.data.deliveryDate,
      paymentDueDate: result.data.paymentDueDate,
      taxType: result.data.taxType,
      taxAmount: result.data.taxAmount,
    });
    return NextResponse.json(order);
  }

  const order = await service.updatePurchaseOrder(id, result.data);
  return NextResponse.json(order);
}

/**
 * 発注の画像をアップロード
 */
export async function uploadPurchaseOrderImage(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  storageClient: StorageClient,
  imageTypeFieldMap: Record<string, string>,
  validImageTypes: string[]
): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const imageType = formData.get('imageType') as string;

  if (!file || !imageType) {
    return NextResponse.json(
      { error: 'ファイルと画像タイプが必要です' },
      { status: 400 }
    );
  }

  const imageService = new ImageUploadService(storageClient);

  if (!imageService.isValidImageType(imageType, validImageTypes)) {
    return NextResponse.json(
      { error: '無効な画像タイプです' },
      { status: 400 }
    );
  }

  const procurementService = new ProcurementService(prisma);
  const order = await procurementService.getPurchaseOrderById(id);

  const fieldName = imageTypeFieldMap[imageType];
  const existingUrl = (order as unknown as Record<string, unknown>)[fieldName] as string | null;

  const uploadResult = await imageService.uploadImage(
    id,
    imageType,
    file,
    existingUrl
  );

  const updatedOrder = await procurementService.updateImagePath(
    id,
    fieldName,
    uploadResult.url!
  );

  return NextResponse.json(updatedOrder);
}

/**
 * 発注にSIMを一括インポート
 */
export async function importSimsToPurchaseOrder(
  id: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const body = await request.json();
  const validation = importSimsSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: validation.error.flatten() },
      { status: 400 }
    );
  }
  const service = new ProcurementSimImportService(prisma);
  const result = await service.importSims(id, validation.data);
  return NextResponse.json(result);
}

/**
 * 発注の画像を削除
 */
export async function deletePurchaseOrderImage(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  storageClient: StorageClient,
  imageTypeFieldMap: Record<string, string>,
  validImageTypes: string[]
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const imageType = searchParams.get('imageType');

  if (!imageType) {
    return NextResponse.json(
      { error: '画像タイプが必要です' },
      { status: 400 }
    );
  }

  const imageService = new ImageUploadService(storageClient);

  if (!imageService.isValidImageType(imageType, validImageTypes)) {
    return NextResponse.json(
      { error: '無効な画像タイプです' },
      { status: 400 }
    );
  }

  const procurementService = new ProcurementService(prisma);
  const order = await procurementService.getPurchaseOrderById(id);

  const fieldName = imageTypeFieldMap[imageType];
  const imageUrl = (order as unknown as Record<string, unknown>)[fieldName] as string | null;

  if (!imageUrl) {
    return NextResponse.json(
      { error: '削除する画像がありません' },
      { status: 404 }
    );
  }

  await imageService.deleteImage(imageUrl, id);

  const updatedOrder = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      [fieldName]: null,
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

  return NextResponse.json(updatedOrder);
}

// ==================== Bulk Update Schema ====================

const bulkUpdateSimsSchema = z.object({
  iccids: z.array(z.string()).min(1, '1件以上のICCIDが必要です'),
  simType: z.enum(['INDIVIDUAL', 'CORPORATE', 'BOTH']).optional(),
  carrierType: z.enum(CARRIER_TYPES).nullable().optional(),
  plan: z.string().nullable().optional(),
  eligibleTagIds: z.array(z.number().int()).optional(),
  status: z.enum(['IN_STOCK', 'ACTIVE', 'RETURNING', 'RETIRED', 'CANCELLED']).optional(),
});

/**
 * 発注に紐づくSIMを一括更新
 */
export async function bulkUpdatePurchaseOrderSims(
  id: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const body = await request.json();
  const validation = bulkUpdateSimsSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { iccids, ...updateFields } = validation.data;

  // purchaseOrderの存在確認
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
  });
  if (!purchaseOrder) {
    return NextResponse.json({ error: '発注が見つかりません' }, { status: 404 });
  }

  // 更新データを構築（undefinedのフィールドは除外）
  const data: Record<string, unknown> = {};
  if (updateFields.simType !== undefined) data.simType = updateFields.simType;
  if (updateFields.carrierType !== undefined) data.carrierType = updateFields.carrierType;
  if (updateFields.plan !== undefined) data.plan = updateFields.plan;
  if (updateFields.eligibleTagIds !== undefined) data.eligibleTagIds = updateFields.eligibleTagIds;
  if (updateFields.status !== undefined) data.status = updateFields.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 });
  }

  try {
    const result = await prisma.sim.updateMany({
      where: {
        iccid: { in: iccids },
        purchaseOrderId: id,
      },
      data,
    });

    logger.info('SIM一括更新完了', {
      purchaseOrderId: id,
      updated: result.count,
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    logger.error('SIM一括更新エラー', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 発注に紐づくSIM一覧を取得
 */
export async function getPurchaseOrderSims(
  id: string,
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('発注SIM一覧取得開始', { purchaseOrderId: id });

  const sims = await prisma.sim.findMany({
    where: {
      purchaseOrderId: id,
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      simLocationTag: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  logger.info('発注SIM一覧取得完了', { count: sims.length });
  return NextResponse.json(sims);
}
