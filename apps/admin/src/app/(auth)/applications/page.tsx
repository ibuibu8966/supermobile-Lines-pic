import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { ApplicationService } from "@/services/application.service";
import { ApplicationRepository } from "@/repositories/application.repository";
import { ServiceService } from "@/services/service.service";
import { ServiceRepository } from "@/repositories/service.repository";
import { ApplicationsClient } from "./applications-client";

export default async function ApplicationsPage() {
  const queryClient = new QueryClient();

  try {
    // サーバーサイドで認証チェック
    const sessionResult = await getAdminSession();
    if (!(sessionResult instanceof Response)) {
      const session = sessionResult;
      const applicationService = new ApplicationService(
        new ApplicationRepository(prisma)
      );
      const serviceService = new ServiceService(new ServiceRepository(prisma));

      await Promise.all([
        // デフォルト状態（全完了案件を非表示、1ページ目）をプリフェッチ
        queryClient.prefetchQuery({
          queryKey: queryKeys.applications({ hideFullyCompleted: "true", page: "1" }),
          queryFn: () =>
            applicationService
              .getApplicationList(
                { hideFullyCompleted: true },
                { page: 1, pageSize: 50, skip: 0 },
                session
              )
              .then((result) => ({
                data: result.applications,
                pagination: {
                  page: result.pagination.currentPage,
                  pageSize: result.pagination.limit,
                  total: result.pagination.totalCount,
                  totalPages: result.pagination.totalPages,
                },
              })),
          staleTime: STALE_TIMES.LIST,
        }),
        // サービス一覧（フィルター用マスターデータ）
        queryClient.prefetchQuery({
          queryKey: queryKeys.services,
          queryFn: () => serviceService.getServiceList({}),
          staleTime: STALE_TIMES.MASTER,
        }),
        // スタッフ一覧（担当者フィルター用）
        queryClient.prefetchQuery({
          queryKey: ["users", "staff"],
          queryFn: () =>
            prisma.user.findMany({
              where: { role: { in: ["SUPER_ADMIN", "EMPLOYEE"] } },
              select: { id: true, name: true, email: true, role: true },
              orderBy: { name: "asc" },
            }),
          staleTime: STALE_TIMES.MASTER,
        }),
        // 紹介者タグ（ワークフロー用）
        queryClient.prefetchQuery({
          queryKey: queryKeys.referrerTags,
          queryFn: () =>
            prisma.referrerTag.findMany({
              where: { isActive: true },
              orderBy: { displayOrder: "asc" },
            }),
          staleTime: STALE_TIMES.MASTER,
        }),
      ]);
    }
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  );
}
