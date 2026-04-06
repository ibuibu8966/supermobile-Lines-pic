import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAllSims } from "@/controllers/sim.controller";

export const dynamic = "force-dynamic";

export async function GET (request: NextRequest) {
  return await getAllSims(request, prisma);
}
