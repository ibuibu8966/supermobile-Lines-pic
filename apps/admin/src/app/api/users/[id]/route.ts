import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getUserDetail, updateUser, deleteUser } from "@/controllers/user.controller";
import { getAdminSession, assertServiceAccess } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

// 詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getUserDetail(id, prisma, getAdminSession, assertServiceAccess);
}

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateUser(id, request, prisma, getAdminSession, assertServiceAccess);
}

// 削除
export async function DELETE (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await deleteUser(id, prisma, getAdminSession, assertServiceAccess);
}
