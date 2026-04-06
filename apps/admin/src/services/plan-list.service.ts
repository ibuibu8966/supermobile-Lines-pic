/**
 * Plan list service
 */

import { PrismaClient } from "@/lib/database";
import { PlanListResult } from "@/entities";
import { NotFoundError } from "@/shared/errors/custom-errors";
import { logger } from "@/shared/utils/logger";

export class PlanListService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get active plans for a service code
   */
  async getPlans(serviceCode: string): Promise<PlanListResult> {
    // Fetch service by code
    const service = await this.prisma.service.findUnique({
      where: { code: serviceCode },
    });

    if (!service) {
      throw new NotFoundError("サービスが見つかりません");
    }

    // Fetch active plans with pricings and usage tags
    const plans = await this.prisma.plan.findMany({
      where: {
        serviceId: service.id,
        isActive: true,
      },
      include: {
        usageTags: {
          include: {
            usageTag: true,
          },
        },
        pricings: {
          orderBy: { minQuantity: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    logger.info("Plans retrieved", { serviceCode, planCount: plans.length });

    return plans as unknown as PlanListResult;
  }
}
