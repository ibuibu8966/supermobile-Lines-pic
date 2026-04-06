"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, ChevronUp, Search, Loader2, AlertCircle, Edit, CalendarIcon, Filter } from "lucide-react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import type { SimUpdateInput } from "@/entities";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/components/ui/lib/utils";
import { TableSkeleton } from "@/components/ui/table-skeleton";

interface Contract {
  id: string;
  serviceName: string;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  customer: {
    id: string;
    lastName: string;
    firstName: string;
    companyName: string | null;
    type: string;
  } | null;
  usageTags: Array<{
    usageTag: {
      id: number;
      code: string;
      name: string;
    };
  }>;
}

interface Sim {
  iccid: string;
  msisdn: string | null;
  simType: string;
  carrierType: string | null;
  status: string;
  isAutoCancel: boolean;
  autoCancelDate: string | null;
  supplier: {
    id: string;
    code: string;
    name: string;
  };
  simLocationTag: {
    id: number;
    code: string;
    name: string;
  } | null;
  simLocationTagId: number | null;
  contracts: Contract[];
  consumedTags: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  eligibleTags: Array<{
    id: number;
    name: string;
  }>;
  applicationLines?: Array<{
    id: string;
    application: {
      id: string;
      applicationNumber: string;
      isArchived: boolean;
      archivedAt: Date | null;
    };
  }>;
}

interface SimsResponse {
  data: Sim[];
  pagination: {
    currentPage: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
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

const SIM_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "個人",
  CORPORATE: "法人",
};

const CARRIER_LABELS: Record<string, string> = {
  DOCOMO: "docomo",
  AU: "au",
  SOFTBANK: "SoftBank",
  RAKUTEN: "楽天",
};

export function SimsClient() {
  const queryClient = useQueryClient();

  // simLocationTags from cache (prefetched at login)
  const { data: simLocationTags = [] } = useQuery<{ id: number; code?: string; name: string }[]>({
    queryKey: queryKeys.simLocationTags,
    queryFn: api.getSimLocationTags,
  });

  // 用途タグ・仕入れ先をReact Queryで取得（ログイン時プリフェッチ済みキャッシュを使用）
  const { data: allUsageTags = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: queryKeys.usageTags,
    queryFn: api.getUsageTags,
  });

  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: queryKeys.suppliers,
    queryFn: api.getSuppliers as unknown as () => Promise<Array<{ id: string; name: string }>>,
  });

  // URL状態管理
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [statusFilter, setStatusFilter] = useQueryState("status", { defaultValue: "" });
  const [carrierFilter, setCarrierFilter] = useQueryState("carrier", { defaultValue: "" });
  const [simTypeFilter, setSimTypeFilter] = useQueryState("simType", { defaultValue: "" });
  const [autoCancelDateFrom, setAutoCancelDateFrom] = useQueryState("autoCancelDateFrom", { defaultValue: "" });
  const [autoCancelDateTo, setAutoCancelDateTo] = useQueryState("autoCancelDateTo", { defaultValue: "" });
  const [simLocationFilter, setSimLocationFilter] = useQueryState("simLocation", { defaultValue: "" });
  const [supplierFilter, setSupplierFilter] = useQueryState("supplier", { defaultValue: "" });
  const [page, setPage] = useQueryState("page", {
    defaultValue: "1",
    parse: (v) => v,
    serialize: (v) => v,
  });

  // ローカル状態
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(search);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // 編集モーダル用状態（利用可能な用途タグのみ）
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSimIccid, setEditingSimIccid] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // 一括編集用状態
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedSimIds, setSelectedSimIds] = useState<Set<string>>(new Set());
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<number[]>([]);
  const [bulkAutoCancelDate, setBulkAutoCancelDate] = useState<string>("");

  // 自動解約予定日のポップオーバー表示用状態
  const [autoCancelPopoverOpen, setAutoCancelPopoverOpen] = useState<Record<string, boolean>>({});

  // クエリパラメータ生成（キャッシュキー兼用）
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (carrierFilter) params.carrier = carrierFilter;
    if (simTypeFilter) params.simType = simTypeFilter;
    if (autoCancelDateFrom) params.autoCancelDateFrom = autoCancelDateFrom;
    if (autoCancelDateTo) params.autoCancelDateTo = autoCancelDateTo;
    if (simLocationFilter) params.simLocationTagId = simLocationFilter;
    if (supplierFilter) params.supplier = supplierFilter;
    params.page = page;
    return params;
  }, [search, statusFilter, carrierFilter, simTypeFilter, autoCancelDateFrom, autoCancelDateTo, simLocationFilter, supplierFilter, page]);

  // SIMs data（queryParamsからURLSearchParamsを派生させてfetch）
  const { data: simsData, isLoading: isLoadingSims, error } = useQuery<SimsResponse>({
    queryKey: queryKeys.sims(queryParams),
    queryFn: () => api.getSims(new URLSearchParams(queryParams)) as Promise<SimsResponse>,
    staleTime: STALE_TIMES.LIST,
  });

  const sims = simsData?.data || [];
  const pagination = simsData?.pagination || null;

  const toggleExpand = (iccid: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(iccid)) {
        next.delete(iccid);
      } else {
        next.add(iccid);
      }
      return next;
    });
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage("1");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const getCustomerName = (contract: Contract) => {
    if (!contract.customer) return "—";
    if (contract.customer.type === "CORPORATE" && contract.customer.companyName) {
      return contract.customer.companyName;
    }
    return `${contract.customer.lastName} ${contract.customer.firstName}`;
  };

  // SIMに紐づく申し込みがアーカイブされているかチェック
  const hasArchivedApplication = (sim: Sim) => {
    return sim.applicationLines?.some((line) => line.application?.isArchived) || false;
  };

  const updateSimLocationTag = async (iccid: string, simLocationTagId: number | null) => {
    if (!simsData) return;

    // 楽観的更新
    const foundTag = simLocationTagId ? simLocationTags.find(t => t.id === simLocationTagId) : null;
    const currentQueryKey = queryKeys.sims(queryParams);

    queryClient.setQueryData<SimsResponse>(currentQueryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((sim) =>
          sim.iccid === iccid
            ? {
                ...sim,
                simLocationTagId,
                simLocationTag: foundTag ? { id: foundTag.id, code: foundTag.code || "", name: foundTag.name } : null
              }
            : sim
        ),
      };
    });

    try {
      const res = await fetch(`/api/sims/${iccid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simLocationTagId }),
      });
      if (res.ok) {
        toast.success("SIMの場所を更新しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("SIMの場所の更新に失敗しました");
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    }
  };

  // 編集モーダルを開く（利用可能な用途タグのみ）
  const openEditModal = (sim: Sim) => {
    setEditingSimIccid(sim.iccid);
    setSelectedTagIds(sim.eligibleTags?.map(t => t.id) || []);
    setEditModalOpen(true);
  };

  // 自動解約フラグを切り替え
  const handleAutoCancelToggle = async (iccid: string, checked: boolean) => {
    try {
      const res = await fetch(`/api/sims/${iccid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAutoCancel: checked }),
      });

      if (res.ok) {
        toast.success(checked ? '自動解約をONにしました' : '自動解約をOFFにしました');
        queryClient.invalidateQueries({ queryKey: queryKeys.sims(queryParams) });
      } else {
        const data = await res.json();
        toast.error(data.error || '更新に失敗しました');
      }
    } catch {
      toast.error('更新に失敗しました');
    }
  };

  // 解約予定日を自動保存
  const handleAutoCancelDateChange = async (iccid: string, date: Date | undefined) => {
    try {
      // ローカルタイムゾーンでYYYY-MM-DD形式に変換
      let dateString: string | null = null;
      if (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
      }

      const res = await fetch(`/api/sims/${iccid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoCancelDate: dateString,
        }),
      });

      if (res.ok) {
        toast.success('解約予定日を更新しました');
        queryClient.invalidateQueries({ queryKey: queryKeys.sims(queryParams) });
        // ポップオーバーを閉じる
        setAutoCancelPopoverOpen(prev => ({ ...prev, [iccid]: false }));
      } else {
        const data = await res.json();
        toast.error(data.error || '更新に失敗しました');
      }
    } catch {
      toast.error('更新に失敗しました');
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

  // 保存処理（利用可能な用途タグのみ）
  const handleSave = async () => {
    if (!editingSimIccid) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sims/${editingSimIccid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eligibleTagIds: selectedTagIds,
        }),
      });

      if (res.ok) {
        toast.success('利用可能な用途タグを更新しました');
        setEditModalOpen(false);
        // データを再取得
        queryClient.invalidateQueries({ queryKey: queryKeys.sims(queryParams) });
      } else {
        const data = await res.json();
        toast.error(data.error || '更新に失敗しました');
      }
    } catch {
      toast.error('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // Tab state
  return (
    <div className="p-6 h-full flex flex-col">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4" />
          データの取得に失敗しました。再度お試しください。
        </div>
      )}

          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  SIM一覧（親子表示）
                  {pagination && (
                    <span className="text-sm font-normal text-gray-500">
                      {pagination.totalCount}件
                    </span>
                  )}
                  {isLoadingSims && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {bulkEditMode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedSimIds.size === sims.length) {
                            setSelectedSimIds(new Set());
                          } else {
                            setSelectedSimIds(new Set(sims.map(s => s.iccid)));
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        {selectedSimIds.size === sims.length ? "全選択解除" : "全選択"}
                      </Button>
                      {selectedSimIds.size > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setBulkEditModalOpen(true)}
                          className="flex items-center gap-2"
                        >
                          選択した{selectedSimIds.size}件を編集
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBulkEditMode(!bulkEditMode);
                      if (bulkEditMode) {
                        setSelectedSimIds(new Set());
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    {bulkEditMode ? "一括編集を閉じる" : "一括編集を開く"}
                    {bulkEditMode ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
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
                </div>
              </div>

              {isFilterOpen && (
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ICCID / 電話番号で検索..."
                      className="px-4 py-2 border rounded-md w-64 pr-10"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <button
                      onClick={handleSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="h-8 w-px bg-gray-300" />

                  <select
                    className={`px-4 py-2 border rounded-md ${!carrierFilter ? 'text-gray-400' : 'text-gray-700'}`}
                    value={carrierFilter}
                    onChange={(e) => {
                      setCarrierFilter(e.target.value);
                      setPage("1");
                    }}
                  >
                    <option value="" disabled hidden>キャリア</option>
                    <option value="">選択なし</option>
                    <option value="NULL">空白</option>
                    <option value="DOCOMO">docomo</option>
                    <option value="AU">au</option>
                    <option value="SOFTBANK">SoftBank</option>
                    <option value="RAKUTEN">楽天</option>
                  </select>

                  <div className="h-8 w-px bg-gray-300" />

                  <select
                    className={`px-4 py-2 border rounded-md ${!simTypeFilter ? 'text-gray-400' : 'text-gray-700'}`}
                    value={simTypeFilter}
                    onChange={(e) => {
                      setSimTypeFilter(e.target.value);
                      setPage("1");
                    }}
                  >
                    <option value="" disabled hidden>SIMタイプ</option>
                    <option value="">選択なし</option>
                    <option value="INDIVIDUAL">個人</option>
                    <option value="CORPORATE">法人</option>
                    <option value="BOTH">両方</option>
                  </select>

                  <div className="h-8 w-px bg-gray-300" />

                  <select
                    className={`px-4 py-2 border rounded-md ${!statusFilter ? 'text-gray-400' : 'text-gray-700'}`}
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage("1");
                    }}
                  >
                    <option value="" disabled hidden>ステータス</option>
                    <option value="">選択なし</option>
                    <option value="IN_STOCK">在庫</option>
                    <option value="ACTIVE">利用中</option>
                  </select>

                  <div className="h-8 w-px bg-gray-300" />

                  <select
                    className={`px-4 py-2 border rounded-md ${!simLocationFilter ? 'text-gray-400' : 'text-gray-700'}`}
                    value={simLocationFilter}
                    onChange={(e) => {
                      setSimLocationFilter(e.target.value);
                      setPage("1");
                    }}
                  >
                    <option value="" disabled hidden>SIMの場所</option>
                    <option value="">選択なし</option>
                    <option value="NULL">空白</option>
                    {simLocationTags.map((tag) => (
                      <option key={tag.id} value={tag.id.toString()}>
                        {tag.name}
                      </option>
                    ))}
                  </select>

                  <div className="h-8 w-px bg-gray-300" />

                  <select
                    className={`px-4 py-2 border rounded-md ${!supplierFilter ? 'text-gray-400' : 'text-gray-700'}`}
                    value={supplierFilter}
                    onChange={(e) => {
                      setSupplierFilter(e.target.value);
                      setPage("1");
                    }}
                  >
                    <option value="" disabled hidden>仕入れ先</option>
                    <option value="">選択なし</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>

                  <div className="h-8 w-px bg-gray-300" />

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 whitespace-nowrap">解約予定日:</label>
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md text-sm"
                      value={autoCancelDateFrom}
                      onChange={(e) => {
                        setAutoCancelDateFrom(e.target.value);
                        setPage("1");
                      }}
                    />
                    <span className="text-gray-500">〜</span>
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md text-sm"
                      value={autoCancelDateTo}
                      onChange={(e) => {
                        setAutoCancelDateTo(e.target.value);
                        setPage("1");
                      }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0 overflow-auto">
              {sims.length === 0 && !isLoadingSims ? (
                <div className="text-center py-12 px-6 text-gray-500">
                  SIMが見つかりません
                </div>
              ) : sims.length === 0 && isLoadingSims ? (
                <TableSkeleton rows={10} cols={8} />
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b">
                        {bulkEditMode && <th className="text-left py-3 px-4 w-8"></th>}
                        <th className="text-left py-3 px-4 w-8"></th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[150px]">ICCID</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[110px]">電話番号</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[90px]">キャリア</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[70px]">SIMタイプ</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[120px]">消費済みタグ</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[140px]">利用可能な用途タグ</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[110px]">SIMの場所</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[90px]">ステータス</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[110px]">解約予定日</th>
                        <th className="text-left py-3 px-4 whitespace-nowrap min-w-[100px]">仕入れ先</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sims.map((sim) => (
                        <React.Fragment key={sim.iccid}>
                          <tr
                            className={`border-b hover:bg-gray-50 ${
                              hasArchivedApplication(sim) ? "bg-gray-100 opacity-75" : ""
                            }`}
                          >
                            {bulkEditMode && (
                              <td className="py-3 px-4">
                                <Checkbox
                                  checked={selectedSimIds.has(sim.iccid)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedSimIds);
                                    if (checked) {
                                      newSet.add(sim.iccid);
                                    } else {
                                      newSet.delete(sim.iccid);
                                    }
                                    setSelectedSimIds(newSet);
                                  }}
                                />
                              </td>
                            )}
                            <td className="py-3 px-4">
                              {sim.contracts.length > 0 && (
                                <button
                                  onClick={() => toggleExpand(sim.iccid)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  {expandedRows.has(sim.iccid) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <Link href={`/sims/${sim.iccid}`} prefetch={false} className="hover:underline text-blue-600">
                                  {sim.iccid}
                                </Link>
                                {hasArchivedApplication(sim) && (
                                  <Badge variant="secondary" className="text-xs">
                                    アーカイブ
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {sim.msisdn || "—"}
                            </td>
                            <td className="py-3 px-4">
                              {sim.carrierType ? (
                                <Badge variant="outline">
                                  {CARRIER_LABELS[sim.carrierType] || sim.carrierType}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">
                                {SIM_TYPE_LABELS[sim.simType] || sim.simType}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1 flex-wrap">
                                {sim.consumedTags.length > 0 ? (
                                  sim.consumedTags.map((tag) => (
                                    <Badge key={tag.id} variant="secondary">
                                      {tag.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 items-center">
                                <div className="flex gap-1 flex-wrap flex-1">
                                  {sim.eligibleTags && sim.eligibleTags.length > 0 ? (
                                    sim.eligibleTags.map((tag) => (
                                      <Badge key={tag.id} variant="outline">
                                        {tag.name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(sim)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                className="px-2 py-1 border rounded text-sm min-w-[100px]"
                                value={sim.simLocationTagId?.toString() || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  updateSimLocationTag(
                                    sim.iccid,
                                    value ? parseInt(value) : null
                                  );
                                }}
                              >
                                <option value="">未設定</option>
                                {simLocationTags.map((tag) => (
                                  <option key={tag.id} value={tag.id.toString()}>
                                    {tag.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={STATUS_VARIANTS[sim.status] || "default"}>
                                {STATUS_LABELS[sim.status] || sim.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={sim.isAutoCancel}
                                  onCheckedChange={(checked) => handleAutoCancelToggle(sim.iccid, !!checked)}
                                />
                                <Popover
                                  open={autoCancelPopoverOpen[sim.iccid] || false}
                                  onOpenChange={(open) => setAutoCancelPopoverOpen(prev => ({ ...prev, [sim.iccid]: open }))}
                                >
                                  <PopoverTrigger asChild>
                                    <button className="hover:underline text-left text-sm">
                                      {sim.autoCancelDate
                                        ? new Date(sim.autoCancelDate).toLocaleDateString("ja-JP")
                                        : "—"}
                                    </button>
                                  </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={sim.autoCancelDate ? new Date(sim.autoCancelDate) : undefined}
                                    onSelect={(date) => handleAutoCancelDateChange(sim.iccid, date)}
                                    initialFocus
                                  />
                                  {sim.autoCancelDate && (
                                    <div className="p-3 border-t">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleAutoCancelDateChange(sim.iccid, undefined)}
                                      >
                                        クリア
                                      </Button>
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                              </div>
                            </td>
                            <td className="py-3 px-4">{sim.supplier?.name ?? "-"}</td>
                          </tr>
                          {expandedRows.has(sim.iccid) &&
                            sim.contracts.map((contract: Contract) => (
                              <tr
                                key={contract.id}
                                className="bg-gray-50/50 border-b"
                              >
                                {bulkEditMode && <td className="py-2 px-4"></td>}
                                <td className="py-2 px-4"></td>
                                <td colSpan={10} className="py-2 px-4">
                                  <div className="pl-4 border-l-2 border-gray-300 ml-2">
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      <span>
                                        {formatDate(contract.contractStart)}〜
                                        {contract.contractEnd
                                          ? formatDate(contract.contractEnd)
                                          : "現在"}
                                      </span>
                                      <span>{getCustomerName(contract)}</span>
                                      <Badge variant="outline">
                                        {contract.serviceName}
                                      </Badge>
                                      {contract.usageTags.map((ut) => (
                                        <Badge key={ut.usageTag.id} variant="secondary">
                                          {ut.usageTag.name}
                                        </Badge>
                                      ))}
                                      <Badge>
                                        {CONTRACT_STATUS_LABELS[contract.status] ||
                                          contract.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t flex justify-between items-center text-sm text-gray-500">
                  <span>
                    {pagination.totalCount}件中{" "}
                    {(pagination.currentPage - 1) * pagination.limit + 1}-
                    {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
                    件を表示
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasPrev}
                      onClick={() => setPage((parseInt(page) - 1).toString())}
                    >
                      前へ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasNext}
                      onClick={() => setPage((parseInt(page) + 1).toString())}
                    >
                      次へ
                    </Button>
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

      {/* 一括編集モーダル */}
      <Dialog open={bulkEditModalOpen} onOpenChange={setBulkEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>一括編集 ({selectedSimIds.size}件)</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* 利用可能な用途タグ */}
            <div>
              <Label className="text-base font-medium mb-3 block">利用可能な用途タグ</Label>
              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border rounded">
                {allUsageTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded border cursor-pointer transition-colors"
                  >
                    <span className="text-sm">{tag.name}</span>
                    <Checkbox
                      checked={bulkSelectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => {
                        setBulkSelectedTagIds(prev =>
                          checked
                            ? [...prev, tag.id]
                            : prev.filter(id => id !== tag.id)
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* 自動解約予定日 */}
            <div>
              <Label className="text-base font-medium mb-3 block">自動解約予定日</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={bulkAutoCancelDate}
                  onChange={(e) => setBulkAutoCancelDate(e.target.value)}
                  className="max-w-xs"
                />
                {bulkAutoCancelDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkAutoCancelDate("")}
                  >
                    クリア
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                ※ 空欄の場合は変更しません
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkEditModalOpen(false);
                setBulkSelectedTagIds([]);
                setBulkAutoCancelDate("");
              }}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                setSaving(true);
                try {
                  const iccids = Array.from(selectedSimIds);

                  // 各SIMを個別に更新
                  await Promise.all(
                    iccids.map(async (iccid) => {
                      const updateData: Partial<SimUpdateInput & { eligibleTagIds: number[]; autoCancelDate: string }> = {};

                      // タグが選択されている場合のみ更新
                      if (bulkSelectedTagIds.length > 0) {
                        updateData.eligibleTagIds = bulkSelectedTagIds;
                      }

                      // 日付が入力されている場合のみ更新
                      if (bulkAutoCancelDate) {
                        updateData.autoCancelDate = bulkAutoCancelDate;
                      }

                      // 更新するデータがある場合のみAPIコール
                      if (Object.keys(updateData).length > 0) {
                        const res = await fetch(`/api/sims/${iccid}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updateData),
                        });

                        if (!res.ok) {
                          throw new Error(`Failed to update ${iccid}`);
                        }
                      }
                    })
                  );

                  toast.success(`${iccids.length}件のSIMを更新しました`);
                  setBulkEditModalOpen(false);
                  setBulkSelectedTagIds([]);
                  setBulkAutoCancelDate("");
                  setSelectedSimIds(new Set());
                  setBulkEditMode(false);
                  queryClient.invalidateQueries({ queryKey: queryKeys.sims(queryParams) });
                } catch {
                  toast.error('一括更新に失敗しました');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || (bulkSelectedTagIds.length === 0 && !bulkAutoCancelDate)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              一括更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
