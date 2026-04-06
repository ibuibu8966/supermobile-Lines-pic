/**
 * Plan Domain Entity
 *
 * プランのドメインエンティティ定義
 */

/**
 * 基本Plan Entity
 */
export interface PlanEntity {
  id: string;
  serviceId: string;
  code: string;
  name: string;
  description: string | null;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan Pricing Entity
 */
export interface PlanPricingEntity {
  id: string;
  planId: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan with Relations (API response用)
 */
export interface PlanWithRelations extends PlanEntity {
  service?: {
    id: string;
    name: string;
    code: string;
  };
  usageTags?: Array<{
    id: string;
    usageTag: {
      id: number;
      name: string;
      description: string | null;
    };
  }>;
  pricings?: PlanPricingEntity[];
  _count?: {
    applications: number;
  };
}

/**
 * Plan Create Input
 */
export interface PlanCreateInput {
  serviceId: string;
  code: string;
  name: string;
  description?: string | null;
  features?: string[];
  usageTagIds?: number[];
  pricings?: Array<{
    minQuantity: number;
    maxQuantity?: number | null;
    unitPrice: number;
    description?: string | null;
  }>;
  isActive?: boolean;
}

/**
 * Plan Update Input
 */
export interface PlanUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  features?: string[];
  usageTagIds?: number[];
  pricings?: Array<{
    id?: string;
    minQuantity: number;
    maxQuantity?: number | null;
    unitPrice: number;
    description?: string | null;
  }>;
  isActive?: boolean;
}
