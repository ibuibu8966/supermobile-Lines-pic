import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.services,
      queryFn: () =>
        prisma.service.findMany({
          include: {
            plans: {
              include: {
                usageTags: { include: { usageTag: true } },
                pricings: { orderBy: { minQuantity: "asc" } },
              },
              orderBy: { name: "asc" },
            },
            _count: { select: { plans: true, applications: true, users: true } },
          },
          orderBy: { name: "asc" },
        }),
      staleTime: STALE_TIMES.MASTER,
    });
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ServicesClient />
    </HydrationBoundary>
  );
}
