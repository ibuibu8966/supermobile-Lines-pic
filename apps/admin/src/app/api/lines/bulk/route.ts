import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { bulkUpdateAllLines } from "@/controllers/line.controller";

export const dynamic = "force-dynamic";

export async function PATCH (request: NextRequest) {
  return await bulkUpdateAllLines(request, prisma);
}
