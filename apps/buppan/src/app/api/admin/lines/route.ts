import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllLines, bulkUpdateAllLines } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return await getAllLines(request, prisma);
}

export async function POST(request: NextRequest) {
  return await bulkUpdateAllLines(request, prisma);
}
