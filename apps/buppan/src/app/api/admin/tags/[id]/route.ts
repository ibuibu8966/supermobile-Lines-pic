import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { updateTag, deleteTag, TagConfig } from "@/lib";

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

function getConfig(request: NextRequest): TagConfig {
  const type = request.nextUrl.searchParams.get("type");
  return type === "line_reserve_tag" ? LINE_RESERVE_TAG_CONFIG : LINE_TAG_CONFIG;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.clone().json();
  const type = body.type as string;
  const config = type === "line_reserve_tag" ? LINE_RESERVE_TAG_CONFIG : LINE_TAG_CONFIG;
  return await updateTag(id, request, prisma, config);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = getConfig(request);
  return await deleteTag(id, prisma, config);
}
