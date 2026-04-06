"use client";

import { useState } from "react";
import { CsvImportDialog } from "@/components/procurement/csv-import-dialog";
import { SimHistoryTable } from "@/components/procurement/sim-history-dialog";
import { ImageUploadField } from "@/components/procurement/image-upload-field";
import { ProcurementUnitCostDisplay } from "./procurement-unit-cost-display";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Download, FileText, Pencil } from "lucide-react";
import { useProcurementSims } from "@/hooks/use-procurement-sims";
import type { PurchaseOrder } from "@/types/procurement";

const CARRIER_LABELS: Record<string, string> = {
  DOCOMO: "ドコモ",
  AU: "au",
  SOFTBANK: "ソフトバンク",
  RAKUTEN: "楽天モバイル",
};

interface ProcurementExpandedRowProps {
  order: PurchaseOrder;
  colSpan: number;
  onImageUpload: (orderId: string, imageType: string, file: File) => Promise<void>;
  onImageDelete: (orderId: string, imageType: string) => Promise<void>;
  isUploading: boolean;
  onEdit: (order: PurchaseOrder) => void;
}

export function ProcurementExpandedRow({
  order,
  colSpan,
  onImageUpload,
  onImageDelete,
  isUploading,
  onEdit,
}: ProcurementExpandedRowProps) {
  const [openSections, setOpenSections] = useState({ docs: true, simHistory: true });
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const { data: sims } = useProcurementSims(order.type === "PURCHASE_ORDER" ? order.id : null);

  const handleCsvExport = () => {
    if (!sims || sims.length === 0) return;
    const headers = ["ICCID", "電話番号", "SIMタイプ", "キャリア", "プラン", "解約予定日", "自動解約", "ステータス", "インポート日時"];
    const rows = sims.map((sim) => [
      sim.iccid,
      sim.msisdn || "",
      sim.simType || "",
      sim.carrierType || "",
      sim.plan || "",
      sim.autoCancelDate ? new Date(sim.autoCancelDate).toLocaleDateString("ja-JP") : "",
      sim.isAutoCancel ? "有効" : "",
      sim.status || "",
      new Date(sim.createdAt).toLocaleString("ja-JP"),
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sims_${order.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: "docs" | "simHistory") => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isPurchaseOrder = order.type === "PURCHASE_ORDER";

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="bg-gray-50">
        <div className="p-4 space-y-4">
          {/* 明細テーブル */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">
                {isPurchaseOrder ? "回線詳細" : "明細"}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(order)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                編集
              </Button>
            </div>
            {order.lines && order.lines.length > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className={`grid gap-4 p-4 bg-gray-100 border-b border-gray-200 ${isPurchaseOrder ? "grid-cols-[2fr_1fr_1fr_1fr_1fr_0.5fr]" : "grid-cols-[3fr_1fr_1fr_1fr]"}`}>
                  <div className="text-xs font-medium text-gray-600">品目名</div>
                  {isPurchaseOrder && <div className="text-xs font-medium text-gray-600">回線種別</div>}
                  <div className="text-xs font-medium text-gray-600 text-right">数量</div>
                  <div className="text-xs font-medium text-gray-600 text-right">単価</div>
                  <div className="text-xs font-medium text-gray-600 text-right">小計</div>
                  {isPurchaseOrder && <div className="text-xs font-medium text-gray-600 text-center">単価含</div>}
                </div>
                <div className="divide-y divide-gray-200">
                  {order.lines.map((line) => (
                    <div key={line.id} className={`grid gap-4 p-4 hover:bg-gray-50 transition-colors ${isPurchaseOrder ? "grid-cols-[2fr_1fr_1fr_1fr_1fr_0.5fr]" : "grid-cols-[3fr_1fr_1fr_1fr]"}`}>
                      <div className="font-semibold text-gray-900">
                        {line.name || (line.carrierType ? CARRIER_LABELS[line.carrierType] : "-")}
                      </div>
                      {isPurchaseOrder && (
                        <div className="text-gray-600 text-sm">
                          {line.carrierType ? CARRIER_LABELS[line.carrierType] : "-"}
                        </div>
                      )}
                      <div className="text-gray-900 font-medium text-right">
                        {line.quantity.toLocaleString()}
                      </div>
                      <div className="text-gray-900 font-medium text-right">
                        ¥{line.unitPrice.toLocaleString()}
                      </div>
                      <div className="font-bold text-gray-900 text-right">
                        ¥{line.subtotal.toLocaleString()}
                      </div>
                      {isPurchaseOrder && (
                        <div className="text-center">
                          {line.isIncludedInUnitCost ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-t-2 border-gray-300">
                  {order.taxType === "TAX_EXCLUDED" && order.taxAmount > 0 && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-500">小計</span>
                      <span className="text-sm text-gray-600">
                        ¥{(order.totalAmount - order.taxAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {order.taxType === "TAX_EXCLUDED" && order.taxAmount > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500">消費税（10%）</span>
                      <span className="text-sm text-gray-600">
                        ¥{order.taxAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-700">
                      合計金額
                      {order.taxType === "TAX_INCLUDED" && (
                        <span className="text-xs text-gray-500 ml-1">（税込）</span>
                      )}
                      {order.taxType === "TAX_EXCLUDED" && order.taxAmount > 0 && (
                        <span className="text-xs text-gray-500 ml-1">（税抜+税）</span>
                      )}
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      ¥{order.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">明細がありません</p>
            )}

            {/* 発注の場合: 仕入れ単価表示 */}
            {isPurchaseOrder && order.lines.length > 0 && (
              <ProcurementUnitCostDisplay lines={order.lines} />
            )}
          </div>

          {/* 書類セクション */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
              onClick={() => toggleSection("docs")}
            >
              {openSections.docs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              書類
            </button>
            {openSections.docs && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {order.type === "PURCHASE_ORDER" && (
                  <>
                    <ImageUploadField
                      orderId={order.id}
                      label="発注書"
                      imageType="purchaseOrder"
                      currentImageUrl={order.purchaseOrderImagePath}
                      onUpload={onImageUpload}
                      onDelete={onImageDelete}
                      isUploading={isUploading}
                    />
                    <ImageUploadField
                      orderId={order.id}
                      label="見積書"
                      imageType="quote"
                      currentImageUrl={order.quoteImagePath}
                      onUpload={onImageUpload}
                      onDelete={onImageDelete}
                      isUploading={isUploading}
                    />
                    <ImageUploadField
                      orderId={order.id}
                      label="請求書"
                      imageType="invoice"
                      currentImageUrl={order.invoiceImagePath}
                      onUpload={onImageUpload}
                      onDelete={onImageDelete}
                      isUploading={isUploading}
                    />
                  </>
                )}
                {order.type === "EXPENSE" && (
                  <ImageUploadField
                    orderId={order.id}
                    label="書類"
                    imageType="purchaseOrder"
                    currentImageUrl={order.purchaseOrderImagePath}
                    onUpload={onImageUpload}
                    onDelete={onImageDelete}
                    isUploading={isUploading}
                  />
                )}
                {(order.type === "SUPPLIER_INVOICE" || order.type === "CUSTOMER_INVOICE") && (
                  <ImageUploadField
                    orderId={order.id}
                    label="請求書"
                    imageType="invoice"
                    currentImageUrl={order.invoiceImagePath}
                    onUpload={onImageUpload}
                    onDelete={onImageDelete}
                    isUploading={isUploading}
                  />
                )}
              </div>
            )}
          </div>

          {/* SIM履歴セクション（発注のみ） */}
          {isPurchaseOrder && order.supplier && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
                onClick={() => toggleSection("simHistory")}
              >
                {openSections.simHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                インポートSIM履歴
              </button>
              {openSections.simHistory && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCsvImportDialogOpen(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      CSVインポート
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCsvExport}
                      disabled={!sims || sims.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSVエクスポート
                    </Button>
                  </div>
                  <SimHistoryTable purchaseOrderId={order.id} />
                </div>
              )}
              {csvImportDialogOpen && (
                <CsvImportDialog
                  open={csvImportDialogOpen}
                  onOpenChange={setCsvImportDialogOpen}
                  purchaseOrderId={order.id}
                  supplierId={order.supplier.id}
                />
              )}
            </div>
          )}

          {order.note && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">備考</label>
              <p className="text-sm text-gray-600">{order.note}</p>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
