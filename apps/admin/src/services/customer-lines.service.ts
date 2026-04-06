/**
 * Customer lines service
 */

import { PrismaClient } from "@/lib/database";
import { CustomerLinesResult, CustomerLine } from "@/entities";
import { NotFoundError } from "@/shared/errors/custom-errors";
import { logger } from "@/shared/utils/logger";

export class CustomerLinesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all lines for a customer
   */
  async getCustomerLines(userId: string): Promise<CustomerLinesResult> {
    // Fetch customer by userId
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundError("顧客情報が見つかりません");
    }

    // Fetch all lines from customer's applications
    const lines = await this.prisma.applicationLine.findMany({
      where: {
        application: {
          customerId: customer.id,
        },
      },
      include: {
        application: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    logger.info("Customer lines retrieved", { 
      userId, 
      customerId: customer.id,
      lineCount: lines.length 
    });

    return { lines: lines as unknown as CustomerLine[] };
  }
}
