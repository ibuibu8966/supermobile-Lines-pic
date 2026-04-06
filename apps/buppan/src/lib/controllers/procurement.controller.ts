/**
 * Procurement Controller
 *
 * 発注管理のコントローラー層
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ProcurementService } from '../services/procurement.service';
import { ProcurementSimImportService } from '../services/procurement-sim-import.service';
import { ImageUploadService, StorageClient } from '../services/image-upload.service';
import { logger } from '../shared/utils/logger';

/**
 * 発注一覧を取得
 */
export async function getAllPurchaseOrders(prisma: PrismaClient): Promise<NextResponse> {
  const service = new ProcurementService(prisma);
  const orders = await service.getAllPurchaseOrders();
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
  const service = new ProcurementService(prisma);
  const order = await service.createPurchaseOrder(body);
  return NextResponse.json(order, { status: 201 });
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
  const service = new ProcurementService(prisma);
  const order = await service.updatePurchaseOrder(id, body);
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

  // 必須パラメータチェック
  if (!file || !imageType) {
    return NextResponse.json(
      { error: 'ファイルと画像タイプが必要です' },
      { status: 400 }
    );
  }

  // 画像アップロードサービス
  const imageService = new ImageUploadService(storageClient);

  // 画像タイプのバリデーション
  if (!imageService.isValidImageType(imageType, validImageTypes)) {
    return NextResponse.json(
      { error: '無効な画像タイプです' },
      { status: 400 }
    );
  }

  // 発注を取得
  const procurementService = new ProcurementService(prisma);
  const order = await procurementService.getPurchaseOrderById(id);

  // フィールド名を取得
  const fieldName = imageTypeFieldMap[imageType];
  const existingUrl = order[fieldName];

  // 画像をアップロード
  const uploadResult = await imageService.uploadImage(
    id,
    imageType,
    file,
    existingUrl
  );

  // データベースを更新
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
  const service = new ProcurementSimImportService(prisma);
  const result = await service.importSims(id, body);
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

  // 必須パラメータチェック
  if (!imageType) {
    return NextResponse.json(
      { error: '画像タイプが必要です' },
      { status: 400 }
    );
  }

  // 画像アップロードサービス
  const imageService = new ImageUploadService(storageClient);

  // 画像タイプのバリデーション
  if (!imageService.isValidImageType(imageType, validImageTypes)) {
    return NextResponse.json(
      { error: '無効な画像タイプです' },
      { status: 400 }
    );
  }

  // 発注を取得
  const procurementService = new ProcurementService(prisma);
  const order = await procurementService.getPurchaseOrderById(id);

  // フィールド名を取得
  const fieldName = imageTypeFieldMap[imageType];
  const imageUrl = order[fieldName];

  if (!imageUrl) {
    return NextResponse.json(
      { error: '削除する画像がありません' },
      { status: 404 }
    );
  }

  // 画像を削除
  await imageService.deleteImage(imageUrl, id);

  // データベースを更新
  const updatedOrder = await procurementService.updateImagePath(
    id,
    fieldName,
    null as any // nullで画像パスをクリア
  );

  // nullを設定するために、直接updateする
  const finalOrder = await prisma.purchaseOrder.update({
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

  return NextResponse.json(finalOrder);
}
