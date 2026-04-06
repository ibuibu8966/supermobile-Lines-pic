import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { scanIccids } from "@/controllers/line-scan.controller";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 大量ICCID登録時のタイムアウト対策（デフォルト: 10s）

// ICCID一括割当
export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await scanIccids(id, request, prisma);
}
