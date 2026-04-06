import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllServices, createService } from "@/controllers/service.controller";

export const dynamic = "force-dynamic";

// 一覧取得
export async function GET (request: NextRequest) {
  return await getAllServices(request, prisma);
}

// 新規作成
export async function POST (request: NextRequest) {
  return await createService(request, prisma);
}
