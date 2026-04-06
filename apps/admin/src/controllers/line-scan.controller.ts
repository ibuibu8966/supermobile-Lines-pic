import { PrismaClient } from '@prisma/client';
/**
 * Line Scan Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { LineScanService } from '../services/line-scan.service';
import { handleApiError } from '../shared/errors/api-errors';
import { logger } from '../shared/utils/logger';
import { z } from 'zod';

// Validation Schema（一括登録用）
const scanSchema = z.object({
  iccids: z
    .array(z.string().regex(/^[A-Z0-9]{15,20}$/, 'ICCIDは15〜20桁の英数字（大文字）です'))
    .min(1)
    .max(1000),
  contractMonth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '契約月はYYYY-MM-DD形式で指定してください')
    .transform((s) => new Date(s + 'T00:00:00.000Z')), // UTC midnight に固定してタイムゾーンずれを防ぐ
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
});

// Validation Schema（1件登録用）
const scanSingleSchema = z.object({
  iccid: z.string().regex(/^[A-Z0-9]{15,20}$/, 'ICCIDは15〜20桁の英数字（大文字）です'),
  contractMonth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '契約月はYYYY-MM-DD形式で指定してください')
    .transform((s) => new Date(s + 'T00:00:00.000Z')),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
});

// Validation Schema（競合解決用）
const forceReassignSchema = z.object({
  iccid: z.string().regex(/^[A-Z0-9]{15,20}$/, 'ICCIDは15〜20桁の英数字（大文字）です'),
  cancelLineId: z.string().min(1, '解約する回線IDを指定してください'),
  contractMonth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '契約月はYYYY-MM-DD形式で指定してください')
    .transform((s) => new Date(s + 'T00:00:00.000Z')),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
});

/**
 * ICCID一括割当コントローラー
 */
export async function scanIccids(
  applicationId: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  try {
    logger.info('ICCID一括割当開始', { applicationId });

    const body = await request.json();
    const parseResult = scanSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const lineScanService = new LineScanService(prisma);
    const result = await lineScanService.scanIccids(applicationId, parseResult.data);

    logger.info('ICCID一括割当完了', { applicationId, assignedCount: result.assignedCount });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * ICCID 1件登録コントローラー（バックグラウンドキュー用）
 */
export async function scanSingleIccid(
  applicationId: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = scanSingleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { status: 'error', error: 'バリデーションエラー', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const lineScanService = new LineScanService(prisma);
    const result = await lineScanService.scanSingleIccid(applicationId, parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 競合解決コントローラー（旧回線をCANCELLED + 新回線にICCID割当）
 */
export async function forceReassign(
  applicationId: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = forceReassignSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { status: 'error', error: 'バリデーションエラー', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const lineScanService = new LineScanService(prisma);
    const result = await lineScanService.forceReassign(applicationId, parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
