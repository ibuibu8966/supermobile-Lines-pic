import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";
import { CouponsClient } from "./coupons-client";

export default async function CouponsPage() {
  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.couponsWithRelations,
      queryFn: async () => {
        const [services, plans, coupons] = await Promise.all([
          prisma.service.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: "asc" },
          }),
          prisma.plan.findMany({
            select: {
              id: true,
              name: true,
              serviceId: true,
              isActive: true,
              service: { select: { id: true, code: true, name: true } },
              pricings: {
                select: { id: true, minQuantity: true, maxQuantity: true, unitPrice: true },
                orderBy: { minQuantity: "asc" },
              },
            },
            orderBy: { name: "asc" },
          }),
          prisma.coupon.findMany({
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  service: { select: { id: true, code: true, name: true } },
                },
              },
              pricings: {
                orderBy: { minQuantity: "asc" },
              },
              _count: { select: { applications: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);
        return { services, plans, coupons };
      },
      staleTime: STALE_TIMES.MASTER,
    });
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CouponsClient />
    </HydrationBoundary>
  );
}
