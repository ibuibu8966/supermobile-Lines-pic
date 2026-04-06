"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, FileText } from "lucide-react";
import { useProcurementSims } from "@/hooks/use-procurement-sims";
import { SimBulkEditToolbar } from "./sim-bulk-edit-toolbar";

interface SimHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string | null;
  supplierName: string;
}

const CARRIER_LABELS: Record<string, string> = {
  DOCOMO: "ドコモ",
  AU: "au",
  SOFTBANK: "ソフトバンク",
  RAKUTEN: "楽天モバイル",
};

const SIM_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "個人回線",
  CORPORATE: "法人回線",
  BOTH: "両方",
};

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "在庫",
  ACTIVE: "利用中",
};

const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
};

// インライン表示用コンポーネント（ダイアログなし）
export function SimHistoryTable({ purchaseOrderId }: { purchaseOrderId: string }) {
  const { data: sims, isLoading, error } = useProcurementSims(purchaseOrderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
        データの取得に失敗しました
      </div>
    );
  }

  if (!sims || sims.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        インポートされたSIMがありません
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm text-gray-600 mb-2">
        合計: <span className="font-bold">{sims.length}</span> 件
      </div>
      <div className="border rounded-lg overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white z-10 min-w-[150px]">ICCID</TableHead>
              <TableHead className="min-w-[120px]">電話番号</TableHead>
              <TableHead className="min-w-[100px]">SIMタイプ</TableHead>
              <TableHead className="min-w-[120px]">キャリア</TableHead>
              <TableHead className="min-w-[150px]">プラン</TableHead>
              <TableHead className="min-w-[120px]">解約予定日</TableHead>
              <TableHead className="min-w-[100px]">自動解約</TableHead>
              <TableHead className="min-w-[120px]">保管場所</TableHead>
              <TableHead className="sticky right-[120px] bg-white z-10 min-w-[100px]">ステータス</TableHead>
              <TableHead className="sticky right-0 bg-white z-10 min-w-[120px]">インポート日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sims.map((sim) => (
              <TableRow key={sim.iccid} className="hover:bg-gray-50">
                <TableCell className="sticky left-0 bg-white font-mono text-xs">{sim.iccid}</TableCell>
                <TableCell className="font-mono text-xs">{sim.msisdn || "-"}</TableCell>
                <TableCell className="text-sm">{SIM_TYPE_LABELS[sim.simType] || sim.simType}</TableCell>
                <TableCell className="text-sm">{sim.carrierType ? CARRIER_LABELS[sim.carrierType] : "-"}</TableCell>
                <TableCell className="text-sm">{sim.plan || "-"}</TableCell>
                <TableCell className="text-sm">
                  {sim.autoCancelDate ? new Date(sim.autoCancelDate).toLocaleDateString("ja-JP") : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {sim.isAutoCancel ? <Badge variant="secondary">有効</Badge> : "-"}
                </TableCell>
                <TableCell className="text-sm">{sim.simLocationTag?.name || "-"}</TableCell>
                <TableCell className="sticky right-[120px] bg-white">
                  <Badge className={STATUS_COLORS[sim.status]} variant="secondary">
                    {STATUS_LABELS[sim.status] || sim.status}
                  </Badge>
                </TableCell>
                <TableCell className="sticky right-0 bg-white text-xs text-gray-600">
                  {new Date(sim.createdAt).toLocaleString("ja-JP")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SimHistoryDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  supplierName,
}: SimHistoryDialogProps) {
  const { data: sims, isLoading, error } = useProcurementSims(purchaseOrderId);
  const [selectedIccids, setSelectedIccids] = useState<Set<string>>(new Set());

  const toggleSelect = (iccid: string) => {
    setSelectedIccids((prev) => {
      const next = new Set(prev);
      if (next.has(iccid)) next.delete(iccid);
      else next.add(iccid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!sims) return;
    if (selectedIccids.size === sims.length) {
      setSelectedIccids(new Set());
    } else {
      setSelectedIccids(new Set(sims.map((s) => s.iccid)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelectedIccids(new Set()); }}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            インポートSIM履歴
          </DialogTitle>
          <DialogDescription>
            {supplierName} からインポートされたSIM一覧
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            データの取得に失敗しました
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !sims || sims.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>インポートされたSIMがありません</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                合計: <span className="font-bold text-lg">{sims.length}</span> 件
              </div>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedIccids.size === sims.length ? "選択解除" : "全て選択"}
              </Button>
            </div>

            {purchaseOrderId && (
              <SimBulkEditToolbar
                selectedIccids={Array.from(selectedIccids)}
                purchaseOrderId={purchaseOrderId}
                onComplete={() => setSelectedIccids(new Set())}
              />
            )}

            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 w-[40px]">
                      <Checkbox
                        checked={selectedIccids.size === sims.length && sims.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="sticky left-[40px] bg-white z-10 min-w-[150px]">
                      ICCID
                    </TableHead>
                    <TableHead className="min-w-[120px]">電話番号</TableHead>
                    <TableHead className="min-w-[100px]">SIMタイプ</TableHead>
                    <TableHead className="min-w-[120px]">キャリア</TableHead>
                    <TableHead className="min-w-[150px]">プラン</TableHead>
                    <TableHead className="min-w-[120px]">利用可能タグ</TableHead>
                    <TableHead className="min-w-[100px]">自動解約</TableHead>
                    <TableHead className="sticky right-[120px] bg-white z-10 min-w-[100px]">
                      ステータス
                    </TableHead>
                    <TableHead className="sticky right-0 bg-white z-10 min-w-[120px]">
                      インポート日時
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sims.map((sim) => (
                    <TableRow
                      key={sim.iccid}
                      className={selectedIccids.has(sim.iccid) ? "bg-blue-50" : "hover:bg-gray-50"}
                    >
                      <TableCell className="sticky left-0 bg-inherit">
                        <Checkbox
                          checked={selectedIccids.has(sim.iccid)}
                          onCheckedChange={() => toggleSelect(sim.iccid)}
                        />
                      </TableCell>
                      <TableCell className="sticky left-[40px] bg-inherit font-mono text-xs">
                        {sim.iccid}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {sim.msisdn || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {SIM_TYPE_LABELS[sim.simType] || sim.simType}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sim.carrierType
                          ? CARRIER_LABELS[sim.carrierType]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sim.plan || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {sim.eligibleTagIds.length > 0
                          ? sim.eligibleTagIds.join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sim.isAutoCancel ? (
                          <Badge variant="secondary">有効</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="sticky right-[120px] bg-inherit">
                        <Badge
                          className={STATUS_COLORS[sim.status]}
                          variant="secondary"
                        >
                          {STATUS_LABELS[sim.status] || sim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="sticky right-0 bg-inherit text-xs text-gray-600">
                        {new Date(sim.createdAt).toLocaleString("ja-JP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
