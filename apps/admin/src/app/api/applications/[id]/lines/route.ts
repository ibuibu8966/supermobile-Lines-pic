import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getApplicationLines } from "@/controllers/line.controller";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

// 回線一覧取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  return await getApplicationLines(id, prisma);
}
