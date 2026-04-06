"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";

interface Supplier {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  _count: {
    sims: number;
  };
}

interface SupplierManagerProps {
  hideControls?: boolean;
  showInactive?: boolean;
  onShowInactiveChange?: (value: boolean) => void;
  isCreateDialogOpen?: boolean;
  onCreateDialogChange?: (open: boolean) => void;
}

export function SupplierManager({
  hideControls = false,
  showInactive: externalShowInactive,
  onShowInactiveChange,
  isCreateDialogOpen: externalIsCreateDialogOpen,
  onCreateDialogChange,
}: SupplierManagerProps) {
  const queryClient = useQueryClient();
  const [internalShowInactive, setInternalShowInactive] = useState(false);

  const showInactive = externalShowInactive ?? internalShowInactive;
  const handleShowInactiveChange = (checked: boolean) => {
    if (onShowInactiveChange) {
      onShowInactiveChange(checked);
    } else {
      setInternalShowInactive(checked);
    }
  };

  // TanStack Query - suppliers (prefetched at login)
  const { data: suppliersData = [], isLoading } = useQuery<Supplier[]>({
    queryKey: queryKeys.suppliers,
    queryFn: api.getSuppliers as () => Promise<Supplier[]>,
  });

  // フィルター適用
  const suppliers = useMemo(() => {
    if (showInactive) return suppliersData;
    return suppliersData.filter((s) => s.isActive);
  }, [suppliersData, showInactive]);

  // Modal state
  const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);
  const isModalOpen = externalIsCreateDialogOpen ?? internalIsModalOpen;
  const setIsModalOpen = (open: boolean) => {
    if (onCreateDialogChange) {
      onCreateDialogChange(open);
    } else {
      setInternalIsModalOpen(open);
    }
  };

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({ name: "" });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ name: supplier.name });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormData({ name: "" });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingSupplier
        ? `/api/suppliers/${editingSupplier.id}`
        : "/api/suppliers";
      const method = editingSupplier ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
        toast.success(editingSupplier ? "仕入れ先を更新しました" : "仕入れ先を作成しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`「${supplier.name}」を削除しますか？\n\n※SIMが紐付いている場合は無効化されます。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("仕入れ先を削除しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      } else {
        const data = await res.json();
        toast.error(data.error || "削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const toggleActive = async (supplier: Supplier) => {
    // 楽観的更新
    queryClient.setQueryData<Supplier[]>(queryKeys.suppliers, (old) => {
      if (!old) return old;
      return old.map((s) =>
        s.id === supplier.id ? { ...s, isActive: !s.isActive } : s
      );
    });

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });

      if (res.ok) {
        toast.success(supplier.isActive ? "仕入れ先を無効化しました" : "仕入れ先を有効化しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
    }
  };

  return (
    <div>
      {!hideControls && (
        <div className="flex justify-between items-center mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => handleShowInactiveChange(e.target.checked)}
              className="rounded"
            />
            無効な仕入れ先も表示
          </label>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            新規仕入れ先登録
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            仕入れ先一覧
            <span className="text-sm font-normal text-gray-500 ml-2">
              {suppliers.length}件
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              仕入れ先が登録されていません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b">
                  <th className="text-left py-3 px-4">仕入れ先名</th>
                  <th className="text-left py-3 px-4">SIM数</th>
                  <th className="text-left py-3 px-4">ステータス</th>
                  <th className="text-right py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{supplier.name}</td>
                    <td className="py-3 px-4">{supplier._count.sims.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleActive(supplier)}>
                        <Badge variant={supplier.isActive ? "success" : "secondary"}>
                          {supplier.isActive ? "有効" : "無効"}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(supplier)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier)}
                        >
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingSupplier ? "仕入れ先編集" : "新規仕入れ先登録"}
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
                    仕入れ先名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="アーツ"
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
