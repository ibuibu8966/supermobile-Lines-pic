/**
 * Application Entity
 *
 * 申込エンティティの型定義
 */

import type { ServiceEntity } from './service.entity';
import type { PlanEntity } from './plan.entity';

export interface ApplicationEntity {
  id: string;
  applicationNumber: string;
  serviceId: string;
  planId: string;
  customerId: string;
  lineCount: number;
  unitPrice: number;
  totalAmount: number;
  status: ApplicationStatus;
  kycStatus: KycStatus;
  paymentStatus: PaymentStatus;
  addressStatus: AddressStatus;
  comment1: string | null;
  comment2: string | null;
  note: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  SHIPPING = 'SHIPPING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum KycStatus {
  PENDING = 'PENDING',
  DEFICIENT = 'DEFICIENT',
  RESUBMIT = 'RESUBMIT',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  INVOICED = 'INVOICED',
  PAID = 'PAID',
}

export enum AddressStatus {
  PENDING = 'PENDING',
  DEFICIENT = 'DEFICIENT',
  RESUBMIT = 'RESUBMIT',
  COMPLETED = 'COMPLETED',
}

/**
 * リレーション付きApplication
 */
export interface ApplicationWithRelations extends ApplicationEntity {
  customer?: CustomerEntity;
  service?: ServiceEntity;
  plan?: PlanEntity;
  lines?: ApplicationLineEntity[];
  kycImages?: KycImageEntity[];
}

/**
 * Application作成時の入力データ
 */
export interface ApplicationCreateInput {
  applicationNumber: string;
  serviceId: string;
  planId: string;
  customerId: string;
  lineCount: number;
  unitPrice: number;
  totalAmount: number;
  couponId?: string | null;
}

/**
 * Application更新時の入力データ
 */
export interface ApplicationUpdateInput {
  status?: ApplicationStatus;
  kycStatus?: KycStatus;
  paymentStatus?: PaymentStatus;
  addressStatus?: AddressStatus;
  comment1?: string | null;
  comment2?: string | null;
  note?: string | null;
  isArchived?: boolean;
  noReferral?: boolean;
  invoiceUrl?: string | null;
  inoueCheck?: 'IN_PROGRESS' | 'COMPLETED' | 'PROCESSED' | null;
  assignedUserId?: string | null;
  lineCount?: number;
  unitPrice?: number;
  couponCode?: string | null;
  couponId?: string | null;
  planId?: string;
}

/**
 * Application統計情報
 */
export interface ApplicationStats {
  lineCount: number;
  shippedCount: number;
  notActivatedCount: number;
  returnedCount: number;
}

// 依存するEntity（循環参照を避けるため基本的な型のみ）
export interface CustomerEntity {
  id: string;
  type: 'INDIVIDUAL' | 'CORPORATE';
  lastName: string | null;
  firstName: string | null;
  lastNameKana: string | null;
  firstNameKana: string | null;
  companyName: string | null;
  companyNameKana: string | null;
  email: string;
  phone: string;
}

export interface ApplicationLineEntity {
  id: string;
  applicationId: string;
  lineNumber: number;
  status: string;
}

export interface KycImageEntity {
  id: string;
  applicationId: string;
  type: string;
  storagePath: string;
  status: string;
  expiryDate: Date | null;
}
