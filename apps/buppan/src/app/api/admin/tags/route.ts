import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getTagList, createTag, TagConfig } from "@/lib";

export const dynamic = "force-dynamic";

const LINE_TAG_CONFIG: TagConfig = {
  tableName: "lineTag",
  displayName: "SIMの場所タグ",
  usageTableName: "applicationLine",
  usageColumnName: "lineTagId",
};

const LINE_RESERVE_TAG_CONFIG: TagConfig = {
  tableName: "lineReserveTag",
  displayName: "予備タグ",
  usageTableName: "applicationLine",
  usageColumnName: "lineReserveTagId",
};

export async function GET(request: NextRequest) {
  const [lineTags, lineReserveTags] = await Promise.all([
    getTagList(request, prisma, LINE_TAG_CONFIG).then((r) => r.json()),
    getTagList(request, prisma, LINE_RESERVE_TAG_CONFIG).then((r) => r.json()),
  ]);
  return NextResponse.json({ lineTags, lineReserveTags });
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json();
  const type = body.type as string;

  const config = type === "line_reserve_tag" ? LINE_RESERVE_TAG_CONFIG : LINE_TAG_CONFIG;

  if (!body.code) {
    body.code = body.name;
  }

  const newRequest = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  });

  return await createTag(newRequest, prisma, config);
}
