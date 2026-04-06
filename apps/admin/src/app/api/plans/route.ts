import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllPlans, createPlan } from "@/controllers/plan.controller";

export const dynamic = "force-dynamic";

// 一覧取得
export async function GET (request: NextRequest) {
  return await getAllPlans(request, prisma);
}

// 新規作成
export async function POST (request: NextRequest) {
  return await createPlan(request, prisma);
}
