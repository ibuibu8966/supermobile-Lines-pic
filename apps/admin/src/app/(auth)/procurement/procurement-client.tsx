"use client";

import { useState, useMemo } from "react";
import { NewProcurementDialog } from "@/components/procurement/new-procurement-dialog";
import { SupplierManager } from "@/components/suppliers/supplier-manager";
import { ProcurementTable } from "./components/procurement-table";
import { useProcurement } from "@/hooks/use-procurement";
import type { PurchaseOrder, PurchaseOrderType } from "@/types/procurement";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Plus,
  FileText,
  Building2,
  Receipt,
  Wallet,
  CreditCard,
  LayoutList,
  Filter,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const TAB_CONFIG = [
  { value: "all", label: "全て", icon: LayoutList, typeFilter: undefined },
  { value: "PURCHASE_ORDER", label: "仕入れ", icon: FileText, typeFilter: "PURCHASE_ORDER" as PurchaseOrderType },
  { value: "SUPPLIER_INVOICE", label: "支払い", icon: Receipt, typeFilter: "SUPPLIER_INVOICE" as PurchaseOrderType },
  { value: "EXPENSE", label: "経費", icon: Wallet, typeFilter: "EXPENSE" as PurchaseOrderType },
  { value: "CUSTOMER_INVOICE", label: "追加請求", icon: CreditCard, typeFilter: "CUSTOMER_INVOICE" as PurchaseOrderType },
  { value: "suppliers", label: "取引先/仕入先", icon: Building2, typeFilter: undefined },
] as const;

const ORDER_STATUS_OPTIONS = [
  { value: "ORDERED", label: "仕入れ済" },
  { value: "CONFIRMED", label: "仕入れ" },
  { value: "AWAITING_SEAL", label: "しぃさん印鑑待ち" },
  { value: "BEFORE_PAYMENT", label: "振込前" },
  { value: "AWAITING_DELIVERY", label: "納品待ち" },
  { value: "DELIVERED", label: "納品済" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "UNPAID", label: "未払い" },
  { value: "PAID", label: "支払済" },
];

export function ProcurementClient() {
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [showInactiveSuppliers, setShowInactiveSuppliers] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const typeFilter = activeTab !== "all" && activeTab !== "suppliers"
    ? (activeTab as PurchaseOrderType)
    : undefined;

  const {
    orders,
    isLoading,
    error,
    updateMutation,
    uploadImageMutation,
    deleteImageMutation,
  } = useProcurement(typeFilter);

  const handleUpdate = (id: string, data: Record<string, unknown>) => {
    updateMutation.mutate({ id, data });
  };

  const handleImageUpload = async (orderId: string, imageType: string, file: File) => {
    await uploadImageMutation.mutateAsync({ id: orderId, imageType, file });
  };

  const handleImageDelete = async (orderId: string, imageType: string) => {
    await deleteImageMutation.mutateAsync({ id: orderId, imageType });
  };

  const isDataTab = activeTab !== "suppliers";

  // 仕入れタブかどうか（全てタブでも仕入れステータスフィルターを表示）
  const showOrderStatusFilter = activeTab === "all" || activeTab === "PURCHASE_ORDER";
  // 支払いステータスフィルター（全て・支払い・経費・追加請求で表示）
  const showPaymentStatusFilter = activeTab === "all" || activeTab === "SUPPLIER_INVOICE" || activeTab === "EXPENSE" || activeTab === "CUSTOMER_INVOICE";

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      // 仕入れステータスフィルター
      if (statusFilter && order.type === "PURCHASE_ORDER") {
        if (order.status !== statusFilter) return false;
      }
      // 支払いステータスフィルター
      if (paymentStatusFilter && order.type !== "PURCHASE_ORDER") {
        if (order.paymentStatus !== paymentStatusFilter) return false;
      }
      // デフォルト：完了系を非表示（フィルターが未指定の場合）
      if (!statusFilter && order.type === "PURCHASE_ORDER" && order.status === "DELIVERED") return false;
      if (!paymentStatusFilter && order.type !== "PURCHASE_ORDER" && order.paymentStatus === "PAID") return false;
      return true;
    });
  }, [orders, statusFilter, paymentStatusFilter]);

  return (
    <div className="p-6 h-full flex flex-col">
      <NewProcurementDialog
        open={dialogOpen || !!editingOrder}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingOrder(null);
          }
        }}
        defaultType={typeFilter}
        editOrder={editingOrder || undefined}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex items-center gap-4">
            {isDataTab && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {isFilterOpen ? "絞り込みを閉じる" : "絞り込みを開く"}
                  {isFilterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新規登録
                </Button>
              </>
            )}
            {activeTab === "suppliers" && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showInactiveSuppliers}
                    onChange={(e) => setShowInactiveSuppliers(e.target.checked)}
                    className="rounded"
                  />
                  無効な仕入れ先も表示
                </label>
                <Button onClick={() => setSupplierDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新規仕入れ先登録
                </Button>
              </>
            )}
          </div>
        </div>

        {/* フィルターパネル */}
        {isDataTab && isFilterOpen && (
          <div className="flex flex-wrap gap-3 items-center mb-4 px-1">
            {showOrderStatusFilter && (
              <>
                <select
                  className={`px-4 py-2 border rounded-md cursor-pointer ${!statusFilter ? "text-gray-400" : "text-gray-700"}`}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="" disabled hidden>仕入れステータス</option>
                  <option value="">全て（納品済を除く）</option>
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="h-8 w-px bg-gray-300" />
              </>
            )}

            {showPaymentStatusFilter && (
              <select
                className={`px-4 py-2 border rounded-md cursor-pointer ${!paymentStatusFilter ? "text-gray-400" : "text-gray-700"}`}
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
              >
                <option value="" disabled hidden>支払いステータス</option>
                <option value="">全て（支払済を除く）</option>
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* データタブ（全て/発注/請求/経費/追加請求） */}
        {TAB_CONFIG.filter((t) => t.value !== "suppliers").map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 flex-1 min-h-0">
            {isLoading ? (
              <TableSkeleton rows={10} cols={7} />
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">エラーが発生しました</p>
                <p className="text-sm text-muted-foreground mt-2">
                  データの取得に失敗しました。ページを再読み込みしてください。
                </p>
              </div>
            ) : (
              <ProcurementTable
                orders={filteredOrders}
                currentTab={activeTab}
                onUpdate={handleUpdate}
                onImageUpload={handleImageUpload}
                onImageDelete={handleImageDelete}
                isUploading={uploadImageMutation.isPending}
                onEdit={setEditingOrder}
              />
            )}
          </TabsContent>
        ))}

        {/* 仕入先タブ */}
        <TabsContent value="suppliers" className="mt-0">
          <SupplierManager
            hideControls={true}
            showInactive={showInactiveSuppliers}
            onShowInactiveChange={setShowInactiveSuppliers}
            isCreateDialogOpen={supplierDialogOpen}
            onCreateDialogChange={setSupplierDialogOpen}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
