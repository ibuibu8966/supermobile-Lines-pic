import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getPlanById, updatePlan, deletePlan } from "@/controllers/plan.controller";

export const dynamic = "force-dynamic";

// 詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getPlanById(id, prisma);
}

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updatePlan(id, request, prisma);
}

// 削除
export async function DELETE (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await deletePlan(id, prisma);
}
