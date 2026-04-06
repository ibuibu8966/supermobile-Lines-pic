import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { addReferral } from "@/controllers/application.controller";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

// 紹介者追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await addReferral(id, request, prisma, getAdminSession);
  } catch (error) {
    logger.logError("POST /referrals error", error);
    return NextResponse.json({ error: "紹介者の追加に失敗しました" }, { status: 500 });
  }
}
