import { ProfitLossRepository, ApplicationPaymentRow, ReferralRow, PurchaseOrderRow } from '../repositories/profit-loss.repository';
import { ProfitLossData, PLGroup, PLLineItem, ReferralGroup, ReferralItem } from '../types/profit-loss';
import { logger } from '../shared/utils/logger';

/** PurchaseOrderType → 表示ラベルのマッピング */
const PO_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE: '追加請求',
  PURCHASE_ORDER: '仕入れ',
  SUPPLIER_INVOICE: '支払い',
  EXPENSE: '経費',
};

/** 売上になるPurchaseOrderType */
const REVENUE_PO_TYPES = new Set(['CUSTOMER_INVOICE']);

export class ProfitLossService {
  constructor(private repository: ProfitLossRepository) {}

  async getProfitLoss(periodStart: Date, periodEnd: Date, periodLabel: string): Promise<ProfitLossData> {
    logger.info('ProfitLossService.getProfitLoss', { periodLabel });

    const { applicationPayments, referrals, purchaseOrders } = await this.repository.getProfitLossData(periodStart, periodEnd);

    // 売上グループ構築
    const revenueGroups = this.buildRevenueGroups(applicationPayments, purchaseOrders);

    // 費用グループ構築
    const expenseGroups = this.buildExpenseGroups(purchaseOrders);

    // 紹介料グループ構築
    const referralGroups = this.buildReferralGroups(referrals);

    // 集計
    const totalRevenue = revenueGroups.reduce((sum, g) => sum + g.subtotal, 0);
    const totalExpense = expenseGroups.reduce((sum, g) => sum + g.subtotal, 0);
    const totalReferralFee = referralGroups.reduce((sum, g) => sum + g.subtotal, 0);
    const profit = totalRevenue - totalExpense - totalReferralFee;

    logger.info('ProfitLossService.getProfitLoss完了', {
      totalRevenue,
      totalExpense,
      totalReferralFee,
      profit,
    });

    return {
      periodLabel,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      totalRevenue,
      totalExpense,
      totalReferralFee,
      profit,
      revenueGroups,
      expenseGroups,
      referralGroups,
    };
  }

  /** 売上グループ: 申込入金 + 追加請求(CUSTOMER_INVOICE) */
  private buildRevenueGroups(
    applicationPayments: ApplicationPaymentRow[],
    purchaseOrders: PurchaseOrderRow[]
  ): PLGroup[] {
    const groups: PLGroup[] = [];

    // 申込入金
    const appItems: PLLineItem[] = applicationPayments.map((row) => ({
      id: row.id,
      label: `#${row.applicationNumber}`,
      description: `${row.customerLastName} ${row.customerFirstName}`,
      amount: row.totalAmount,
      date: new Date(row.updatedAt).toISOString(),
    }));

    if (appItems.length > 0) {
      groups.push({
        type: 'APPLICATION_PAYMENT',
        typeLabel: '申込入金',
        subtotal: appItems.reduce((sum, item) => sum + item.amount, 0),
        items: appItems,
      });
    }

    // 追加請求
    const customerInvoices = purchaseOrders.filter((po) => REVENUE_PO_TYPES.has(po.type));
    const ciItems: PLLineItem[] = customerInvoices.map((row) => this.poToLineItem(row));

    if (ciItems.length > 0) {
      groups.push({
        type: 'CUSTOMER_INVOICE',
        typeLabel: '追加請求',
        subtotal: ciItems.reduce((sum, item) => sum + item.amount, 0),
        items: ciItems,
      });
    }

    return groups;
  }

  /** 費用グループ: 仕入れ + 支払い + 経費 */
  private buildExpenseGroups(purchaseOrders: PurchaseOrderRow[]): PLGroup[] {
    const expenseTypes = ['PURCHASE_ORDER', 'SUPPLIER_INVOICE', 'EXPENSE'] as const;
    const groups: PLGroup[] = [];

    for (const type of expenseTypes) {
      const filtered = purchaseOrders.filter((po) => po.type === type);
      const items: PLLineItem[] = filtered.map((row) => this.poToLineItem(row));

      if (items.length > 0) {
        groups.push({
          type,
          typeLabel: PO_TYPE_LABELS[type] || type,
          subtotal: items.reduce((sum, item) => sum + item.amount, 0),
          items,
        });
      }
    }

    return groups;
  }

  /** 紹介料グループ: 紹介者別にグルーピング */
  private buildReferralGroups(referrals: ReferralRow[]): ReferralGroup[] {
    const groupMap = new Map<string, ReferralItem[]>();

    for (const row of referrals) {
      const items = groupMap.get(row.referrerName) || [];
      items.push({
        id: row.id,
        applicationNumber: row.applicationNumber,
        fee: Number(row.totalFee),
        date: new Date(row.applicationUpdatedAt).toISOString(),
      });
      groupMap.set(row.referrerName, items);
    }

    return Array.from(groupMap.entries()).map(([referrerName, items]) => ({
      referrerName,
      subtotal: items.reduce((sum, item) => sum + item.fee, 0),
      items,
    }));
  }

  /** PurchaseOrderRow → PLLineItem 変換 */
  private poToLineItem(row: PurchaseOrderRow): PLLineItem {
    const description = row.supplierName || row.customerName || row.note || '';
    return {
      id: row.id,
      label: row.id.slice(0, 8),
      description,
      amount: row.totalAmount,
      date: new Date(row.updatedAt).toISOString(),
    };
  }
}
