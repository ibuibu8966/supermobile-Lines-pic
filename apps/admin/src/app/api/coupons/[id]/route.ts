import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { updateCoupon, deleteCoupon } from "@/controllers/coupon.controller";

export const dynamic = "force-dynamic";

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateCoupon(id, request, prisma);
}

// 削除
export async function DELETE (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await deleteCoupon(id, prisma);
}
