/**
 * ダッシュボード関連のエンティティ定義
 */

export interface DashboardStats {
  todayApplicationCount: number;
  kycPendingCount: number;
  shippingPendingCount: number;
  activeCustomerCount: number;
}

export interface RecentApplication {
  id: string;
  applicationNumber: string;
  customerName: string;
  planName: string;
  lineCount: number;
  status: string;
  createdAt: Date;
}

export interface KycPendingItem {
  id: string;
  applicationNumber: string;
  customerName: string;
  documentType: string;
  createdAt: Date;
}

export interface DashboardResult {
  stats: DashboardStats;
  recentApplications: RecentApplication[];
  kycPendingList: KycPendingItem[];
}
