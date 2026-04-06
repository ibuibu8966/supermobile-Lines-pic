"use client";

import { useState, Suspense, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import { CurrencyInput } from "@/components/common/currency-input";

interface PlanPricing {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

interface CouponPricing {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

interface Coupon {
  id: string;
  code: string;
  planId: string;
  unitPrice: number | null;
  description: string | null;
  maxUsages: number | null;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  pricings: CouponPricing[];
  plan: {
    id: string;
    name: string;
    service: { id: string; code: string; name: string };
  };
  _count: { applications: number };
}

interface Plan {
  id: string;
  name: string;
  serviceId: string;
  isActive: boolean;
  service: { id: string; code: string; name: string };
  pricings: PlanPricing[];
}

interface Service {
  id: string;
  name: string;
  code: string;
}

interface CouponsWithRelations {
  services: Service[];
  plans: Plan[];
  coupons: Coupon[];
}

// ティア料金の編集用state型
interface PricingTierForm {
  minQuantity: number;
  maxQuantity: number | null;
  originalPrice: number; // プランの元価格
  discountType: "discount" | "markup"; // 割引 or 割増
  discountAmount: number; // 割引/割増額
}

function CouponsContent() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [filterServiceId, setFilterServiceId] = useState<string>("");

  const { data, isLoading: loading } = useQuery<CouponsWithRelations>({
    queryKey: queryKeys.couponsWithRelations,
    queryFn: api.getCouponsWithRelations as () => Promise<CouponsWithRelations>,
    staleTime: STALE_TIMES.MASTER,
  });

  const services = data?.services ?? [];
  const plansData = data?.plans ?? [];
  const couponsData = data?.coupons ?? [];

  const coupons = useMemo(() => {
    let filtered = couponsData.filter((c) =>
      activeTab === "active" ? c.isActive : !c.isActive
    );
    if (filterServiceId) {
      filtered = filtered.filter((c) => c.plan.service.id === filterServiceId);
    }
    return filtered;
  }, [couponsData, activeTab, filterServiceId]);

  const [modalServiceId, setModalServiceId] = useState<string>("");
  const filteredPlans = useMemo(() => {
    if (!modalServiceId) return plansData.filter((p) => p.isActive);
    return plansData.filter((p) => p.serviceId === modalServiceId && p.isActive);
  }, [plansData, modalServiceId]);

  // モーダル状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    planId: "",
    description: "",
    maxUsages: "" as string | number,
    validFrom: "",
    validUntil: "",
  });
  const [pricingTiers, setPricingTiers] = useState<PricingTierForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // プラン選択時にPlanPricingをデフォルトのティアとして設定
  const handlePlanChange = useCallback((planId: string) => {
    setFormData((prev) => ({ ...prev, planId }));
    if (!planId) {
      setPricingTiers([]);
      return;
    }
    const plan = plansData.find((p) => p.id === planId);
    if (!plan || !plan.pricings || plan.pricings.length === 0) {
      setPricingTiers([{
        minQuantity: 1,
        maxQuantity: null,
        originalPrice: 0,
        discountType: "discount",
        discountAmount: 0,
      }]);
      return;
    }
    setPricingTiers(
      plan.pricings.map((pp) => ({
        minQuantity: pp.minQuantity,
        maxQuantity: pp.maxQuantity,
        originalPrice: pp.unitPrice,
        discountType: "discount" as const,
        discountAmount: 0,
      }))
    );
  }, [plansData]);

  // 編集時にクーポンのpricingsを復元
  const loadEditPricings = useCallback((coupon: Coupon) => {
    const plan = plansData.find((p) => p.id === coupon.planId);
    if (coupon.pricings && coupon.pricings.length > 0) {
      setPricingTiers(
        coupon.pricings.map((cp) => {
          const planPricing = plan?.pricings?.find(
            (pp) => pp.minQuantity === cp.minQuantity
          );
          const originalPrice = planPricing?.unitPrice ?? 0;
          const diff = cp.unitPrice - originalPrice;
          return {
            minQuantity: cp.minQuantity,
            maxQuantity: cp.maxQuantity,
            originalPrice,
            discountType: diff >= 0 ? ("markup" as const) : ("discount" as const),
            discountAmount: Math.abs(diff),
          };
        })
      );
    } else {
      // 旧形式: unitPriceのみ
      if (plan?.pricings && plan.pricings.length > 0) {
        setPricingTiers(
          plan.pricings.map((pp) => {
            const diff = (coupon.unitPrice ?? 0) - pp.unitPrice;
            return {
              minQuantity: pp.minQuantity,
              maxQuantity: pp.maxQuantity,
              originalPrice: pp.unitPrice,
              discountType: diff >= 0 ? ("markup" as const) : ("discount" as const),
              discountAmount: Math.abs(diff),
            };
          })
        );
      } else {
        setPricingTiers([{
          minQuantity: 1,
          maxQuantity: null,
          originalPrice: 0,
          discountType: "discount",
          discountAmount: coupon.unitPrice ?? 0,
        }]);
      }
    }
  }, [plansData]);

  const calcCouponPrice = (tier: PricingTierForm) => {
    if (tier.discountType === "discount") {
      return tier.originalPrice - tier.discountAmount;
    }
    return tier.originalPrice + tier.discountAmount;
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setModalServiceId("");
    setFormData({
      code: "",
      planId: "",
      description: "",
      maxUsages: "",
      validFrom: "",
      validUntil: "",
    });
    setPricingTiers([]);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setModalServiceId(coupon.plan.service.id);
    setFormData({
      code: coupon.code,
      planId: coupon.planId,
      description: coupon.description || "",
      maxUsages: coupon.maxUsages ?? "",
      validFrom: new Date(coupon.validFrom).toISOString().slice(0, 10),
      validUntil: new Date(coupon.validUntil).toISOString().slice(0, 10),
    });
    loadEditPricings(coupon);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingCoupon
        ? "/api/coupons/" + editingCoupon.id
        : "/api/coupons";
      const method = editingCoupon ? "PATCH" : "POST";

      const pricings = pricingTiers.map((tier) => ({
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        unitPrice: calcCouponPrice(tier),
      }));

      const payload = {
        code: formData.code,
        planId: formData.planId,
        description: formData.description || null,
        maxUsages: formData.maxUsages !== "" ? Number(formData.maxUsages) : null,
        validFrom: formData.validFrom,
        validUntil: formData.validUntil,
        pricings,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        closeModal();
        toast.success(editingCoupon ? "クーポンを更新しました" : "クーポンを作成しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.couponsWithRelations });
      } else {
        setError(resData.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm("「" + coupon.code + "」を削除しますか？\n\n※利用済みの場合は無効化されます。")) {
      return;
    }

    try {
      const res = await fetch("/api/coupons/" + coupon.id, { method: "DELETE" });
      if (res.ok) {
        toast.success("クーポンを削除しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.couponsWithRelations });
      } else {
        const resData = await res.json();
        toast.error(resData.error || "削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const res = await fetch("/api/coupons/" + coupon.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      if (res.ok) {
        toast.success(coupon.isActive ? "クーポンを無効化しました" : "クーポンを有効化しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.couponsWithRelations });
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
    }
  };

  const formatPrice = (price: number) => "¥" + price.toLocaleString();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ja-JP");

  const isExpired = (validUntil: string) =>
    new Date(validUntil) < new Date();

  const addTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newMin = lastTier ? (lastTier.maxQuantity ?? lastTier.minQuantity) + 1 : 1;
    setPricingTiers([
      ...pricingTiers,
      {
        minQuantity: newMin,
        maxQuantity: null,
        originalPrice: lastTier?.originalPrice ?? 0,
        discountType: "discount",
        discountAmount: 0,
      },
    ]);
  };

  const removeTier = (index: number) => {
    if (pricingTiers.length <= 1) return;
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, updates: Partial<PricingTierForm>) => {
    setPricingTiers(
      pricingTiers.map((tier, i) => (i === index ? { ...tier, ...updates } : tier))
    );
  };

  // 一覧の料金表示用ヘルパー
  const getCouponPriceDisplay = (coupon: Coupon) => {
    if (coupon.pricings && coupon.pricings.length > 0) {
      if (coupon.pricings.length === 1) {
        return formatPrice(coupon.pricings[0].unitPrice);
      }
      const prices = coupon.pricings.map((p) => p.unitPrice);
      return formatPrice(Math.min(...prices)) + "〜" + formatPrice(Math.max(...prices));
    }
    if (coupon.unitPrice != null) {
      return formatPrice(coupon.unitPrice);
    }
    return "-";
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="max-w-6xl flex-1 min-h-0 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="active">有効</TabsTrigger>
              <TabsTrigger value="inactive">無効</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            新規クーポン作成
          </Button>
        </div>

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <select
                value={filterServiceId}
                onChange={(e) => setFilterServiceId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">全サービス</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{coupons.length}件</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 overflow-auto">
            {coupons.length === 0 && !loading ? (
              <div className="text-center py-12 px-6 text-gray-500">
                クーポンが登録されていません
              </div>
            ) : coupons.length === 0 && loading ? (
              <div className="flex justify-center py-12 px-6">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">コード</th>
                    <th className="text-left py-2 px-4">プラン</th>
                    <th className="text-right py-2 px-4">クーポン単価</th>
                    <th className="text-left py-2 px-4">有効期間</th>
                    <th className="text-right py-2 px-4">利用数/上限</th>
                    <th className="text-left py-2 px-4">有効/無効</th>
                    <th className="text-right py-2 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className={"border-b hover:bg-gray-50" + (!coupon.isActive ? " opacity-60" : "")}>
                      <td className="py-2 px-4 font-mono font-medium">{coupon.code}</td>
                      <td className="py-2 px-4">
                        <div>
                          <span className="font-medium">{coupon.plan.name}</span>
                          <Badge variant="outline" className="ml-2">{coupon.plan.service.name}</Badge>
                        </div>
                        {coupon.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{coupon.description}</p>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-medium">
                        {getCouponPriceDisplay(coupon)}
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs">
                          {formatDate(coupon.validFrom)} 〜 {formatDate(coupon.validUntil)}
                        </div>
                        {isExpired(coupon.validUntil) && (
                          <Badge variant="destructive" className="mt-0.5">期限切れ</Badge>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {coupon._count?.applications ?? 0} / {coupon.maxUsages ?? "∞"}
                      </td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => toggleActive(coupon)}
                          className="group cursor-pointer"
                        >
                          <Badge
                            variant={coupon.isActive ? "success" : "secondary"}
                            className={coupon.isActive
                              ? "group-hover:bg-red-100 group-hover:text-red-700 group-hover:border-red-300 transition-colors"
                              : "group-hover:bg-green-100 group-hover:text-green-700 group-hover:border-green-300 transition-colors"
                            }
                          >
                            <span className="group-hover:hidden">{coupon.isActive ? "有効" : "無効"}</span>
                            <span className="hidden group-hover:inline">{coupon.isActive ? "無効にする" : "有効にする"}</span>
                          </Badge>
                        </button>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(coupon)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(coupon)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingCoupon ? "クーポン編集" : "新規クーポン作成"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    クーポンコード
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-md font-mono"
                    placeholder="SUMMER2026"
                    required
                    maxLength={50}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サービス
                    </label>
                    <select
                      value={modalServiceId}
                      onChange={(e) => {
                        setModalServiceId(e.target.value);
                        setFormData({ ...formData, planId: "" });
                        setPricingTiers([]);
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">選択してください</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      プラン
                    </label>
                    <select
                      value={formData.planId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                      disabled={!modalServiceId}
                    >
                      <option value="">選択してください</option>
                      {filteredPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 料金条件設定 */}
                {!formData.planId && (
                  <div className="bg-gray-50 border border-dashed rounded-md px-4 py-3 text-sm text-gray-500">
                    サービス・プランを選択すると料金条件が表示されます
                  </div>
                )}
                {formData.planId && pricingTiers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      料金条件
                    </label>
                    {/* ヘッダー */}
                    <div className="grid grid-cols-[1fr_1fr_80px_64px_1fr_80px_24px] gap-2 text-xs text-gray-500 mb-1 px-1">
                      <span>最低</span>
                      <span>最大</span>
                      <span>元価格</span>
                      <span></span>
                      <span>金額</span>
                      <span className="text-right">適用後</span>
                      <span></span>
                    </div>
                    <div className="space-y-1">
                      {pricingTiers.map((tier, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1fr_80px_64px_1fr_80px_24px] gap-2 items-center">
                          <input
                            type="number"
                            value={tier.minQuantity}
                            onChange={(e) => updateTier(index, { minQuantity: parseInt(e.target.value) || 1 })}
                            className="w-full px-2 py-1 border rounded text-sm text-center"
                            min="1"
                          />
                          <input
                            type="number"
                            value={tier.maxQuantity ?? ""}
                            onChange={(e) => updateTier(index, { maxQuantity: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2 py-1 border rounded text-sm text-center"
                            min="1"
                            placeholder="∞"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap px-1">{formatPrice(tier.originalPrice)}</span>
                          <select
                            value={tier.discountType}
                            onChange={(e) => updateTier(index, { discountType: e.target.value as "discount" | "markup" })}
                            className="px-1.5 py-1 border rounded text-sm"
                          >
                            <option value="discount">割引</option>
                            <option value="markup">割増</option>
                          </select>
                          <CurrencyInput
                            value={tier.discountAmount}
                            onChange={(val) => updateTier(index, { discountAmount: val })}
                            className="w-full px-2 py-1 border rounded text-sm text-center"
                          />
                          <span className={"text-sm font-bold text-right whitespace-nowrap " + (calcCouponPrice(tier) < tier.originalPrice ? "text-green-600" : calcCouponPrice(tier) > tier.originalPrice ? "text-red-600" : "")}>
                            {formatPrice(calcCouponPrice(tier))}
                          </span>
                          {pricingTiers.length > 1 ? (
                            <button type="button" onClick={() => removeTier(index)} className="text-red-400 hover:text-red-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addTier}
                      className="mt-1.5 text-xs text-blue-600 hover:text-blue-800"
                    >
                      + 条件追加
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明（任意）
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="例: 夏季キャンペーン特別価格"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    利用回数上限（空欄=無制限）
                  </label>
                  <input
                    type="number"
                    value={formData.maxUsages}
                    onChange={(e) => setFormData({ ...formData, maxUsages: e.target.value ? parseInt(e.target.value) : "" })}
                    className="w-full px-3 py-2 border rounded-md"
                    min="1"
                    placeholder="無制限"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      有効開始日
                    </label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      有効終了日
                    </label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                <Button type="button" variant="outline" onClick={closeModal}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function CouponsClient() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <CouponsContent />
    </Suspense>
  );
}
