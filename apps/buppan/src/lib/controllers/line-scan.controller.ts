/**
 * Line Scan Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { LineScanService } from '../services/line-scan.service';
import { logger } from '../shared/utils/logger';
import { z } from 'zod';

// Validation Schema
const scanSchema = z.object({
  iccids: z
    .array(z.string().regex(/^[A-Z0-9]{15,20}$/, 'ICCIDは15〜20桁の英数字（大文字）です'))
    .min(1)
    .max(1000),
  contractMonth: z.coerce.date(),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
});

/**
 * ICCID一括割当コントローラー
 */
export async function scanIccids(
  applicationId: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  logger.info('ICCID一括割当開始', { applicationId });

  // 1. リクエストボディのパース & バリデーション
  const body = await request.json();
  const validated = scanSchema.parse(body);

  // 2. Service呼び出し
  const lineScanService = new LineScanService(prisma);
  const result = await lineScanService.scanIccids(applicationId, validated);

  // 3. レスポンス
  logger.info('ICCID一括割当完了', { applicationId, assignedCount: result.assignedCount });
  return NextResponse.json(result);
}
