/**
 * KYC Image Entity
 *
 * KYC画像のドメインエンティティ定義
 */

export type KycImageType =
  | 'ID_FRONT'
  | 'ID_BACK'
  | 'SELFIE'
  | 'ADDRESS_PROOF'
  | 'CORPORATE_REGISTRY';

export type KycImageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycImage {
  id: string;
  applicationId: string;
  type: KycImageType;
  storagePath: string;
  status: KycImageStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycImageWithApplication extends KycImage {
  application: {
    id: string;
    kycImages: KycImage[];
  };
}

export interface KycImageUpdateInput {
  status?: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  expiryDate?: string | null;
}

export interface KycImageUpdateResult {
  kycImage: KycImage;
  kycStatus: 'PENDING' | 'DEFICIENT' | 'RESUBMIT' | 'COMPLETED';
}
