import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getPurchaseOrderSims } from "@/controllers/procurement.controller";

export const dynamic = "force-dynamic";

// 発注に紐づくSIM一覧取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getPurchaseOrderSims(id, prisma);
}
