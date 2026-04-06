"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, X, FileText, Receipt, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { PurchaseOrderType, PurchaseOrder } from "@/types/procurement";
import { CurrencyInput } from "@/components/common/currency-input";

interface Supplier {
  id: number;
  name: string;
  code: string;
}

interface ProcurementLine {
  id: string;
  name: string;
  carrierType: string;
  quantity: string;
  unitPrice: string;
  isIncludedInUnitCost: boolean;
}

const CARRIER_OPTIONS = [
  { value: "DOCOMO", label: "ドコモ" },
  { value: "AU", label: "au" },
  { value: "SOFTBANK", label: "ソフトバンク" },
  { value: "RAKUTEN", label: "楽天モバイル" },
];

const TYPE_CONFIG: { value: PurchaseOrderType; label: string; icon: typeof FileText; description: string }[] = [
  { value: "PURCHASE_ORDER", label: "仕入れ", icon: FileText, description: "SIM仕入れ" },
  { value: "SUPPLIER_INVOICE", label: "支払い", icon: Receipt, description: "取引先への支払い" },
  { value: "EXPENSE", label: "経費", icon: Wallet, description: "運営支出" },
  { value: "CUSTOMER_INVOICE", label: "追加請求", icon: CreditCard, description: "顧客への請求" },
];

const DEFAULT_LINE = (): ProcurementLine => ({
  id: crypto.randomUUID(),
  name: "",
  carrierType: "",
  quantity: "",
  unitPrice: "",
  isIncludedInUnitCost: false,
});

interface NewProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: PurchaseOrderType;
  editOrder?: PurchaseOrder;
}

export function NewProcurementDialog({
  open,
  onOpenChange,
  defaultType,
  editOrder,
}: NewProcurementDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<PurchaseOrderType | "">("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [lines, setLines] = useState<ProcurementLine[]>([DEFAULT_LINE()]);
  const [taxType, setTaxType] = useState<"TAX_EXCLUDED" | "TAX_INCLUDED" | "TAX_FREE">("TAX_EXCLUDED");

  const isEditMode = !!editOrder;

  const { data: suppliers, isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
  });

  // ダイアログが開いた時にフォームを初期化
  useEffect(() => {
    if (open) {
      if (editOrder) {
        setType(editOrder.type);
        setSupplierId(editOrder.supplier?.id.toString() || "");
        setCustomerName(editOrder.customerName || "");
        setNote(editOrder.note || "");
        setDeliveryDate(
          editOrder.deliveryDate
            ? new Date(editOrder.deliveryDate).toISOString().split("T")[0]
            : ""
        );
        setPaymentDueDate(
          editOrder.paymentDueDate
            ? new Date(editOrder.paymentDueDate).toISOString().split("T")[0]
            : ""
        );
        setTaxType((editOrder.taxType as "TAX_EXCLUDED" | "TAX_INCLUDED" | "TAX_FREE") || "TAX_EXCLUDED");
        setLines(
          editOrder.lines.map((l) => ({
            id: crypto.randomUUID(),
            name: l.name || "",
            carrierType: l.carrierType || "",
            quantity: l.quantity.toString(),
            unitPrice: l.unitPrice.toString(),
            isIncludedInUnitCost: l.isIncludedInUnitCost,
          }))
        );
      } else {
        resetForm();
        if (defaultType) {
          setType(defaultType);
        }
      }
    }
  }, [open, editOrder, defaultType]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "作成に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement"] });
      toast.success("登録しました");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/procurement/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "更新に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement"] });
      toast.success("更新しました");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setType("");
    setSupplierId("");
    setCustomerName("");
    setNote("");
    setDeliveryDate("");
    setPaymentDueDate("");
    setLines([DEFAULT_LINE()]);
    setTaxType("TAX_EXCLUDED");
  };

  const addLine = () => setLines([...lines, DEFAULT_LINE()]);

  const removeLine = (id: string) => {
    if (lines.length > 1) setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof ProcurementLine, value: string | boolean) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const calculateSubtotal = (line: ProcurementLine) => {
    return (parseInt(line.quantity) || 0) * (parseInt(line.unitPrice) || 0);
  };

  const calculateSubtotalSum = () =>
    lines.reduce((sum, l) => sum + calculateSubtotal(l), 0);

  const calculateTax = () =>
    taxType === "TAX_EXCLUDED" ? Math.floor(calculateSubtotalSum() * 0.1) : 0;

  const calculateTotal = () =>
    calculateSubtotalSum() + calculateTax();

  const isPurchaseOrder = type === "PURCHASE_ORDER";
  const needsSupplier = type === "PURCHASE_ORDER" || type === "SUPPLIER_INVOICE";
  const isCustomerInvoice = type === "CUSTOMER_INVOICE";

  const isPending = createMutation.isPending || editMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!type) {
      toast.error("種別を選択してください");
      return;
    }

    if (needsSupplier && !supplierId) {
      toast.error("仕入先を選択してください");
      return;
    }

    const validLines = lines.filter(
      (l) => l.name && parseInt(l.quantity) > 0 && parseInt(l.unitPrice) > 0
    );

    if (validLines.length === 0) {
      toast.error("少なくとも1つの有効な明細を入力してください");
      return;
    }

    const mappedLines = validLines.map((l) => ({
      name: l.name,
      carrierType: l.carrierType || null,
      quantity: parseInt(l.quantity),
      unitPrice: parseInt(l.unitPrice),
      isIncludedInUnitCost: l.isIncludedInUnitCost,
    }));

    if (isEditMode) {
      const requestData: Record<string, unknown> = {
        lines: mappedLines,
        note: note || null,
        taxType,
        taxAmount: calculateTax(),
      };
      if (needsSupplier || (type === "EXPENSE" && supplierId)) {
        requestData.supplierId = supplierId ? parseInt(supplierId) : null;
      }
      if (isCustomerInvoice) {
        requestData.customerName = customerName || null;
      }
      if (needsSupplier) {
        requestData.paymentDueDate = paymentDueDate || null;
      }
      if (isPurchaseOrder) {
        requestData.deliveryDate = deliveryDate || null;
      }
      editMutation.mutate({ id: editOrder!.id, data: requestData });
    } else {
      const totalAmount = calculateTotal();
      const requestData: Record<string, unknown> = {
        type,
        totalAmount,
        taxType,
        taxAmount: calculateTax(),
        lines: mappedLines,
        note: note || null,
      };
      if (needsSupplier) requestData.supplierId = parseInt(supplierId);
      if (type === "EXPENSE" && supplierId) requestData.supplierId = parseInt(supplierId);
      if (isCustomerInvoice) requestData.customerName = customerName || null;
      if (needsSupplier) requestData.paymentDueDate = paymentDueDate || null;
      if (type === "PURCHASE_ORDER") requestData.deliveryDate = deliveryDate || null;
      createMutation.mutate(requestData);
    }
  };

  const isValid = type && lines.some((l) => l.name && parseInt(l.quantity) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "編集" : "新規登録"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 種別選択 */}
          <div className="space-y-2">
            <Label>種別 <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_CONFIG.map((config) => {
                const Icon = config.icon;
                const isSelected = type === config.value;
                return (
                  <button
                    key={config.value}
                    type="button"
                    disabled={isEditMode}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    } ${isEditMode ? "cursor-not-allowed opacity-60" : ""}`}
                    onClick={() => !isEditMode && setType(config.value)}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-sm font-medium">{config.label}</span>
                    <span className="text-xs text-gray-500">{config.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {type && (
            <>
              {/* 仕入先/取引先（仕入れ/支払い: 必須、経費: 任意） */}
              {(needsSupplier || type === "EXPENSE") && (
                <div className="space-y-2">
                  <Label htmlFor="supplier">
                    {type === "EXPENSE" ? "取引先" : "仕入先"} {needsSupplier && <span className="text-red-500">*</span>}
                  </Label>
                  {loadingSuppliers ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      読み込み中...
                    </div>
                  ) : (
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder={type === "EXPENSE" ? "取引先を選択" : "仕入先を選択"} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* 顧客名（追加請求のみ） */}
              {isCustomerInvoice && (
                <div className="space-y-2">
                  <Label htmlFor="customerName">顧客名</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="顧客名を入力"
                  />
                </div>
              )}

              {/* 支払期日（仕入れ/支払い） */}
              {needsSupplier && (
                <div className="space-y-2">
                  <Label htmlFor="paymentDueDate">支払期日</Label>
                  <Input
                    id="paymentDueDate"
                    type="date"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                  />
                </div>
              )}

              {/* 納品予定日（仕入れのみ） */}
              {isPurchaseOrder && (
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">納品予定日</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              )}

              {/* 明細 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>明細 <span className="text-red-500">*</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-2" />
                    明細を追加
                  </Button>
                </div>

                <div className="bg-white rounded-lg border border-gray-200">
                  <div className={`grid gap-3 p-4 bg-gray-100 border-b border-gray-200 ${isPurchaseOrder ? "grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.5fr_36px]" : "grid-cols-[3fr_1fr_1fr_1fr_36px]"}`}>
                    <div className="text-xs font-medium text-gray-600 px-3">品目名</div>
                    {isPurchaseOrder && <div className="text-xs font-medium text-gray-600 px-3">回線種別</div>}
                    <div className="text-xs font-medium text-gray-600 text-right px-3">数量</div>
                    <div className="text-xs font-medium text-gray-600 text-right px-3">単価</div>
                    <div className="text-xs font-medium text-gray-600 text-right px-3">小計</div>
                    {isPurchaseOrder && <div className="text-xs font-medium text-gray-600 text-center">単価含</div>}
                    <div></div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {lines.map((line) => (
                      <div
                        key={line.id}
                        className={`grid gap-3 items-center p-4 hover:bg-gray-50 ${isPurchaseOrder ? "grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.5fr_36px]" : "grid-cols-[3fr_1fr_1fr_1fr_36px]"}`}
                      >
                        <Input
                          value={line.name}
                          onChange={(e) => updateLine(line.id, "name", e.target.value)}
                          placeholder="品目名"
                          className="h-9"
                        />
                        {isPurchaseOrder && (
                          <Select
                            value={line.carrierType}
                            onValueChange={(v) => updateLine(line.id, "carrierType", v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="任意" />
                            </SelectTrigger>
                            <SelectContent>
                              {CARRIER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                          placeholder="100"
                          className="h-9 text-right"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">¥</span>
                          <CurrencyInput
                            value={Number(line.unitPrice) || 0}
                            onChange={(val) => updateLine(line.id, "unitPrice", String(val))}
                            placeholder="1,000"
                            className="flex h-9 w-full rounded-md border border-input bg-background pl-5 pr-3 py-2 text-sm text-right ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                        </div>
                        <div className="h-9 px-3 py-2 bg-gray-100 border rounded-md text-sm font-bold flex items-center justify-end">
                          ¥{calculateSubtotal(line).toLocaleString()}
                        </div>
                        {isPurchaseOrder && (
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={line.isIncludedInUnitCost}
                              onCheckedChange={(checked) =>
                                updateLine(line.id, "isIncludedInUnitCost", !!checked)
                              }
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          className="h-9 w-9 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 合計金額（自動計算） */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">小計</span>
                    <Select value={taxType} onValueChange={(v) => setTaxType(v as "TAX_EXCLUDED" | "TAX_INCLUDED" | "TAX_FREE")}>
                      <SelectTrigger className="w-[110px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TAX_EXCLUDED">税抜</SelectItem>
                        <SelectItem value="TAX_INCLUDED">税込</SelectItem>
                        <SelectItem value="TAX_FREE">非課税</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    ¥{calculateSubtotalSum().toLocaleString()}
                  </span>
                </div>
                {taxType === "TAX_EXCLUDED" && (
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>消費税（10%）</span>
                    <span>¥{calculateTax().toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-semibold text-gray-700">合計金額</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ¥{calculateTotal().toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 備考 */}
              <div className="space-y-2">
                <Label htmlFor="note">備考</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="備考があれば入力してください"
                  rows={3}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? "更新中..." : "作成中..."}
                </>
              ) : (
                isEditMode ? "更新" : "登録"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
