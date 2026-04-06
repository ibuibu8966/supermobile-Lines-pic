import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getInStockIccids, getInStockIccidsWithValidation } from "@/controllers/sim.controller";

export const dynamic = "force-dynamic";

/**
 * GET /api/sims/in-stock-iccids
 * - planId なし: IN_STOCK ICCID配列のみ返す（後方互換）
 * - planId あり: 用途タグ検証情報付きで返す
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const planId = request.nextUrl.searchParams.get('planId');
  if (planId) {
    return await getInStockIccidsWithValidation(request, prisma);
  }
  return await getInStockIccids(prisma);
}
