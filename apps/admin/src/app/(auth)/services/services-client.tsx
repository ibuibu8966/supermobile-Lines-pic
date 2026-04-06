"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, X, Settings } from "lucide-react";
import { toast } from "sonner";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";

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
}

interface Plan {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  usageTags: PlanUsageTag[];
  pricings: PlanPricing[];
}

interface Service {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count: {
    plans: number;
    applications: number;
    users: number;
  };
  plans: Plan[];
}

export function ServicesClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");

  // TanStack Query
  const { data: servicesData = [], isLoading: loading } = useQuery<Service[]>({
    queryKey: queryKeys.services,
    queryFn: api.getServices as unknown as () => Promise<Service[]>,
    staleTime: STALE_TIMES.MASTER,
  });

  // フィルター適用
  const services = useMemo(() => {
    return servicesData.filter((s) =>
      activeTab === "active" ? s.isActive : !s.isActive
    );
  }, [servicesData, activeTab]);

  // モーダル状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({
      code: "",
      name: "",
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      code: service.code,
      name: service.name,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingService
        ? "/api/services/" + editingService.id
        : "/api/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
        toast.success(editingService ? "サービスを更新しました" : "サービスを作成しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.services });
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: Service) => {
    if (!confirm("「" + service.name + "」を削除しますか？\n\n※関連データがある場合は無効化されます。")) {
      return;
    }

    try {
      const res = await fetch("/api/services/" + service.id, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("サービスを削除しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.services });
      } else {
        const data = await res.json();
        toast.error(data.error || "削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const toggleActive = async (service: Service) => {
    // 楽観的更新
    queryClient.setQueryData<Service[]>(queryKeys.services, (old) => {
      if (!old) return old;
      return old.map((s) =>
        s.id === service.id ? { ...s, isActive: !s.isActive } : s
      );
    });

    try {
      const res = await fetch("/api/services/" + service.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !service.isActive }),
      });

      if (res.ok) {
        toast.success(service.isActive ? "サービスを無効化しました" : "サービスを有効化しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
    }
  };

  const togglePlanActive = async (plan: Plan) => {
    // 楽観的更新
    queryClient.setQueryData<Service[]>(queryKeys.services, (old) => {
      if (!old) return old;
      return old.map((s) => ({
        ...s,
        plans: s.plans.map((p) =>
          p.id === plan.id ? { ...p, isActive: !p.isActive } : p
        ),
      }));
    });

    try {
      const res = await fetch("/api/plans/" + plan.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (res.ok) {
        toast.success(plan.isActive ? "プランを無効化しました" : "プランを有効化しました");
      } else {
        throw new Error();
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
    }
  };

  const formatPrice = (price: number) => {
    return "¥" + price.toLocaleString();
  };

  const getPriceDisplay = (pricings: PlanPricing[]) => {
    if (pricings.length === 0) return "-";

    const sorted = [...pricings].sort((a, b) => a.minQuantity - b.minQuantity);
    const base = sorted[0];
    const hasDiscount = sorted.length > 1;

    return hasDiscount
      ? formatPrice(base.unitPrice) + "/月〜"
      : formatPrice(base.unitPrice) + "/月";
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="active">有効</TabsTrigger>
              <TabsTrigger value="inactive">無効</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            新規サービス登録
          </Button>
        </div>

        {services.length === 0 && !loading ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              サービスが登録されていません
            </CardContent>
          </Card>
        ) : services.length === 0 && loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {services.map((service) => (
              <Card key={service.id} className={!service.isActive ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{service.name}</CardTitle>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => toggleActive(service)}
                        className="group cursor-pointer"
                      >
                        <Badge
                          variant={service.isActive ? "success" : "secondary"}
                          className={service.isActive
                            ? "group-hover:bg-red-100 group-hover:text-red-700 group-hover:border-red-300 transition-colors"
                            : "group-hover:bg-green-100 group-hover:text-green-700 group-hover:border-green-300 transition-colors"
                          }
                        >
                          <span className="group-hover:hidden">{service.isActive ? "有効" : "無効"}</span>
                          <span className="hidden group-hover:inline">{service.isActive ? "無効にする" : "有効にする"}</span>
                        </Badge>
                      </button>
                      <Link href={"/plans?serviceId=" + service.id} prefetch={false}>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          プラン追加
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => openEditModal(service)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        編集
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(service)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {service.plans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      プランが登録されていません
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">プラン名</th>
                          <th className="text-left py-2 px-4">用途タグ</th>
                          <th className="text-left py-2 px-4">料金</th>
                          <th className="text-left py-2 px-4">有効/無効</th>
                          <th className="text-right py-2 px-4">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {service.plans.map((plan) => (
                          <tr key={plan.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{plan.name}</td>
                            <td className="py-2 px-4">
                              <div className="flex gap-1 flex-wrap">
                                {plan.usageTags.length > 0 ? (
                                  plan.usageTags.map((pt) => (
                                    <Badge key={pt.usageTag.id} variant="secondary">
                                      {pt.usageTag.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4">
                              {getPriceDisplay(plan.pricings)}
                            </td>
                            <td className="py-2 px-4">
                              <button
                                onClick={() => togglePlanActive(plan)}
                                className="group cursor-pointer"
                              >
                                <Badge
                                  variant={plan.isActive ? "success" : "secondary"}
                                  className={plan.isActive
                                    ? "group-hover:bg-red-100 group-hover:text-red-700 group-hover:border-red-300 transition-colors"
                                    : "group-hover:bg-green-100 group-hover:text-green-700 group-hover:border-green-300 transition-colors"
                                  }
                                >
                                  <span className="group-hover:hidden">{plan.isActive ? "有効" : "無効"}</span>
                                  <span className="hidden group-hover:inline">{plan.isActive ? "無効にする" : "有効にする"}</span>
                                </Badge>
                              </button>
                            </td>
                            <td className="py-2 px-4 text-right">
                              <Link href={"/plans/" + plan.id} prefetch={false}>
                                <Button variant="ghost" size="sm">
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingService ? "サービス編集" : "新規サービス登録"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    コード
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="buppan"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    一意の識別コード（例: buppan, versus, avaris）
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    サービス名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="物販サービス"
                    required
                  />
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
