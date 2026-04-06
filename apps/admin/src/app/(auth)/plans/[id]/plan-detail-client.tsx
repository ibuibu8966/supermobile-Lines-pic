"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Loader2, X, Plus, Save, Check } from "lucide-react";
import { CurrencyInput } from "@/components/common/currency-input";

interface UsageTag {
  id: number;
  code: string;
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

interface Service {
  id: string;
  code: string;
  name: string;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  features: string[];
  isActive: boolean;
  serviceId: string;
  service: Service;
  usageTags: PlanUsageTag[];
  pricings: PlanPricing[];
  lineIncrements: number[];
  minLineCount: number;
  _count: {
    applications: number;
  };
}

interface PricingInput {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  description: string;
}

export function PlanDetailClient({ id }: { id: string }) {
  const router = useRouter();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [usageTags, setUsageTags] = useState<UsageTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // 編集フォーム状態
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    features: [] as string[],
    lineIncrements: [10] as number[],
    minLineCount: 10,
    usageTagIds: [] as number[],
    pricings: [] as PricingInput[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async () => {
    try {
      const res = await fetch(`/api/plans/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setFormData({
          code: data.code,
          name: data.name,
          description: data.description || "",
          features: data.features || [],
          lineIncrements: data.lineIncrements?.length ? data.lineIncrements : [10],
          minLineCount: data.minLineCount || 10,
          usageTagIds: data.usageTags.map((pt: PlanUsageTag) => pt.usageTag.id),
          pricings: data.pricings.map((p: PlanPricing) => ({
            minQuantity: p.minQuantity,
            maxQuantity: p.maxQuantity,
            unitPrice: p.unitPrice,
            description: p.description || "",
          })),
        });
      } else if (res.status === 404) {
        router.push("/plans");
      }
    } catch (err) {
      console.error("プラン取得エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageTags = async () => {
    try {
      const res = await fetch("/api/usage-tags");
      const data = await res.json();
      if (res.ok) {
        setUsageTags(data);
      }
    } catch (err) {
      console.error("用途タグ取得エラー:", err);
    }
  };

  useEffect(() => {
    fetchPlan();
    fetchUsageTags();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        pricings: formData.pricings.map((p) => ({
          ...p,
          description: p.description || null,
        })),
      };

      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setPlan(data);
        setIsEditing(false);
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (!confirm(`「${plan.name}」を削除しますか？\n\n※申込がある場合は無効化されます。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/plans");
      } else {
        const data = await res.json();
        alert(data.error || "削除に失敗しました");
      }
    } catch {
      alert("削除に失敗しました");
    }
  };

  const toggleActive = async () => {
    if (!plan) return;
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch (err) {
      console.error("ステータス変更エラー:", err);
    }
  };

  const cancelEdit = () => {
    if (plan) {
      setFormData({
        code: plan.code,
        name: plan.name,
        description: plan.description || "",
        features: plan.features || [],
        lineIncrements: plan.lineIncrements?.length ? plan.lineIncrements : [10],
        minLineCount: plan.minLineCount || 10,
        usageTagIds: plan.usageTags.map((pt) => pt.usageTag.id),
        pricings: plan.pricings.map((p) => ({
          minQuantity: p.minQuantity,
          maxQuantity: p.maxQuantity,
          unitPrice: p.unitPrice,
          description: p.description || "",
        })),
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const addPricing = () => {
    setFormData({
      ...formData,
      pricings: [
        ...formData.pricings,
        { minQuantity: 1, maxQuantity: null, unitPrice: 0, description: "" },
      ],
    });
  };

  const removePricing = (index: number) => {
    setFormData({
      ...formData,
      pricings: formData.pricings.filter((_, i) => i !== index),
    });
  };

  const updatePricing = (index: number, field: keyof PricingInput, value: unknown) => {
    const newPricings = [...formData.pricings];
    newPricings[index] = { ...newPricings[index], [field]: value };
    setFormData({ ...formData, pricings: newPricings });
  };

  const formatPrice = (price: number) => {
    return "¥" + price.toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">プランが見つかりません</p>
          <Link href="/plans" prefetch={false}>
            <Button variant="outline">一覧に戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
              <Badge variant={plan.isActive ? "success" : "secondary"}>
                {plan.isActive ? "有効" : "無効"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <Button variant="outline" onClick={toggleActive}>
                  {plan.isActive ? "無効化" : "有効化"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  編集
                </Button>
                <Button variant="outline" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                  削除
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl">
        {isEditing ? (
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">プラン編集</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      コード
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      プラン名
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    プラン説明（顧客向け）
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={3}
                    placeholder="例: データ通信専用のお得なプランです。動画視聴やSNS利用に最適。"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    申込画面のプラン選択時に表示されます（最大500文字）
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      特徴（料金カードに表示）
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          features: [...formData.features, ""],
                        })
                      }
                      disabled={formData.features.length >= 10}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      追加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => {
                            const newFeatures = [...formData.features];
                            newFeatures[index] = e.target.value;
                            setFormData({ ...formData, features: newFeatures });
                          }}
                          className="flex-1 px-3 py-2 border rounded-md text-sm"
                          placeholder="例: 音声通話付き"
                          maxLength={50}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              features: formData.features.filter((_, i) => i !== index),
                            })
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {formData.features.length === 0 && (
                      <div className="text-center py-3 text-gray-500 text-sm border rounded-md">
                        特徴が設定されていません。「追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    顧客向け料金カードにチェックマーク付きで表示されます（最大10件）
                  </p>
                </div>

                <div className="p-3 border rounded-md bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    回線数設定
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">増加単位（複数選択可）</label>
                      <div className="flex gap-3">
                        {[
                          { value: 1, label: "1の位" },
                          { value: 10, label: "10の位" },
                          { value: 100, label: "100の位" },
                        ].map((option) => (
                          <label key={option.value} className="flex items-center gap-1 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.lineIncrements.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    lineIncrements: [...formData.lineIncrements, option.value].sort((a, b) => a - b),
                                  });
                                } else {
                                  const filtered = formData.lineIncrements.filter((v) => v !== option.value);
                                  if (filtered.length > 0) {
                                    setFormData({ ...formData, lineIncrements: filtered });
                                  }
                                }
                              }}
                              className="rounded"
                            />
                            {option.label} (×{option.value})
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">最小回線数（初期値）</label>
                      <input
                        type="number"
                        value={formData.minLineCount}
                        onChange={(e) => setFormData({ ...formData, minLineCount: parseInt(e.target.value) || 1 })}
                        className="w-32 px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    用途タグ
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                    {usageTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.usageTagIds.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                usageTagIds: [...formData.usageTagIds, tag.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                usageTagIds: formData.usageTagIds.filter((id) => id !== tag.id),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      料金設定
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={addPricing}>
                      <Plus className="h-4 w-4 mr-1" />
                      追加
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.pricings.map((pricing, index) => (
                      <div key={index} className="p-3 border rounded-md bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">料金 {index + 1}</span>
                          {formData.pricings.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePricing(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">最低回線数</label>
                            <input
                              type="number"
                              value={pricing.minQuantity}
                              onChange={(e) => updatePricing(index, "minQuantity", parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">最大回線数（空白=上限なし）</label>
                            <input
                              type="number"
                              value={pricing.maxQuantity || ""}
                              onChange={(e) => updatePricing(index, "maxQuantity", e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">単価（円/月）</label>
                            <CurrencyInput
                              value={pricing.unitPrice}
                              onChange={(val) => updatePricing(index, "unitPrice", val)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs text-gray-500 mb-1">説明</label>
                          <input
                            type="text"
                            value={pricing.description}
                            onChange={(e) => updatePricing(index, "description", e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="例: 51回線以上で10%OFF"
                          />
                        </div>
                      </div>
                    ))}
                    {formData.pricings.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        料金設定がありません。「追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        ) : (
          <div className="grid gap-6">
            {/* 基本情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本情報</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">サービス</dt>
                    <dd className="font-medium mt-1">{plan.service.name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">プランコード</dt>
                    <dd className="font-mono mt-1">{plan.code}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">プラン名</dt>
                    <dd className="font-medium mt-1">{plan.name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">申込数</dt>
                    <dd className="font-medium mt-1">{plan._count.applications}件</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-500">プラン説明</dt>
                    <dd className="mt-1 whitespace-pre-wrap">
                      {plan.description || <span className="text-gray-400">未設定</span>}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* 用途タグ */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">用途タグ</CardTitle>
              </CardHeader>
              <CardContent>
                {plan.usageTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {plan.usageTags.map((pt) => (
                      <Badge key={pt.usageTag.id} variant="secondary">
                        {pt.usageTag.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">用途タグが設定されていません</p>
                )}
              </CardContent>
            </Card>

            {/* 特徴 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">特徴</CardTitle>
              </CardHeader>
              <CardContent>
                {plan.features.length > 0 ? (
                  <ul className="space-y-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">特徴が設定されていません</p>
                )}
              </CardContent>
            </Card>

            {/* 回線数設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">回線数設定</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">増加単位</dt>
                    <dd className="mt-1 flex gap-2">
                      {(plan.lineIncrements?.length ? plan.lineIncrements : [10])
                        .slice()
                        .sort((a, b) => a - b)
                        .map((inc) => (
                          <Badge key={inc} variant="secondary">×{inc}</Badge>
                        ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">最小回線数（初期値）</dt>
                    <dd className="font-medium mt-1">{plan.minLineCount || 10}回線</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* 料金テーブル */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">料金設定</CardTitle>
              </CardHeader>
              <CardContent>
                {plan.pricings.length > 0 ? (
                  <div>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">回線数</th>
                          <th className="text-right py-2 px-4">単価</th>
                          <th className="text-left py-2 px-4">説明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.pricings.map((pricing) => (
                          <tr key={pricing.id} className="border-b">
                            <td className="py-2 px-4">
                              {pricing.maxQuantity
                                ? `${pricing.minQuantity}〜${pricing.maxQuantity}回線`
                                : `${pricing.minQuantity}回線以上`}
                            </td>
                            <td className="py-2 px-4 text-right font-medium">
                              {formatPrice(pricing.unitPrice)}/月
                            </td>
                            <td className="py-2 px-4 text-gray-500">
                              {pricing.description || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">料金設定がありません</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
