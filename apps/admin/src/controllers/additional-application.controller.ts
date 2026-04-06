/**
 * Additional application controller
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { ApplicationService } from "@/services/application.service";
import { ApplicationRepository } from "@/repositories/application.repository";
import { z } from "zod";
import { handleApiError } from "@/shared/errors/api-errors";

const additionalApplicationSchema = z.object({
  planId: z.string().min(1, "プランを選択してください"),
  lineCount: z.number().int().min(10, "回線数は10回線以上で指定してください"),
  couponCode: z.string().optional(),
});

export async function createAdditionalApplication(
  request: NextRequest,
  prisma: PrismaClient,
  authFn: () => Promise<{ user?: { id?: string } } | null>
) {
  try {
    // Authenticate
    const session = await authFn();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = additionalApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // TODO: createAdditionalApplication は未実装
    return NextResponse.json(
      { error: 'この機能は現在実装されていません' },
      { status: 501 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
