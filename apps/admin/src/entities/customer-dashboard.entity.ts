/**
 * Customer dashboard entity
 */

export interface CustomerDashboardLineStats {
  active: number;
  pending: number;
  cancelled: number;
}

export interface CustomerDashboardApplication {
  id: string;
  applicationNumber: string;
  status: string;
  lineCount: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    id: string;
    name: string;
  };
  lines: Array<{
    id: string;
    msisdn: string | null;
    status: string;
  }>;
}

export interface CustomerDashboardKycImage {
  id: string;
  type: string;
  status: string;
  expiryDate: Date | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}

export interface CustomerDashboardResult {
  customer: {
    id: string;
    type: string;
    email: string;
    phone: string;
    lastName: string;
    firstName: string;
    lastNameKana: string;
    firstNameKana: string;
    birthDate: Date | null;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building: string | null;
    companyName: string | null;
    companyNameKana: string | null;
    establishedDate: Date | null;
    companyPostalCode: string | null;
    companyPrefecture: string | null;
    companyCity: string | null;
    companyAddress: string | null;
    companyBuilding: string | null;
    kycImages: CustomerDashboardKycImage[];
  } | null;
  applications: CustomerDashboardApplication[];
  lineStats: CustomerDashboardLineStats;
}
