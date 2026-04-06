"use client";

import { useState, Fragment } from "react";
import { ProcurementStatusCell } from "./procurement-status-cell";
import { ProcurementExpandedRow } from "./procurement-expanded-row";
import { UnitCostBadge } from "./procurement-unit-cost-display";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PurchaseOrder, PurchaseOrderType, PurchaseOrderLine } from "@/types/procurement";

const TYPE_LABELS: Record<string, string> = {
  PURCHASE_ORDER: "仕入れ",
  SUPPLIER_INVOICE: "支払い",
  EXPENSE: "経費",
  CUSTOMER_INVOICE: "追加請求",
};

const TYPE_COLORS: Record<string, string> = {
  PURCHASE_ORDER: "bg-blue-100 text-blue-800",
  SUPPLIER_INVOICE: "bg-orange-100 text-orange-800",
  EXPENSE: "bg-gray-100 text-gray-800",
  CUSTOMER_INVOICE: "bg-green-100 text-green-800",
};

interface ProcurementTableProps {
  orders: PurchaseOrder[];
  currentTab: string;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onImageUpload: (orderId: string, imageType: string, file: File) => Promise<void>;
  onImageDelete: (orderId: string, imageType: string) => Promise<void>;
  isUploading: boolean;
  onEdit: (order: PurchaseOrder) => void;
}

export function ProcurementTable({
  orders,
  currentTab,
  onUpdate,
  onImageUpload,
  onImageDelete,
  isUploading,
  onEdit,
}: ProcurementTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const showTypeBadge = currentTab === "all";
  const showUnitCost = currentTab === "all" || currentTab === "PURCHASE_ORDER";
  const showPaymentDueDate = currentTab === "all" || currentTab === "PURCHASE_ORDER" || currentTab === "SUPPLIER_INVOICE";
  const showDeliveryDate = currentTab === "all" || currentTab === "PURCHASE_ORDER";

  const toggleRow = (orderId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const getTotalQuantity = (lines: PurchaseOrderLine[]) =>
    lines.reduce((sum, l) => sum + l.quantity, 0);

  const getSupplierOrCustomer = (order: PurchaseOrder) => {
    if (order.type === "CUSTOMER_INVOICE") return order.customerName || "-";
    return order.supplier?.name || "-";
  };

  const getLinesSummary = (lines: PurchaseOrderLine[]) => {
    if (lines.length === 0) return "-";
    if (lines.length === 1) return lines[0].name || "-";
    return `${lines[0].name || "-"} 他${lines.length - 1}件`;
  };

  const toDateInputValue = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const colSpan = 7 + (showTypeBadge ? 1 : 0) + (showUnitCost ? 1 : 0) + (showPaymentDueDate ? 1 : 0) + (showDeliveryDate ? 1 : 0);

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
        <Table wrapperClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="w-12"></TableHead>
              {showTypeBadge && <TableHead>種別</TableHead>}
              <TableHead>日付</TableHead>
              <TableHead>{currentTab === "CUSTOMER_INVOICE" ? "顧客名" : currentTab === "EXPENSE" ? "取引先" : "仕入先"}</TableHead>
              <TableHead>品目</TableHead>
              <TableHead className="text-right">合計金額</TableHead>
              <TableHead>ステータス</TableHead>
              {showPaymentDueDate && <TableHead>支払期日</TableHead>}
              {showDeliveryDate && <TableHead>納品予定日</TableHead>}
              {showUnitCost && <TableHead className="text-right">仕入れ単価</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                  データがありません
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <Fragment key={order.id}>
                <TableRow
                  className="hover:bg-gray-50"
                  onMouseEnter={() => {
                    if (order.type === "PURCHASE_ORDER") {
                      queryClient.prefetchQuery({
                        queryKey: queryKeys.procurementSims(order.id),
                        queryFn: () => fetch(`/api/procurement/${order.id}/sims`).then((r) => r.json()),
                        staleTime: STALE_TIMES.SHORT,
                      });
                    }
                  }}
                >
                  <TableCell onClick={() => toggleRow(order.id)} className="cursor-pointer">
                    {expandedRows.has(order.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </TableCell>
                  {showTypeBadge && (
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[order.type]}`}>
                        {TYPE_LABELS[order.type]}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-gray-600">
                    {new Date(order.orderedAt).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell>{getSupplierOrCustomer(order)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {getLinesSummary(order.lines)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ¥{order.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <ProcurementStatusCell
                      type={order.type}
                      status={order.status}
                      paymentStatus={order.paymentStatus}
                      onStatusChange={(status) => onUpdate(order.id, { status })}
                      onPaymentStatusChange={(paymentStatus) => onUpdate(order.id, { paymentStatus })}
                    />
                  </TableCell>
                  {showPaymentDueDate && (
                    <TableCell>
                      {(order.type === "PURCHASE_ORDER" || order.type === "SUPPLIER_INVOICE") ? (
                        <input
                          type="date"
                          className="h-8 w-36 rounded border border-gray-200 px-2 text-sm text-gray-600 hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                          value={toDateInputValue(order.paymentDueDate)}
                          onChange={(e) => onUpdate(order.id, { paymentDueDate: e.target.value || null })}
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                  )}
                  {showDeliveryDate && (
                    <TableCell>
                      {order.type === "PURCHASE_ORDER" ? (
                        <input
                          type="date"
                          className="h-8 w-36 rounded border border-gray-200 px-2 text-sm text-gray-600 hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                          value={toDateInputValue(order.deliveryDate)}
                          onChange={(e) => onUpdate(order.id, { deliveryDate: e.target.value || null })}
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                  )}
                  {showUnitCost && (
                    <TableCell className="text-right">
                      {order.type === "PURCHASE_ORDER" ? (
                        <UnitCostBadge lines={order.lines} />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                {expandedRows.has(order.id) && (
                  <ProcurementExpandedRow
                    key={`${order.id}-expanded`}
                    order={order}
                    colSpan={colSpan}
                    onImageUpload={onImageUpload}
                    onImageDelete={onImageDelete}
                    isUploading={isUploading}
                    onEdit={onEdit}
                  />
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
