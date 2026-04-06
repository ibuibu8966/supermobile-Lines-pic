/** fetch ラッパー: 4xx/5xx をエラーとして throw する */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error ?? `HTTP ${res.status}: ${url}`);
  }
  return res.json();
}

// ---- 共通型定義 ----

export interface BaseTag {
  id: number;
  code?: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  category?: string | null;
  description?: string | null;
  _count?: Record<string, number>;
}

export interface ServiceItem {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface PlanItem {
  id: string;
  name: string;
  code?: string;
  serviceId?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface SupplierItem {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  _count?: { sims: number };
}

export interface CouponItem {
  id: string;
  code: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface UserItem {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface DashboardStats {
  overview: {
    totalInStockSims: number;
    totalActiveLines: number;
    totalReturningLines: number;
  };
  simInventoryByUsageTag: Array<{
    usageTagId: number;
    usageTagCode: string;
    usageTagName: string;
    availableCount: number;
  }>;
  activeLinesByPlan: Array<{
    planId: string;
    planCode: string;
    planName: string;
    serviceName: string;
    activeCount: number;
  }>;
}

// ---- API クライアント ----

export const api = {
  getDashboardStats: (): Promise<DashboardStats> =>
    fetchJson<DashboardStats>("/api/dashboard/stats"),
  getServices: (): Promise<ServiceItem[]> =>
    fetchJson<ServiceItem[]>("/api/services"),
  getPlans: (): Promise<PlanItem[]> =>
    fetchJson<PlanItem[]>("/api/plans"),
  getUsageTags: (): Promise<BaseTag[]> =>
    fetchJson<BaseTag[]>("/api/usage-tags"),
  getSimLocationTags: (): Promise<BaseTag[]> =>
    fetchJson<BaseTag[]>("/api/sim-location-tags"),
  getLineReserveTags: (): Promise<BaseTag[]> =>
    fetchJson<BaseTag[]>("/api/line-reserve-tags"),
  getLineTags: (): Promise<BaseTag[]> =>
    fetchJson<BaseTag[]>("/api/line-tags"),
  getReferrerTags: (): Promise<BaseTag[]> =>
    fetchJson<BaseTag[]>("/api/referrer-tags"),
  getUsers: (params?: URLSearchParams): Promise<UserItem[]> => {
    const qs = params?.toString();
    return fetchJson<UserItem[]>(`/api/users${qs ? `?${qs}` : ""}`);
  },
  getSuppliers: (): Promise<SupplierItem[]> =>
    fetchJson<SupplierItem[]>("/api/suppliers"),
  getCoupons: (): Promise<CouponItem[]> =>
    fetchJson<CouponItem[]>("/api/coupons"),
  getCouponsWithRelations: (): Promise<unknown> =>
    fetchJson<unknown>("/api/coupons-with-relations"),
  getSims: (params?: URLSearchParams): Promise<unknown> =>
    fetchJson<unknown>(`/api/sims?${params?.toString() || "page=1"}`),
  getApplications: (params?: URLSearchParams): Promise<unknown> =>
    fetchJson<unknown>(`/api/applications?${params?.toString() || "page=1"}`),
  getLines: (params?: URLSearchParams): Promise<unknown> =>
    fetchJson<unknown>(`/api/lines?${params?.toString() || "page=1"}`),
  getLinesWithTags: (params?: URLSearchParams): Promise<unknown> =>
    fetchJson<unknown>(`/api/lines-with-tags?${params?.toString() || "page=1"}`),
  getInStockIccids: (): Promise<{ iccids: string[] }> =>
    fetchJson<{ iccids: string[] }>("/api/sims/in-stock-iccids"),
  getApplicationById: (id: string): Promise<unknown> =>
    fetchJson<unknown>(`/api/applications/${id}`),
};
