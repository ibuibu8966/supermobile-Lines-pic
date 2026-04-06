import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { SimService } from "@/services/sim.service";
import { SimRepository } from "@/repositories/sim.repository";
import { TagCrudService } from "@/services/tag-crud.service";
import { SimsClient } from "./sims-client";

export const metadata = {
  title: "SIM管理 | SIM統合管理システム",
};

export default async function SimsPage() {
  const queryClient = new QueryClient();

  try {
    const simService = new SimService(new SimRepository(prisma), prisma);
    const simLocationTagService = new TagCrudService(prisma, {
      tableName: "simLocationTag",
      displayName: "設置場所タグ",
      includeFields: { _count: { select: { sims: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const usageTagService = new TagCrudService(prisma, {
      tableName: "usageTag",
      displayName: "用途タグ",
      usageTableName: "contractUsageTag",
      usageColumnName: "usageTagId",
      includeFields: { _count: { select: { contractTags: true, planTags: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const supplierService = new TagCrudService(prisma, {
      tableName: "supplier",
      displayName: "仕入れ先",
      usageTableName: "sim",
      usageColumnName: "supplierId",
      includeFields: { _count: { select: { sims: true } } },
      orderBy: [{ name: "asc" }],
    });

    await Promise.all([
      // SIM一覧（フィルターなし、1ページ目）
      queryClient.prefetchQuery({
        queryKey: queryKeys.sims({ page: "1" }),
        queryFn: () =>
          simService
            .getSimList({}, { page: 1, pageSize: 50, skip: 0 })
            .then((result) => ({
              data: result.sims,
              pagination: result.pagination,
            })),
        staleTime: STALE_TIMES.LIST,
      }),
      // マスターデータ（フィルター用・MASTER = Infinity）
      queryClient.prefetchQuery({
        queryKey: queryKeys.simLocationTags,
        queryFn: () => simLocationTagService.getTagList(),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.usageTags,
        queryFn: () => usageTagService.getTagList(),
        staleTime: STALE_TIMES.MASTER,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.suppliers,
        queryFn: () => supplierService.getTagList(),
        staleTime: STALE_TIMES.MASTER,
      }),
    ]);
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SimsClient />
    </HydrationBoundary>
  );
}
