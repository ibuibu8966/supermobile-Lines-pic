import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllLines } from "@/controllers/line.controller";

export const dynamic = "force-dynamic";

export async function GET (request: NextRequest) {
  return await getAllLines(request, prisma);
}
