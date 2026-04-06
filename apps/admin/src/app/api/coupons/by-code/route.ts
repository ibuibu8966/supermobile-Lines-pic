import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

/**
 * クーポンコードから有効なクーポンを検索して単価を返す
 * GET /api/coupons/by-code?code=XXXX
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "コードが必要です" }, { status: 400 });
  }

  const coupon = await prisma.coupon.findFirst({
    where: { code: code.trim().toUpperCase(), isActive: true },
    select: {
      id: true,
      code: true,
      unitPrice: true,
      description: true,
      pricings: { orderBy: { minQuantity: "asc" } },
    },
  });

  if (!coupon) {
    return NextResponse.json({ error: "有効なクーポンが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(coupon);
}
