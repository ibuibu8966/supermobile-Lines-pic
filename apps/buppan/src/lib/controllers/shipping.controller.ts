/**
 * Shipping Controller
 *
 * 発送・配送APIのコントローラー
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ShippingService } from '../services/shipping.service';
import { ShippingScanInput, ShippingCompleteInput } from '@/lib/entities';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

// スキャンリクエストスキーマ
const scanSchema = z.object({
  applicationLineId: z.string().min(1, '回線IDは必須です'),
  iccid: z.string().regex(/^[A-Z0-9]{15,20}$/, 'ICCIDは15〜20桁の英数字（大文字）です'),
  contractMonth: z.coerce.date().optional(),
  lineTagId: z.number().int().positive().optional().nullable(),
  lineReserveTagId: z.number().int().positive().optional().nullable(),
});

/**
 * SIMスキャンコントローラー
 *
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @returns スキャン結果
 */
export async function scanBarcode(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  try {
    // 1. パラメータ取得・バリデーション
    const body = await request.json();
    const validated = scanSchema.parse(body);

    // 2. 入力データを構築
    const input: ShippingScanInput = {
      applicationLineId: validated.applicationLineId,
      iccid: validated.iccid,
      contractMonth: validated.contractMonth,
      lineTagId: validated.lineTagId,
      lineReserveTagId: validated.lineReserveTagId,
    };

    // 3. Service呼び出し
    const shippingService = new ShippingService(prisma);
    const result = await shippingService.scanAndAssign(input);

    // 4. レスポンス
    return NextResponse.json(result);
  } catch (error) {
    logger.logError('SIMスキャンエラー', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof NotFoundError ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { error: 'SIMスキャン処理に失敗しました' },
      { status: 500 }
    );
  }
}

// 発送リクエストスキーマ
const shipSchema = z.object({
  applicationId: z.string().min(1, '申込IDは必須です'),
  lineIds: z.array(z.string()).min(1, '発送する回線を選択してください'),
});

/**
 * 発送完了コントローラー
 *
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @returns 発送完了結果
 */
export async function completeShipping(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  try {
    // 1. パラメータ取得・バリデーション
    const body = await request.json();
    const validated = shipSchema.parse(body);

    // 2. 入力データを構築
    const input: ShippingCompleteInput = {
      applicationId: validated.applicationId,
      lineIds: validated.lineIds,
    };

    // 3. Service呼び出し
    const shippingService = new ShippingService(prisma);
    const result = await shippingService.completeShipping(input);

    // 4. レスポンス
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.logError('発送処理エラー', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof NotFoundError ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { error: '発送処理に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 発送待ち一覧取得コントローラー
 *
 * @param serviceCode サービスコード
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @returns 発送待ち一覧
 */
export async function getShippingPending(
  serviceCode: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Service呼び出し
    const shippingService = new ShippingService(prisma);
    const result = await shippingService.getShippingPending(
      serviceCode,
      page,
      pageSize
    );

    // レスポンス
    return NextResponse.json(result);
  } catch (error) {
    logger.logError('発送待ち一覧取得エラー', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: '発送待ち一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
