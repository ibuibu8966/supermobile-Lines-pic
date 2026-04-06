/**
 * Line (ApplicationLine) Domain Entity
 *
 * 回線（ApplicationLine）のドメインエンティティ定義
 */

// Line Status Enum (ApplicationLineStatus)
export enum LineStatus {
  NOT_ACTIVATED = 'NOT_ACTIVATED',
  SHIPPED = 'SHIPPED',
  ACTIVATED = 'ACTIVATED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

/**
 * 基本Line Entity
 */
export interface LineEntity {
  id: string;
  applicationId: string;
  lineNumber: number;
  simId: string | null;
  msisdn: string | null;
  lineTagId: number | null;
  lineReserveTagId: number | null;
  status: LineStatus;
  shippedAt: Date | null;
  returnedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Line with Relations (API response用)
 */
export interface LineWithRelations extends LineEntity {
  application?: {
    id: string;
    applicationNumber: string;
    isArchived: boolean;
    archivedAt: Date | null;
    customer: {
      type: string;
      lastName: string | null;
      firstName: string | null;
      lastNameKana: string | null;
      firstNameKana: string | null;
      companyName: string | null;
      companyNameKana: string | null;
      birthDate: Date | null;
      postalCode: string | null;
      prefecture: string | null;
      city: string | null;
      address: string | null;
      building: string | null;
      companyPostalCode: string | null;
      companyPrefecture: string | null;
      companyCity: string | null;
      companyAddress: string | null;
      companyBuilding: string | null;
      email: string;
      phone: string;
    };
    service: {
      id: string;
      name: string;
      code: string;
    };
    plan: {
      id: string;
      name: string;
      code: string;
    };
  };
  sim?: {
    iccid: string;
    msisdn: string | null;
    carrierType: string;
    simLocationTag: {
      id: number;
      name: string;
    } | null;
    simLocationTagId: number | null;
  } | null;
  lineReserveTag?: {
    id: number;
    name: string;
  } | null;
}

/**
 * Line Update Input
 */
export interface LineUpdateInput {
  lineReserveTagId?: number | null;
  simLocationTagId?: number | null;
  shippedAt?: Date | string | null;
  returnedAt?: Date | string | null;
  status?: LineStatus;
  note?: string | null;
}
