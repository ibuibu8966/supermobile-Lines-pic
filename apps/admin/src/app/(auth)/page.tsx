import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import { prisma } from "@/lib/database";

async function fetchDashboardStats() {
  const [overviewResult, simByUsageTag, activeLinesByPlan, unitCostBySupplier] = await Promise.all([
    prisma.$queryRaw<Array<{ in_stock: bigint; active: bigint }>>`
      SELECT
        (
          SELECT COUNT(*) FROM "Sim" s
          WHERE NOT EXISTS (
            SELECT 1 FROM "ApplicationLine" al
            WHERE al."simId" = s.iccid
              AND al.status IN ('ACTIVATED', 'SHIPPED')
              AND al."updatedAt" = (
                SELECT MAX(al2."updatedAt") FROM "ApplicationLine" al2 WHERE al2."simId" = s.iccid
              )
          )
        ) as in_stock,
        (SELECT COUNT(*) FROM "ApplicationLine" WHERE status = 'ACTIVATED') as active
    `,
    // 用途タグ別: そのタグを消費していない在庫SIMをカウント
    prisma.$queryRaw<Array<{
      tagId: number;
      tagName: string;
      availableCount: bigint;
    }>>`
      SELECT
        ut.id as "tagId",
        ut.name as "tagName",
        COUNT(s.iccid) as "availableCount"
      FROM "UsageTag" ut
      CROSS JOIN "Sim" s
      WHERE NOT EXISTS (
        SELECT 1 FROM "ApplicationLine" al
        WHERE al."simId" = s.iccid
          AND al.status IN ('ACTIVATED', 'SHIPPED')
          AND al."updatedAt" = (
            SELECT MAX(al2."updatedAt") FROM "ApplicationLine" al2 WHERE al2."simId" = s.iccid
          )
      )
        AND NOT (s."consumedTagIds" @> ARRAY[ut.id])
        AND ut."isActive" = true
      GROUP BY ut.id, ut.name
      ORDER BY ut."displayOrder" ASC
    `,
    prisma.$queryRaw<Array<{
      planId: string;
      planName: string;
      serviceName: string;
      activeCount: bigint;
    }>>`
      SELECT
        p.id as "planId",
        p.name as "planName",
        s.name as "serviceName",
        COUNT(al.id) as "activeCount"
      FROM "ApplicationLine" al
      JOIN "Application" a ON al."applicationId" = a.id
      JOIN "Plan" p ON a."planId" = p.id
      JOIN "Service" s ON p."serviceId" = s.id
      WHERE al.status = 'ACTIVATED'
      GROUP BY p.id, p.name, s.name
      ORDER BY "activeCount" DESC
    `,
    prisma.$queryRaw<Array<{
      supplier_name: string;
      included_total: bigint;
      sim_qty: bigint;
    }>>`
      SELECT
        COALESCE(s.name, '不明') as supplier_name,
        SUM(CASE WHEN pol."isIncludedInUnitCost" THEN pol.subtotal ELSE 0 END) as included_total,
        SUM(CASE WHEN pol."carrierType" IS NOT NULL THEN pol.quantity ELSE 0 END) as sim_qty
      FROM "PurchaseOrder" po
      JOIN "PurchaseOrderLine" pol ON po.id = pol."purchaseOrderId"
      LEFT JOIN "Supplier" s ON po."supplierId" = s.id
      WHERE po.type = 'PURCHASE_ORDER'
      GROUP BY s.name
      HAVING SUM(CASE WHEN pol."carrierType" IS NOT NULL THEN pol.quantity ELSE 0 END) > 0
    `,
  ]);

  const totalInStockSims = Number(overviewResult[0]?.in_stock ?? 0);
  const totalActiveLines = Number(overviewResult[0]?.active ?? 0);

  return {
    overview: { totalInStockSims, totalActiveLines },
    simInventoryByUsageTag: simByUsageTag.map((row) => ({
      usageTagId: row.tagId,
      usageTagName: row.tagName,
      availableCount: Number(row.availableCount),
    })),
    activeLinesByPlan: activeLinesByPlan.map((item) => ({
      ...item,
      activeCount: Number(item.activeCount),
    })),
    unitCostBySupplier: unitCostBySupplier.map((row) => ({
      supplierName: row.supplier_name,
      includedTotal: Number(row.included_total),
      simQuantity: Number(row.sim_qty),
      unitCost: Number(row.sim_qty) > 0 ? Math.round(Number(row.included_total) / Number(row.sim_qty)) : null,
    })),
  };
}

export default async function DashboardPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: fetchDashboardStats,
    staleTime: STALE_TIMES.STATS,
  });

  return (
    <div className="p-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardStats />
      </HydrationBoundary>
    </div>
  );
}
