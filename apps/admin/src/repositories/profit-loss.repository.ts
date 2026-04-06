import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';

/** 申込入金の生クエリ結果 */
export interface ApplicationPaymentRow {
  id: string;
  applicationNumber: string;
  totalAmount: number;
  updatedAt: Date;
  customerLastName: string;
  customerFirstName: string;
}

/** 紹介料の生クエリ結果 */
export interface ReferralRow {
  id: string;
  referrerName: string;
  fee: number;
  lineCount: number;
  totalFee: number;
  applicationNumber: string;
  applicationUpdatedAt: Date;
}

/** PurchaseOrderの生クエリ結果（売上・費用兼用） */
export interface PurchaseOrderRow {
  id: string;
  type: string;
  totalAmount: number;
  updatedAt: Date;
  supplierName: string | null;
  customerName: string | null;
  note: string | null;
}

export class ProfitLossRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 3クエリを並列実行して損益データを取得
   */
  async getProfitLossData(periodStart: Date, periodEnd: Date) {
    logger.info('ProfitLossRepository.getProfitLossData', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    const [applicationPayments, referrals, purchaseOrders] = await Promise.all([
      this.getApplicationPayments(periodStart, periodEnd),
      this.getReferrals(periodStart, periodEnd),
      this.getPurchaseOrders(periodStart, periodEnd),
    ]);

    return { applicationPayments, referrals, purchaseOrders };
  }

  /** 申込入金: paymentStatus='PAID' かつ updatedAt が期間内 */
  private async getApplicationPayments(
    periodStart: Date,
    periodEnd: Date
  ): Promise<ApplicationPaymentRow[]> {
    return await this.prisma.$queryRaw<ApplicationPaymentRow[]>`
      SELECT
        a.id,
        a."applicationNumber",
        a."totalAmount",
        a."updatedAt",
        c."lastName" as "customerLastName",
        c."firstName" as "customerFirstName"
      FROM "Application" a
      JOIN "Customer" c ON a."customerId" = c.id
      WHERE a."paymentStatus" = 'PAID'
        AND a."updatedAt" >= ${periodStart}
        AND a."updatedAt" < ${periodEnd}
      ORDER BY a."updatedAt" DESC
    `;
  }

  /** 紹介料: 親Applicationが入金済みかつ updatedAt が期間内 */
  private async getReferrals(
    periodStart: Date,
    periodEnd: Date
  ): Promise<ReferralRow[]> {
    return await this.prisma.$queryRaw<ReferralRow[]>`
      SELECT
        ar.id,
        ar."referrerName",
        ar.fee,
        a."lineCount",
        (ar.fee * a."lineCount") as "totalFee",
        a."applicationNumber",
        a."updatedAt" as "applicationUpdatedAt"
      FROM "ApplicationReferral" ar
      JOIN "Application" a ON ar."applicationId" = a.id
      WHERE a."paymentStatus" = 'PAID'
        AND a."updatedAt" >= ${periodStart}
        AND a."updatedAt" < ${periodEnd}
      ORDER BY a."updatedAt" DESC
    `;
  }

  /** PurchaseOrder一括: 追加請求(売上) + 仕入れ・支払い・経費(費用) */
  private async getPurchaseOrders(
    periodStart: Date,
    periodEnd: Date
  ): Promise<PurchaseOrderRow[]> {
    return await this.prisma.$queryRaw<PurchaseOrderRow[]>`
      SELECT
        po.id,
        po.type::text,
        po."totalAmount",
        po."updatedAt",
        s.name as "supplierName",
        po."customerName",
        po.note
      FROM "PurchaseOrder" po
      LEFT JOIN "Supplier" s ON po."supplierId" = s.id
      WHERE po."updatedAt" >= ${periodStart}
        AND po."updatedAt" < ${periodEnd}
        AND (
          (po.type = 'CUSTOMER_INVOICE' AND po."paymentStatus" = 'PAID')
          OR (po.type = 'PURCHASE_ORDER' AND po.status = 'AWAITING_DELIVERY')
          OR (po.type = 'SUPPLIER_INVOICE' AND po."paymentStatus" = 'PAID')
          OR (po.type = 'EXPENSE' AND po."paymentStatus" = 'PAID')
        )
      ORDER BY po."updatedAt" DESC
    `;
  }
}
