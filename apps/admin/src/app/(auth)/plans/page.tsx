import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { PlansClient } from "./plans-client";

export default async function PlansPage() {
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.plans,
        queryFn: () =>
          prisma.plan.findMany({
            include: {
              service: { select: { id: true, code: true, name: true } },
              usageTags: { include: { usageTag: true } },
              pricings: { orderBy: { minQuantity: "asc" } },
              _count: { select: { applications: true } },
            },
            orderBy: [{ service: { name: "asc" } }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.services,
        queryFn: () =>
          prisma.service.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: "asc" },
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.usageTags,
        queryFn: () =>
          prisma.usageTag.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
    ]);
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlansClient />
    </HydrationBoundary>
  );
}
