"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/lib/api/query-keys";
import type { ProfitLossData } from "@/types/profit-loss";

export function useProfitLoss(year: number, month: number) {
  return useQuery<ProfitLossData>({
    queryKey: ["profit-loss", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/profit-loss?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("損益データの取得に失敗しました");
      return res.json();
    },
    staleTime: STALE_TIMES.STATS,
  });
}
