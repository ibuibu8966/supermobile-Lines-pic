import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getTagList, createTag, type TagConfig } from "@/controllers/tag-crud.controller";

export const dynamic = "force-dynamic";

const config: TagConfig = {
  tableName: 'lineReserveTag',
  displayName: '回線予備タグ',
  usageTableName: 'applicationLine',
  usageColumnName: 'lineReserveTagId',
  includeFields: {
    _count: {
      select: {
        applicationLines: true,
      },
    },
  },
};

// 一覧取得
export async function GET (request: NextRequest) {
  return await getTagList(request, prisma, config);
}

// 新規作成
export async function POST (request: NextRequest) {
  return await createTag(request, prisma, config);
}
