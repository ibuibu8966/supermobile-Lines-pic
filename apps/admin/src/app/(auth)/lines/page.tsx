import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { LineService } from "@/services/line.service";
import { LineRepository } from "@/repositories/line.repository";
import { TagCrudService } from "@/services/tag-crud.service";
import { LinesClient } from "./lines-client";

export const metadata = {
  title: "総合回線管理 | SIM統合管理システム",
};

export default async function LinesPage() {
  const queryClient = new QueryClient();

  try {
    const lineService = new LineService(new LineRepository(prisma));
    const simLocationTagService = new TagCrudService(prisma, {
      tableName: "simLocationTag",
      displayName: "設置場所タグ",
      includeFields: { _count: { select: { sims: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const lineReserveTagService = new TagCrudService(prisma, {
      tableName: "lineReserveTag",
      displayName: "回線予約タグ",
      includeFields: { _count: { select: { applicationLines: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    // デフォルト状態（フィルターなし、1ページ目）をプリフェッチ
    await queryClient.prefetchQuery({
      queryKey: queryKeys.linesWithTags(undefined),
      queryFn: async () => {
        const [linesResult, simLocationTags, lineReserveTags] = await Promise.all([
          lineService.getLineList({}, { page: 1, pageSize: 20, skip: 0 }),
          simLocationTagService.getTagList(),
          lineReserveTagService.getTagList(),
        ]);
        return {
          lines: { data: linesResult.lines, pagination: linesResult.pagination },
          simLocationTags,
          lineReserveTags,
        };
      },
      staleTime: STALE_TIMES.LIST,
    });
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LinesClient />
    </HydrationBoundary>
  );
}
