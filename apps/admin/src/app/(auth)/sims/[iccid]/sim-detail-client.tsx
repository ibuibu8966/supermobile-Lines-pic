"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Phone, Building2, User, Calendar, Tag, CheckCircle, XCircle, Edit, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/components/ui/lib/utils";

interface UsageTag {
  id: number;
  code: string;
  name: string;
  category: string | null;
}

interface Customer {
  id: string;
  lastName: string;
  firstName: string;
  companyName: string | null;
  type: string;
  email: string;
  phone: string;
}

interface Contract {
  id: string;
  serviceName: string;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  shippedAt: string | null;
  arrivedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  customer: Customer | null;
  usageTags: Array<{
    usageTag: UsageTag;
  }>;
}

interface Supplier {
  id: number;
  code: string;
  name: string;
}

interface SimDetail {
  iccid: string;
  msisdn: string | null;
  simType: string;
  carrierType: string | null;
  plan: string | null;
  status: string;
  isMnpEligible: boolean;
  isAutoCancel: boolean;
  autoCancelDate: string | null;
  supplierContractStart: string | null;
  supplierContractEnd: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
  contracts: Contract[];
  consumedTags: UsageTag[];
  availableTags: UsageTag[];
  eligibleTagIds: number[];
}

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "在庫",
  ACTIVE: "利用中",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "destructive" | "secondary" | "outline"> = {
  IN_STOCK: "default",
  ACTIVE: "success",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING: "準備中",
  SHIPPED: "発送済",
  ACTIVE: "利用中",
  ENDED: "終了",
  CANCELLED: "解約",
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-400",
  SHIPPED: "bg-blue-500",
  ACTIVE: "bg-green-500",
  ENDED: "bg-gray-500",
  CANCELLED: "bg-red-500",
};

const CARRIER_LABELS: Record<string, string> = {
  DOCOMO: "docomo",
  AU: "au",
  SOFTBANK: "SoftBank",
  RAKUTEN: "楽天",
};

const SIM_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "個人",
  CORPORATE: "法人",
};

export function SimDetailClient({ iccid }: { iccid: string }) {
  const [sim, setSim] = useState<SimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allUsageTags, setAllUsageTags] = useState<UsageTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // 自動解約予定日のポップオーバー表示用
  const [autoCancelPopoverOpen, setAutoCancelPopoverOpen] = useState(false);

  useEffect(() => {
    const fetchSim = async () => {
      try {
        const res = await fetch(`/api/sims/${iccid}`);
        const data = await res.json();

        if (res.ok) {
          setSim(data);
        } else {
          setError(data.error || "SIMの取得に失敗しました");
        }
      } catch {
        setError("SIMの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchSim();
  }, [iccid]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCustomerName = (customer: Customer | null) => {
    if (!customer) return "—";
    if (customer.type === "CORPORATE" && customer.companyName) {
      return customer.companyName;
    }
    return `${customer.lastName} ${customer.firstName}`;
  };

  // 用途タグを取得
  useEffect(() => {
    const fetchUsageTags = async () => {
      try {
        const res = await fetch('/api/usage-tags');
        if (res.ok) {
          const tags = await res.json();
          setAllUsageTags(tags);
        }
      } catch (err) {
        console.error('用途タグ取得エラー:', err);
      }
    };
    fetchUsageTags();
  }, []);

  // 編集モーダルを開く（利用可能な用途タグのみ）
  const openEditModal = () => {
    if (sim) {
      setSelectedTagIds(sim.eligibleTagIds || []);
      setEditModalOpen(true);
    }
  };

  // 利用可能な用途タグ保存処理
  const handleSave = async () => {
    if (!sim) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sims/${sim.iccid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eligibleTagIds: selectedTagIds,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSim(updated);
        setEditModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.error || '更新に失敗しました');
      }
    } catch {
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 自動解約予定日を自動保存
  const handleAutoCancelDateChange = async (date: Date | undefined) => {
    if (!sim) return;

    try {
      // ローカルタイムゾーンでYYYY-MM-DD形式に変換
      let dateString: string | null = null;
      if (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
      }

      const res = await fetch(`/api/sims/${sim.iccid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoCancelDate: dateString,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSim(updated);
        setAutoCancelPopoverOpen(false);
        alert('自動解約予定日を更新しました');
      } else {
        const data = await res.json();
        alert(data.error || '更新に失敗しました');
      }
    } catch {
      alert('更新に失敗しました');
    }
  };

  // タグの選択/解除
  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !sim) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">SIM詳細</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-red-500">
            {error || "SIMが見つかりません"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">
              {sim.iccid}
            </h1>
          </div>
          <Badge variant={STATUS_VARIANTS[sim.status] || "default"} className="text-sm px-3 py-1">
            {STATUS_LABELS[sim.status] || sim.status}
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">電話番号</p>
                  <p className="font-medium">{sim.msisdn || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">キャリア</p>
                  <p className="font-medium">
                    {sim.carrierType ? CARRIER_LABELS[sim.carrierType] || sim.carrierType : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">回線タイプ</p>
                  <p className="font-medium">
                    {SIM_TYPE_LABELS[sim.simType] || sim.simType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">仕入れ先</p>
                  <p className="font-medium">{sim.supplier.name}</p>
                </div>
              </div>
              {sim.plan && (
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">プラン</p>
                    <p className="font-medium">{sim.plan}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">仕入れ先契約期間</p>
                  <p className="font-medium text-sm">
                    {formatDate(sim.supplierContractStart)} 〜 {formatDate(sim.supplierContractEnd)}
                  </p>
                </div>
              </div>
              <div className="border-t pt-4 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">MNP可否</span>
                  <Badge variant={sim.isMnpEligible ? "success" : "destructive"}>
                    {sim.isMnpEligible ? "可" : "不可"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">自動解約</span>
                  <Badge variant={sim.isAutoCancel ? "destructive" : "secondary"}>
                    {sim.isAutoCancel ? "対象" : "対象外"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 用途タグ状況 */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">用途タグ状況</CardTitle>
                <Button variant="ghost" size="sm" onClick={openEditModal}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  消費済み（販売不可）
                </p>
                <div className="flex flex-wrap gap-2">
                  {sim.consumedTags.length > 0 ? (
                    sim.consumedTags.map((tag) => (
                      <Badge key={tag.id} variant="destructive">
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">なし</span>
                  )}
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  利用可能な用途
                </p>
                <div className="flex flex-wrap gap-2">
                  {(sim.availableTags ?? []).length > 0 ? (
                    (sim.availableTags ?? []).map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">なし</span>
                  )}
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">自動解約予定日</p>
                <Popover
                  open={autoCancelPopoverOpen}
                  onOpenChange={setAutoCancelPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <button className="text-sm text-gray-600 hover:underline text-left">
                      {sim.autoCancelDate ? formatDate(sim.autoCancelDate) : "—"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={sim.autoCancelDate ? new Date(sim.autoCancelDate) : undefined}
                      onSelect={handleAutoCancelDateChange}
                      initialFocus
                    />
                    {sim.autoCancelDate && (
                      <div className="p-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAutoCancelDateChange(undefined)}
                        >
                          クリア
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* メタ情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">システム情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">登録日時</span>
                <span>{formatDateTime(sim.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新日時</span>
                <span>{formatDateTime(sim.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">契約回数</span>
                <span>{sim.contracts.length}回</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 契約履歴タイムライン */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">契約履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {sim.contracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                契約履歴がありません
              </div>
            ) : (
              <div className="relative">
                {/* タイムラインの縦線 */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {sim.contracts.map((contract, index) => (
                    <div key={contract.id} className="relative pl-10">
                      {/* タイムラインのドット */}
                      <div
                        className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white ${
                          CONTRACT_STATUS_COLORS[contract.status] || "bg-gray-400"
                        }`}
                      />

                      <div className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{contract.serviceName}</span>
                              <Badge variant="outline">
                                {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(contract.contractStart)} 〜{" "}
                              {contract.contractEnd ? formatDate(contract.contractEnd) : "現在"}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-400">
                            #{sim.contracts.length - index}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">顧客</p>
                            <p className="font-medium">{getCustomerName(contract.customer)}</p>
                            {contract.customer && (
                              <p className="text-xs text-gray-400">{contract.customer.email}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">用途タグ</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contract.usageTags.length > 0 ? (
                                contract.usageTags.map((ut) => (
                                  <Badge key={ut.usageTag.id} variant="secondary" className="text-xs">
                                    {ut.usageTag.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 配送情報 */}
                        {(contract.shippedAt || contract.arrivedAt || contract.returnedAt) && (
                          <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex gap-4">
                            {contract.shippedAt && (
                              <span>発送: {formatDate(contract.shippedAt)}</span>
                            )}
                            {contract.arrivedAt && (
                              <span>到着: {formatDate(contract.arrivedAt)}</span>
                            )}
                            {contract.returnedAt && (
                              <span>返却: {formatDate(contract.returnedAt)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 仕入れイベント */}
                  <div className="relative pl-10">
                    <div className="absolute left-2 w-5 h-5 rounded-full border-2 border-white bg-blue-400" />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-700">仕入れ</span>
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          {sim.supplier.name}
                        </Badge>
                      </div>
                      <p className="text-sm text-blue-600 mt-1">
                        {formatDate(sim.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 編集モーダル（利用可能な用途タグのみ） */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>利用可能な用途タグを編集</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-base font-medium mb-3 block">利用可能な用途タグ</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded">
                {allUsageTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>
                キャンセル
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* アクションボタン */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline">
            契約を追加
          </Button>
        </div>
      </div>
    </div>
  );
}
