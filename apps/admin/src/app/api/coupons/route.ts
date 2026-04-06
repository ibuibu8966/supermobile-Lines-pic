import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllCoupons, createCoupon } from "@/controllers/coupon.controller";

export const dynamic = "force-dynamic";

// 一覧取得
export async function GET (request: NextRequest) {
  return await getAllCoupons(request, prisma);
}

// 新規作成
export async function POST (request: NextRequest) {
  return await createCoupon(request, prisma);
}
