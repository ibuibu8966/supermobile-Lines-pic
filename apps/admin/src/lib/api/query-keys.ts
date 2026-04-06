/** 用途別の staleTime 定数（ms） */
export const STALE_TIMES = {
  /** ダッシュボード統計など、1分ごとに新鮮さを確認 */
  STATS: 60_000,
  /** SIM履歴など、30秒間はキャッシュをfreshに保つ */
  SHORT: 30_000,
  /** 申込・回線・SIM一覧など、30秒間はHydrationBoundaryのデータをfreshとして使う */
  LIST: 30_000,
  /** services/plans/tags などマスターデータはセッション中に変わらない */
  MASTER: Infinity,
} as const;

export const queryKeys = {
  dashboardStats: ["dashboardStats"] as const,
  services: ["services"] as const,
  plans: ["plans"] as const,
  usageTags: ["usageTags"] as const,
  simLocationTags: ["simLocationTags"] as const,
  lineReserveTags: ["lineReserveTags"] as const,
  lineTags: ["lineTags"] as const,
  referrerTags: ["referrerTags"] as const,
  users: ["users"] as const,
  coupons: ["coupons"] as const,
  couponsWithRelations: ["couponsWithRelations"] as const,
  suppliers: ["suppliers"] as const,
  sims: (filters?: Record<string, string>) => ["sims", filters] as const,
  applications: (filters?: Record<string, string>) => ["applications", filters] as const,
  lines: (filters?: Record<string, string>) => ["lines", filters] as const,
  linesWithTags: (filters?: Record<string, string>) => ["linesWithTags", filters] as const,
  profitLoss: (year: number, month: number) => ["profit-loss", year, month] as const,
  procurement: ["procurement"] as const,
  procurementSims: (purchaseOrderId: string) => ["procurement-sims", purchaseOrderId] as const,
  applicationKyc: (applicationId: string) => ["application-kyc", applicationId] as const,
  inStockIccids: ["inStockIccids"] as const,
  applicationDetail: (id: string) => ["application", id] as const,
};
