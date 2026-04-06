import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { updateKycImage } from "@/controllers/kyc-image.controller";

export const dynamic = "force-dynamic";

// KYC画像ステータスを更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateKycImage(id, request, prisma);
}
