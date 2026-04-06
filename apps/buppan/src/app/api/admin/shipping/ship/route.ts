import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { completeShipping } from "@/lib";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return await completeShipping(request, prisma);
}
