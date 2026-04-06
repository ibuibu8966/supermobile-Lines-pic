import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database";
import { KycImageService } from "@/services/kyc-image.service";
import { KycImageRepository } from "@/repositories/kyc-image.repository";
import { getAdminSession } from "@/lib/auth/admin-session";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

const updateExpirySchema = z.object({
  expiryDate: z.string().nullable(),
});

// 顧客レベルのKYC有効期限を一括更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const body = await request.json();
    const parseResult = updateExpirySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "バリデーションエラー", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const kycImageService = new KycImageService(new KycImageRepository(prisma));
    const result = await kycImageService.updateExpiryByApplicationId(
      id,
      parseResult.data.expiryDate
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.logError("KYC有効期限一括更新エラー", error);
    return NextResponse.json(
      { error: "有効期限の更新に失敗しました" },
      { status: 500 }
    );
  }
}
