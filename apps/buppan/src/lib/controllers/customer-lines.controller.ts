/**
 * Customer lines controller
 */

import { NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { CustomerLinesService } from "../services/customer-lines.service";
import { handleApiError } from "../shared/errors/api-errors";

export async function getCustomerLines(
  prisma: PrismaClient,
  authFn: () => Promise<{ user?: { id?: string } } | null>
) {
  try {
    // Authenticate
    const session = await authFn();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Get customer lines
    const service = new CustomerLinesService(prisma);
    const result = await service.getCustomerLines(session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
