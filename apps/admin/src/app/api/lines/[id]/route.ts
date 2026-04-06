import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { updateLine } from "@/controllers/line.controller";

export const dynamic = "force-dynamic";

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateLine(id, request, prisma);
}
