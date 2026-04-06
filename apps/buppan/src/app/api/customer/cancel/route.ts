import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { requestCancellation } from "@/lib";

export const dynamic = "force-dynamic";

// 解約申請
export async function POST(request: NextRequest) {
  return await requestCancellation(request, prisma, auth);
}
