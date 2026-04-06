/**
 * Coupon validation controller
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { CouponValidationService } from "../services/coupon-validation.service";
import { z } from "zod";
import { handleApiError } from "../shared/errors/api-errors";

const couponValidationSchema = z.object({
  code: z.string().min(1, "クーポンコードを指定してください"),
  planId: z.string().min(1, "プランIDを指定してください"),
});

export async function validateCoupon(
  request: NextRequest,
  prisma: PrismaClient
) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = couponValidationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { valid: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate coupon
    const service = new CouponValidationService(prisma);
    const result = await service.validateCoupon(data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
