import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { bulkUpdatePurchaseOrderSims } from "@/controllers/procurement.controller";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await bulkUpdatePurchaseOrderSims(id, request, prisma);
}
