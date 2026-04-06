import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { deleteTracking } from "@/controllers/application.controller";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

// 追跡番号削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  try {
    const { tid } = await params;
    return await deleteTracking(tid, prisma, getAdminSession);
  } catch (error) {
    logger.logError("DELETE /trackings/[tid] error", error);
    return NextResponse.json({ error: "追跡番号の削除に失敗しました" }, { status: 500 });
  }
}
