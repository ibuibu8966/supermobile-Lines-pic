/**
 * Coupon validation service
 */

import { PrismaClient } from "@/lib/database";
import { CouponValidationRequest, CouponValidationResult } from "@/entities";
import { logger } from "@/shared/utils/logger";

export class CouponValidationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate coupon code
   */
  async validateCoupon(request: CouponValidationRequest): Promise<CouponValidationResult> {
    // Fetch coupon
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: request.code.toUpperCase() },
      include: { plan: true },
    });

    if (!coupon) {
      return { valid: false, error: "無効なクーポンコードです" };
    }

    if (!coupon.isActive) {
      return { valid: false, error: "このクーポンは現在ご利用いただけません" };
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return { valid: false, error: "このクーポンは有効期間外です" };
    }

    if (coupon.maxUsages !== null && coupon.usageCount >= coupon.maxUsages) {
      return { valid: false, error: "このクーポンは利用上限に達しています" };
    }

    if (coupon.planId !== request.planId) {
      return { valid: false, error: "このクーポンは選択されたプランには適用できません" };
    }

    logger.info("Coupon validated", { code: request.code, planId: request.planId });

    return {
      valid: true,
      unitPrice: coupon.unitPrice ?? undefined,
      description: coupon.description || undefined,
    };
  }
}
