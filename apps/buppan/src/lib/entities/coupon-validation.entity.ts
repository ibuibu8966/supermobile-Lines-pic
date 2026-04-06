/**
 * Coupon validation entity
 */

export interface CouponValidationRequest {
  code: string;
  planId: string;
}

export interface CouponPricingTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

export interface CouponValidationResult {
  valid: boolean;
  unitPrice?: number | null;
  pricings?: CouponPricingTier[];
  description?: string;
  error?: string;
}
