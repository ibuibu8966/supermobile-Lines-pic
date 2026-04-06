import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { TagsClient } from "./tags-client";

export default async function TagsPage() {
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.usageTags,
        queryFn: () =>
          prisma.usageTag.findMany({
            include: { _count: { select: { contractTags: true, planTags: true } } },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.simLocationTags,
        queryFn: () =>
          prisma.simLocationTag.findMany({
            include: { _count: { select: { sims: true } } },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.lineTags,
        queryFn: () =>
          prisma.lineTag.findMany({
            include: { _count: { select: { applicationLines: true } } },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.lineReserveTags,
        queryFn: () =>
          prisma.lineReserveTag.findMany({
            include: { _count: { select: { applicationLines: true } } },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          }),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.referrerTags,
        queryFn: () =>
          prisma.referrerTag.findMany({
            include: { _count: { select: { customers: true } } },
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
      <TagsClient />
    </HydrationBoundary>
  );
}
