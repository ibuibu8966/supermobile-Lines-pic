import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getSignedUrl } from "@/lib/supabase";
import { getAdminSession, assertServiceAccess } from "@/lib/auth/admin-session";
import { getApplicationById, updateApplication } from "@/controllers/application.controller";

export const dynamic = "force-dynamic";

// 詳細取得
export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const signedUrlFn = async (bucket: string, path: string): Promise<string> =>
    (await getSignedUrl(bucket, path)) ?? "";
  return await getApplicationById(id, prisma, getAdminSession, assertServiceAccess, signedUrlFn);
}

// 更新
export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateApplication(id, request, prisma, getAdminSession, assertServiceAccess);
}
