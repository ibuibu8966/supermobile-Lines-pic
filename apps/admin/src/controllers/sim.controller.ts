import { PrismaClient } from '@prisma/client';
/**
 * Sim Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimService } from '../services/sim.service';
import { SimRepository, SimFilters, SimIccidValidation } from '../repositories/sim.repository';
import { SimUpdateInput } from '@/entities';
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
  simLocationTagId: z.number().int().positive().optional().nullable(),
  eligibleTagIds: z.array(z.number().int()).optional(),
});

/**
 * SIM一覧取得コントローラー
 */
export async function getAllSims(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;

  // Handle special "NULL" value for simLocationTagId
  const simLocationParam = searchParams.get('simLocationTagId');
  const simLocationTagId = simLocationParam === 'NULL'
    ? null
    : (safeParseInt(simLocationParam) || undefined);

  const filters = {
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    carrier: searchParams.get('carrier') || undefined,
    simType: searchParams.get('simType') || undefined,
    autoCancelDateFrom: searchParams.get('autoCancelDateFrom') || undefined,
    autoCancelDateTo: searchParams.get('autoCancelDateTo') || undefined,
    supplierId: safeParseInt(searchParams.get('supplier')) || undefined,
    simLocationTagId,
  };

  const pagination = parsePaginationParams(searchParams);

  // 2. Service呼び出し
  const simService = new SimService(new SimRepository(prisma), prisma);

  const result = await simService.getSimList(filters as SimFilters, pagination);

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
  prisma: PrismaClient
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
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('SIM更新開始', { iccid });

  // 1. リクエストボディのパース & バリデーション
  const body = await request.json();
  const parseResult = updateSimSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const validated = parseResult.data;

  // 2. Service呼び出し
  const simService = new SimService(new SimRepository(prisma), prisma);
  const updated = await simService.updateSim(iccid, validated as SimUpdateInput);

  // 3. レスポンス
  logger.info('SIM更新完了', { iccid });
  return NextResponse.json(updated);
}

/**
 * IN_STOCK SIM ICCIDリスト取得（IccidScanModal用プリフェッチ）
 */
export async function getInStockIccids(
  prisma: PrismaClient
): Promise<NextResponse> {
  const repo = new SimRepository(prisma);
  const iccids = await repo.findInStockIccids();
  return NextResponse.json({ iccids });
}

/**
 * GET /api/sims/in-stock-iccids?planId=xxx
 * プランの用途タグに基づいてIN_STOCK SIMの検証情報を返す
 */
export async function getInStockIccidsWithValidation(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  const planId = request.nextUrl.searchParams.get('planId');
  if (!planId) {
    return NextResponse.json({ error: 'planIdが必要です' }, { status: 400 });
  }
  const repo = new SimRepository(prisma);
  const validation: Record<string, SimIccidValidation> = await repo.findInStockIccidsWithValidation(planId);
  return NextResponse.json({ validation });
}
