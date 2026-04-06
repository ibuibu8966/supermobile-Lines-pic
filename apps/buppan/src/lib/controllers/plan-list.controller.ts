/**
 * Plan list controller
 */

import { NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { PlanListService } from "../services/plan-list.service";
import { handleApiError } from "../shared/errors/api-errors";

export async function getServicePlans(
  prisma: PrismaClient,
  serviceCode: string
) {
  try {
    const service = new PlanListService(prisma);
    const plans = await service.getPlans(serviceCode);

    return NextResponse.json(plans);
  } catch (error) {
    return handleApiError(error);
  }
}
