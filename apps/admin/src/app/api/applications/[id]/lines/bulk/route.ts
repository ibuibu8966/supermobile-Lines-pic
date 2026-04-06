import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { bulkUpdateApplicationLines } from "@/controllers/line.controller";

export const dynamic = "force-dynamic";

// 回線一括更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await bulkUpdateApplicationLines(id, request, prisma);
}
