import { PrismaClient } from '@prisma/client';
/**
 * Plan Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanService } from '../services/plan.service';
import { PlanRepository } from '../repositories/plan.repository';
import { logger } from '../shared/utils/logger';
import { NotFoundError } from '../shared/errors/custom-errors';
import { z } from 'zod';

// Validation Schemas
const pricingSchema = z.object({
  id: z.string().cuid().optional(),
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  unitPrice: z.number().int().min(0),
  description: z.string().max(200).optional().nullable(),
});

const lineIncrementValue = z.number().int().refine(v => [1, 10, 100].includes(v), {
  message: "増加単位は1, 10, 100のいずれかです"
});

const planSchema = z.object({
  serviceId: z.string().cuid("サービスを選択してください"),
  code: z.string().min(1, "コードは必須です").max(50),
  name: z.string().min(1, "名前は必須です").max(100),
  description: z.string().max(500).optional().nullable(),
  features: z.array(z.string().max(50)).max(10).optional().default([]),
  lineIncrements: z.array(lineIncrementValue).min(1, "最低1つの増加単位を選択してください").optional().default([10]),
  minLineCount: z.number().int().min(1, "最小回線数は1以上です").optional().default(10),
  usageTagIds: z.array(z.number().int()).optional().default([]),
  pricings: z.array(pricingSchema).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const updatePlanSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  features: z.array(z.string().max(50)).max(10).optional(),
  lineIncrements: z.array(lineIncrementValue).min(1).optional(),
  minLineCount: z.number().int().min(1).optional(),
  usageTagIds: z.array(z.number().int()).optional(),
  pricings: z.array(pricingSchema).optional(),
  isActive: z.boolean().optional(),
});

/**
 * プラン一覧取得コントローラー
 */
export async function getAllPlans(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  // 1. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    includeInactive: searchParams.get("includeInactive") === "true",
    serviceId: searchParams.get("serviceId") || undefined,
  };

  // 2. Service呼び出し
  const planService = new PlanService(new PlanRepository(prisma), prisma);
  const plans = await planService.getPlanList(filters);

  // 3. レスポンス
  return NextResponse.json(plans);
}

/**
 * プラン作成コントローラー
 */
export async function createPlan(
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  // 1. バリデーション
  const body = await request.json();
  const result = planSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: result.error.flatten() },
      { status: 400 }
    );
  }
  const validated = result.data;

  // 2. Service呼び出し
  const planService = new PlanService(new PlanRepository(prisma), prisma);
  const plan = await planService.createPlan(validated);

  // 3. レスポンス
  return NextResponse.json(plan, { status: 201 });
}

/**
 * プラン詳細取得コントローラー
 */
export async function getPlanById(
  id: string,
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('プラン詳細取得開始', { id });

  // Service呼び出し
  const planService = new PlanService(new PlanRepository(prisma), prisma);
  const plan = await planService.getPlanById(id);

  if (!plan) {
    throw new NotFoundError('Plan', id);
  }

  // レスポンス
  return NextResponse.json(plan);
}

/**
 * プラン更新コントローラー
 */
export async function updatePlan(
  id: string,
  request: NextRequest,
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('プラン更新開始', { id });

  // 1. リクエストボディのパース & バリデーション
  const body = await request.json();
  const result = updatePlanSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: result.error.flatten() },
      { status: 400 }
    );
  }
  const validated = result.data;

  // 2. Service呼び出し
  const planService = new PlanService(new PlanRepository(prisma), prisma);
  const updated = await planService.updatePlan(id, validated);

  // 3. レスポンス
  logger.info('プラン更新完了', { id });
  return NextResponse.json(updated);
}

/**
 * プラン削除コントローラー
 */
export async function deletePlan(
  id: string,
  prisma: PrismaClient
): Promise<NextResponse> {
  logger.info('プラン削除開始', { id });

  // Service呼び出し
  const planService = new PlanService(new PlanRepository(prisma), prisma);
  const result = await planService.deletePlan(id);

  // レスポンス
  logger.info('プラン削除完了', { id, result });
  return NextResponse.json(result);
}
