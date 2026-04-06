/**
 * Sim Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimService } from '../services/sim.service';
import { SimRepository } from '../repositories/sim.repository';
import { parsePaginationParams, safeParseInt } from '../shared/validators/validation';
import { logger } from '../shared/utils/logger';
import { NotFoundError } from '../shared/errors/custom-errors';
import { z } from 'zod';

// Validation Schema
const updateSimSchema = z.object({
  msisdn: z.string().regex(/^0\d{9,10}$/).optional().nullable(),
  simType: z.enum(['INDIVIDUAL', 'CORPORATE']).optional(),
  carrierType: z.enum(['DOCOMO', 'AU', 'SOFTBANK', 'RAKUTEN']).optional().nullable(),
  plan: z.string().optional().nullable(),
  isMnpEligible: z.boolean().optional(),
  isAutoCancel: z.boolean().optional(),
  autoCancelDate: z.coerce.date().optional().nullable(),
  mnpReservationNumber: z.string().max(20).optional().nullable(),
  mnpExpiryDate: z.coerce.date().optional().nullable(),
  status: z.enum(['IN_STOCK', 'ACTIVE', 'RETURNING', 'RETIRED', 'CANCELLED']).optional(),
  simLocationTagId: z.number().int().positive().optional().nullable(),
});

/**
 * SIM一覧取得コントローラー
 */
export async function getAllSims(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    carrier: searchParams.get('carrier') || undefined,
    supplierId: safeParseInt(searchParams.get('supplier')) || undefined,
    simLocationTagId: safeParseInt(searchParams.get('simLocationTagId')) || undefined,
  };

  const pagination = parsePaginationParams(searchParams);

  // 2. Service呼び出し
  const simService = new SimService(new SimRepository(prisma), prisma);

  const result = await simService.getSimList(filters, pagination);

  // 3. レスポンス
  return NextResponse.json({
    data: result.sims,
    pagination: result.pagination,
  });
}

/**
 * SIM詳細取得コントローラー（販売可能タグ含む）
 */
export async function getSimDetail(
  iccid: string,
  prisma: any
): Promise<NextResponse> {
  logger.info('SIM詳細取得開始', { iccid });

  // Service呼び出し
  const simService = new SimService(new SimRepository(prisma), prisma);
  const sim = await simService.getSimDetail(iccid);

  if (!sim) {
    throw new NotFoundError('SIM', iccid);
  }

  // レスポンス
  return NextResponse.json(sim);
}

/**
 * SIM更新コントローラー
 */
export async function updateSim(
  iccid: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  logger.info('SIM更新開始', { iccid });

  // 1. リクエストボディのパース & バリデーション
  const body = await request.json();
  const validated = updateSimSchema.parse(body);

  // 2. Service呼び出し
  const simService = new SimService(new SimRepository(prisma), prisma);
  const updated = await simService.updateSim(iccid, validated);

  // 3. レスポンス
  logger.info('SIM更新完了', { iccid });
  return NextResponse.json(updated);
}
