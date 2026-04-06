/**
 * Coupon Domain Entity
 *
 * クーポンのドメインエンティティ定義
 */

/**
 * 基本Coupon Entity
 */
export interface CouponEntity {
  id: string;
  code: string;
  planId: string;
  unitPrice: number;
  description: string | null;
  maxUsages: number | null;
  usageCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Coupon with Relations (API response用)
 */
export interface CouponWithRelations extends CouponEntity {
  plan?: {
    id: string;
    code: string;
    name: string;
    serviceId: string;
    service: {
      id: string;
      code: string;
      name: string;
    };
  };
  _count?: {
    applications: number;
  };
}

/**
 * Coupon Create Input
 */
export interface CouponCreateInput {
  code: string;
  planId: string;
  unitPrice: number;
  description?: string | null;
  maxUsages?: number | null;
  validFrom: Date;
  validUntil: Date;
  isActive?: boolean;
}

/**
 * Coupon Update Input
 */
export interface CouponUpdateInput {
  code?: string;
  planId?: string;
  unitPrice?: number;
  description?: string | null;
  maxUsages?: number | null;
  validFrom?: Date | string;
  validUntil?: Date | string;
  isActive?: boolean;
}
