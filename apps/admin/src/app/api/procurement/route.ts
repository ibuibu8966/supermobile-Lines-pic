import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllPurchaseOrders, createPurchaseOrder } from "@/controllers/procurement.controller";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return await getAllPurchaseOrders(prisma, request);
}

export async function POST(request: NextRequest) {
  return await createPurchaseOrder(request, prisma);
}
