"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2,
  ScanLine,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Trash2,
  Plus,
  Upload,
  Pencil,
  AlertTriangle,
  X,
} from "lucide-react";
import { IccidScanModal } from "./iccid-scan-modal";
import type { SimIccidValidation } from "@/repositories/sim.repository";
import { KycModal } from "@/components/kyc-modal";
import { CustomerEditModal } from "@/components/customer-edit-modal";
import { toast } from "sonner";

interface Customer {
  id: string;
  type: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  companyName: string | null;
  companyNameKana: string | null;
  birthDate: string | null;
  email: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string | null;
  companyPostalCode: string | null;
  companyPrefecture: string | null;
  companyCity: string | null;
  companyAddress: string | null;
  companyBuilding: string | null;
  establishedDate: string | null;
  representativeLastName: string | null;
  representativeFirstName: string | null;
  representativeLastNameKana: string | null;
  representativeFirstNameKana: string | null;
}

interface Service {
  id: string;
  code: string;
  name: string;
}

interface Plan {
  id: string;
  code: string;
  name: string;
}

interface KycImage {
  id: string;
  type: string;
  storagePath: string;
  status: string;
  expiryDate: string | null;
  signedUrl: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface SimLocationTag {
  id: number;
  code: string;
  name: string;
}

interface LineTag {
  id: number;
  code: string;
  name: string;
}

interface LineReserveTag {
  id: number;
  code: string;
  name: string;
}

interface Sim {
  iccid: string;
  msisdn: string | null;
  simLocationTag: SimLocationTag | null;
}

interface ApplicationLine {
  id: string;
  lineNumber: number;
  simId: string | null;
  msisdn: string | null;
  status: string;
  shippedAt: string | null;
  returnedAt: string | null;
  contractMonth: string | null;
  sim: Sim | null;
  lineTag: LineTag | null;
  lineReserveTag: LineReserveTag | null;
}

// 回線フィールドの変更を蓄積するための型
interface PendingLineChange {
  simId?: string | null;
  simLocationTagId?: number | null;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
  shippedAt?: string | null;
  returnedAt?: string | null;
  contractMonth?: string | null;
  status?: string;
}

interface ApplicationReferral {
  id: string;
  referrerName: string;
  fee: number;
  createdAt: string;
}

interface ApplicationTracking {
  id: string;
  carrier: string;
  trackingNumber: string;
  createdAt: string;
}

interface Application {
  id: string;
  applicationNumber: string;
  status: string;
  kycStatus: "PENDING" | "DEFICIENT" | "RESUBMIT" | "COMPLETED";
  paymentStatus: "INVOICED" | "PAID" | null;
  lineCount: number;
  unitPrice: number;
  totalAmount: number;
  couponCode: string | null;
  couponId: string | null;
  comment1: string | null;
  comment2: string | null;
  note: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  customer: Customer;
  service: Service;
  plan: Plan;
  lines: ApplicationLine[];
  kycImages: KycImage[];
  referrals: ApplicationReferral[];
  trackings: ApplicationTracking[];
  noReferral: boolean;
  invoicePdfPath: string | null;
  invoiceUrl: string | null;
  invoiceEmailPath: string | null;
  paymentImagePath: string | null;
  shippingImagePath: string | null;
  stats: {
    lineCount: number;
    shippedCount: number;
    notActivatedCount: number;
    returnedCount: number;
  };
  latestExpiryDate: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "申込済み",
  PAYMENT_PENDING: "入金待ち",
  PAID: "入金済み",
  SHIPPING: "発送中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const LINE_STATUS_LABELS: Record<string, string> = {
  NOT_ACTIVATED: "未開通",
  ACTIVATED: "開通済み",
  SHIPPED: "発送済み",
  RETURNED: "返却済み",
  CANCELLED: "解約",
  SHIPPING_INSTRUCTED: "発送指示済み",
};

const LINE_STATUS_VARIANTS: Record<string, "default" | "success" | "destructive" | "secondary" | "outline"> = {
  NOT_ACTIVATED: "secondary",
  ACTIVATED: "success",
  SHIPPED: "default",
  RETURNED: "destructive",
  CANCELLED: "destructive",
  SHIPPING_INSTRUCTED: "outline",
};

const KYC_TYPE_LABELS: Record<string, string> = {
  ID_FRONT: "身分証（表）",
  ID_BACK: "身分証（裏）",
  SELFIE: "自撮り",
  ADDRESS_PROOF: "住所証明",
  CORPORATE_REGISTRY: "登記簿謄本",
};

const KYC_STATUS_OPTIONS = [
  { value: "PENDING", label: "未確認" },
  { value: "DEFICIENT", label: "不備" },
  { value: "RESUBMIT", label: "再提出" },
  { value: "COMPLETED", label: "完了" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "INVOICED", label: "請求書発行済み" },
  { value: "PAID", label: "入金済み" },
];

export function ApplicationDetailClient() {
  const params = useParams();
  const id = params.id as string;

  const queryClient = useQueryClient();

  // 申込詳細（ホバープリフェッチのキャッシュを活用）
  const { data: application, isLoading: loading, refetch: refetchApplication } = useQuery<Application>({
    queryKey: queryKeys.applicationDetail(id),
    queryFn: () => api.getApplicationById(id) as Promise<Application>,
    staleTime: STALE_TIMES.LIST,
  });

  const [lineTags, setLineTags] = useState<LineTag[]>([]);
  const [lineReserveTags, setLineReserveTags] = useState<LineReserveTag[]>([]);
  const [simLocationTags, setSimLocationTags] = useState<SimLocationTag[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  // KycModal関連の状態
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [kycModalInitialType, setKycModalInitialType] = useState<string | undefined>(undefined);

  // 身分証有効期限編集の状態
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [editExpiryValue, setEditExpiryValue] = useState("");
  const [isCustomerEditOpen, setIsCustomerEditOpen] = useState(false);

  // 回線数編集の状態
  const [isEditingLineCount, setIsEditingLineCount] = useState(false);
  const [editLineCountValue, setEditLineCountValue] = useState("");
  const [lineCountConfirmOpen, setLineCountConfirmOpen] = useState(false);
  const [lineCountSaving, setLineCountSaving] = useState(false);

  // クーポン編集の状態
  const [isEditingCoupon, setIsEditingCoupon] = useState(false);
  const [editCouponCode, setEditCouponCode] = useState("");
  const [couponLookupResult, setCouponLookupResult] = useState<{ id: string; code: string; unitPrice: number | null; description: string | null; pricings?: { minQuantity: number; maxQuantity: number | null; unitPrice: number }[] } | null>(null);
  const [couponLookupError, setCouponLookupError] = useState<string | null>(null);
  const [couponLookupLoading, setCouponLookupLoading] = useState(false);
  const [couponConfirmOpen, setCouponConfirmOpen] = useState(false);
  const [couponSaving, setCouponSaving] = useState(false);

  // プラン変更の状態
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [availablePlans, setAvailablePlans] = useState<Array<{id: string; name: string; pricings: Array<{minQuantity: number; maxQuantity: number | null; unitPrice: number}>}>>([]);
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);

  // アーカイブ関連の状態
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [archiveProcessing, setArchiveProcessing] = useState(false);

  // IN_STOCK SIM 用途タグ検証情報をプリフェッチ（IccidScanModal用）
  // ページ表示はこのロードを待たない。モーダルを開く時点で完了していない場合は待機画面を表示する。
  const planId = application?.plan?.id;
  const { data: simValidationData, isLoading: isInStockLoading, isError: isSimValidationError } = useQuery({
    queryKey: ['simValidation', planId],
    queryFn: async () => {
      const res = await fetch(`/api/sims/in-stock-iccids?planId=${planId}`);
      if (!res.ok) throw new Error('SIM検証情報の取得に失敗しました');
      const data = await res.json();
      return data.validation as Record<string, SimIccidValidation>;
    },
    enabled: !!planId,
    staleTime: 60_000, // 1分キャッシュ
  });
  const simValidationMap: Record<string, SimIccidValidation> = simValidationData ?? {};

  // モーダルを開こうとしている状態（在庫データ待機中）
  const [pendingScanModal, setPendingScanModal] = useState(false);

  // 在庫データ待機中にロードが完了したら自動でモーダルを開く
  // エラー時はモーダルを開かずトーストで通知（空のvalidationMapのままバリデーションスキップになるのを防ぐ）
  useEffect(() => {
    if (pendingScanModal && !isInStockLoading) {
      setPendingScanModal(false);
      if (isSimValidationError) {
        toast.error('在庫SIMの検証情報の取得に失敗しました。ページを再読み込みしてください。');
      } else {
        setShowScanModal(true);
      }
    }
  }, [pendingScanModal, isInStockLoading, isSimValidationError]);

  // タグ一覧取得
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [lineTagsRes, reserveTagsRes, locationTagsRes] = await Promise.all([
          fetch("/api/line-tags"),
          fetch("/api/line-reserve-tags"),
          fetch("/api/sim-location-tags"),
        ]);

        if (lineTagsRes.ok) setLineTags(await lineTagsRes.json());
        if (reserveTagsRes.ok) setLineReserveTags(await reserveTagsRes.json());
        if (locationTagsRes.ok) setSimLocationTags(await locationTagsRes.json());
      } catch (error) {
        console.error("タグ取得エラー:", error);
      }
    };
    fetchTags();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const formatMonth = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  // ステータス更新
  const updateApplicationField = async (field: string, value: unknown) => {
    if (!application) return;
    // 楽観的更新
    queryClient.setQueryData(queryKeys.applicationDetail(id), { ...application, [field]: value });
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
      refetchApplication();
    }
  };

  // 有効期限更新（顧客の全KYC画像を一括更新）
  const handleSaveExpiry = async () => {
    if (!application) return;
    try {
      const res = await fetch(`/api/applications/${id}/kyc-expiry`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryDate: editExpiryValue || null }),
      });
      if (!res.ok) throw new Error();
      // キャッシュを即座に更新（楽観的更新）
      queryClient.setQueryData(queryKeys.applicationDetail(id), (old: Application | undefined) =>
        old ? { ...old, latestExpiryDate: editExpiryValue || null } : old
      );
      toast.success("有効期限を更新しました");
      setIsEditingExpiry(false);
      refetchApplication();
    } catch {
      toast.error("有効期限の更新に失敗しました");
    }
  };

  // 回線数変更確定
  const handleSaveLineCount = async () => {
    if (!application) return;
    const newCount = parseInt(editLineCountValue);
    if (isNaN(newCount) || newCount <= 0) return;
    setLineCountSaving(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineCount: newCount }),
      });
      if (res.ok) {
        toast.success("回線数を更新しました");
        setLineCountConfirmOpen(false);
        setIsEditingLineCount(false);
        refetchApplication();
      } else {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "更新に失敗しました");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "回線数の更新に失敗しました");
    } finally {
      setLineCountSaving(false);
    }
  };

  // プラン一覧取得
  const fetchPlansForService = async (serviceId: string) => {
    try {
      const res = await fetch(`/api/plans?serviceId=${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailablePlans(data);
      }
    } catch {
      toast.error("プラン一覧の取得に失敗しました");
    }
  };

  // プラン変更時の新単価を計算
  const getNewPlanPricing = () => {
    if (!application) return null;
    const plan = availablePlans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    const pricing = plan.pricings.find(
      (p) => p.minQuantity <= application.lineCount && (p.maxQuantity === null || p.maxQuantity >= application.lineCount)
    );
    return pricing || null;
  };

  // プラン変更確定
  const handleSavePlan = async () => {
    if (!application) return;
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      });
      if (res.ok) {
        toast.success("プランを変更しました");
        setPlanConfirmOpen(false);
        setIsEditingPlan(false);
        refetchApplication();
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("プランの変更に失敗しました");
    } finally {
      setPlanSaving(false);
    }
  };

  // クーポンコード検索
  const handleLookupCoupon = async (code: string) => {
    if (!code.trim()) {
      setCouponLookupResult(null);
      setCouponLookupError(null);
      return;
    }
    setCouponLookupLoading(true);
    setCouponLookupError(null);
    setCouponLookupResult(null);
    try {
      const res = await fetch(`/api/coupons/by-code?code=${encodeURIComponent(code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCouponLookupResult(data);
      } else {
        setCouponLookupError("有効なクーポンが見つかりません");
      }
    } catch {
      setCouponLookupError("クーポン検索に失敗しました");
    } finally {
      setCouponLookupLoading(false);
    }
  };

  // クーポン変更確定
  const handleSaveCoupon = async () => {
    if (!application || !couponLookupResult) return;
    setCouponSaving(true);
    try {
      // ティア式クーポンの場合、回線数に応じた単価を算出
      let resolvedUnitPrice = couponLookupResult.unitPrice;
      if (resolvedUnitPrice == null && couponLookupResult.pricings && couponLookupResult.pricings.length > 0) {
        const lineCount = application.lineCount;
        const matchedPricing = couponLookupResult.pricings
          .filter(p => lineCount >= p.minQuantity && (p.maxQuantity == null || lineCount <= p.maxQuantity))
          .sort((a, b) => b.minQuantity - a.minQuantity)[0];
        if (matchedPricing) {
          resolvedUnitPrice = matchedPricing.unitPrice;
        }
      }
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: couponLookupResult.code,
          couponId: couponLookupResult.id,
          unitPrice: resolvedUnitPrice,
        }),
      });
      if (res.ok) {
        toast.success("クーポンを適用しました");
        setCouponConfirmOpen(false);
        setIsEditingCoupon(false);
        setCouponLookupResult(null);
        setEditCouponCode("");
        refetchApplication();
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("クーポンの更新に失敗しました");
    } finally {
      setCouponSaving(false);
    }
  };

  // クーポン削除
  const handleRemoveCoupon = async () => {
    if (!application) return;
    setCouponSaving(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: null,
          couponId: null,
          unitPrice: application.unitPrice, // 元の単価を維持（または別途対応）
        }),
      });
      if (res.ok) {
        toast.success("クーポンを削除しました");
        setCouponConfirmOpen(false);
        setIsEditingCoupon(false);
        refetchApplication();
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("クーポンの削除に失敗しました");
    } finally {
      setCouponSaving(false);
    }
  };

  // KycModal表示
  const openKycModal = (imageType?: string) => {
    setKycModalInitialType(imageType);
    setIsKycModalOpen(true);
  };

  // アーカイブ操作
  const handleArchive = async () => {
    setArchiveProcessing(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      if (res.ok) {
        setIsArchiveConfirmOpen(false);
        refetchApplication();
      }
    } catch (error) {
      console.error("アーカイブエラー:", error);
    } finally {
      setArchiveProcessing(false);
    }
  };

  const handleUnarchive = async () => {
    setArchiveProcessing(true);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (res.ok) {
        refetchApplication();
      }
    } catch (error) {
      console.error("アーカイブ解除エラー:", error);
    } finally {
      setArchiveProcessing(false);
    }
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.type === "CORPORATE" && customer.companyName) {
      return customer.companyName;
    }
    return `${customer.lastName} ${customer.firstName}`;
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const toggleAllLines = () => {
    if (!application) return;
    if (selectedLines.size === application.lines.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(application.lines.map((l) => l.id)));
    }
  };

  // 一括編集用の状態
  const [bulkLineTagId, setBulkLineTagId] = useState<string>("");
  const [bulkLineReserveTagId, setBulkLineReserveTagId] = useState<string>("");
  const [bulkShippedAt, setBulkShippedAt] = useState<string>("");
  const [bulkReturnedAt, setBulkReturnedAt] = useState<string>("");
  const [bulkContractMonth, setBulkContractMonth] = useState<string>("");

  const applyBulkUpdate = () => {
    if (selectedLines.size === 0) return;

    // 選択された回線に変更を適用（pendingChangesに追加）
    selectedLines.forEach((lineId) => {
      const changes: PendingLineChange = {};

      if (bulkLineTagId) {
        changes.lineTagId = bulkLineTagId === "clear" ? null : parseInt(bulkLineTagId);
      }
      if (bulkLineReserveTagId) {
        changes.lineReserveTagId = bulkLineReserveTagId === "clear" ? null : parseInt(bulkLineReserveTagId);
      }
      if (bulkShippedAt) {
        changes.shippedAt = bulkShippedAt === "clear" ? null : bulkShippedAt;
        if (bulkShippedAt !== "clear") {
          changes.status = "SHIPPED";
        }
      }
      if (bulkReturnedAt) {
        changes.returnedAt = bulkReturnedAt === "clear" ? null : bulkReturnedAt;
        if (bulkReturnedAt !== "clear") {
          changes.status = "RETURNED";
        }
      }
      if (bulkContractMonth) {
        changes.contractMonth = bulkContractMonth === "clear" ? null : bulkContractMonth + "-01";
      }

      if (Object.keys(changes).length > 0) {
        setPendingChanges((prev) => ({
          ...prev,
          [lineId]: { ...prev[lineId], ...changes },
        }));
      }
    });

    // UIリセット
    setSelectedLines(new Set());
    setBulkLineTagId("");
    setBulkLineReserveTagId("");
    setBulkShippedAt("");
    setBulkReturnedAt("");
    setBulkContractMonth("");
  };

  // 回線フィールド編集用の状態（クライアント側一時保存 - 一括更新用）
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingLineChange>>({});
  const [iccidErrors, setIccidErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const validateIccid = (iccid: string): string | null => {
    if (!iccid) return null; // 空は許可
    if (!/^[A-Z0-9]{15,20}$/.test(iccid.toUpperCase())) {
      return "ICCIDは15〜20桁の英数字です";
    }
    return null;
  };

  // 回線フィールドの変更を追跡
  const handleLineChange = (
    lineId: string,
    field: keyof PendingLineChange,
    value: string | number | null
  ) => {
    setPendingChanges((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value,
      },
    }));
  };

  // ICCID変更（バリデーション付き）
  const handleIccidChange = (lineId: string, value: string) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    handleLineChange(lineId, "simId", upperValue || null);

    // リアルタイムバリデーション
    const error = validateIccid(upperValue);
    setIccidErrors((prev) => {
      if (error) {
        return { ...prev, [lineId]: error };
      } else {
        const { [lineId]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  // 現在の値を取得（保留中の変更があればそれを、なければ元の値を返す）
  function getCurrentValue<T>(
    lineId: string,
    field: keyof PendingLineChange,
    originalValue: T
  ): T {
    const pending = pendingChanges[lineId];
    if (pending && field in pending) {
      return pending[field] as T;
    }
    return originalValue;
  }

  // 変更があるかチェック
  const hasChanges = () => Object.keys(pendingChanges).length > 0;

  // 特定の回線に変更があるかチェック
  const hasLineChanges = (lineId: string) => lineId in pendingChanges;

  // 変更された回線数を取得
  const getChangedLinesCount = () => Object.keys(pendingChanges).length;

  // バリデーションエラーがあるかチェック
  const hasValidationErrors = () => Object.keys(iccidErrors).length > 0;

  // 全変更を保存
  const handleSaveAll = async () => {
    if (!hasChanges() || hasValidationErrors()) return;

    setIsSaving(true);
    try {
      const updates = Object.entries(pendingChanges);

      const results = await Promise.all(
        updates.map(async ([lineId, changes]) => {
          const { simLocationTagId, ...lineChanges } = changes;

          // 回線の更新
          const lineRes = await fetch(`/api/applications/${id}/lines/${lineId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lineChanges),
          });

          // SIMの場所の更新（simLocationTagIdが変更されている場合）
          if (simLocationTagId !== undefined) {
            const line = application?.lines.find((l) => l.id === lineId);
            const simId = changes.simId !== undefined ? changes.simId : line?.simId;
            if (simId) {
              await fetch(`/api/sims/${simId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ simLocationTagId }),
              });
            }
          }

          return lineRes.ok;
        })
      );

      if (results.every((r) => r)) {
        setPendingChanges({});
        setIccidErrors({});
        refetchApplication();
      }
    } catch (error) {
      console.error("保存エラー:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 全変更をキャンセル
  const handleCancelAll = () => {
    setPendingChanges({});
    setIccidErrors({});
  };

  const notActivatedCount = useMemo(
    () => application?.lines.filter((l) => l.status === "NOT_ACTIVATED").length ?? 0,
    [application?.lines]
  );
  const shippedCount = useMemo(
    () => application?.lines.filter((l) => l.status === "SHIPPED").length ?? 0,
    [application?.lines]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">申し込みが見つかりません</p>
          <Link href="/applications" prefetch={false}>
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  const returnedCount = application.lines.filter((l) => l.status === "RETURNED").length;

  return (
    <div className="p-6 space-y-4">
      {/* ページヘッダー */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/applications" prefetch={false}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              一覧に戻る
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            申し込み詳細 - {application.applicationNumber}
          </h1>
          <Badge>{STATUS_LABELS[application.status]}</Badge>
          {application.isArchived && (
            <Badge variant="secondary">アーカイブ済み</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {application.isArchived ? (
            <Button variant="outline" onClick={handleUnarchive} disabled={archiveProcessing}>
              {archiveProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArchiveRestore className="h-4 w-4 mr-2" />
              )}
              アーカイブ解除
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsArchiveConfirmOpen(true)}>
              <Archive className="h-4 w-4 mr-2" />
              アーカイブにする
            </Button>
          )}
        </div>
      </div>

      {/* 上部 3カラム（申込情報 | 顧客情報 | 右サイドバー） */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_300px] gap-4 items-start">
        {/* 申込情報 */}
        <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">申込情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">申込番号</p>
                  <p className="font-mono font-medium">{application.applicationNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">サービス</p>
                  <p>{application.service.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">プラン</p>
                  {isEditingPlan ? (
                    <div className="flex items-center gap-1">
                      <select
                        className="px-2 py-1 border rounded text-sm"
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                      >
                        {availablePlans.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={selectedPlanId === application.plan.id}
                        onClick={() => setPlanConfirmOpen(true)}
                      >確認</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setIsEditingPlan(false)}
                      >✕</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p>{application.plan.name}</p>
                      <button
                        onClick={() => {
                          setSelectedPlanId(application.plan.id);
                          fetchPlansForService(application.service.id);
                          setIsEditingPlan(true);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="プランを変更"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">回線数</p>
                  {isEditingLineCount ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="px-2 py-1 border rounded text-sm w-20"
                        value={editLineCountValue}
                        min={1}
                        onChange={(e) => setEditLineCountValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editLineCountValue) setLineCountConfirmOpen(true);
                          if (e.key === "Escape") setIsEditingLineCount(false);
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={!editLineCountValue || parseInt(editLineCountValue) <= 0}
                        onClick={() => setLineCountConfirmOpen(true)}
                      >確認</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setIsEditingLineCount(false)}
                      >✕</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p>{application.lineCount}回線</p>
                      <button
                        onClick={() => {
                          setEditLineCountValue(String(application.lineCount));
                          setIsEditingLineCount(true);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="回線数を編集"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">単価</p>
                  <p>{application.unitPrice.toLocaleString()}円</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">合計</p>
                  <p className="font-bold">{application.totalAmount.toLocaleString()}円</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">申込日</p>
                  <p>{formatDate(application.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">クーポン</p>
                  {isEditingCoupon ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          className="px-2 py-1 border rounded text-sm w-32 font-mono uppercase"
                          value={editCouponCode}
                          placeholder="コードを入力"
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setEditCouponCode(val);
                            setCouponLookupResult(null);
                            setCouponLookupError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleLookupCoupon(editCouponCode);
                            if (e.key === "Escape") {
                              setIsEditingCoupon(false);
                              setEditCouponCode("");
                              setCouponLookupResult(null);
                              setCouponLookupError(null);
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={!editCouponCode || couponLookupLoading}
                          onClick={() => handleLookupCoupon(editCouponCode)}
                        >
                          {couponLookupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "検索"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setIsEditingCoupon(false);
                            setEditCouponCode("");
                            setCouponLookupResult(null);
                            setCouponLookupError(null);
                          }}
                        >✕</Button>
                      </div>
                      {couponLookupError && (
                        <p className="text-xs text-red-500">{couponLookupError}</p>
                      )}
                      {couponLookupResult && (
                        <div className="text-xs bg-green-50 border border-green-200 rounded p-2 space-y-0.5">
                          <p className="font-mono font-medium text-green-700">{couponLookupResult.code}</p>
                          <p className="text-gray-600">単価: {couponLookupResult.unitPrice != null
                            ? `${couponLookupResult.unitPrice.toLocaleString()}円`
                            : couponLookupResult.pricings && couponLookupResult.pricings.length > 0
                              ? couponLookupResult.pricings.length === 1
                                ? `${couponLookupResult.pricings[0].unitPrice.toLocaleString()}円`
                                : `${Math.min(...couponLookupResult.pricings.map(p => p.unitPrice)).toLocaleString()}〜${Math.max(...couponLookupResult.pricings.map(p => p.unitPrice)).toLocaleString()}円`
                              : "未設定"}</p>
                          {couponLookupResult.description && (
                            <p className="text-gray-500">{couponLookupResult.description}</p>
                          )}
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs mt-1"
                            onClick={() => setCouponConfirmOpen(true)}
                          >このクーポンを適用</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {application.couponCode ? (
                        <>
                          <Badge variant="outline" className="font-mono">{application.couponCode}</Badge>
                          <button
                            onClick={handleRemoveCoupon}
                            disabled={couponSaving}
                            className="text-red-400 hover:text-red-600"
                            title="クーポンを削除"
                          >
                            {couponSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">未設定</span>
                      )}
                      <button
                        onClick={() => {
                          setEditCouponCode(application.couponCode || "");
                          setIsEditingCoupon(true);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="クーポンを編集"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        {/* 顧客情報 */}
        <Card className="h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">顧客情報</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsCustomerEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                編集
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">メールアドレス</p>
                  <a href={`mailto:${application.customer.email}`} className="text-blue-600 hover:underline">
                    {application.customer.email}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">区分</p>
                  <Badge variant={application.customer.type === "CORPORATE" ? "default" : "secondary"}>
                    {application.customer.type === "CORPORATE" ? "法人" : "個人"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">姓（フリガナ）</p>
                  <p>{application.customer.lastNameKana}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">名（フリガナ）</p>
                  <p>{application.customer.firstNameKana}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">姓（漢字）</p>
                  <p>{application.customer.lastName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">名（漢字）</p>
                  <p>{application.customer.firstName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">生年月日</p>
                  <p>{application.customer.birthDate ? formatDate(application.customer.birthDate) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">郵便番号</p>
                  <p>〒{application.customer.postalCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">都道府県</p>
                  <p>{application.customer.prefecture}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">市区郡町村</p>
                  <p>{application.customer.city}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">町名・丁目・番地</p>
                  <p>{application.customer.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">マンション／ビル名・部屋番号</p>
                  <p>{application.customer.building || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">電話番号</p>
                  <p>{application.customer.phone}</p>
                </div>
                {application.customer.type === "CORPORATE" && (
                  <div className="pt-2 border-t space-y-3">
                    {application.customer.companyName && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">会社名</p>
                        <p>{application.customer.companyName}</p>
                      </div>
                    )}
                    {application.customer.companyNameKana && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">会社名（カナ）</p>
                        <p>{application.customer.companyNameKana}</p>
                      </div>
                    )}
                    {application.customer.companyPostalCode && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">法人住所</p>
                        <p>
                          〒{application.customer.companyPostalCode} {application.customer.companyPrefecture}
                          {application.customer.companyCity}{application.customer.companyAddress}
                          {application.customer.companyBuilding}
                        </p>
                      </div>
                    )}
                    {application.customer.establishedDate && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">設立日</p>
                        <p>{formatDate(application.customer.establishedDate)}</p>
                      </div>
                    )}
                    {application.customer.representativeLastName && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">代表者名</p>
                        <p>
                          {application.customer.representativeLastName} {application.customer.representativeFirstName}
                          （{application.customer.representativeLastNameKana} {application.customer.representativeFirstNameKana}）
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        {/* 右カラム */}
        <div className="space-y-4">
          {/* 確認ステータス */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">確認ステータス</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">本人確認</label>
                <select
                  className="px-3 py-2 border rounded-md text-sm w-full"
                  value={application.kycStatus}
                  onChange={(e) => updateApplicationField("kycStatus", e.target.value)}
                >
                  {KYC_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">決済確認</label>
                <select
                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                    application.paymentStatus === "PAID" ? "bg-green-50 border-green-300" : ""
                  }`}
                  value={application.paymentStatus ?? ""}
                  onChange={(e) => updateApplicationField("paymentStatus", e.target.value || null)}
                >
                  <option value="">未設定</option>
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* 本人確認書類 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">本人確認書類</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {application.kycImages.length === 0 ? (
                <p className="text-sm text-gray-400">画像がありません</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {application.kycImages.map((img) => (
                    <div key={img.id}>
                      <p className="text-xs text-gray-500 mb-0.5">
                        {KYC_TYPE_LABELS[img.type] || img.type}
                      </p>
                      <button
                        onClick={() => openKycModal(img.type)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        表示
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 mb-1">身分証有効期限</p>
                {isEditingExpiry ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="px-2 py-1 border rounded-md text-sm flex-1"
                      value={editExpiryValue}
                      onChange={(e) => setEditExpiryValue(e.target.value)}
                    />
                    <Button size="sm" onClick={handleSaveExpiry}>保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingExpiry(false)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm">
                      {application.latestExpiryDate ? formatDate(application.latestExpiryDate) : "未設定"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditExpiryValue(
                          application.latestExpiryDate
                            ? new Date(application.latestExpiryDate).toISOString().split("T")[0]
                            : ""
                        );
                        setIsEditingExpiry(true);
                      }}
                    >
                      編集
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 管理用コメント */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">管理用コメント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">コメント1</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={3}
                  defaultValue={application.comment1 || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (application.comment1 || "")) {
                      fetch(`/api/applications/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ comment1: e.target.value }),
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">コメント2</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={3}
                  defaultValue={application.comment2 || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (application.comment2 || "")) {
                      fetch(`/api/applications/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ comment2: e.target.value }),
                      });
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 回線管理（全幅） */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <CardTitle className="text-base">回線管理</CardTitle>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>全 <span className="font-medium text-gray-700">{application.lines.length}</span> 回線</span>
                  <span className="text-gray-300">|</span>
                  <span>未開通 <span className="font-medium text-amber-600">{notActivatedCount}</span></span>
                  <span>発送済み <span className="font-medium text-blue-600">{shippedCount}</span></span>
                  <span>返却 <span className="font-medium text-red-500">{returnedCount}</span></span>
                </div>
              </div>
              {notActivatedCount > 0 && (
                <Button
                  onClick={() => {
                    if (isInStockLoading) {
                      setPendingScanModal(true);
                    } else {
                      setShowScanModal(true);
                    }
                  }}
                >
                  <ScanLine className="h-4 w-4 mr-2" />
                  ICCID連続入力
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 一括編集バー */}
            {selectedLines.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-blue-700">
                  {selectedLines.size}件選択中
                </span>
                <select
                  className="px-2 py-1 border rounded text-xs"
                  value={bulkLineTagId}
                  onChange={(e) => setBulkLineTagId(e.target.value)}
                >
                  <option value="">回線タグ</option>
                  <option value="clear">クリア</option>
                  {lineTags.map((tag) => (
                    <option key={tag.id} value={tag.id.toString()}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <select
                  className="px-2 py-1 border rounded text-xs"
                  value={bulkLineReserveTagId}
                  onChange={(e) => setBulkLineReserveTagId(e.target.value)}
                >
                  <option value="">予備タグ</option>
                  <option value="clear">クリア</option>
                  {lineReserveTags.map((tag) => (
                    <option key={tag.id} value={tag.id.toString()}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="px-2 py-1 border rounded text-xs"
                  value={bulkShippedAt}
                  onChange={(e) => setBulkShippedAt(e.target.value)}
                  placeholder="発送日"
                />
                <input
                  type="date"
                  className="px-2 py-1 border rounded text-xs"
                  value={bulkReturnedAt}
                  onChange={(e) => setBulkReturnedAt(e.target.value)}
                  placeholder="返却日"
                />
                <input
                  type="month"
                  className="px-2 py-1 border rounded text-xs"
                  value={bulkContractMonth}
                  onChange={(e) => setBulkContractMonth(e.target.value)}
                  placeholder="契約月"
                />
                <Button
                  size="sm"
                  onClick={applyBulkUpdate}
                  disabled={!bulkLineTagId && !bulkLineReserveTagId && !bulkShippedAt && !bulkReturnedAt && !bulkContractMonth}
                >
                  適用
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedLines(new Set())}
                >
                  解除
                </Button>
              </div>
            )}
            {/* 変更保存バー */}
            {hasChanges() && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-yellow-700">
                  未保存の変更があります（{getChangedLinesCount()}件）
                </span>
                {hasValidationErrors() && (
                  <span className="text-sm text-red-600">
                    （入力エラーがあります）
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={isSaving || hasValidationErrors()}
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "保存"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelAll}
                >
                  キャンセル
                </Button>
              </div>
            )}
            <div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={
                          application.lines.length > 0 &&
                          selectedLines.size === application.lines.length
                        }
                        onChange={toggleAllLines}
                        disabled={application.lines.length === 0}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[30px]">#</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">電話番号</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[150px]">ICCID</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[90px]">SIMの場所</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[90px]">回線タグ</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[90px]">予備タグ</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">発送日</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">返却日</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[100px]">契約月</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap min-w-[90px]">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {application.lines.map((line) => {
                    const currentSimId = getCurrentValue(line.id, "simId", line.simId);
                    const currentSimLocationTagId = getCurrentValue(
                      line.id,
                      "simLocationTagId",
                      line.sim?.simLocationTag?.id ?? null
                    );
                    const currentLineTagId = getCurrentValue(
                      line.id,
                      "lineTagId",
                      line.lineTag?.id ?? null
                    );
                    const currentLineReserveTagId = getCurrentValue(
                      line.id,
                      "lineReserveTagId",
                      line.lineReserveTag?.id ?? null
                    );
                    const currentShippedAt = getCurrentValue(line.id, "shippedAt", line.shippedAt);
                    const currentReturnedAt = getCurrentValue(line.id, "returnedAt", line.returnedAt);
                    const currentContractMonth = getCurrentValue(line.id, "contractMonth", line.contractMonth);
                    const currentStatus = getCurrentValue(line.id, "status", line.status);

                    return (
                      <tr
                        key={line.id}
                        className={`border-b hover:bg-gray-50 ${
                          hasLineChanges(line.id) ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={selectedLines.has(line.id)}
                            onChange={() => toggleLineSelection(line.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-2 px-2">{line.lineNumber}</td>
                        <td className="py-2 px-2">{line.msisdn || "—"}</td>
                        <td className="py-2 px-2">
                          <span className="text-xs font-mono text-gray-700">
                            {currentSimId || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {(line.sim || currentSimId) ? (
                            <select
                              className="px-2 py-1 border rounded text-xs min-w-[80px]"
                              value={currentSimLocationTagId?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                handleLineChange(
                                  line.id,
                                  "simLocationTagId",
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
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="px-2 py-1 border rounded text-xs min-w-[80px]"
                            value={currentLineTagId?.toString() || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleLineChange(
                                line.id,
                                "lineTagId",
                                value ? parseInt(value) : null
                              );
                            }}
                          >
                            <option value="">未設定</option>
                            {lineTags.map((tag) => (
                              <option key={tag.id} value={tag.id.toString()}>
                                {tag.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="px-2 py-1 border rounded text-xs min-w-[80px]"
                            value={currentLineReserveTagId?.toString() || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleLineChange(
                                line.id,
                                "lineReserveTagId",
                                value ? parseInt(value) : null
                              );
                            }}
                          >
                            <option value="">未設定</option>
                            {lineReserveTags.map((tag) => (
                              <option key={tag.id} value={tag.id.toString()}>
                                {tag.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="date"
                            className="px-2 py-1 border rounded text-xs"
                            value={currentShippedAt ? String(currentShippedAt).split("T")[0] : ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleLineChange(
                                line.id,
                                "shippedAt",
                                value ? value : null
                              );
                              if (value) {
                                handleLineChange(line.id, "status", "SHIPPED");
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="date"
                            className="px-2 py-1 border rounded text-xs"
                            value={currentReturnedAt ? String(currentReturnedAt).split("T")[0] : ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleLineChange(
                                line.id,
                                "returnedAt",
                                value ? value : null
                              );
                              if (value) {
                                handleLineChange(line.id, "status", "RETURNED");
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="month"
                            className="px-2 py-1 border rounded text-xs"
                            value={currentContractMonth ? formatMonth(String(currentContractMonth)) : ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleLineChange(
                                line.id,
                                "contractMonth",
                                value ? value + "-01" : null
                              );
                            }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="px-2 py-1 border rounded text-xs"
                            value={currentStatus || ""}
                            onChange={(e) => {
                              handleLineChange(line.id, "status", e.target.value);
                            }}
                          >
                            {Object.entries(LINE_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


      {/* 在庫データ取得中オーバーレイ（モーダルを開く前の待機画面） */}
      {pendingScanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-700">現在の在庫状況を取得中...</p>
            <button
              onClick={() => setPendingScanModal(false)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ICCIDスキャンモーダル */}
      {showScanModal && (
        <IccidScanModal
          applicationId={id}
          notActivatedCount={notActivatedCount}
          existingIccids={new Set(application.lines.filter(l => l.simId).map(l => l.simId!))}
          lineTags={lineTags}
          lineReserveTags={lineReserveTags}
          simValidationMap={simValidationMap}
          onComplete={() => {
            setShowScanModal(false);
            toast.success("ICCID登録が完了しました");
            // simValidationキャッシュを無効化（割当済みSIMを反映）
            queryClient.invalidateQueries({ queryKey: ['simValidation'] });
            refetchApplication();
          }}
        />
      )}

      {/* KycModal */}
      <KycModal
        applicationId={application?.id || null}
        isOpen={isKycModalOpen}
        onClose={() => {
          setIsKycModalOpen(false);
          setKycModalInitialType(undefined);
        }}
        initialImageType={kycModalInitialType}
      />

      {/* 顧客情報編集モーダル */}
      <CustomerEditModal
        customer={application?.customer || null}
        isOpen={isCustomerEditOpen}
        onClose={() => setIsCustomerEditOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.applicationDetail(id) })}
      />

      {/* プラン変更確認ダイアログ */}
      <Dialog open={planConfirmOpen} onOpenChange={setPlanConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              プラン変更の確認
            </DialogTitle>
            <DialogDescription>
              この操作は申し込みの単価と合計金額に影響します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-medium mb-1">注意事項</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>プランを変更すると、単価と合計金額が自動的に再計算されます。</li>
                <li>請求書が発行済みの場合は、別途対応が必要です。</li>
              </ul>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変更前:</span>
              <span className="font-medium">{application?.plan.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変更後:</span>
              <span className="font-bold text-blue-600">{availablePlans.find((p) => p.id === selectedPlanId)?.name}</span>
            </div>
            {(() => {
              const pricing = getNewPlanPricing();
              if (!pricing || !application) return null;
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">単価変更:</span>
                    <span>
                      {application.unitPrice.toLocaleString()}円 → {pricing.unitPrice.toLocaleString()}円
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">新しい合計金額:</span>
                    <span className="font-bold">{(application.lineCount * pricing.unitPrice).toLocaleString()}円</span>
                  </div>
                </>
              );
            })()}
            {!getNewPlanPricing() && application && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                選択したプランにこの回線数（{application.lineCount}回線）に対応する料金設定がありません。料金は変更されません。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSavePlan} disabled={planSaving}>
              {planSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              変更する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 回線数変更確認ダイアログ */}
      <Dialog open={lineCountConfirmOpen} onOpenChange={setLineCountConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              回線数の変更確認
            </DialogTitle>
            <DialogDescription>
              この操作は申し込み内容に直接影響します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-medium mb-1">⚠️ 注意事項</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>回線数を変更すると、合計金額が自動的に再計算されます。</li>
                <li>回線管理の行数も自動で増減します。</li>
                <li>SIM割当済みの回線数より少ない数には変更できません。</li>
                <li>請求書が発行済みの場合は、別途対応が必要です。</li>
              </ul>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変更前:</span>
              <span className="font-medium">{application?.lineCount}回線</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変更後:</span>
              <span className="font-bold text-blue-600">{editLineCountValue}回線</span>
            </div>
            {application && editLineCountValue && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">新しい合計金額:</span>
                <span className="font-bold">{(parseInt(editLineCountValue) * application.unitPrice).toLocaleString()}円</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineCountConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveLineCount} disabled={lineCountSaving}>
              {lineCountSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              変更を確定する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* クーポン変更確認ダイアログ */}
      <Dialog open={couponConfirmOpen} onOpenChange={setCouponConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              クーポン適用の確認
            </DialogTitle>
            <DialogDescription>
              この操作は申し込みの単価と合計金額に影響します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-medium mb-1">⚠️ 注意事項</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>クーポンを適用すると、単価がクーポンの単価に変更されます。</li>
                <li>合計金額（回線数 × 新単価）が自動的に再計算されます。</li>
                <li>請求書が発行済みの場合は、別途対応が必要です。</li>
              </ul>
            </div>
            {couponLookupResult && application && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">適用クーポン:</span>
                  <span className="font-mono font-bold text-blue-600">{couponLookupResult.code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">単価変更:</span>
                  <span className="font-medium">
                    {application.unitPrice?.toLocaleString() ?? "-"}円 → {couponLookupResult.unitPrice != null
                      ? `${couponLookupResult.unitPrice.toLocaleString()}円`
                      : "段階価格"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">新しい合計金額:</span>
                  <span className="font-bold">{couponLookupResult.unitPrice != null
                    ? `${(application.lineCount * couponLookupResult.unitPrice).toLocaleString()}円`
                    : "段階価格により変動"}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveCoupon} disabled={couponSaving}>
              {couponSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              クーポンを適用する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* アーカイブ確認ダイアログ */}
      <Dialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申し込みをアーカイブ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              この申し込みをアーカイブしますか？
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                アーカイブすると、この申し込みと関連する全ての回線が一覧から非表示になります。
                総合回線管理・SIM管理でもアーカイブ状態として表示されます。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsArchiveConfirmOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleArchive}
              disabled={archiveProcessing}
            >
              {archiveProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              アーカイブする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
