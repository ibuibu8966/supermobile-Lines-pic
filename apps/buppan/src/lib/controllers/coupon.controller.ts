/**
 * Coupon Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CouponService } from '../services/coupon.service';
import { CouponRepository } from '../repositories/coupon.repository';
import { parseBooleanParam } from '../shared/validators/validation';
import { logger } from '../shared/utils/logger';

/**
 * クーポン一覧取得コントローラー
 */
export async function getAllCoupons(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    includeInactive: parseBooleanParam(searchParams.get('includeInactive')),
  };

  // 2. Service呼び出し
  const couponService = new CouponService(new CouponRepository(prisma));
  const coupons = await couponService.getCouponList(filters);

  // 3. レスポンス
  return NextResponse.json(coupons);
}

/**
 * クーポン作成コントローラー
 */
const couponSchema = z.object({
  code: z.string().min(1, 'コードは必須です').max(50),
  planId: z.string().cuid('プランを選択してください'),
  unitPrice: z.number().int().min(0, '単価は0以上で入力してください'),
  description: z.string().max(200).optional().nullable(),
  maxUsages: z.number().int().min(1).optional().nullable(),
  validFrom: z.coerce.date({ required_error: '有効開始日は必須です' }),
  validUntil: z.coerce.date({ required_error: '有効終了日は必須です' }),
  isActive: z.boolean().optional().default(true),
});

export async function createCoupon(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = couponSchema.parse(body);

  // 2. Service呼び出し
  const couponService = new CouponService(new CouponRepository(prisma));
  const coupon = await couponService.createCoupon(validated);

  // 3. レスポンス
  return NextResponse.json(coupon, { status: 201 });
}

/**
 * クーポン更新コントローラー
 */
const updateCouponSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  planId: z.string().cuid().optional(),
  unitPrice: z.number().int().min(0).optional(),
  description: z.string().max(200).optional().nullable(),
  maxUsages: z.number().int().min(1).optional().nullable(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function updateCoupon(
  id: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const validated = updateCouponSchema.parse(body);

  // 2. Service呼び出し
  const couponService = new CouponService(new CouponRepository(prisma));
  const coupon = await couponService.updateCoupon(id, validated);

  // 3. レスポンス
  return NextResponse.json(coupon);
}

/**
 * クーポン削除コントローラー
 */
export async function deleteCoupon(
  id: string,
  prisma: any
): Promise<NextResponse> {
  // Service呼び出し
  const couponService = new CouponService(new CouponRepository(prisma));
  const result = await couponService.deleteCoupon(id);

  // レスポンス
  return NextResponse.json(result);
}
