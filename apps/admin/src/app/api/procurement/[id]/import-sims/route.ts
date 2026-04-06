import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { importSimsToPurchaseOrder } from "@/controllers/procurement.controller";

export const dynamic = "force-dynamic";

// SIM一括インポート
export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await importSimsToPurchaseOrder(id, request, prisma);
}
