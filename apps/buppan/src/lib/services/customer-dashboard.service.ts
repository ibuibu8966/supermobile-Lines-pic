/**
 * Customer dashboard service
 * 最適化: 2クエリ→1クエリ統合 + select最適化 + lineStats DB集計
 */

import { PrismaClient } from "@/lib/database";
import { CustomerDashboardResult } from "@/lib/entities";
import { logger } from "../shared/utils/logger";

export class CustomerDashboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get customer dashboard data
   * 1クエリでcustomer + applications + kycImages を取得
   * lineStatsはDB側でcount集計（JSのflatMap+filterを排除）
   */
  async getCustomerDashboard(userId: string): Promise<CustomerDashboardResult> {
    // 1クエリで全データ取得（select で必要カラムだけ）
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
      select: {
        id: true,
        type: true,
        email: true,
        phone: true,
        lastName: true,
        firstName: true,
        lastNameKana: true,
        firstNameKana: true,
        birthDate: true,
        postalCode: true,
        prefecture: true,
        city: true,
        address: true,
        building: true,
        companyName: true,
        companyNameKana: true,
        establishedDate: true,
        companyPostalCode: true,
        companyPrefecture: true,
        companyCity: true,
        companyAddress: true,
        companyBuilding: true,
        applications: {
          orderBy: { createdAt: "desc" as const },
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            lineCount: true,
            totalAmount: true,
            createdAt: true,
            updatedAt: true,
            plan: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              select: {
                id: true,
                msisdn: true,
                status: true,
              },
            },
            kycImages: {
              select: {
                id: true,
                type: true,
                status: true,
                expiryDate: true,
                issueDate: true,
                reviewedAt: true,
                reviewNote: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      logger.warn("Customer not found for user", { userId });
      return {
        customer: null,
        applications: [],
        lineStats: { active: 0, pending: 0, cancelled: 0 },
      };
    }

    // kycImagesは最新のapplicationから取得
    const kycImages = customer.applications[0]?.kycImages ?? [];

    // lineStats: DB側でcount集計（JSのflatMap+filterを排除）
    const [activeCount, pendingCount, cancelledCount] = await Promise.all([
      this.prisma.applicationLine.count({
        where: {
          application: { customerId: customer.id },
          status: { in: ["ACTIVATED", "SHIPPED", "SHIPPING_INSTRUCTED"] },
        },
      }),
      this.prisma.applicationLine.count({
        where: {
          application: { customerId: customer.id },
          status: "NOT_ACTIVATED",
        },
      }),
      this.prisma.applicationLine.count({
        where: {
          application: { customerId: customer.id },
          status: { in: ["CANCELLED", "RETURNED"] },
        },
      }),
    ]);

    // applicationsからkycImagesを除外（レスポンスに含めない）
    const applications = customer.applications.map(({ kycImages: _, ...app }) => app);

    logger.info("Customer dashboard retrieved", {
      userId,
      customerId: customer.id,
      applicationCount: applications.length,
    });

    return {
      customer: {
        id: customer.id,
        type: customer.type,
        email: customer.email,
        phone: customer.phone,
        lastName: customer.lastName,
        firstName: customer.firstName,
        lastNameKana: customer.lastNameKana,
        firstNameKana: customer.firstNameKana,
        birthDate: customer.birthDate,
        postalCode: customer.postalCode,
        prefecture: customer.prefecture,
        city: customer.city,
        address: customer.address,
        building: customer.building,
        companyName: customer.companyName,
        companyNameKana: customer.companyNameKana,
        establishedDate: customer.establishedDate,
        companyPostalCode: customer.companyPostalCode,
        companyPrefecture: customer.companyPrefecture,
        companyCity: customer.companyCity,
        companyAddress: customer.companyAddress,
        companyBuilding: customer.companyBuilding,
        kycImages,
      },
      applications,
      lineStats: {
        active: activeCount,
        pending: pendingCount,
        cancelled: cancelledCount,
      },
    };
  }
}
