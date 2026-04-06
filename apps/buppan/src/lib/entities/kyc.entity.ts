/**
 * KYC関連のエンティティ定義
 */

export interface KycApplication {
  id: string;
  applicationNumber: string;
  customer: {
    id: string;
    type: string;
    name: string;
    email: string;
    phone: string;
    birthDate: Date | null;
    postalCode: string | null;
    prefecture: string | null;
    city: string | null;
    address: string | null;
    building: string | null;
  };
  plan: {
    id: string;
    name: string;
  };
  lineCount: number;
  totalAmount: number;
  status: string;
  createdAt: Date;
  kycImages: Array<{
    id: string;
    type: string;
    status: string;
    storagePath: string;
    signedUrl: string;
    createdAt: Date;
  }>;
}

export interface KycListResult {
  applications: KycApplication[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
