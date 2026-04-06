/** 売上・費用共通の明細1行 */
export interface PLLineItem {
  id: string;
  label: string;
  description: string;
  amount: number;
  date: string;
}

/** 種別ごとのグループ（売上明細・費用明細で共通利用） */
export interface PLGroup {
  type: string;
  typeLabel: string;
  subtotal: number;
  items: PLLineItem[];
}

/** 紹介料の個別明細 */
export interface ReferralItem {
  id: string;
  applicationNumber: string;
  fee: number;
  date: string;
}

/** 紹介者ごとのグループ */
export interface ReferralGroup {
  referrerName: string;
  subtotal: number;
  items: ReferralItem[];
}

/** 損益管理レスポンス */
export interface ProfitLossData {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalExpense: number;
  totalReferralFee: number;
  profit: number;
  revenueGroups: PLGroup[];
  expenseGroups: PLGroup[];
  referralGroups: ReferralGroup[];
}
