/**
 * Plan list entity
 */

export interface PlanListItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  usageTags: Array<{
    usageTag: {
      id: string;
      name: string;
    };
  }>;
  pricings: Array<{
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: number;
  }>;
}

export type PlanListResult = PlanListItem[];
