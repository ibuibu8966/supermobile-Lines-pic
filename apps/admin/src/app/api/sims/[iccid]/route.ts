import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getSimDetail, updateSim } from "@/controllers/sim.controller";

export const dynamic = "force-dynamic";

// 詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  const { iccid } = await params;
  return await getSimDetail(iccid, prisma);
}

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  const { iccid } = await params;
  return await updateSim(iccid, request, prisma);
}
