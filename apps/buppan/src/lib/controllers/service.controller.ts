/**
 * Service Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceService } from '../services/service.service';
import { ServiceRepository } from '../repositories/service.repository';
import { parseBooleanParam } from '../shared/validators/validation';
import { logger } from '../shared/utils/logger';
import { NotFoundError } from '../shared/errors/custom-errors';

/**
 * サービス一覧取得コントローラー
 */
export async function getAllServices(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    includeInactive: parseBooleanParam(searchParams.get('includeInactive')),
  };

  // 2. Service呼び出し
  const serviceService = new ServiceService(new ServiceRepository(prisma));
  const services = await serviceService.getServiceList(filters);

  // 3. レスポンス
  return NextResponse.json(services);
}

/**
 * サービス作成コントローラー
 */
const serviceSchema = z.object({
  code: z.string().min(1, 'コードは必須です').max(50),
  name: z.string().min(1, '名前は必須です').max(100),
  isActive: z.boolean().optional().default(true),
});

export async function createService(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = serviceSchema.parse(body);

  // 2. Service呼び出し
  const serviceService = new ServiceService(new ServiceRepository(prisma));
  const service = await serviceService.createService(validated);

  // 3. レスポンス
  return NextResponse.json(service, { status: 201 });
}

/**
 * サービス詳細取得コントローラー
 */
export async function getServiceDetail(
  id: string,
  prisma: any
): Promise<NextResponse> {
  logger.info('サービス詳細取得開始', { id });

  // Service呼び出し
  const serviceService = new ServiceService(new ServiceRepository(prisma));
  const service = await serviceService.getServiceDetail(id);

  if (!service) {
    throw new NotFoundError('Service', id);
  }

  // レスポンス
  return NextResponse.json(service);
}

/**
 * サービス更新コントローラー
 */
const updateServiceSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function updateService(
  id: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  logger.info('サービス更新開始', { id });

  // 1. リクエストボディのパース & バリデーション
  const body = await request.json();
  const validated = updateServiceSchema.parse(body);

  // 2. Service呼び出し
  const serviceService = new ServiceService(new ServiceRepository(prisma));
  const updated = await serviceService.updateService(id, validated);

  // 3. レスポンス
  logger.info('サービス更新完了', { id });
  return NextResponse.json(updated);
}

/**
 * サービス削除コントローラー
 */
export async function deleteService(
  id: string,
  prisma: any
): Promise<NextResponse> {
  logger.info('サービス削除開始', { id });

  // Service呼び出し
  const serviceService = new ServiceService(new ServiceRepository(prisma));
  const result = await serviceService.deleteService(id);

  // レスポンス
  logger.info('サービス削除完了', { id, result });
  return NextResponse.json(result);
}
