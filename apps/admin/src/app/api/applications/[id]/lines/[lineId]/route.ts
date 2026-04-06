import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getApplicationLineDetail, updateApplicationLine } from "@/controllers/line.controller";

export const dynamic = "force-dynamic";

// 回線詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params;
  return await getApplicationLineDetail(id, lineId, prisma);
}

// 回線更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params;
  return await updateApplicationLine(id, lineId, request, prisma);
}
