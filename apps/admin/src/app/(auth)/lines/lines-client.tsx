"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { CustomerDetailModal } from "@/components/customer-detail-modal";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import type { LineUpdateInput, LineStatus } from "@/entities";
import { TableSkeleton } from "@/components/ui/table-skeleton";

interface ApplicationLine {
  id: string;
  applicationId: string;
  lineNumber: number;
  simId: string | null;
  msisdn: string | null;
  status: string;
  shippedAt: Date | null;
  returnedAt: Date | null;
  lineReserveTagId: number | null;
  application: {
    id: string;
    applicationNumber: string;
    isArchived: boolean;
    archivedAt: Date | null;
    customer: {
      lastName: string;
      firstName: string;
      companyName: string | null;
      type: string;
      lastNameKana: string | null;
      firstNameKana: string | null;
      companyNameKana: string | null;
      birthDate: Date | null;
      postalCode: string | null;
      prefecture: string | null;
      city: string | null;
      address: string | null;
      building: string | null;
      companyPostalCode: string | null;
      companyPrefecture: string | null;
      companyCity: string | null;
      companyAddress: string | null;
      companyBuilding: string | null;
      email: string | null;
      phone: string | null;
    };
    service: {
      id: string;
      name: string;
      code: string;
    } | null;
    plan: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  sim: {
    iccid: string;
    msisdn: string | null;
    simLocationTagId: number | null;
    simLocationTag: {
      id: number;
      name: string;
    } | null;
  } | null;
  lineReserveTag: {
    id: number;
    name: string;
  } | null;
}

interface LinesResponse {
  data: ApplicationLine[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface LineTag {
  id: number;
  name: string;
}

interface LinesWithTagsResponse {
  lines: LinesResponse;
  simLocationTags: LineTag[];
  lineReserveTags: LineTag[];
}

const STATUS_LABELS: Record<string, string> = {
  NOT_ACTIVATED: "未開通",
  ACTIVATED: "開通済み",
  SHIPPING_INSTRUCTED: "発送指示済み",
  SHIPPED: "発送済み",
  RETURNED: "返却済み",
  CANCELLED: "解約",
};


export function LinesClient() {
  const queryClient = useQueryClient();

  // Filter states
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [simLocationTagIds, setSimLocationTagIds] = useQueryState("simLocationTagIds", { defaultValue: "" });
  const [lineReserveTagIds, setLineReserveTagIds] = useQueryState("lineReserveTagIds", { defaultValue: "" });
  const [statuses, setStatuses] = useQueryState("statuses", { defaultValue: "" });
  const [shippedFrom, setShippedFrom] = useQueryState("shippedFrom", { defaultValue: "" });
  const [shippedTo, setShippedTo] = useQueryState("shippedTo", { defaultValue: "" });
  const [returnedFrom, setReturnedFrom] = useQueryState("returnedFrom", { defaultValue: "" });
  const [returnedTo, setReturnedTo] = useQueryState("returnedTo", { defaultValue: "" });
  const [showArchived, setShowArchived] = useQueryState("archived", { defaultValue: "false" });
  const [page, setPage] = useQueryState("page", { defaultValue: "1" });

  const [searchInput, setSearchInput] = useState(search);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState<ApplicationLine["application"]["customer"] | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Bulk edit states
  const [bulkSimLocationTagId, setBulkSimLocationTagId] = useState<number | null>(null);
  const [bulkLineReserveTagId, setBulkLineReserveTagId] = useState<number | null>(null);
  const [bulkShippedAt, setBulkShippedAt] = useState("");
  const [bulkReturnedAt, setBulkReturnedAt] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Inline edit states (保存ボタン方式)
  const [editedLines, setEditedLines] = useState<Record<string, Partial<{
    simLocationTagId: number | null;
    lineReserveTagId: number | null;
    shippedAt: string | null;
    returnedAt: string | null;
    status: string;
  }>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // フィルターが設定されているかチェック
  const hasFilters = !!(search || simLocationTagIds || lineReserveTagIds || statuses || shippedFrom || shippedTo || returnedFrom || returnedTo || showArchived === "true" || page !== "1");

  // クエリパラメータ生成
  const queryParams = useMemo(() => {
    if (!hasFilters) return undefined;
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (simLocationTagIds) params.simLocationTagIds = simLocationTagIds;
    if (lineReserveTagIds) params.lineReserveTagIds = lineReserveTagIds;
    if (statuses) params.statuses = statuses;
    if (shippedFrom) params.shippedFrom = shippedFrom;
    if (shippedTo) params.shippedTo = shippedTo;
    if (returnedFrom) params.returnedFrom = returnedFrom;
    if (returnedTo) params.returnedTo = returnedTo;
    if (showArchived === "true") params.includeArchived = "true";
    params.page = page;
    return params;
  }, [hasFilters, search, simLocationTagIds, lineReserveTagIds, statuses, shippedFrom, shippedTo, returnedFrom, returnedTo, showArchived, page]);

  // Lines + tags data (統合API)
  const { data, isLoading: isLoadingLines, error } = useQuery<LinesWithTagsResponse>({
    queryKey: queryKeys.linesWithTags(queryParams),
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (simLocationTagIds) params.set("simLocationTagIds", simLocationTagIds);
      if (lineReserveTagIds) params.set("lineReserveTagIds", lineReserveTagIds);
      if (statuses) params.set("statuses", statuses);
      if (shippedFrom) params.set("shippedFrom", shippedFrom);
      if (shippedTo) params.set("shippedTo", shippedTo);
      if (returnedFrom) params.set("returnedFrom", returnedFrom);
      if (returnedTo) params.set("returnedTo", returnedTo);
      if (showArchived === "true") params.set("includeArchived", "true");
      params.set("page", page);
      return api.getLinesWithTags(params) as Promise<LinesWithTagsResponse>;
    },
    staleTime: STALE_TIMES.LIST,
  });

  const linesData = data?.lines;
  const simLocationTags = data?.simLocationTags || [];
  const lineReserveTags = data?.lineReserveTags || [];
  const lines = linesData?.data || [];
  const pagination = linesData?.pagination || null;
  const currentQueryKey = queryKeys.linesWithTags(queryParams);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage("1");
  };

  const toggleSelectAll = () => {
    if (selectedLines.size === lines.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(lines.map((line) => line.id)));
    }
  };

  const toggleSelectLine = (lineId: string) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId);
    } else {
      newSelected.add(lineId);
    }
    setSelectedLines(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedLines.size === 0) {
      toast.error("回線を選択してください");
      return;
    }

    const updates: Partial<LineUpdateInput & { simLocationTagId: number | null }> = {};
    if (bulkSimLocationTagId !== null) updates.simLocationTagId = bulkSimLocationTagId;
    if (bulkLineReserveTagId !== null) updates.lineReserveTagId = bulkLineReserveTagId;
    if (bulkShippedAt) updates.shippedAt = bulkShippedAt;
    if (bulkReturnedAt) updates.returnedAt = bulkReturnedAt;
    if (bulkStatus) updates.status = bulkStatus as LineStatus;

    if (Object.keys(updates).length === 0) {
      toast.error("更新する項目を選択してください");
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/lines/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineIds: Array.from(selectedLines),
          ...updates,
        }),
      });

      if (res.ok) {
        toast.success(`${selectedLines.size}件を更新しました`);
        setSelectedLines(new Set());
        setBulkSimLocationTagId(null);
        setBulkLineReserveTagId(null);
        setBulkShippedAt("");
        setBulkReturnedAt("");
        setBulkStatus("");
        queryClient.invalidateQueries({ queryKey: currentQueryKey });
      } else {
        throw new Error("一括更新に失敗しました");
      }
    } catch (err) {
      toast.error("一括更新に失敗しました");
    } finally {
      setBulkUpdating(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  };

  const getCustomerName = (line: ApplicationLine) => {
    const customer = line.application.customer;
    if (customer.type === "CORPORATE" && customer.companyName) {
      return customer.companyName;
    }
    return `${customer.lastName} ${customer.firstName}`;
  };

  // 編集用ヘルパー関数
  const handleFieldChange = (lineId: string, field: string, value: string | number | null) => {
    setEditedLines((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  };

  const getEditedValue = <T,>(line: ApplicationLine, field: string, originalValue: T): T => {
    const edited = editedLines[line.id];
    if (edited && field in edited) {
      return edited[field as keyof typeof edited] as T;
    }
    return originalValue;
  };

  const hasChanges = () => Object.keys(editedLines).length > 0;

  const hasLineChanges = (lineId: string) => lineId in editedLines;

  const getChangedLinesCount = () => Object.keys(editedLines).length;

  const cancelChanges = () => setEditedLines({});

  const saveChanges = async () => {
    if (!hasChanges()) return;

    const changesCount = getChangedLinesCount();
    const currentEditedLines = { ...editedLines };

    // 楽観的更新: まずUIを即座に更新
    queryClient.setQueryData<LinesWithTagsResponse>(currentQueryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        lines: {
          ...old.lines,
          data: old.lines.data.map((line) => {
            const changes = currentEditedLines[line.id];
            if (!changes) return line;
            return {
              ...line,
              ...(changes.lineReserveTagId !== undefined && { lineReserveTagId: changes.lineReserveTagId }),
              ...(changes.status !== undefined && { status: changes.status }),
              ...(changes.shippedAt !== undefined && { shippedAt: changes.shippedAt ? new Date(changes.shippedAt) : null }),
              ...(changes.returnedAt !== undefined && { returnedAt: changes.returnedAt ? new Date(changes.returnedAt) : null }),
              sim: line.sim && changes.simLocationTagId !== undefined
                ? { ...line.sim, simLocationTagId: changes.simLocationTagId }
                : line.sim,
            };
          }),
        },
      };
    });

    // 編集状態をクリア（UIは既に更新済み）
    setEditedLines({});
    toast.success(`${changesCount}件の変更を保存しました`);

    // バックグラウンドでAPIを呼び出し
    setIsSaving(true);
    try {
      const promises = Object.entries(currentEditedLines).map(([lineId, changes]) =>
        fetch(`/api/lines/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
      );

      const results = await Promise.all(promises);
      const allSucceeded = results.every((res) => res.ok);

      if (!allSucceeded) {
        // 失敗した場合は再取得して正しい状態に戻す
        toast.error("一部の保存に失敗しました。データを再取得します。");
        queryClient.invalidateQueries({ queryKey: currentQueryKey });
      }
    } catch (err) {
      toast.error("保存に失敗しました。データを再取得します。");
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4" />
          データの取得に失敗しました。
        </div>
      )}

      {/* Bulk Edit Bar */}
      {selectedLines.size > 0 && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedLines.size}件選択中
              </span>
              <select
                className="px-3 py-1.5 border rounded-md text-sm"
                value={bulkSimLocationTagId?.toString() || ""}
                onChange={(e) => setBulkSimLocationTagId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">SIMの場所</option>
                {simLocationTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <select
                className="px-3 py-1.5 border rounded-md text-sm"
                value={bulkLineReserveTagId?.toString() || ""}
                onChange={(e) => setBulkLineReserveTagId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">予備タグ</option>
                {lineReserveTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="px-3 py-1.5 border rounded-md text-sm"
                value={bulkShippedAt}
                onChange={(e) => setBulkShippedAt(e.target.value)}
                placeholder="発送日"
              />
              <input
                type="date"
                className="px-3 py-1.5 border rounded-md text-sm"
                value={bulkReturnedAt}
                onChange={(e) => setBulkReturnedAt(e.target.value)}
                placeholder="返却日"
              />
              <select
                className="px-3 py-1.5 border rounded-md text-sm"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
              >
                <option value="">ステータス</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleBulkUpdate}
                disabled={bulkUpdating}
              >
                {bulkUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    適用中...
                  </>
                ) : (
                  "適用"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unsaved Changes Bar */}
      {hasChanges() && (
        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-800">
                未保存の変更があります（{getChangedLinesCount()}件）
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelChanges}
                  disabled={isSaving}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={saveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              回線一覧
              {pagination?.total && (
                <span className="text-sm font-normal text-gray-500">
                  {pagination.total.toLocaleString()}件
                </span>
              )}
              {isLoadingLines && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              フィルター
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="pt-4 border-t mt-4">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="申込者名"
                  className="px-3 py-2 border rounded-md"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <input
                  type="text"
                  placeholder="会社名"
                  className="px-3 py-2 border rounded-md"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <input
                  type="text"
                  placeholder="電話番号"
                  className="px-3 py-2 border rounded-md"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <input
                  type="text"
                  placeholder="ICCID"
                  className="px-3 py-2 border rounded-md"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* SIM Location Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SIMの場所
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {simLocationTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={simLocationTagIds.split(",").includes(tag.id.toString())}
                          onChange={(e) => {
                            const ids = simLocationTagIds.split(",").filter(Boolean);
                            if (e.target.checked) {
                              ids.push(tag.id.toString());
                            } else {
                              const index = ids.indexOf(tag.id.toString());
                              if (index > -1) ids.splice(index, 1);
                            }
                            setSimLocationTagIds(ids.join(","));
                            setPage("1");
                          }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Line Reserve Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    予備タグ
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {lineReserveTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={lineReserveTagIds.split(",").includes(tag.id.toString())}
                          onChange={(e) => {
                            const ids = lineReserveTagIds.split(",").filter(Boolean);
                            if (e.target.checked) {
                              ids.push(tag.id.toString());
                            } else {
                              const index = ids.indexOf(tag.id.toString());
                              if (index > -1) ids.splice(index, 1);
                            }
                            setLineReserveTagIds(ids.join(","));
                            setPage("1");
                          }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Statuses */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ステータス
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={statuses.split(",").includes(value)}
                          onChange={(e) => {
                            const vals = statuses.split(",").filter(Boolean);
                            if (e.target.checked) {
                              vals.push(value);
                            } else {
                              const index = vals.indexOf(value);
                              if (index > -1) vals.splice(index, 1);
                            }
                            setStatuses(vals.join(","));
                            setPage("1");
                          }}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    発送日
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md flex-1"
                      value={shippedFrom}
                      onChange={(e) => {
                        setShippedFrom(e.target.value);
                        setPage("1");
                      }}
                    />
                    <span className="text-gray-500">～</span>
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md flex-1"
                      value={shippedTo}
                      onChange={(e) => {
                        setShippedTo(e.target.value);
                        setPage("1");
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    返却日
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md flex-1"
                      value={returnedFrom}
                      onChange={(e) => {
                        setReturnedFrom(e.target.value);
                        setPage("1");
                      }}
                    />
                    <span className="text-gray-500">～</span>
                    <input
                      type="date"
                      className="px-3 py-2 border rounded-md flex-1"
                      value={returnedTo}
                      onChange={(e) => {
                        setReturnedTo(e.target.value);
                        setPage("1");
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Archive Filter */}
              <div className="mt-4 pt-4 border-t">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showArchived === "true"}
                    onChange={(e) => {
                      setShowArchived(e.target.checked ? "true" : "false");
                      setPage("1");
                    }}
                    className="rounded"
                  />
                  アーカイブ済み申し込みの回線を表示
                </label>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0 overflow-auto">
          {lines.length === 0 && !isLoadingLines ? (
            <div className="text-center py-12 px-6 text-gray-500">
              回線が見つかりません
            </div>
          ) : lines.length === 0 && isLoadingLines ? (
            <TableSkeleton rows={10} cols={6} />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 w-8">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedLines.size === lines.length && lines.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[120px]">申込者名</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[120px]">会社名</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[100px]">サービス</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[100px]">プラン</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[110px]">電話番号</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[150px]">ICCID</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[130px]">SIMの場所</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[130px]">予備タグ</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[100px]">発送日</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[100px]">返却日</th>
                    <th className="text-left py-3 px-4 whitespace-nowrap min-w-[90px]">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className={`border-b hover:bg-gray-50 ${
                        hasLineChanges(line.id) ? "bg-yellow-50" : ""
                      } ${line.application.isArchived ? "bg-gray-100 opacity-75" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedLines.has(line.id)}
                          onChange={() => toggleSelectLine(line.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedCustomer(line.application.customer);
                              setIsCustomerModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                          >
                            {getCustomerName(line)}
                          </button>
                          {line.application.isArchived && (
                            <Badge variant="secondary" className="text-xs">
                              アーカイブ
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {line.application.customer.companyName || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {line.application.service?.name || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {line.application.plan?.name || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {line.msisdn || line.sim?.msisdn || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {line.simId || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className="px-2 py-1 border rounded text-sm min-w-[120px]"
                          value={getEditedValue(line, "simLocationTagId", line.sim?.simLocationTagId)?.toString() || ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : null;
                            handleFieldChange(line.id, "simLocationTagId", value);
                          }}
                        >
                          <option value="">選択してください</option>
                          {simLocationTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className="px-2 py-1 border rounded text-sm min-w-[120px]"
                          value={getEditedValue(line, "lineReserveTagId", line.lineReserveTagId)?.toString() || ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : null;
                            handleFieldChange(line.id, "lineReserveTagId", value);
                          }}
                        >
                          <option value="">選択してください</option>
                          {lineReserveTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="date"
                          className="px-2 py-1 border rounded text-sm"
                          value={getEditedValue(line, "shippedAt", formatDate(line.shippedAt))}
                          onChange={(e) => {
                            handleFieldChange(line.id, "shippedAt", e.target.value || null);
                          }}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="date"
                          className="px-2 py-1 border rounded text-sm"
                          value={getEditedValue(line, "returnedAt", formatDate(line.returnedAt))}
                          onChange={(e) => {
                            handleFieldChange(line.id, "returnedAt", e.target.value || null);
                          }}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className="px-2 py-1 border rounded text-sm"
                          value={getEditedValue(line, "status", line.status)}
                          onChange={(e) => {
                            handleFieldChange(line.id, "status", e.target.value);
                          }}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t flex justify-between items-center text-sm text-gray-500">
              <span>
                {pagination.total}件中{" "}
                {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                件を表示
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((parseInt(page) - 1).toString())}
                >
                  前へ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((parseInt(page) + 1).toString())}
                >
                  次へ
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCustomer && (
        <CustomerDetailModal
          open={isCustomerModalOpen}
          onOpenChange={setIsCustomerModalOpen}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
}
