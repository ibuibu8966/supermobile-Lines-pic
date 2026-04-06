import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { PlanDetailClient } from "./plan-detail-client";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["plan", id],
        queryFn: () =>
          prisma.plan.findUnique({
            where: { id },
            include: {
              service: { select: { id: true, code: true, name: true } },
              usageTags: { include: { usageTag: true } },
              pricings: { orderBy: { minQuantity: "asc" } },
              _count: { select: { applications: true } },
            },
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: ["usageTags"],
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
      <PlanDetailClient id={id} />
    </HydrationBoundary>
  );
}
