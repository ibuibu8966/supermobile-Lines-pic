import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getShippingPending } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return await getShippingPending("buppan", request, prisma);
}
