import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { ProcurementService } from "@/services/procurement.service";
import { TagCrudService } from "@/services/tag-crud.service";
import { ProcurementClient } from "./procurement-client";

export const metadata = {
  title: "仕入れ(支出)管理 | SIM統合管理システム",
};

export default async function ProcurementPage() {
  const queryClient = new QueryClient();

  try {
    const service = new ProcurementService(prisma);
    const supplierService = new TagCrudService(prisma, {
      tableName: "supplier",
      displayName: "仕入れ先",
      usageTableName: "sim",
      usageColumnName: "supplierId",
      includeFields: { _count: { select: { sims: true } } },
      orderBy: [{ name: "asc" }],
    });

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.procurement,
        queryFn: () => service.getAllPurchaseOrders(),
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
      <ProcurementClient />
    </HydrationBoundary>
  );
}
