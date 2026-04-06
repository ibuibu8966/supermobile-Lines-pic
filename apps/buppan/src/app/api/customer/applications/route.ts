import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { getCustomerApplications, createAdditionalApplication } from "@/lib";

export const dynamic = "force-dynamic";

// 追加申込作成
export async function POST(request: NextRequest) {
  return await createAdditionalApplication(request, prisma, auth);
}

// 申込履歴取得
export async function GET() {
  return await getCustomerApplications(prisma, auth);
}
