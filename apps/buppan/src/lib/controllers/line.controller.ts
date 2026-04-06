/**
 * Line Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LineService } from '../services/line.service';
import { LineRepository } from '../repositories/line.repository';
import {
  parsePaginationParams,
  parseNumberArrayParam,
  parseArrayParam,
  parseBooleanParam,
  parseDateRange,
} from '../shared/validators/validation';
import { NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

/**
 * 回線一覧取得コントローラー
 */
export async function getAllLines(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    search: searchParams.get('search') || undefined,
    simLocationTagIds: parseNumberArrayParam(searchParams.get('simLocationTagIds')),
    lineReserveTagIds: parseNumberArrayParam(searchParams.get('lineReserveTagIds')),
    statuses: parseArrayParam(searchParams.get('statuses')),
    includeArchived: parseBooleanParam(searchParams.get('includeArchived')),
    shippedDateRange: parseDateRange(
      searchParams.get('shippedFrom'),
      searchParams.get('shippedTo')
    ),
    returnedDateRange: parseDateRange(
      searchParams.get('returnedFrom'),
      searchParams.get('returnedTo')
    ),
  };

  const pagination = parsePaginationParams(searchParams);

  // 2. Service呼び出し
  const lineService = new LineService(new LineRepository(prisma));

  const result = await lineService.getLineList(filters, pagination);

  // 3. レスポンス
  return NextResponse.json({
    data: result.lines,
    pagination: result.pagination,
  });
}

/**
 * 申込の回線詳細取得コントローラー
 */
export async function getApplicationLineDetail(
  applicationId: string,
  lineId: string,
  prisma: any
): Promise<NextResponse> {
  // Service呼び出し
  const lineService = new LineService(new LineRepository(prisma), prisma);

  const line = await lineService.getLineDetailByApplicationIdAndLineId(applicationId, lineId);

  if (!line) {
    throw new NotFoundError('回線');
  }

  // レスポンス
  return NextResponse.json(line);
}

/**
 * 回線更新コントローラー
 */
const updateLineSchema = z.object({
  lineReserveTagId: z.number().int().nullable().optional(),
  simLocationTagId: z.number().int().nullable().optional(),
  shippedAt: z.coerce.date().nullable().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  status: z.enum(['NOT_ACTIVATED', 'SHIPPED', 'ACTIVATED', 'RETURNED']).optional(),
  note: z.string().nullable().optional(),
});

export async function updateLine(
  id: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = updateLineSchema.parse(body);

  // 2. Service呼び出し
  const lineService = new LineService(new LineRepository(prisma));

  const updated = await lineService.updateLine(id, validated as any);

  // 3. レスポンス
  return NextResponse.json(updated);
}

/**
 * 申込の回線更新コントローラー（タグバリデーション付き）
 */
const updateApplicationLineSchema = z.object({
  simId: z.string().regex(/^[A-Z0-9]{15,20}$/, "ICCIDは15〜20桁の英数字（大文字）です").optional().nullable(),
  msisdn: z.string().regex(/^0\d{9,10}$/).optional().nullable(),
  status: z.enum([
    "NOT_ACTIVATED",
    "ACTIVATED",
    "SHIPPED",
    "RETURNED",
    "CANCELLED",
  ]).optional(),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
  contractMonth: z.coerce.date().optional().nullable(),
  shippedAt: z.coerce.date().optional().nullable(),
  returnedAt: z.coerce.date().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function updateApplicationLine(
  applicationId: string,
  lineId: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = updateApplicationLineSchema.parse(body);

  // 2. Service呼び出し
  const lineService = new LineService(new LineRepository(prisma), prisma);

  const updated = await lineService.updateLineWithValidation(applicationId, lineId, validated as any);

  // 3. レスポンス
  return NextResponse.json(updated);
}

/**
 * 申込の回線一括更新コントローラー
 */
const bulkUpdateLineSchema = z.object({
  lineIds: z.array(z.string()).min(1),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
  contractMonth: z.coerce.date().optional().nullable(),
  shippedAt: z.coerce.date().optional().nullable(),
  returnedAt: z.coerce.date().optional().nullable(),
});

export async function bulkUpdateApplicationLines(
  applicationId: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = bulkUpdateLineSchema.parse(body);

  // 2. Service呼び出し
  const lineService = new LineService(new LineRepository(prisma), prisma);

  const result = await lineService.bulkUpdateLines(
    applicationId,
    validated.lineIds,
    validated
  );

  // 3. レスポンス
  return NextResponse.json(result);
}

/**
 * 全回線一括更新コントローラー（申込IDなし）
 */
const bulkUpdateAllLinesSchema = z.object({
  lineIds: z.array(z.string()).min(1).max(1000),
  lineReserveTagId: z.number().int().optional().nullable(),
  shippedAt: z.string().optional().nullable(),
  returnedAt: z.string().optional().nullable(),
  status: z.enum(['NOT_ACTIVATED', 'ACTIVATED', 'SHIPPED', 'RETURNED', 'CANCELLED']).optional(),
  simLocationTagId: z.number().int().optional().nullable(),
});

export async function bulkUpdateAllLines(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const { lineIds, ...updateFields } = bulkUpdateAllLinesSchema.parse(body);

  // 2. Service呼び出し
  const lineService = new LineService(new LineRepository(prisma), prisma);

  const result = await lineService.bulkUpdateAllLines(lineIds, updateFields);

  // 3. レスポンス
  return NextResponse.json(result);
}
