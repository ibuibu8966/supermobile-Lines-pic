import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getTagDetail, updateTag, deleteTag, TagConfig } from "@/controllers/tag-crud.controller";

export const dynamic = "force-dynamic";

const config: TagConfig = {
  tableName: 'simLocationTag',
  displayName: 'SIM場所タグ',
  usageTableName: 'sim',
  usageColumnName: 'simLocationTagId',
  includeFields: {
    _count: {
      select: {
        sims: true,
      },
    },
  },
};

// 詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getTagDetail(id, prisma, config);
}

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateTag(id, request, prisma, config);
}

// 削除
export async function DELETE (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await deleteTag(id, prisma, config);
}
