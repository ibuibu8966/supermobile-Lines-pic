import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getAllApplications } from "@/controllers/application.controller";

export const dynamic = "force-dynamic";

// 全サービス統合一覧取得
export async function GET (request: NextRequest) {
  return await getAllApplications(request, prisma, getAdminSession);
}
