import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { updateApplicationLine } from "@/lib";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params;
  return await updateApplicationLine(id, lineId, request, prisma);
}
