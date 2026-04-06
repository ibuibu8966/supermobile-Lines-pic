/**
 * Procurement関連の型定義
 */

export type PurchaseOrderType = 'PURCHASE_ORDER' | 'SUPPLIER_INVOICE' | 'EXPENSE' | 'CUSTOMER_INVOICE';
export type SimplePaymentStatus = 'UNPAID' | 'PAID';

export interface PurchaseOrderLine {
  id: string;
  name: string | null;
  carrierType: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isIncludedInUnitCost: boolean;
}

export interface PurchaseOrder {
  id: string;
  type: PurchaseOrderType;
  supplier: {
    id: number;
    name: string;
  } | null;
  lines: PurchaseOrderLine[];
  totalAmount: number;
  taxType: string;
  taxAmount: number;
  status: string;
  paymentStatus: SimplePaymentStatus | null;
  paidAt: string | null;
  customerName: string | null;
  orderedAt: string;
  invoiceDate: string | null;
  deliveryDate: string | null;
  paymentDueDate: string | null;
  purchaseOrderImagePath: string | null;
  quoteImagePath: string | null;
  invoiceImagePath: string | null;
  note: string | null;
  unitCost?: number | null;
  simQuantity?: number | null;
}
