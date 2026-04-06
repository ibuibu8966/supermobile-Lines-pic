"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, X, Eye, EyeOff, CalendarDays, Minus, Plus } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface UsageTag {
  id: number;
  name: string;
}

interface PlanUsageTag {
  usageTag: UsageTag;
}

interface PlanPricing {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  description: string | null;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  usageTags: PlanUsageTag[];
  pricings: PlanPricing[];
  lineIncrements: number[];
  minLineCount: number;
}

const steps = [
  { id: 1, name: "プラン選択" },
  { id: 2, name: "お客様情報" },
  { id: 3, name: "本人確認" },
  { id: 4, name: "回線数・金額" },
  { id: 5, name: "確認・送信" },
];

const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// Supabase Storageへ直接アップロード
async function uploadToSupabase(
  file: File,
  fileType: string
): Promise<string> {
  const timestamp = Date.now();
  const tempId = crypto.randomUUID();
  const path = `kyc/${tempId}/${fileType}_${timestamp}`;

  // 署名付きアップロードURLを取得
  const urlRes = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: "kyc", path }),
  });

  if (!urlRes.ok) {
    throw new Error("アップロードURLの取得に失敗しました");
  }

  const { signedUrl } = await urlRes.json();

  // Supabase Storageに直接アップロード
  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("ファイルのアップロードに失敗しました");
  }

  return path;
}

interface UploadedFile {
  file: File;
  storagePath: string;
}

// ファイルアップロードコンポーネント
function FileUpload({
  label,
  uploadedFile,
  onFileChange,
  fileType,
  accept = "image/*",
  required = false,
}: {
  label: string;
  uploadedFile: UploadedFile | null;
  onFileChange: (uploaded: UploadedFile | null) => void;
  fileType: string;
  accept?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const file = uploadedFile?.file || null;

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [file]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);
    try {
      const storagePath = await uploadToSupabase(selectedFile, fileType);
      onFileChange({ file: selectedFile, storagePath });
    } catch {
      setUploadError("アップロードに失敗しました。再度お試しください。");
      onFileChange(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    setUploadError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {uploading ? (
        <div className="w-full border-2 border-dashed border-border rounded-lg p-6">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">アップロード中...</span>
          </div>
        </div>
      ) : file && preview ? (
        <div className="relative border rounded-lg p-2 bg-muted">
          <div className="flex items-center gap-3">
            {file.type.startsWith("image/") ? (
              <Image
                src={preview}
                alt="プレビュー"
                width={80}
                height={80}
                className="object-cover rounded"
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                PDF
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:border-primary hover:bg-muted transition-colors"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <span className="text-sm">クリックしてファイルを選択</span>
            <span className="text-xs">
              {accept.includes("pdf") ? "画像またはPDF" : "画像ファイル"}（最大10MB）
            </span>
          </div>
        </button>
      )}
      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}
    </div>
  );
}

function ApplyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [kycCompleted, setKycCompleted] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームデータ
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [lineCount, setLineCount] = useState(10);
  const [activeIncrement, setActiveIncrement] = useState(10);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTelecom, setAgreeTelecom] = useState(false);
  const [agreeInitialCancellation, setAgreeInitialCancellation] = useState(false);
  const [agreeAntiSocial, setAgreeAntiSocial] = useState(false);

  // 代表者と担当者が同じ
  const [sameAsRepresentative, setSameAsRepresentative] = useState(false);

  // パスワード
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // KYC書類
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [corporateRegistry, setCorporateRegistry] = useState<UploadedFile | null>(null);
  const [idExpiryDate, setIdExpiryDate] = useState("");

  // メール重複チェック
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // クーポン
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponUnitPrice, setCouponUnitPrice] = useState<number | null>(null);
  const [couponPricings, setCouponPricings] = useState<{ minQuantity: number; maxQuantity: number | null; unitPrice: number }[] | null>(null);
  const [couponDescription, setCouponDescription] = useState<string | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // 顧客情報
  const [customerData, setCustomerData] = useState({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    birthDate: "",
    phone: "",
    email: "",
    postalCode: "",
    prefecture: "",
    city: "",
    address: "",
    building: "",
    companyName: "",
    companyNameKana: "",
    establishedDate: "",
    representativeLastName: "",
    representativeFirstName: "",
    representativeLastNameKana: "",
    representativeFirstNameKana: "",
    companyPostalCode: "",
    companyPrefecture: "",
    companyCity: "",
    companyAddress: "",
    companyBuilding: "",
  });

  // URLクエリパラメータでPIC完了後のリダイレクトを処理
  useEffect(() => {
    const stepParam = searchParams.get("step");
    const kycParam = searchParams.get("kyc");
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum);
      }
    }
    if (kycParam === "complete") {
      setKycCompleted(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (res.ok) {
        setPlans(data);
        if (data.length > 0) {
          setSelectedPlanId(data[0].id);
        }
      }
    } catch (err) {
      console.error("プラン取得エラー:", err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes("@")) {
      setEmailExists(false);
      return;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/applications/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setEmailExists(data.exists);
    } catch {
      setEmailExists(false);
    } finally {
      setCheckingEmail(false);
    }
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

  // プラン変更時にlineCountとactiveIncrementをリセット
  useEffect(() => {
    if (selectedPlan) {
      const minLine = selectedPlan.minLineCount || 10;
      setLineCount(minLine);
      const increments = selectedPlan.lineIncrements?.length ? selectedPlan.lineIncrements : [10];
      setActiveIncrement(increments.length > 1 ? increments[1] : increments[0]);
    }
  }, [selectedPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getUnitPrice = (): number => {
    if (!selectedPlan) return 0;
    const applicablePricings = selectedPlan.pricings
      .sort((a, b) => a.minQuantity - b.minQuantity);

    if (applicablePricings.length === 0) return 0;

    let unitPrice = applicablePricings[0].unitPrice;
    for (const pricing of applicablePricings) {
      if (lineCount >= pricing.minQuantity) {
        if (!pricing.maxQuantity || lineCount <= pricing.maxQuantity) {
          unitPrice = pricing.unitPrice;
        }
      }
    }
    return unitPrice;
  };

  const baseUnitPrice = getUnitPrice();

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
  const unitPrice = couponPrice !== null ? couponPrice : baseUnitPrice;
  const totalAmount = unitPrice * lineCount;

  const formatPrice = (price: number) => {
    return "¥" + price.toLocaleString();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("planId", selectedPlanId);
      formData.append("lineCount", lineCount.toString());
      formData.append("customerType", customerType);
      formData.append("password", password);
      formData.append("customer", JSON.stringify(customerData));
      formData.append("agreeTerms", agreeTerms.toString());
      formData.append("agreePrivacy", agreePrivacy.toString());
      formData.append("agreeTelecom", agreeTelecom.toString());
      formData.append("agreeInitialCancellation", agreeInitialCancellation.toString());
      formData.append("agreeAntiSocial", agreeAntiSocial.toString());

      // KYC書類（Supabase Storageのパスを送信）
      if (idFront) formData.append("idFrontPath", idFront.storagePath);
      if (idBack) formData.append("idBackPath", idBack.storagePath);
      if (corporateRegistry) formData.append("corporateRegistryPath", corporateRegistry.storagePath);
      if (idExpiryDate) formData.append("idExpiryDate", idExpiryDate);
      if (couponApplied && couponCode) formData.append("couponCode", couponCode);

      const res = await fetch("/api/applications", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/apply/complete?number=" + data.applicationNumber);
      } else {
        setError(data.error || "申込に失敗しました");
      }
    } catch (err) {
      console.error("申込エラー:", err);
      setError("申込に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep2 = (): boolean => {
    // メール重複チェック
    if (emailExists) return false;

    // パスワードチェック
    if (password.length < 8) return false;
    if (password !== passwordConfirm) return false;

    if (customerType === "CORPORATE") {
      if (!customerData.companyName || !customerData.companyNameKana) {
        return false;
      }
      if (!customerData.companyPostalCode || !customerData.companyPrefecture ||
          !customerData.companyCity || !customerData.companyAddress) {
        return false;
      }
    }
    return (
      customerData.lastName !== "" &&
      customerData.firstName !== "" &&
      customerData.lastNameKana !== "" &&
      customerData.firstNameKana !== "" &&
      customerData.birthDate !== "" &&
      customerData.phone !== "" &&
      customerData.email !== "" &&
      customerData.postalCode !== "" &&
      customerData.prefecture !== "" &&
      customerData.city !== "" &&
      customerData.address !== ""
    );
  };

  const canProceedStep3 = (): boolean => {
    // KYC書類チェック
    if (!idExpiryDate) return false;
    if (customerType === "INDIVIDUAL") {
      return idFront !== null && idBack !== null;
    } else {
      return idFront !== null && idBack !== null && corporateRegistry !== null;
    }
  };

  const getPasswordError = (): string | null => {
    if (password && password.length < 8) {
      return "パスワードは8文字以上で入力してください";
    }
    if (passwordConfirm && password !== passwordConfirm) {
      return "パスワードが一致しません";
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">お申込み</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={"flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium " +
                    (currentStep > step.id
                      ? "bg-primary text-white"
                      : currentStep === step.id
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground")}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={"ml-2 text-sm hidden sm:inline " +
                    (currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground")}
                >
                  {step.name}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={"w-8 sm:w-12 h-0.5 mx-2 sm:mx-4 " +
                      (currentStep > step.id ? "bg-primary" : "bg-muted")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>プランを選択してください</CardTitle>
              <CardDescription>
                ご利用用途に合わせてプランをお選びください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPlans ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  現在お申込み可能なプランがありません
                </div>
              ) : (
                <div className="grid gap-4">
                  {plans.map((plan) => {
                    const sortedPricings = [...plan.pricings].sort((a, b) => a.minQuantity - b.minQuantity);
                    return (
                      <label
                        key={plan.id}
                        className={"flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted " +
                          (selectedPlanId === plan.id ? "border-primary bg-primary/5" : "")}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={selectedPlanId === plan.id}
                          onChange={() => setSelectedPlanId(plan.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{plan.name}</p>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {plan.description}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1 mb-2">
                            {plan.usageTags.map((pt) => pt.usageTag.name).join(", ") || "汎用プラン"}
                          </p>
                          <div className="space-y-0.5">
                            {sortedPricings.map((pricing, i) => {
                              const rangeText = pricing.maxQuantity
                                ? `${pricing.minQuantity}〜${pricing.maxQuantity}回線`
                                : `${pricing.minQuantity}回線以上`;
                              return (
                                <div key={i} className="text-xs text-muted-foreground">
                                  {rangeText}: <span className="font-medium">{formatPrice(pricing.unitPrice)}</span>/回線
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button onClick={() => setCurrentStep(2)} disabled={!selectedPlanId}>
                  次へ
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>お客様情報</CardTitle>
              <CardDescription>
                ご契約者様の情報をご入力ください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerType"
                    value="INDIVIDUAL"
                    checked={customerType === "INDIVIDUAL"}
                    onChange={() => setCustomerType("INDIVIDUAL")}
                  />
                  個人のお客様
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerType"
                    value="CORPORATE"
                    checked={customerType === "CORPORATE"}
                    onChange={() => setCustomerType("CORPORATE")}
                  />
                  法人のお客様
                </label>
              </div>

              {customerType === "CORPORATE" && (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium">法人情報</h4>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName">法人名 *</Label>
                        <Input
                          id="companyName"
                          placeholder="株式会社〇〇"
                          value={customerData.companyName}
                          onChange={(e) => setCustomerData({ ...customerData, companyName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyNameKana">法人名（カナ）*</Label>
                        <Input
                          id="companyNameKana"
                          placeholder="カブシキガイシャ〇〇"
                          value={customerData.companyNameKana}
                          onChange={(e) => setCustomerData({ ...customerData, companyNameKana: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="establishedDate">法人設立日 *</Label>
                      <div className="flex gap-2">
                        <select
                          className="px-3 py-2 border rounded-md bg-background text-foreground"
                          value={customerData.establishedDate ? customerData.establishedDate.split("-")[0] : ""}
                          onChange={(e) => {
                            const year = e.target.value;
                            const month = customerData.establishedDate ? customerData.establishedDate.split("-")[1] : "01";
                            setCustomerData({ ...customerData, establishedDate: year ? `${year}-${month}-01` : "" });
                          }}
                        >
                          <option value="">年</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y}>{y}年</option>
                          ))}
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md bg-background text-foreground"
                          value={customerData.establishedDate ? customerData.establishedDate.split("-")[1] : ""}
                          onChange={(e) => {
                            const year = customerData.establishedDate ? customerData.establishedDate.split("-")[0] : "";
                            const month = e.target.value;
                            setCustomerData({ ...customerData, establishedDate: year ? `${year}-${month}-01` : "" });
                          }}
                        >
                          <option value="">月</option>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                            <option key={m} value={m}>{parseInt(m)}月</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <h4 className="font-medium mt-4">法人住所</h4>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="companyPostalCode">郵便番号 *</Label>
                        <Input
                          id="companyPostalCode"
                          placeholder="123-4567"
                          value={customerData.companyPostalCode}
                          onChange={(e) => setCustomerData({ ...customerData, companyPostalCode: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="companyPrefecture">都道府県 *</Label>
                        <select
                          id="companyPrefecture"
                          className="w-full h-10 px-3 border rounded-md bg-background text-foreground border-border"
                          value={customerData.companyPrefecture}
                          onChange={(e) => setCustomerData({ ...customerData, companyPrefecture: e.target.value })}
                        >
                          <option value="">選択してください</option>
                          {prefectures.map((pref) => (
                            <option key={pref} value={pref}>{pref}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="companyCity">市区町村 *</Label>
                      <Input
                        id="companyCity"
                        placeholder="渋谷区"
                        value={customerData.companyCity}
                        onChange={(e) => setCustomerData({ ...customerData, companyCity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyAddress">番地 *</Label>
                      <Input
                        id="companyAddress"
                        placeholder="1-2-3"
                        value={customerData.companyAddress}
                        onChange={(e) => setCustomerData({ ...customerData, companyAddress: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyBuilding">建物名・部屋番号（任意）</Label>
                      <Input
                        id="companyBuilding"
                        placeholder="〇〇ビル 5F"
                        value={customerData.companyBuilding}
                        onChange={(e) => setCustomerData({ ...customerData, companyBuilding: e.target.value })}
                      />
                    </div>
                  </div>

                  <h4 className="font-medium mt-4">代表者情報</h4>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="representativeLastName">姓 *</Label>
                        <Input
                          id="representativeLastName"
                          placeholder="山田"
                          value={customerData.representativeLastName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerData((prev) => ({
                              ...prev,
                              representativeLastName: val,
                              ...(sameAsRepresentative ? { lastName: val } : {}),
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="representativeFirstName">名 *</Label>
                        <Input
                          id="representativeFirstName"
                          placeholder="太郎"
                          value={customerData.representativeFirstName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerData((prev) => ({
                              ...prev,
                              representativeFirstName: val,
                              ...(sameAsRepresentative ? { firstName: val } : {}),
                            }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="representativeLastNameKana">セイ *</Label>
                        <Input
                          id="representativeLastNameKana"
                          placeholder="ヤマダ"
                          value={customerData.representativeLastNameKana}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerData((prev) => ({
                              ...prev,
                              representativeLastNameKana: val,
                              ...(sameAsRepresentative ? { lastNameKana: val } : {}),
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="representativeFirstNameKana">メイ *</Label>
                        <Input
                          id="representativeFirstNameKana"
                          placeholder="タロウ"
                          value={customerData.representativeFirstNameKana}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerData((prev) => ({
                              ...prev,
                              representativeFirstNameKana: val,
                              ...(sameAsRepresentative ? { firstNameKana: val } : {}),
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 mt-2">
                    <Checkbox
                      checked={sameAsRepresentative}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setSameAsRepresentative(isChecked);
                        if (isChecked) {
                          setCustomerData((prev) => ({
                            ...prev,
                            lastName: prev.representativeLastName,
                            firstName: prev.representativeFirstName,
                            lastNameKana: prev.representativeLastNameKana,
                            firstNameKana: prev.representativeFirstNameKana,
                          }));
                        }
                      }}
                    />
                    <span className="text-sm">担当者も代表者と同じ</span>
                  </label>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-medium">
                  {customerType === "CORPORATE" ? "担当者情報" : "ご契約者情報"}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lastName">姓 *</Label>
                    <Input
                      id="lastName"
                      placeholder="山田"
                      value={customerData.lastName}
                      onChange={(e) => setCustomerData({ ...customerData, lastName: e.target.value })}
                      disabled={sameAsRepresentative}
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstName">名 *</Label>
                    <Input
                      id="firstName"
                      placeholder="太郎"
                      value={customerData.firstName}
                      onChange={(e) => setCustomerData({ ...customerData, firstName: e.target.value })}
                      disabled={sameAsRepresentative}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lastNameKana">セイ *</Label>
                    <Input
                      id="lastNameKana"
                      placeholder="ヤマダ"
                      value={customerData.lastNameKana}
                      onChange={(e) => setCustomerData({ ...customerData, lastNameKana: e.target.value })}
                      disabled={sameAsRepresentative}
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstNameKana">メイ *</Label>
                    <Input
                      id="firstNameKana"
                      placeholder="タロウ"
                      value={customerData.firstNameKana}
                      onChange={(e) => setCustomerData({ ...customerData, firstNameKana: e.target.value })}
                      disabled={sameAsRepresentative}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>生年月日 *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customerData.birthDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {customerData.birthDate
                            ? format(new Date(customerData.birthDate), "yyyy年MM月dd日", { locale: ja })
                            : "生年月日を選択"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customerData.birthDate ? new Date(customerData.birthDate) : undefined}
                          onSelect={(date) =>
                            setCustomerData({
                              ...customerData,
                              birthDate: date ? format(date, "yyyy-MM-dd") : "",
                            })
                          }
                          defaultMonth={customerData.birthDate ? new Date(customerData.birthDate) : new Date(1990, 0)}
                          startMonth={new Date(1920, 0)}
                          endMonth={new Date()}
                          captionLayout="dropdown"
                          locale={ja}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="phone">電話番号 *</Label>
                    <Input
                      id="phone"
                      placeholder="09012345678"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={customerData.email}
                    onChange={(e) => {
                      setCustomerData({ ...customerData, email: e.target.value });
                      if (emailExists) setEmailExists(false);
                    }}
                    onBlur={(e) => checkEmailExists(e.target.value)}
                  />
                  {emailExists && (
                    <p className="text-sm text-red-500 mt-1">
                      このメールアドレスは既に登録されています。マイページから追加申込をしてください。
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">ご住所</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="postalCode">郵便番号 *</Label>
                    <Input
                      id="postalCode"
                      placeholder="123-4567"
                      value={customerData.postalCode}
                      onChange={(e) => setCustomerData({ ...customerData, postalCode: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="prefecture">都道府県 *</Label>
                    <select
                      id="prefecture"
                      className="w-full h-10 px-3 border rounded-md bg-background text-foreground border-border"
                      value={customerData.prefecture}
                      onChange={(e) => setCustomerData({ ...customerData, prefecture: e.target.value })}
                    >
                      <option value="">選択してください</option>
                      {prefectures.map((pref) => (
                        <option key={pref} value={pref}>{pref}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="city">市区町村 *</Label>
                  <Input
                    id="city"
                    placeholder="渋谷区"
                    value={customerData.city}
                    onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="address">番地 *</Label>
                  <Input
                    id="address"
                    placeholder="1-2-3"
                    value={customerData.address}
                    onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="building">建物名・部屋番号（任意）</Label>
                  <Input
                    id="building"
                    placeholder="〇〇マンション101"
                    value={customerData.building}
                    onChange={(e) => setCustomerData({ ...customerData, building: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">マイページ用パスワード</h4>
                <p className="text-sm text-muted-foreground">
                  お申込み完了後、マイページにログインするためのパスワードを設定してください
                </p>
                <div>
                  <Label htmlFor="password">パスワード *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="8文字以上"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="passwordConfirm">パスワード（確認）*</Label>
                  <div className="relative">
                    <Input
                      id="passwordConfirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      placeholder="パスワードを再入力"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {getPasswordError() && (
                  <p className="text-sm text-red-500">{getPasswordError()}</p>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
                <Button onClick={() => setCurrentStep(3)} disabled={!canProceedStep2()}>
                  次へ
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>本人確認</CardTitle>
              <CardDescription>
                {customerType === "INDIVIDUAL"
                  ? "本人確認を行います。カメラで身分証と顔写真を撮影してください。"
                  : "代表者の本人確認と、登記簿謄本のアップロードを行ってください。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PIC eKYC 本人確認 */}
              {kycCompleted ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">本人確認が完了しました</p>
                    <p className="text-sm text-green-700 mt-1">
                      eKYCによる本人確認が正常に完了しました。次のステップに進んでください。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      「本人確認を開始」ボタンを押すと、カメラが起動し身分証明書と顔写真の撮影を行います。
                      スマートフォンでの操作を推奨します。
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 text-lg"
                    onClick={() => {
                      // PIC自動起動のためページをフルリロード
                      window.location.href = "/apply?step=3&pic=launch";
                    }}
                  >
                    本人確認を開始
                  </Button>
                </div>
              )}

              {/* 法人の場合：謄本アップロード */}
              {customerType === "CORPORATE" && (
                <div className="space-y-4">
                  <h4 className="font-medium">法人確認書類</h4>
                  <FileUpload
                    label="登記簿謄本（履歴事項全部証明書）"
                    uploadedFile={corporateRegistry}
                    onFileChange={setCorporateRegistry}
                    fileType="corporate_registry"
                    accept="image/*,.pdf"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    発行から6ヶ月以内のものをご用意ください
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
                <Button
                  onClick={() => setCurrentStep(4)}
                  disabled={
                    !kycCompleted ||
                    (customerType === "CORPORATE" && !corporateRegistry)
                  }
                >
                  次へ
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>回線数と金額</CardTitle>
              <CardDescription>
                必要な回線数をご入力ください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 料金テーブル */}
              {selectedPlan && selectedPlan.pricings.length > 1 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                  <h4 className="font-medium text-blue-900 mb-2">回線数別料金（まとめてお得！）</h4>
                  <div className="space-y-1">
                    {[...selectedPlan.pricings]
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((pricing, i) => {
                        const isCurrentTier = lineCount >= pricing.minQuantity &&
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
                            <span>{formatPrice(pricing.unitPrice)}/回線</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div>
                <Label>回線数</Label>
                <div className="flex flex-col items-center gap-3 mt-2">
                  <span className="text-3xl font-bold tabular-nums text-center">
                    {lineCount}<span className="text-lg font-normal text-gray-500 ml-1">回線</span>
                  </span>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 rounded-full text-lg p-0"
                      onClick={() => setLineCount(Math.max(selectedPlan?.minLineCount || 1, lineCount - activeIncrement))}
                      disabled={lineCount <= (selectedPlan?.minLineCount || 1)}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="text-sm text-gray-500 w-12 text-center">
                      ×{activeIncrement}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 rounded-full text-lg p-0"
                      onClick={() => setLineCount(lineCount + activeIncrement)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  {(selectedPlan?.lineIncrements || [10]).length > 1 && (
                    <div className="flex gap-2">
                      {(selectedPlan?.lineIncrements || [10])
                        .slice()
                        .sort((a, b) => a - b)
                        .map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            className={
                              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors " +
                              (activeIncrement === inc
                                ? "bg-primary text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                            }
                            onClick={() => setActiveIncrement(inc)}
                          >
                            ×{inc}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* クーポンコード */}
              <div>
                <Label>クーポンコード（お持ちの方）</Label>
                <div className="flex gap-2 mt-1">
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

              <div className="p-4 bg-muted rounded-lg space-y-2 text-foreground">
                <div className="flex justify-between">
                  <span>{selectedPlan?.name} × {lineCount}回線</span>
                  <span>{formatPrice(unitPrice)} × {lineCount}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>月額合計（税込）</span>
                  <span>{formatPrice(totalAmount)}</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
                <Button onClick={() => setCurrentStep(5)}>
                  次へ
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>申し込み内容の確認</CardTitle>
              <CardDescription>
                内容をご確認の上、お申込みください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 法人情報（法人の場合） */}
              {customerType === "CORPORATE" && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-gold">法人情報</h4>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-sm text-gold hover:underline"
                      >
                        修正する
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex px-4 py-3">
                      <span className="w-36 text-sm text-muted-foreground shrink-0">法人名</span>
                      <span className="text-sm">
                        {customerData.companyName}（{customerData.companyNameKana}）
                      </span>
                    </div>
                    <div className="flex px-4 py-3">
                      <span className="w-36 text-sm text-muted-foreground shrink-0">法人設立日</span>
                      <span className="text-sm">
                        {customerData.establishedDate
                          ? `${customerData.establishedDate.split("-")[0]}年${parseInt(customerData.establishedDate.split("-")[1])}月`
                          : ""}
                      </span>
                    </div>
                    <div className="flex px-4 py-3">
                      <span className="w-36 text-sm text-muted-foreground shrink-0">法人住所</span>
                      <span className="text-sm">
                        〒{customerData.companyPostalCode} {customerData.companyPrefecture}
                        {customerData.companyCity}{customerData.companyAddress}
                        {customerData.companyBuilding && ` ${customerData.companyBuilding}`}
                      </span>
                    </div>
                    <div className="flex px-4 py-3">
                      <span className="w-36 text-sm text-muted-foreground shrink-0">代表者名</span>
                      <span className="text-sm">
                        {customerData.representativeLastName} {customerData.representativeFirstName}
                        {" "}({customerData.representativeLastNameKana} {customerData.representativeFirstNameKana})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 個人情報 */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gold">
                      {customerType === "CORPORATE" ? "担当者情報" : "個人情報"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-sm text-gold hover:underline"
                    >
                      修正する
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">氏名</span>
                    <span className="text-sm">
                      {customerData.lastName} {customerData.firstName}
                      {" "}({customerData.lastNameKana} {customerData.firstNameKana})
                    </span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">生年月日</span>
                    <span className="text-sm">{customerData.birthDate}</span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">電話番号</span>
                    <span className="text-sm">{customerData.phone}</span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">メールアドレス</span>
                    <span className="text-sm">{customerData.email}</span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">住所</span>
                    <span className="text-sm">
                      〒{customerData.postalCode} {customerData.prefecture}
                      {customerData.city}{customerData.address}
                      {customerData.building && ` ${customerData.building}`}
                    </span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">身分証有効期限</span>
                    <span className="text-sm">{idExpiryDate}</span>
                  </div>
                </div>
              </div>

              {/* プラン情報 */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gold">プラン情報</h4>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-sm text-gold hover:underline"
                    >
                      修正する
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">プラン</span>
                    <span className="text-sm">{selectedPlan?.name}</span>
                  </div>
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">回線数</span>
                    <span className="text-sm">{lineCount}回線</span>
                  </div>
                  {couponApplied && (
                    <div className="flex px-4 py-3">
                      <span className="w-36 text-sm text-muted-foreground shrink-0">クーポン</span>
                      <span className="text-sm text-green-600">{couponCode}（適用済み）</span>
                    </div>
                  )}
                  <div className="flex px-4 py-3">
                    <span className="w-36 text-sm text-muted-foreground shrink-0 font-bold">合計金額</span>
                    <span className="text-lg font-bold">{formatPrice(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* アップロード書類 */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gold">アップロード書類</h4>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-sm text-gold hover:underline"
                    >
                      修正する
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {customerType === "CORPORATE" && corporateRegistry && (
                    <p className="text-sm">・登記簿謄本: {corporateRegistry.file.name}</p>
                  )}
                  {idFront && <p className="text-sm">・身分証明書（表）: {idFront.file.name}</p>}
                  {idBack && <p className="text-sm">・身分証明書（裏）: {idBack.file.name}</p>}
                </div>
              </div>

              {/* チェック項目 */}
              <div className="space-y-4 pt-2">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={agreePrivacy}
                    onCheckedChange={(checked) => setAgreePrivacy(checked === true)}
                  />
                  <span className="text-sm">
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-gold underline">
                      プライバシーポリシー
                    </a>
                    に同意します
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                  />
                  <span className="text-sm">
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-gold underline">
                      利用規約
                    </a>
                    に同意します
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={agreeTelecom}
                    onCheckedChange={(checked) => setAgreeTelecom(checked === true)}
                  />
                  <span className="text-sm">
                    <a href="/legal#telecom-law" target="_blank" rel="noopener noreferrer" className="text-gold underline">
                      電気通信事業法約款
                    </a>
                    に同意します
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={agreeInitialCancellation}
                    onCheckedChange={(checked) => setAgreeInitialCancellation(checked === true)}
                  />
                  <span className="text-sm">初期契約解除制度を確認しました</span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={agreeAntiSocial}
                    onCheckedChange={(checked) => setAgreeAntiSocial(checked === true)}
                  />
                  <span className="text-sm">反社会的勢力ではないことを表明し確約します</span>
                </label>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!agreeTerms || !agreePrivacy || !agreeTelecom || !agreeInitialCancellation || !agreeAntiSocial || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    "申し込む"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ApplyPageInner />
    </Suspense>
  );
}
