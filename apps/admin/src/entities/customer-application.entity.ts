/**
 * 顧客申込関連のエンティティ定義
 */

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE';

export interface CustomerApplicationInput {
  // プラン情報
  planId: string;
  lineCount: number;

  // 顧客情報
  customerType: CustomerType;
  password: string;
  customer: CustomerInfo;

  // 同意事項
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeTelecom: boolean;
  agreeInitialCancellation: boolean;
  agreeAntiSocial: boolean;

  // KYC書類
  idFront: File;
  idBack: File;
  corporateRegistry?: File | null;
  idExpiryDate?: Date | null;

  // クーポン
  couponCode?: string | null;
}

export interface CustomerInfo {
  // 個人情報
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string;
  phone: string;
  email: string;

  // 住所
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building?: string;

  // 法人情報（法人の場合）
  companyName?: string;
  companyNameKana?: string;
  companyPostalCode?: string;
  companyPrefecture?: string;
  companyCity?: string;
  companyAddress?: string;
  companyBuilding?: string;
}

export interface CustomerApplicationResult {
  success: boolean;
  applicationNumber: string;
  application: {
    id: string;
    applicationNumber: string;
    customerId: string;
    serviceId: string;
    planId: string;
    lineCount: number;
    unitPrice: number;
    totalAmount: number;
    status: string;
    couponId: string | null;
    couponCode: string | null;
    createdAt: Date;
    customer: {
      id: string;
      type: CustomerType;
      email: string;
      phone: string;
      lastName: string;
      firstName: string;
    };
    plan: {
      id: string;
      name: string;
      code: string;
    };
  };
}
