import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { validateCoupon } from "@/lib";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return await validateCoupon(request, prisma);
}
