import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

// SUPER_ADMIN / EMPLOYEE のユーザー一覧取得（担当者選択用）
export async function GET() {
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof Response) return sessionResult;

  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "EMPLOYEE"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}
