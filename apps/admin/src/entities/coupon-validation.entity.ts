/**
 * Coupon validation entity
 */

export interface CouponValidationRequest {
  code: string;
  planId: string;
}

export interface CouponValidationResult {
  valid: boolean;
  unitPrice?: number;
  description?: string;
  error?: string;
}
