import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { SimDetailClient } from "./sim-detail-client";

export default async function SimDetailPage({
  params,
}: {
  params: Promise<{ iccid: string }>;
}) {
  const { iccid } = await params;
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["sim", iccid],
        queryFn: () =>
          prisma.sim.findUnique({
            where: { iccid },
            include: {
              supplier: { select: { id: true, name: true } },
              simLocationTag: { select: { id: true, name: true } },
              contracts: {
                include: {
                  customer: {
                    select: { id: true, lastName: true, firstName: true, companyName: true, type: true },
                  },
                  usageTags: { include: { usageTag: true } },
                },
                orderBy: { createdAt: "desc" },
              },
              applicationLines: {
                include: {
                  application: {
                    select: { id: true, applicationNumber: true, isArchived: true, archivedAt: true },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          }),
        staleTime: STALE_TIMES.SHORT,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.usageTags,
        queryFn: () =>
          prisma.usageTag.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, category: true },
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
      <SimDetailClient iccid={iccid} />
    </HydrationBoundary>
  );
}
