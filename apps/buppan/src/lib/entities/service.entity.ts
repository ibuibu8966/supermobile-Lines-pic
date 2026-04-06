/**
 * Service Domain Entity
 *
 * サービス（携帯キャリアサービス）のドメインエンティティ定義
 */

/**
 * 基本Service Entity
 */
export interface ServiceEntity {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service with Relations (API response用)
 */
export interface ServiceWithRelations extends ServiceEntity {
  _count?: {
    plans: number;
    applications: number;
    users: number;
  };
  plans?: Array<{
    id: string;
    serviceId: string;
    code: string;
    name: string;
    isActive: boolean;
    usageTags: Array<{
      id: string;
      usageTag: {
        id: number;
        name: string;
      };
    }>;
    pricings: Array<{
      id: string;
      planId: string;
      minQuantity: number;
      maxQuantity: number | null;
      unitPrice: number;
    }>;
  }>;
}

/**
 * Service Create Input
 */
export interface ServiceCreateInput {
  code: string;
  name: string;
  isActive?: boolean;
}

/**
 * Service Update Input
 */
export interface ServiceUpdateInput {
  code?: string;
  name?: string;
  isActive?: boolean;
}
