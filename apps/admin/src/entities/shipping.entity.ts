/**
 * 発送関連のエンティティ定義
 */

export interface ShippingScanInput {
  applicationLineId: string;
  iccid: string;
  contractMonth?: Date;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
}

export interface ShippingScanResult {
  line: {
    id: string;
    lineNumber: number;
    simId: string | null;
    msisdn: string | null;
    status: string;
  };
  sim: {
    iccid: string;
    msisdn: string | null;
    carrierType: string | null;
    plan: string | null;
  };
}

export interface ShippingBulkInput {
  applicationIds: string[];
  shippedAt?: Date;
}

export interface ShippingBulkResult {
  updatedCount: number;
  applications: Array<{
    id: string;
    applicationNumber: string;
    status: string;
  }>;
}

export interface ShippingCompleteInput {
  applicationId: string;
  lineIds: string[];
}

export interface ShippingCompleteResult {
  applicationStatus: string;
  shippedLineCount: number;
  contractCount: number;
}

export interface ShippingPendingApplication {
  id: string;
  applicationNumber: string;
  customer: {
    id: string;
    type: string;
    name: string;
    email: string;
    phone: string;
    postalCode: string | null;
    prefecture: string | null;
    city: string | null;
    address: string | null;
    building: string | null;
  };
  plan: {
    id: string;
    name: string;
    usageTags: Array<{
      id: number;
      code: string;
      name: string;
    }>;
  };
  lineCount: number;
  totalAmount: number;
  paidAt: Date | null;
  createdAt: Date;
  lines: Array<{
    id: string;
    lineNumber: number;
    simId: string | null;
    msisdn: string | null;
    status: string;
    sim: {
      iccid: string;
      msisdn: string | null;
      carrierType: string;
      status: string;
    } | null;
  }>;
  assignedCount: number;
}

export interface ShippingPendingResult {
  applications: ShippingPendingApplication[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
