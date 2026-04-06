import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { scanBarcode } from "@/lib";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return await scanBarcode(request, prisma);
}
