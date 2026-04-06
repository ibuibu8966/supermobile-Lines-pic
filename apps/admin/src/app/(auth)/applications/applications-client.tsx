"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, ExternalLink, AlertCircle, ChevronRight, ChevronDown, ChevronUp, X, Filter, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import dynamic from "next/dynamic";
import { WorkflowRows } from "@/components/applications/workflow-rows";
import type { WorkflowAppData } from "@/components/applications/workflow-rows";
import { CommentModal } from "@/components/applications/comment-modal";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const KycModal = dynamic(
  () => import("@/components/kyc-modal").then((m) => ({ default: m.KycModal })),
  { ssr: false }
);

interface Application {
  id: string;
  applicationNumber: string;
  status: string;
  kycStatus: "PENDING" | "DEFICIENT" | "RESUBMIT" | "COMPLETED" | null;
  paymentStatus: "INVOICED" | "PAID" | null;
  addressStatus: "PENDING" | "DEFICIENT" | "RESUBMIT" | "COMPLETED" | null;
  comment1: string | null;
  comment2: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  latestExpiryDate: string | null;
  needsKycCheck: boolean;
  applicationOrdinal: number;
  unitPrice: number | null;
  totalAmount: number | null;
  customer: {
    type: string;
    lastName: string;
    firstName: string;
    lastNameKana: string | null;
    firstNameKana: string | null;
    companyName: string | null;
    companyNameKana: string | null;
    email: string | null;
    phone: string | null;
  };
  service: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    name: string;
  } | null;
  stats: {
    lineCount: number;
    shippedCount: number;
    notActivatedCount: number;
    returnedCount: number;
    lineStatus: string | null;
  };
  kycImages: { id: string }[];
  noReferral: boolean;
  invoicePdfPath: string | null;
  invoiceUrl: string | null;
  invoiceEmailPath: string | null;
  paymentImagePath: string | null;
  shippingImagePath: string | null;
  referrals: { id: string; referrerName: string; fee: number }[];
  trackings: { id: string; carrier: string; trackingNumber: string }[];
  lines: { id: string }[];
  createdAt: string;
  inoueCheck: string | null;
  assignedUserId: string | null;
  assignedUser: { id: string; name: string } | null;
  _count: { comments: number };
}

interface ApplicationsResponse {
  data: Application[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}


const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "申込済み",
  PAYMENT_PENDING: "入金待ち",
  PAID: "入金済み",
  SHIPPING: "発送中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const KYC_STATUS_OPTIONS = [
  { value: "PENDING", label: "確認待ち" },
  { value: "DEFICIENT", label: "不備" },
  { value: "RESUBMIT", label: "再提出" },
  { value: "COMPLETED", label: "完了" },
];

const ADDRESS_STATUS_OPTIONS = [
  { value: "PENDING", label: "発送済" },
  { value: "DEFICIENT", label: "不備" },
  { value: "RESUBMIT", label: "再送" },
  { value: "COMPLETED", label: "完了" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "INVOICED", label: "請求書発行済み" },
  { value: "PAID", label: "入金済み" },
];

export function ApplicationsClient() {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const isSuperAdmin = sessionData?.user?.role === "SUPER_ADMIN";
  const isEmployee = sessionData?.user?.role === "EMPLOYEE";

  // Services from cache (prefetched at login)
  const { data: services = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: queryKeys.services,
    queryFn: api.getServices as () => Promise<{ id: string; name: string }[]>,
  });

  // スタッフ一覧（担当者選択用）
  const { data: staffList = [] } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: ["users", "staff"],
    queryFn: () => fetch("/api/users/staff").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  // URL状態管理
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [serviceFilter, setServiceFilter] = useQueryState("service", { defaultValue: "" });
  const [kycStatusFilter, setKycStatusFilter] = useQueryState("kycStatus", { defaultValue: "" });
  const [paymentStatusFilter, setPaymentStatusFilter] = useQueryState("paymentStatus", { defaultValue: "" });
  const [addressStatusFilter, setAddressStatusFilter] = useQueryState("addressStatus", { defaultValue: "" });
  const [inoueCheckFilter, setInoueCheckFilter] = useQueryState("inoueCheck", { defaultValue: "" });
  const [assignedUserFilter, setAssignedUserFilter] = useQueryState("assignedUser", { defaultValue: "" });
  const [activeTab, setActiveTab] = useQueryState("tab", { defaultValue: "active" });
  const [page, setPage] = useQueryState("page", {
    defaultValue: "1",
    parse: (v) => v,
    serialize: (v) => v,
  });

  // ローカル状態
  const [searchInput, setSearchInput] = useState(search);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // コメントモーダル
  const [commentModalAppId, setCommentModalAppId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // referrer-tags（SSRプリフェッチ済み）
  const { data: referrerTags = [] } = useQuery<{ id: number; name: string; isActive: boolean }[]>({
    queryKey: queryKeys.referrerTags,
    queryFn: () => fetch("/api/referrer-tags").then((r) => r.json()),
    staleTime: STALE_TIMES.MASTER,
    select: (data) => data.filter((t) => t.isActive),
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openKycModal = (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setIsKycModalOpen(true);
  };

  // クエリパラメータ生成
  // デフォルト: 住所確認=完了 AND 井上確認=完了 AND 担当者あり の全条件が揃った案件のみ非表示
  // 全表示ON: デフォルト除外なし（完了済みも含め全件表示）
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (serviceFilter) params.serviceId = serviceFilter;
    if (kycStatusFilter) params.kycStatus = kycStatusFilter;
    if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;
    if (addressStatusFilter) params.addressStatus = addressStatusFilter;
    if (inoueCheckFilter) params.inoueCheck = inoueCheckFilter;
    if (assignedUserFilter) params.assignedUserId = assignedUserFilter;
    // デフォルト: 全完了案件を非表示（全表示OFFかつアクティブタブの時）
    if (!showAll && activeTab !== "archived") {
      params.hideFullyCompleted = "true";
    }
    if (activeTab === "archived") params.archivedOnly = "true";
    params.page = page;
    return params;
  }, [search, serviceFilter, kycStatusFilter, paymentStatusFilter, addressStatusFilter, inoueCheckFilter, assignedUserFilter, showAll, activeTab, page]);

  // Applications data (default view is hydrated from server, filtered view fetched client-side)
  const { data: applicationsData, isLoading: isLoadingApplications, error } = useQuery<ApplicationsResponse>({
    queryKey: queryKeys.applications(queryParams),
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(queryParams || {}).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return api.getApplications(params) as Promise<ApplicationsResponse>;
    },
    staleTime: STALE_TIMES.LIST,
  });

  const applications = applicationsData?.data || [];
  const pagination = applicationsData?.pagination || null;

  // 一覧データ取得時にコメント件数を初期化
  useEffect(() => {
    if (!applicationsData) return;
    setCommentCounts((prev) => {
      const next = { ...prev };
      for (const app of applicationsData.data) {
        if (!(app.id in next)) next[app.id] = app._count.comments;
      }
      return next;
    });
  }, [applicationsData]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage("1");
  };

  const updateApplicationStatus = async (id: string, status: string) => {
    const currentQueryKey = queryKeys.applications(queryParams);

    // 楽観的更新
    queryClient.setQueryData<ApplicationsResponse>(currentQueryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((app) =>
          app.id === id ? { ...app, status } : app
        ),
      };
    });

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success("ステータスを更新しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの更新に失敗しました");
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    }
  };

  const updateApplicationComment = async (id: string, field: "comment1" | "comment2", value: string) => {
    const currentQueryKey = queryKeys.applications(queryParams);

    // 楽観的更新
    queryClient.setQueryData<ApplicationsResponse>(currentQueryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((app) =>
          app.id === id ? { ...app, [field]: value } : app
        ),
      };
    });

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("コメントを保存しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("コメントの保存に失敗しました");
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const getCustomerName = (customer: Application["customer"]) => {
    if (customer.type === "CORPORATE" && customer.companyName) {
      return customer.companyName;
    }
    return `${customer.lastName} ${customer.firstName}`;
  };

  const getCustomerNameKana = (customer: Application["customer"]) => {
    if (customer.type === "CORPORATE" && customer.companyNameKana) {
      return customer.companyNameKana;
    }
    return `${customer.lastNameKana} ${customer.firstNameKana}`;
  };

  const updateApplicationField = async (id: string, field: string, value: unknown) => {
    const currentQueryKey = queryKeys.applications(queryParams);

    // 楽観的更新
    queryClient.setQueryData<ApplicationsResponse>(currentQueryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((app) =>
          app.id === id ? { ...app, [field]: value } : app
        ),
      };
    });

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("更新しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("更新に失敗しました");
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4" />
          データの取得に失敗しました。再度お試しください。
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setPage("1");
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="active">申し込み一覧</TabsTrigger>
          <TabsTrigger value="archived">アーカイブ済み</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              申し込み一覧
              {pagination && (
                <span className="text-sm font-normal text-gray-500">
                  {pagination.total}件
                </span>
              )}
              {isLoadingApplications && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              )}
            </CardTitle>
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
            {activeTab !== "archived" && (
              <Button
                variant={showAll ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowAll(!showAll); setPage("1"); }}
                className="cursor-pointer"
              >
                {showAll ? "完了を非表示" : "全表示"}
              </Button>
            )}
          </div>
          {isFilterOpen && (
            <div className="flex flex-wrap gap-3 items-center mt-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="申込番号/名前/会社名/メール/電話..."
                  className="px-4 py-2 border rounded-md w-72 pr-10"
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

              {isSuperAdmin && (
                <>
                  <select
                    className={`px-4 py-2 border rounded-md ${!serviceFilter ? "text-gray-400" : "text-gray-700"}`}
                    value={serviceFilter}
                    onChange={(e) => { setServiceFilter(e.target.value); setPage("1"); }}
                  >
                    <option value="" disabled hidden>サービス</option>
                    <option value="">選択なし</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                  <div className="h-8 w-px bg-gray-300" />
                </>
              )}

              <select
                className={`px-4 py-2 border rounded-md ${!kycStatusFilter ? "text-gray-400" : "text-gray-700"}`}
                value={kycStatusFilter}
                onChange={(e) => { setKycStatusFilter(e.target.value); setPage("1"); }}
              >
                <option value="" disabled hidden>本人確認</option>
                <option value="">全て</option>
                {KYC_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="h-8 w-px bg-gray-300" />

              <select
                className={`px-4 py-2 border rounded-md ${!paymentStatusFilter ? "text-gray-400" : "text-gray-700"}`}
                value={paymentStatusFilter}
                onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage("1"); }}
              >
                <option value="" disabled hidden>決済確認</option>
                <option value="">全て</option>
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="h-8 w-px bg-gray-300" />

              <select
                className={`px-4 py-2 border rounded-md ${!addressStatusFilter ? "text-gray-400" : "text-gray-700"}`}
                value={addressStatusFilter}
                onChange={(e) => { setAddressStatusFilter(e.target.value); setPage("1"); }}
              >
                <option value="" disabled hidden>住所確認</option>
                <option value="">全て</option>
                {ADDRESS_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="h-8 w-px bg-gray-300" />

              <select
                className={`px-4 py-2 border rounded-md ${!inoueCheckFilter ? "text-gray-400" : "text-gray-700"}`}
                value={inoueCheckFilter}
                onChange={(e) => { setInoueCheckFilter(e.target.value); setPage("1"); }}
              >
                <option value="" disabled hidden>井上確認</option>
                <option value="">全て</option>
                <option value="IN_PROGRESS">進行中</option>
                <option value="PROCESSED">処理済み</option>
                <option value="COMPLETED">完了</option>
              </select>

              <div className="h-8 w-px bg-gray-300" />

              <select
                className={`px-4 py-2 border rounded-md ${!assignedUserFilter ? "text-gray-400" : "text-gray-700"}`}
                value={assignedUserFilter}
                onChange={(e) => { setAssignedUserFilter(e.target.value); setPage("1"); }}
              >
                <option value="" disabled hidden>担当者</option>
                <option value="">全て</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0 overflow-auto">
          {applications.length === 0 && !isLoadingApplications ? (
            <div className="text-center py-12 px-6 text-gray-500">
              申し込みが見つかりません
            </div>
          ) : applications.length === 0 && isLoadingApplications ? (
            <TableSkeleton rows={10} cols={7} />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[32px]"></th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[50px]">詳細</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[80px]">申込日</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[70px]">個人/法人</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[4.5em] w-[4.5em]">申込</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[120px]">名前/会社名</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[120px]">カナ</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[180px]">メール</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">サービス</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[80px]">プラン</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[70px]">単価</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[50px]">回線数</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[80px]">請求金額</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[50px]">画像</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[90px]">発送</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">本人確認</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[120px]">決済確認</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">住所確認</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[12em]">井上コメント</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">井上確認</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[120px]">担当者</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">備考</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[80px]">従業員質問</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    // 井上確認の経過日数による行背景色
                    const inoueRowBg = (() => {
                      if (app.inoueCheck === "PROCESSED" || app.isArchived) return app.inoueCheck === "PROCESSED" ? "bg-green-100" : "";
                      if (app.inoueCheck === "COMPLETED") return "";
                      const created = new Date(app.createdAt);
                      const today = new Date();
                      const diffDays = Math.floor(
                        (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
                         new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()) /
                        (1000 * 60 * 60 * 24)
                      );
                      if (diffDays >= 7) return "bg-red-100";
                      if (diffDays >= 3) return "bg-yellow-100";
                      return "";
                    })();

                    return (
                    <React.Fragment key={app.id}>
                    <tr
                      className={`border-b hover:bg-gray-50 ${
                        app.isArchived ? "bg-gray-100 opacity-75" : inoueRowBg
                      }`}
                      onMouseEnter={() => {
                        // 申込詳細をプリフェッチ（詳細画面表示に必要なデータ）
                        queryClient.prefetchQuery({
                          queryKey: queryKeys.applicationDetail(app.id),
                          queryFn: () => api.getApplicationById(app.id),
                          staleTime: STALE_TIMES.LIST,
                        });
                      }}
                    >
                      {/* トグル列 */}
                      <td className="py-2 px-2">
                        <button
                          onClick={() => toggleRow(app.id)}
                          className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                        >
                          {expandedRows.has(app.id)
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />
                          }
                        </button>
                      </td>
                      {/* 詳細列 */}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/applications/${app.id}`}
                            prefetch={false}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            詳細
                          </Link>
                          {app.isArchived && (
                            <Badge variant="secondary" className="text-xs">
                              アーカイブ済み
                            </Badge>
                          )}
                        </div>
                      </td>
                      {/* 申込日列 */}
                      <td className="py-2 px-2 text-xs whitespace-nowrap text-gray-600">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={app.customer.type === "CORPORATE" ? "default" : "secondary"}>
                          {app.customer.type === "CORPORATE" ? "法人" : "個人"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {(() => {
                          const isFirst = app.applicationOrdinal === 1;
                          const needsCheck = app.needsKycCheck;
                          return (
                            <Badge variant="outline" className={`text-xs whitespace-nowrap flex flex-col items-center leading-tight px-1.5 py-1 h-auto ${
                              isFirst ? "bg-blue-50 text-blue-700 border-blue-200"
                              : needsCheck ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-green-50 text-green-700 border-green-200"
                            }`}>
                              {needsCheck && <span>要確認</span>}
                              <span>{isFirst ? "初回" : `${app.applicationOrdinal}回目`}</span>
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {getCustomerName(app.customer)}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-xs text-gray-500">
                        {getCustomerNameKana(app.customer)}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <a href={`mailto:${app.customer.email}`} className="text-blue-600 hover:underline">
                          {app.customer.email}
                        </a>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{app.service.name}</Badge>
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {app.plan?.name ?? "—"}
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {app.unitPrice != null ? app.unitPrice.toLocaleString() : "—"}
                      </td>
                      <td className="py-2 px-2 text-center">{app.stats.lineCount}</td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {app.totalAmount != null ? app.totalAmount.toLocaleString() : "—"}
                      </td>
                      <td className="py-2 px-2">
                        {app.kycImages.length > 0 ? (
                          <button
                            onClick={() => openKycModal(app.id)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            {app.kycImages.length}件
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {app.stats.lineStatus ? (
                          <Badge
                            variant={
                              app.stats.lineStatus === "NOT_ACTIVATED" ? "secondary" :
                              app.stats.lineStatus === "ACTIVATED" ? "default" :
                              app.stats.lineStatus === "SHIPPING_INSTRUCTED" ? "outline" :
                              app.stats.lineStatus === "SHIPPED" ? "outline" :
                              app.stats.lineStatus === "RETURNED" ? "destructive" :
                              "secondary"
                            }
                            className="text-xs whitespace-nowrap"
                          >
                            {app.stats.lineStatus === "NOT_ACTIVATED" ? "未開通" :
                             app.stats.lineStatus === "ACTIVATED" ? "開通済み" :
                             app.stats.lineStatus === "SHIPPING_INSTRUCTED" ? "発送指示済み" :
                             app.stats.lineStatus === "SHIPPED" ? "発送済み" :
                             app.stats.lineStatus === "RETURNED" ? "返却済み" :
                             app.stats.lineStatus}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <select
                          className="px-2 py-1 border rounded text-xs"
                          value={app.kycStatus ?? ""}
                          onChange={(e) => {
                            updateApplicationField(app.id, "kycStatus", e.target.value || null);
                          }}
                        >
                          <option value="">　</option>
                          {KYC_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          className="px-2 py-1 border rounded text-xs"
                          value={app.paymentStatus ?? ""}
                          onChange={(e) => {
                            updateApplicationField(app.id, "paymentStatus", e.target.value || null);
                          }}
                        >
                          <option value="">　</option>
                          {PAYMENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        {app.needsKycCheck ? (
                          <select
                            className="px-2 py-1 border rounded text-xs"
                            value={app.addressStatus ?? ""}
                            onChange={(e) => {
                              updateApplicationField(app.id, "addressStatus", e.target.value || null);
                            }}
                          >
                            <option value="">　</option>
                            {ADDRESS_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {!isSuperAdmin ? (
                          <span className="text-xs text-gray-700">{app.comment1 || "—"}</span>
                        ) : (
                          <input
                            type="text"
                            className="px-2 py-1 border rounded text-xs w-[12em]"
                            defaultValue={app.comment1 || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (app.comment1 || "")) {
                                updateApplicationComment(app.id, "comment1", e.target.value);
                              }
                            }}
                          />
                        )}
                      </td>
                      {/* 井上確認 */}
                      <td className="py-2 px-2">
                        {!isSuperAdmin ? (
                          <span className="text-xs text-gray-700">
                            {app.inoueCheck === "COMPLETED" ? "完了" : app.inoueCheck === "PROCESSED" ? "処理済み" : app.inoueCheck === "IN_PROGRESS" ? "進行中" : "—"}
                          </span>
                        ) : (
                          <select
                            className="px-2 py-1 border rounded text-xs"
                            value={app.inoueCheck ?? ""}
                            onChange={(e) => {
                              updateApplicationField(app.id, "inoueCheck", e.target.value || null);
                            }}
                          >
                            <option value="">　</option>
                            <option value="IN_PROGRESS">進行中</option>
                            <option value="PROCESSED">処理済み</option>
                            <option value="COMPLETED">完了</option>
                          </select>
                        )}
                      </td>
                      {/* 担当者 */}
                      <td className="py-2 px-2">
                        <select
                          className="px-2 py-1 border rounded text-xs"
                          value={app.assignedUserId ?? ""}
                          onChange={(e) => {
                            updateApplicationField(app.id, "assignedUserId", e.target.value || null);
                          }}
                        >
                          <option value="">未割当</option>
                          {staffList.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          className="px-2 py-1 border rounded text-xs w-24"
                          defaultValue={app.comment2 || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (app.comment2 || "")) {
                              updateApplicationComment(app.id, "comment2", e.target.value);
                            }
                          }}
                        />
                      </td>
                      {/* チャットコメント列 */}
                      <td className="py-2 px-2">
                        <button
                          onClick={() => setCommentModalAppId(app.id)}
                          className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {commentCounts[app.id] != null && commentCounts[app.id] > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
                              {commentCounts[app.id]}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(app.id) && (
                      <WorkflowRows
                        app={app}
                        referrerTags={referrerTags}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.applications(queryParams) })}
                      />
                    )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

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

      <KycModal
        applicationId={selectedApplicationId}
        isOpen={isKycModalOpen}
        onClose={() => {
          setIsKycModalOpen(false);
          setSelectedApplicationId(null);
        }}
      />

      {commentModalAppId && (
        <CommentModalWrapper
          appId={commentModalAppId}
          appNumber={applications.find((a) => a.id === commentModalAppId)?.applicationNumber ?? ""}
          onClose={() => setCommentModalAppId(null)}
          onCountChange={setCommentCounts}
        />
      )}
    </div>
  );
}

// onCountChange を useCallback でメモ化するラッパー（レンダー中の setState エラーを防ぐ）
function CommentModalWrapper({
  appId,
  appNumber,
  onClose,
  onCountChange,
}: {
  appId: string;
  appNumber: string;
  onClose: () => void;
  onCountChange: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const handleCountChange = useCallback(
    (count: number) => {
      onCountChange((prev) => ({ ...prev, [appId]: count }));
    },
    [appId, onCountChange]
  );

  return (
    <CommentModal
      applicationId={appId}
      applicationNumber={appNumber}
      isOpen={true}
      onClose={onClose}
      onCountChange={handleCountChange}
    />
  );
}
