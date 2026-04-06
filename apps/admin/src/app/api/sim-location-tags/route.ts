import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getTagList, createTag, type TagConfig } from "@/controllers/tag-crud.controller";

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

export async function GET(request: NextRequest) {
  return await getTagList(request, prisma, config);
}

export async function POST(request: NextRequest) {
  return await createTag(request, prisma, config);
}
