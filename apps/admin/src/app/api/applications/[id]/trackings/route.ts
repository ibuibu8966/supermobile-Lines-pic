import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { addTracking } from "@/controllers/application.controller";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

// 追跡番号追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await addTracking(id, request, prisma, getAdminSession);
  } catch (error) {
    logger.logError("POST /trackings error", error);
    return NextResponse.json({ error: "追跡番号の追加に失敗しました" }, { status: 500 });
  }
}
