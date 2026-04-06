/**
 * Additional application controller
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { ApplicationService } from "../services/application.service";
import { ApplicationRepository } from "../repositories/application.repository";
import { z } from "zod";
import { handleApiError } from "../shared/errors/api-errors";

const kycImageInputSchema = z.object({
  type: z.enum(["ID_FRONT", "ID_BACK", "SELFIE", "ADDRESS_PROOF", "CORPORATE_REGISTRY"]),
  path: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
});

const additionalApplicationSchema = z.object({
  planId: z.string().min(1, "プランを選択してください"),
  lineCount: z.number().int().min(10, "回線数は10回線以上で指定してください"),
  couponCode: z.string().optional(),
  kycImages: z.array(kycImageInputSchema).optional(),
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
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create additional application
    const service = new ApplicationService(new ApplicationRepository(prisma));
    const result = await service.createAdditionalApplication(session.user.id, data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
