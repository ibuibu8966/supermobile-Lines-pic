import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { deleteReferral } from "@/controllers/application.controller";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

// 紹介者削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  try {
    const { rid } = await params;
    return await deleteReferral(rid, prisma, getAdminSession);
  } catch (error) {
    logger.logError("DELETE /referrals/[rid] error", error);
    return NextResponse.json({ error: "紹介者の削除に失敗しました" }, { status: 500 });
  }
}
