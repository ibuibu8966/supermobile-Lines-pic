"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PurchaseOrderType, SimplePaymentStatus } from "@/types/procurement";

const STATUS_LABELS: Record<string, string> = {
  ORDERED: "仕入れ済",
  CONFIRMED: "仕入れ",
  AWAITING_SEAL: "しぃさん印鑑待ち",
  BEFORE_PAYMENT: "振込前",
  AWAITING_DELIVERY: "納品待ち",
  DELIVERED: "納品済",
};

const STATUS_OPTIONS = [
  { value: "ORDERED", label: "仕入れ済" },
  { value: "CONFIRMED", label: "仕入れ" },
  { value: "AWAITING_SEAL", label: "しぃさん印鑑待ち" },
  { value: "BEFORE_PAYMENT", label: "振込前" },
  { value: "AWAITING_DELIVERY", label: "納品待ち" },
  { value: "DELIVERED", label: "納品済" },
];

const STATUS_COLORS: Record<string, string> = {
  ORDERED: "bg-blue-100 text-blue-800 border-blue-200",
  CONFIRMED: "bg-green-100 text-green-800 border-green-200",
  AWAITING_SEAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
  BEFORE_PAYMENT: "bg-orange-100 text-orange-800 border-orange-200",
  AWAITING_DELIVERY: "bg-purple-100 text-purple-800 border-purple-200",
  DELIVERED: "bg-gray-100 text-gray-800 border-gray-200",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "未払い",
  PAID: "支払済",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-800 border-red-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
};

interface ProcurementStatusCellProps {
  type: PurchaseOrderType;
  status: string;
  paymentStatus: SimplePaymentStatus | null;
  onStatusChange: (status: string) => void;
  onPaymentStatusChange: (status: string) => void;
}

export function ProcurementStatusCell({
  type,
  status,
  paymentStatus,
  onStatusChange,
  onPaymentStatusChange,
}: ProcurementStatusCellProps) {
  if (type === "PURCHASE_ORDER") {
    return (
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-48">
          <SelectValue>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[option.value]}`}>
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const currentPaymentStatus = paymentStatus || "UNPAID";
  return (
    <Select value={currentPaymentStatus} onValueChange={onPaymentStatusChange}>
      <SelectTrigger className="w-32">
        <SelectValue>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_STATUS_COLORS[currentPaymentStatus]}`}>
            {PAYMENT_STATUS_LABELS[currentPaymentStatus]}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="UNPAID">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_STATUS_COLORS.UNPAID}`}>
            未払い
          </span>
        </SelectItem>
        <SelectItem value="PAID">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_STATUS_COLORS.PAID}`}>
            支払済
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
