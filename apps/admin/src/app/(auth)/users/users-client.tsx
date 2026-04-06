"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, X, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";
  serviceId: string | null;
  service: { id: string; code: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  customers?: Array<{
    type: "INDIVIDUAL" | "CORPORATE";
    lastName: string;
    firstName: string;
    companyName: string | null;
  }>;
  _count: {
    customers: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "顧客",
  EMPLOYEE: "従業員",
  ADMIN: "管理者",
  SUPER_ADMIN: "スーパー管理者",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  CUSTOMER: "secondary",
  EMPLOYEE: "outline",
  ADMIN: "default",
  SUPER_ADMIN: "warning",
};

const USERS_QUERY_KEY = ["users", { includeInactive: "true" }] as const;

export function UsersClient() {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const isSuperAdmin = sessionData?.user?.role === "SUPER_ADMIN" || sessionData?.user?.role === "EMPLOYEE";

  // Services from cache (prefetched at login)
  const { data: services = [] } = useQuery<{ id: string; code: string; name: string }[]>({
    queryKey: queryKeys.services,
    queryFn: api.getServices as () => Promise<{ id: string; code: string; name: string }[]>,
  });

  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [filterRole, setFilterRole] = useQueryState("role", { defaultValue: "" });
  const [filterServiceId, setFilterServiceId] = useQueryState("service", { defaultValue: "" });

  // 全ユーザー取得（有効・無効両方）
  const { data: allUsers = [], isLoading: isLoadingUsers, error: fetchError } = useQuery<User[]>({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => {
      const params = new URLSearchParams({ includeInactive: "true" });
      return api.getUsers(params) as unknown as Promise<User[]>;
    },
    staleTime: STALE_TIMES.LIST,
  });

  // クライアントサイドフィルタリング
  const users = useMemo(() => {
    let filtered = allUsers.filter((u) =>
      activeTab === "active" ? u.isActive : !u.isActive
    );
    if (filterRole) {
      filtered = filtered.filter((u) => u.role === filterRole);
    }
    if (filterServiceId) {
      filtered = filtered.filter((u) => u.service?.id === filterServiceId);
    }
    return filtered;
  }, [allUsers, activeTab, filterRole, filterServiceId]);

  // モーダル状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "EMPLOYEE" as "CUSTOMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN",
    serviceId: "" as string | null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      name: "",
      password: "",
      role: "EMPLOYEE",
      serviceId: null,
    });
    setShowPassword(false);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name || "",
      password: "",
      role: user.role,
      serviceId: user.serviceId,
    });
    setShowPassword(false);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        email: formData.email,
        name: formData.name || null,
        role: formData.role,
        serviceId: formData.serviceId || null,
      };

      // 新規作成時はパスワード必須
      if (!editingUser) {
        if (!formData.password) {
          setError("パスワードを入力してください");
          setSaving(false);
          return;
        }
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
        toast.success(editingUser ? "ユーザーを更新しました" : "ユーザーを作成しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.users });
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`「${user.email}」を削除しますか？\n\n※顧客が紐付いている場合は無効化されます。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("ユーザーを削除しました");
        queryClient.invalidateQueries({ queryKey: queryKeys.users });
      } else {
        const data = await res.json();
        toast.error(data.error || "削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const toggleActive = async (user: User) => {
    // 楽観的更新（正しいqueryKeyで更新）
    queryClient.setQueryData<User[]>(USERS_QUERY_KEY as unknown as readonly string[], (old) => {
      if (!old) return old;
      return old.map((u) =>
        u.id === user.id ? { ...u, isActive: !u.isActive } : u
      );
    });

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (res.ok) {
        toast.success(user.isActive ? "ユーザーを無効化しました" : "ユーザーを有効化しました");
      } else {
        throw new Error("更新に失敗しました");
      }
    } catch {
      toast.error("ステータスの変更に失敗しました");
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {fetchError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4" />
          データの取得に失敗しました。再度お試しください。
        </div>
      )}

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
            新規ユーザー作成
          </Button>
        </div>

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {isSuperAdmin && (
                  <>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">全ロール</option>
                      <option value="SUPER_ADMIN">スーパー管理者</option>
                      <option value="ADMIN">管理者</option>
                      <option value="EMPLOYEE">従業員</option>
                      <option value="CUSTOMER">顧客</option>
                    </select>
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
                  </>
                )}
              </div>
              <span className="text-sm text-gray-500">{users.length}件</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 overflow-auto">
            {users.length === 0 && !isLoadingUsers ? (
              <div className="text-center py-12 px-6 text-gray-500">
                ユーザーが登録されていません
              </div>
            ) : users.length === 0 && isLoadingUsers ? (
              <div className="flex justify-center py-12 px-6">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">メールアドレス</th>
                      <th className="text-left py-3 px-4">名前</th>
                      <th className="text-left py-3 px-4">ロール</th>
                      <th className="text-left py-3 px-4">サービス</th>
                      <th className="text-left py-3 px-4">顧客数</th>
                      <th className="text-left py-3 px-4">状態</th>
                      <th className="text-right py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b hover:bg-gray-50 ${!user.isActive ? "opacity-60" : ""}`}
                      >
                        <td className="py-3 px-4 font-medium">{user.email}</td>
                        <td className="py-3 px-4">
                          {user.role === "CUSTOMER" && user.customers?.[0] ? (
                            <span>
                              {user.customers[0].type === "CORPORATE" && user.customers[0].companyName
                                ? user.customers[0].companyName
                                : `${user.customers[0].lastName} ${user.customers[0].firstName}`}
                            </span>
                          ) : user.name ? (
                            <span>{user.name}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={ROLE_VARIANTS[user.role]}>
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {user.service ? (
                            <Badge variant="outline">{user.service.name}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {user._count.customers > 0 ? (
                            `${user._count.customers}件`
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => toggleActive(user)}>
                            <Badge variant={user.isActive ? "success" : "secondary"}>
                              {user.isActive ? "有効" : "無効"}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user)}
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
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingUser ? "ユーザー編集" : "新規ユーザー作成"}
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
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                {/* 名前フィールド（従業員・管理者・スーパー管理者のみ） */}
                {(formData.role === "EMPLOYEE" || formData.role === "ADMIN" || formData.role === "SUPER_ADMIN") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名前
                      {editingUser && (
                        <span className="text-gray-400 font-normal ml-2">（任意）</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="例: 山田 太郎"
                      required={!editingUser}
                    />
                  </div>
                )}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      パスワード
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-md pr-10"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">8文字以上</p>
                  </div>
                )}
                {isSuperAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ロール
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            role: e.target.value as "CUSTOMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN",
                          })
                        }
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      >
                        <option value="EMPLOYEE">従業員</option>
                        <option value="ADMIN">管理者</option>
                        <option value="SUPER_ADMIN">スーパー管理者</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属サービス
                        {formData.role === "SUPER_ADMIN" && (
                          <span className="text-gray-400 font-normal ml-2">
                            （スーパー管理者は全サービス管理可）
                          </span>
                        )}
                      </label>
                      <select
                        value={formData.serviceId || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serviceId: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">未設定</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
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
