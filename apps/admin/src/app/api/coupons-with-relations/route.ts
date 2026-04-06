import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

/**
 * クーポン・プラン・サービスを1リクエストで取得
 * パフォーマンス最適化のための統合エンドポイント
 */
export async function GET(request: NextRequest) {
  try {
    // 並列実行で高速化
    const [coupons, services, plans] = await Promise.all([
      // クーポン取得（プラン・サービス情報・料金テーブルを含む）
      prisma.coupon.findMany({
        include: {
          pricings: { orderBy: { minQuantity: "asc" } },
          plan: {
            include: {
              service: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
        orderBy: [
          { isActive: "desc" },
          { validUntil: "desc" },
        ],
      }),
      // サービス一覧（フィルター用）
      prisma.service.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),
      // プラン一覧（モーダル用、料金テーブル含む）
      prisma.plan.findMany({
        where: { isActive: true },
        include: {
          service: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          pricings: {
            orderBy: { minQuantity: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      coupons,
      services,
      plans,
    });
  } catch (error) {
    logger.logError("クーポン+リレーション取得エラー", error);
    return NextResponse.json(
      { error: "クーポンデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
