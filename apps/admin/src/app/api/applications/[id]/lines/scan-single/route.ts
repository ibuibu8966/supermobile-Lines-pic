import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { scanSingleIccid } from "@/controllers/line-scan.controller";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await scanSingleIccid(id, request, prisma);
}
