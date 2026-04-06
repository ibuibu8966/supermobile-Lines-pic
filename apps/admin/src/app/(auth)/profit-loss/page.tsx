import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { ProfitLossRepository } from "@/repositories/profit-loss.repository";
import { ProfitLossService } from "@/services/profit-loss.service";
import { ProfitLossClient } from "./profit-loss-client";

/** 現在の月度を判定（18日以降なら翌月度） */
function getCurrentPeriod() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() >= 18) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month };
}

function calculatePeriod(year: number, month: number) {
  const periodStart = new Date(Date.UTC(year, month - 2, 18, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month - 1, 18, 0, 0, 0));
  const periodLabel = `${year}年${month}月度`;
  return { periodStart, periodEnd, periodLabel };
}

export default async function ProfitLossPage() {
  const queryClient = new QueryClient();
  const { year, month } = getCurrentPeriod();

  try {
    const { periodStart, periodEnd, periodLabel } = calculatePeriod(year, month);
    const repository = new ProfitLossRepository(prisma);
    const service = new ProfitLossService(repository);

    await queryClient.prefetchQuery({
      queryKey: ["profit-loss", year, month],
      queryFn: () => service.getProfitLoss(periodStart, periodEnd, periodLabel),
      staleTime: STALE_TIMES.STATS,
    });
  } catch {
    // エラー時はクライアント側でフォールバック
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">損益管理</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProfitLossClient />
      </HydrationBoundary>
    </div>
  );
}
