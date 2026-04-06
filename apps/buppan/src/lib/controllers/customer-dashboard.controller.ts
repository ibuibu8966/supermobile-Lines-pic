/**
 * Customer dashboard controller
 */

import { NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { CustomerDashboardService } from "../services/customer-dashboard.service";
import { handleApiError } from "../shared/errors/api-errors";

export async function getCustomerDashboard(
  prisma: PrismaClient,
  authFn: () => Promise<{ user?: { id?: string } } | null>
) {
  try {
    // Authenticate
    const session = await authFn();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Get dashboard data
    const service = new CustomerDashboardService(prisma);
    const result = await service.getCustomerDashboard(session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
