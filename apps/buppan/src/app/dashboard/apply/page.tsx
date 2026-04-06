"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Package,
  FileCheck,
  Upload,
  X,
  AlertTriangle,
  CalendarDays,
  Minus,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useDashboard } from "../context";

interface PlanPricing {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  description: string | null;
}

interface Plan {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  pricings: PlanPricing[];
}

interface KycUploadFile {
  type: "ID_FRONT" | "ID_BACK";
  file: File | null;
  path: string | null;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  expiryDate: string | null;
}

export default function AdditionalApplyPage() {
  const router = useRouter();
  const { data: dashboardData } = useDashboard();

  // KYC期限切れチェック（dashboardData が null の間は false）
  const isKycExpired = (() => {
    const kycImages = dashboardData?.customer?.kycImages ?? [];
    if (kycImages.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestExpiry = kycImages
      .map((img) => img.expiryDate)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (!latestExpiry) return false;
    return new Date(latestExpiry) < today;
  })();

  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // KYCアップロード状態
  const [kycFiles, setKycFiles] = useState<KycUploadFile[]>([
    { type: "ID_FRONT", file: null, path: null, uploading: false, uploaded: false, error: null, expiryDate: null },
    { type: "ID_BACK", file: null, path: null, uploading: false, uploaded: false, error: null, expiryDate: null },
  ]);
  const [kycExpiryDate, setKycExpiryDate] = useState<string>("");

  // フォームデータ
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [lineCount, setLineCount] = useState<number>(10);
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    cancellation: false,
  });

  // クーポン
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponUnitPrice, setCouponUnitPrice] = useState<number | null>(null);
  const [couponPricings, setCouponPricings] = useState<{ minQuantity: number; maxQuantity: number | null; unitPrice: number }[] | null>(null);
  const [couponDescription, setCouponDescription] = useState<string | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // dashboardData が読み込まれたら step を再設定
  useEffect(() => {
    if (dashboardData !== null) {
      const kycImages = dashboardData?.customer?.kycImages ?? [];
      if (kycImages.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestExpiry = kycImages
          .map((img) => img.expiryDate)
          .filter(Boolean)
          .sort()
          .at(-1);
        const expired = !!latestExpiry && new Date(latestExpiry) < today;
        if (expired) {
          setStep(0);
        }
      }
    }
  }, [dashboardData]);

  const steps = isKycExpired
    ? [
        { id: 0, name: "身分証更新" },
        { id: 1, name: "プラン選択" },
        { id: 2, name: "確認・同意" },
      ]
    : [
        { id: 1, name: "プラン選択" },
        { id: 2, name: "確認・同意" },
      ];

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.filter((p: Plan) => p.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadKycFile = async (index: number, file: File) => {
    const kycType = kycFiles[index].type;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `kyc/${Date.now()}_${kycType.toLowerCase()}.${ext}`;

    setKycFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, file, uploading: true, error: null } : f
      )
    );

    try {
      // 署名付きURLを取得
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "kyc", path }),
      });

      if (!urlRes.ok) {
        throw new Error("アップロードURLの取得に失敗しました");
      }

      const { signedUrl, path: savedPath } = await urlRes.json();

      // Supabaseへアップロード
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("ファイルのアップロードに失敗しました");
      }

      setKycFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, path: savedPath, uploading: false, uploaded: true }
            : f
        )
      );
    } catch (err) {
      setKycFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                uploading: false,
                error: err instanceof Error ? err.message : "アップロードエラー",
              }
            : f
        )
      );
    }
  };

  const removeKycFile = (index: number) => {
    setKycFiles((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, file: null, path: null, uploaded: false, error: null }
          : f
      )
    );
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), planId: selectedPlanId }),
      });
      const data = await res.json();

      if (data.valid) {
        setCouponApplied(true);
        setCouponUnitPrice(data.unitPrice ?? null);
        setCouponPricings(data.pricings ?? null);
        setCouponDescription(data.description);
        setCouponError(null);
      } else {
        setCouponApplied(false);
        setCouponUnitPrice(null);
        setCouponDescription(null);
        setCouponError(data.error || "クーポンの適用に失敗しました");
      }
    } catch {
      setCouponError("クーポンの検証に失敗しました");
    } finally {
      setCouponValidating(false);
    }
  };

  const clearCoupon = () => {
    setCouponCode("");
    setCouponApplied(false);
    setCouponUnitPrice(null);
    setCouponPricings(null);
    setCouponDescription(null);
    setCouponError(null);
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const getUnitPrice = (plan: Plan, quantity: number): number => {
    const sortedPricings = [...plan.pricings].sort(
      (a, b) => a.minQuantity - b.minQuantity
    );
    if (sortedPricings.length === 0) return 0;

    let unitPrice = sortedPricings[0].unitPrice;
    for (const pricing of sortedPricings) {
      if (quantity >= pricing.minQuantity) {
        if (!pricing.maxQuantity || quantity <= pricing.maxQuantity) {
          unitPrice = pricing.unitPrice;
        }
      }
    }
    return unitPrice;
  };

  const canProceedStep0 = () => kycFiles.every((f) => f.uploaded) && !!kycExpiryDate;
  const canProceedStep1 = () => selectedPlanId !== "" && lineCount >= 10 && lineCount % 10 === 0;
  const canSubmit = () => agreements.terms && agreements.privacy && agreements.cancellation;

  const handleSubmit = async () => {
    if (!canSubmit() || !selectedPlan) return;

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        planId: selectedPlanId,
        lineCount,
        ...(couponApplied && couponCode ? { couponCode } : {}),
      };

      if (isKycExpired) {
        body.kycImages = kycFiles
          .filter((f) => f.path)
          .map((f) => ({ type: f.type, path: f.path, expiryDate: kycExpiryDate || null }));
      }

      const res = await fetch("/api/customer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "申込に失敗しました");
      }

      router.push("/dashboard/apply/complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "申込に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const baseUnitPrice = selectedPlan ? getUnitPrice(selectedPlan, lineCount) : 0;

  const getCouponUnitPrice = (): number | null => {
    if (couponPricings && couponPricings.length > 0) {
      const sorted = [...couponPricings].sort((a, b) => a.minQuantity - b.minQuantity);
      let price = sorted[0].unitPrice;
      for (const p of sorted) {
        if (lineCount >= p.minQuantity && (!p.maxQuantity || lineCount <= p.maxQuantity)) {
          price = p.unitPrice;
        }
      }
      return price;
    }
    if (couponUnitPrice !== null && couponUnitPrice !== undefined) {
      return couponUnitPrice;
    }
    return null;
  };

  const couponPrice = couponApplied ? getCouponUnitPrice() : null;
  const selectedPlanPrice = couponPrice !== null ? couponPrice : baseUnitPrice;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          ダッシュボードに戻る
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>追加申込</CardTitle>
          <CardDescription>新しい回線を追加申込します</CardDescription>
        </CardHeader>
        <CardContent>
          {/* ステップインジケーター */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2",
                      step >= s.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground text-muted-foreground"
                    )}
                  >
                    {step > s.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "ml-2 text-sm font-medium",
                      step >= s.id ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-16 h-0.5 mx-4",
                        step > s.id ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Step 0: 身分証アップロード（KYC期限切れ時のみ） */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">身分証明書の有効期限が切れています</p>
                  <p className="text-sm text-amber-700 mt-1">
                    追加申込を行うには、有効な身分証明書の表面・裏面をアップロードしてください。
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">
                    新しい身分証明書の有効期限 *
                  </Label>
                  <div className="mt-2 max-w-xs">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !kycExpiryDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {kycExpiryDate
                            ? format(new Date(kycExpiryDate), "yyyy年MM月dd日", { locale: ja })
                            : "有効期限を選択"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={kycExpiryDate ? new Date(kycExpiryDate) : undefined}
                          onSelect={(date) =>
                            setKycExpiryDate(date ? format(date, "yyyy-MM-dd") : "")
                          }
                          startMonth={new Date()}
                          endMonth={new Date(new Date().getFullYear() + 15, 11)}
                          captionLayout="dropdown"
                          locale={ja}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-sm text-muted-foreground mt-1">
                      運転免許証等の有効期限を入力してください
                    </p>
                  </div>
                </div>
                {kycFiles.map((kycFile, index) => (
                  <div key={kycFile.type}>
                    <Label className="text-sm font-medium">
                      身分証明書 {kycFile.type === "ID_FRONT" ? "表面" : "裏面"} *
                    </Label>
                    <div className="mt-2">
                      {kycFile.uploaded ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">
                            {kycFile.file?.name ?? "アップロード済み"}
                          </span>
                          <button
                            onClick={() => removeKycFile(index)}
                            className="ml-auto text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={kycFile.uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadKycFile(index, file);
                            }}
                          />
                          {kycFile.uploading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              アップロード中...
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                              <Upload className="h-5 w-5" />
                              <span>クリックして画像を選択</span>
                              <span className="text-xs">JPG, PNG など</span>
                            </div>
                          )}
                        </label>
                      )}
                      {kycFile.error && (
                        <p className="text-xs text-red-500 mt-1">{kycFile.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: プラン選択 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-medium">
                  プランを選択してください *
                </Label>
                <div className="mt-3 space-y-3">
                  {plans.map((plan) => {
                    const sortedPricings = [...plan.pricings].sort(
                      (a, b) => a.minQuantity - b.minQuantity
                    );
                    return (
                      <div
                        key={plan.id}
                        className={cn(
                          "relative flex items-start p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors",
                          selectedPlanId === plan.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                        onClick={() => setSelectedPlanId(plan.id)}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                            selectedPlanId === plan.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}
                        >
                          {selectedPlanId === plan.id && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="font-medium">{plan.name}</div>
                          <div className="mt-1 space-y-0.5">
                            {sortedPricings.map((p, i) => {
                              const rangeText = p.maxQuantity
                                ? `${p.minQuantity}〜${p.maxQuantity}回線`
                                : `${p.minQuantity}回線以上`;
                              return (
                                <div key={i} className="text-xs text-muted-foreground">
                                  {rangeText}:{" "}
                                  <strong>{formatCurrency(p.unitPrice)}</strong>
                                  /回線
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">
                  回線数 *
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => setLineCount(Math.max(10, lineCount - 10))}
                    disabled={lineCount <= 10}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center text-lg font-medium tabular-nums">
                    {lineCount}
                  </span>
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => setLineCount(lineCount + 10)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedPlan && selectedPlan.pricings.length > 1 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                  <h4 className="font-medium text-blue-900 mb-2">
                    回線数別料金（まとめてお得！）
                  </h4>
                  <div className="space-y-1">
                    {[...selectedPlan.pricings]
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((pricing, i) => {
                        const isCurrentTier =
                          lineCount >= pricing.minQuantity &&
                          (!pricing.maxQuantity || lineCount <= pricing.maxQuantity);
                        const rangeText = pricing.maxQuantity
                          ? `${pricing.minQuantity}〜${pricing.maxQuantity}回線`
                          : `${pricing.minQuantity}回線以上`;
                        return (
                          <div
                            key={i}
                            className={`flex justify-between text-sm py-1 px-2 rounded ${
                              isCurrentTier ? "bg-blue-100 font-medium text-blue-900" : ""
                            }`}
                          >
                            <span>{rangeText}</span>
                            <span>{formatCurrency(pricing.unitPrice)}/回線</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {selectedPlan && (
                <div>
                  <Label className="text-base font-medium">クーポンコード（お持ちの方）</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        if (couponApplied) clearCoupon();
                      }}
                      placeholder="クーポンコードを入力"
                      className="w-48 font-mono"
                      disabled={couponApplied}
                    />
                    {couponApplied ? (
                      <Button type="button" variant="outline" onClick={clearCoupon}>
                        取消
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={validateCoupon}
                        disabled={!couponCode.trim() || couponValidating}
                      >
                        {couponValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "適用"}
                      </Button>
                    )}
                  </div>
                  {couponApplied && (
                    <p className="text-sm text-green-600 mt-1">
                      クーポン適用済み{couponDescription ? `（${couponDescription}）` : ""}
                    </p>
                  )}
                  {couponError && (
                    <p className="text-sm text-red-500 mt-1">{couponError}</p>
                  )}
                </div>
              )}

              {selectedPlan && (
                <div className="p-4 bg-muted rounded-lg text-foreground">
                  <h4 className="font-medium mb-2">お見積り</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{formatCurrency(selectedPlanPrice)} × {lineCount}回線</span>
                      <span>{formatCurrency(selectedPlanPrice * lineCount)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-medium text-lg">
                      <span>月額合計（税込）</span>
                      <span>{formatCurrency(selectedPlanPrice * lineCount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 確認・同意 */}
          {step === 2 && selectedPlan && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-lg text-foreground">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  申込内容
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">プラン</span>
                    <span className="font-medium">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">回線数</span>
                    <span className="font-medium">{lineCount}回線</span>
                  </div>
                  {couponApplied && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">クーポン</span>
                      <span className="font-medium text-green-600">{couponCode}（適用済み）</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">単価</span>
                    <span className="font-medium">{formatCurrency(selectedPlanPrice)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-base border-t pt-2">
                    <span>月額合計（税込）</span>
                    <span>{formatCurrency(selectedPlanPrice * lineCount)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-700">
                  <FileCheck className="h-4 w-4" />
                  本人確認について
                </h4>
                {isKycExpired ? (
                  <p className="text-sm text-blue-600">
                    新しい身分証明書をアップロードしていただきました。確認完了後、申込が処理されます。
                  </p>
                ) : (
                  <p className="text-sm text-blue-600">
                    追加申込の場合、以前ご提出いただいた本人確認書類を使用します。
                    新たな書類のアップロードは不要です。
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">同意事項</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={agreements.terms}
                      onCheckedChange={(checked) =>
                        setAgreements({ ...agreements, terms: !!checked })
                      }
                    />
                    <label htmlFor="terms" className="text-sm cursor-pointer">
                      <span className="text-primary underline">利用規約</span>
                      に同意します
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacy"
                      checked={agreements.privacy}
                      onCheckedChange={(checked) =>
                        setAgreements({ ...agreements, privacy: !!checked })
                      }
                    />
                    <label htmlFor="privacy" className="text-sm cursor-pointer">
                      <span className="text-primary underline">プライバシーポリシー</span>
                      に同意します
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="cancellation"
                      checked={agreements.cancellation}
                      onCheckedChange={(checked) =>
                        setAgreements({ ...agreements, cancellation: !!checked })
                      }
                    />
                    <label htmlFor="cancellation" className="text-sm cursor-pointer">
                      <span className="text-primary underline">解約・返金ポリシー</span>
                      に同意します
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ナビゲーションボタン */}
          <div className="mt-8 flex justify-between">
            {step > (isKycExpired ? 0 : 1) ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                戻る
              </Button>
            ) : (
              <div />
            )}

            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 ? !canProceedStep0() : !canProceedStep1()}
              >
                次へ
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    申込中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    申込を確定する
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
