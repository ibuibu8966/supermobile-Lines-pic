/**
 * Usage Rule Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 */

import { NextRequest, NextResponse } from 'next/server';
import { UsageRuleService, UsageRuleUpdateInput } from '../services/usage-rule.service';
import { logger } from '../shared/utils/logger';
import { z } from 'zod';

// Validation Schemas
const usageRuleSchema = z.object({
  usageTagId: z.number().int().positive('用途タグを選択してください'),
  supplierFilter: z.string().max(50).optional().nullable(),
  carrierFilter: z.enum(['DOCOMO', 'AU', 'SOFTBANK', 'RAKUTEN']).optional().nullable(),
  planFilter: z.string().max(100).optional().nullable(),
  excludedTagIds: z.array(z.number().int()).optional().default([]),
  minContractDays: z.number().int().min(0).optional().default(0),
  requiresMnp: z.boolean().optional().default(false),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
  priority: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateUsageRuleSchema = z.object({
  usageTagId: z.number().int().positive().optional(),
  supplierFilter: z.string().max(50).optional().nullable(),
  carrierFilter: z.enum(['DOCOMO', 'AU', 'SOFTBANK', 'RAKUTEN']).optional().nullable(),
  planFilter: z.string().max(100).optional().nullable(),
  excludedTagIds: z.array(z.number().int()).optional(),
  minContractDays: z.number().int().min(0).optional(),
  requiresMnp: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * ルール一覧取得コントローラー
 */
export async function getAllUsageRules(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    includeInactive: searchParams.get('includeInactive') === 'true',
    usageTagId: searchParams.get('usageTagId') ? parseInt(searchParams.get('usageTagId')!) : undefined,
  };

  // Service呼び出し
  const ruleService = new UsageRuleService(prisma);
  const rules = await ruleService.getRuleList(filters);

  return NextResponse.json(rules);
}

/**
 * ルール作成コントローラー
 */
export async function createUsageRule(
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  // バリデーション
  const body = await request.json();
  const validated = usageRuleSchema.parse(body);

  // Service呼び出し
  const ruleService = new UsageRuleService(prisma);
  const rule = await ruleService.createRule(validated);

  return NextResponse.json(rule, { status: 201 });
}

/**
 * ルール詳細取得コントローラー
 */
export async function getUsageRuleDetail(
  id: string,
  prisma: any
): Promise<NextResponse> {
  const ruleId = parseInt(id);
  const ruleService = new UsageRuleService(prisma);
  const rule = await ruleService.getRuleDetail(ruleId);
  return NextResponse.json(rule);
}

/**
 * ルール更新コントローラー
 */
export async function updateUsageRule(
  id: string,
  request: NextRequest,
  prisma: any
): Promise<NextResponse> {
  const ruleId = parseInt(id);

  // バリデーション
  const body = await request.json();
  const validated = updateUsageRuleSchema.parse(body);

  // Service呼び出し
  const ruleService = new UsageRuleService(prisma);
  const updated = await ruleService.updateRule(ruleId, validated);

  return NextResponse.json(updated);
}

/**
 * ルール削除コントローラー
 */
export async function deleteUsageRule(
  id: string,
  prisma: any
): Promise<NextResponse> {
  const ruleId = parseInt(id);

  // Service呼び出し
  const ruleService = new UsageRuleService(prisma);
  const result = await ruleService.deleteRule(ruleId);

  return NextResponse.json(result);
}
