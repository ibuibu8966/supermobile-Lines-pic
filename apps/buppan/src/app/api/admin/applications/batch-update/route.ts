import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { auth } from "@/auth";
import { KycVerificationStatus, PaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const KYC_STATUSES = new Set(Object.values(KycVerificationStatus));
const PAYMENT_STATUSES = new Set(Object.values(PaymentStatus));

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates配列が必要です" }, { status: 400 });
    }

    await prisma.$transaction(
      updates.map((update: { id: string; kycStatus?: string; paymentStatus?: string }) => {
        const data: { kycStatus?: KycVerificationStatus; paymentStatus?: PaymentStatus } = {};
        if (update.kycStatus && KYC_STATUSES.has(update.kycStatus as KycVerificationStatus)) {
          data.kycStatus = update.kycStatus as KycVerificationStatus;
        }
        if (update.paymentStatus && PAYMENT_STATUSES.has(update.paymentStatus as PaymentStatus)) {
          data.paymentStatus = update.paymentStatus as PaymentStatus;
        }
        return prisma.application.update({
          where: { id: update.id },
          data,
        });
      })
    );

    return NextResponse.json({ success: true, count: updates.length });
  } catch (error) {
    console.error("一括更新エラー:", error);
    return NextResponse.json({ error: "一括更新に失敗しました" }, { status: 500 });
  }
}
