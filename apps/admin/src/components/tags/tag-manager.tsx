"use client";

import { useState, useMemo, useEffect } from "react";
import type { BaseTag } from "@/lib/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

// Form field configuration
interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  required?: boolean;
}

// Component configuration
export interface TagManagerConfig {
  apiEndpoint: string;
  queryKey: readonly string[];
  queryFn: () => Promise<BaseTag[]>;
  title: string;
  emptyMessage: string;
  formFields: FormField[];
  renderCount: (count: Record<string, number>) => string;
  hasCategoryGrouping?: boolean;
  labels: {
    createButton: string;
    modalCreateTitle: string;
    modalEditTitle: string;
  };
}

interface TagManagerProps {
  config: TagManagerConfig;
  createTrigger?: number;
}

export function TagManager({ config, createTrigger }: TagManagerProps) {
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);

  // TanStack Query - tags (prefetched at login)
  const { data: tagsData = [], isLoading } = useQuery<BaseTag[]>({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
  });

  // フィルター適用
  const tags = useMemo(() => {
    if (showInactive) return tagsData;
    return tagsData.filter((t) => t.isActive);
  }, [tagsData, showInactive]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BaseTag | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Watch for create trigger from parent
  useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      openCreateModal();
    }
  }, [createTrigger]);

  const initFormData = (tag?: BaseTag) => {
    const data: Record<string, string | number> = {};
    config.formFields.forEach((field) => {
      if (tag) {
        const tagRecord = tag as unknown as Record<string, string | number | null | undefined>;
        data[field.name] = tagRecord[field.name] ?? (field.type === "number" ? 0 : "");
      } else {
        data[field.name] = field.type === "number" ? (field.name === "displayOrder" ? tags.length : 0) : "";
      }
    });
    return data;
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormData(initFormData());
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tag: BaseTag) => {
    setEditingTag(tag);
    setFormData(initFormData(tag));
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTag(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingTag
        ? `${config.apiEndpoint}/${editingTag.id}`
        : config.apiEndpoint;
      const method = editingTag ? "PATCH" : "POST";

      // Process form data - convert empty strings to null for optional fields
      const processedData: Record<string, unknown> = {};
      config.formFields.forEach((field) => {
        const value = formData[field.name];
        if (field.type === "number") {
          processedData[field.name] = typeof value === "number" ? value : parseInt(value as string) || 0;
        } else if (value === "" && !field.required) {
          processedData[field.name] = null;
        } else {
          processedData[field.name] = value;
        }
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processedData),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
        toast.success(editingTag ? "タグを更新しました" : "タグを作成しました");
        queryClient.invalidateQueries({ queryKey: config.queryKey });
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: BaseTag) => {
    if (!confirm(`「${tag.name}」を削除しますか？\n\n※使用中の場合は無効化されます。`)) {
      return;
    }

    try {
      const res = await fetch(`${config.apiEndpoint}/${tag.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("タグを削除しました");
        queryClient.invalidateQueries({ queryKey: config.queryKey });
      } else {
        const data = await res.json();
        toast.error(data.error || "削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const toggleActive = async (tag: BaseTag) => {
    // 楽観的更新
    queryClient.setQueryData<BaseTag[]>(config.queryKey, (old) => {
      if (!old) return old;
      return old.map((t) =>
        t.id === tag.id ? { ...t, isActive: !t.isActive } : t
      );
    });

    try {
      const res = await fetch(`${config.apiEndpoint}/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tag.isActive }),
      });

      if (res.ok) {
        toast.success(tag.isActive ? "タグを無効化しました" : "タグを有効化しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    }
  };

  // Group tags by category (for usage tags)
  const groupedTags = config.hasCategoryGrouping
    ? tags.reduce<Record<string, BaseTag[]>>((acc, tag) => {
        const category = tag.category || "未分類";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(tag);
        return acc;
      }, {})
    : null;

  const renderTable = (tagsToRender: BaseTag[], showGripHandle = false) => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-white">
        <tr className="border-b">
          {showGripHandle && <th className="text-left py-2 px-4 w-8"></th>}
          <th className="text-left py-2 px-4">表示名</th>
          <th className="text-left py-2 px-4">使用数</th>
          <th className="text-left py-2 px-4">ステータス</th>
          <th className="text-right py-2 px-4">操作</th>
        </tr>
      </thead>
      <tbody>
        {tagsToRender.map((tag) => (
          <tr key={tag.id} className="border-b hover:bg-gray-50">
            {showGripHandle && (
              <td className="py-2 px-4">
                <GripVertical className="h-4 w-4 text-gray-300" />
              </td>
            )}
            <td className="py-2 px-4">
              <Badge variant="secondary">{tag.name}</Badge>
            </td>
            <td className="py-2 px-4 text-gray-500 text-xs">
              {config.renderCount(tag._count ?? {})}
            </td>
            <td className="py-2 px-4">
              <button onClick={() => toggleActive(tag)}>
                <Badge variant={tag.isActive ? "success" : "secondary"}>
                  {tag.isActive ? "有効" : "無効"}
                </Badge>
              </button>
            </td>
            <td className="py-2 px-4 text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(tag)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tag)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">
              {config.title}
              <span className="text-sm font-normal text-gray-500 ml-2">
                {tags.length}件
              </span>
            </CardTitle>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded cursor-pointer"
              />
              無効なタグも表示
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {config.emptyMessage}
            </div>
          ) : config.hasCategoryGrouping && groupedTags ? (
            <div className="space-y-6">
              {Object.entries(groupedTags).map(([category, categoryTags]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded">{category}</span>
                    <span className="text-xs">({categoryTags.length})</span>
                  </h3>
                  {renderTable(categoryTags, true)}
                </div>
              ))}
            </div>
          ) : (
            renderTable(tags)
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingTag ? config.labels.modalEditTitle : config.labels.modalCreateTitle}
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
                {config.formFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        value={formData[field.name] as string || ""}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        rows={2}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={formData[field.name] ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [field.name]: field.type === "number" ? parseInt(e.target.value) || 0 : e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
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
