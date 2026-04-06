import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { LineService } from "@/services/line.service";
import { LineRepository } from "@/repositories/line.repository";
import { TagCrudService } from "@/services/tag-crud.service";
import {
  parsePaginationParams,
  parseNumberArrayParam,
  parseArrayParam,
  parseBooleanParam,
  parseDateRange,
} from "@/shared/validators/validation";
import { logger } from "@/shared/utils/logger";

export const dynamic = "force-dynamic";

/**
 * 回線一覧 + タグ情報を並列取得
 * パフォーマンス最適化のため、3つのAPI呼び出しを1つにまとめる
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      search: searchParams.get("search") || undefined,
      simLocationTagIds: parseNumberArrayParam(searchParams.get("simLocationTagIds")),
      lineReserveTagIds: parseNumberArrayParam(searchParams.get("lineReserveTagIds")),
      statuses: parseArrayParam(searchParams.get("statuses")),
      includeArchived: parseBooleanParam(searchParams.get("includeArchived")),
      shippedDateRange: parseDateRange(
        searchParams.get("shippedFrom"),
        searchParams.get("shippedTo")
      ),
      returnedDateRange: parseDateRange(
        searchParams.get("returnedFrom"),
        searchParams.get("returnedTo")
      ),
    };
    const pagination = parsePaginationParams(searchParams);

    const lineService = new LineService(new LineRepository(prisma));
    const simLocationTagService = new TagCrudService(prisma, {
      tableName: "simLocationTag",
      displayName: "設置場所タグ",
      includeFields: { _count: { select: { sims: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const lineReserveTagService = new TagCrudService(prisma, {
      tableName: "lineReserveTag",
      displayName: "回線予約タグ",
      includeFields: { _count: { select: { applicationLines: true } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    // 並列実行で高速化
    const [linesResult, simLocationTags, lineReserveTags] = await Promise.all([
      lineService.getLineList(filters, pagination),
      simLocationTagService.getTagList(),
      lineReserveTagService.getTagList(),
    ]);

    return NextResponse.json({
      lines: { data: linesResult.lines, pagination: linesResult.pagination },
      simLocationTags,
      lineReserveTags,
    });
  } catch (error) {
    logger.logError("回線+タグ取得エラー", error);
    return NextResponse.json(
      { error: "回線データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
