import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getAllUsers, createUser } from "@/controllers/user.controller";

export const dynamic = "force-dynamic";

// 一覧取得
export async function GET (request: NextRequest) {
  return await getAllUsers(request, prisma, getAdminSession);
}

// 新規作成
export async function POST (request: NextRequest) {
  return await createUser(
    request,
    prisma,
    getAdminSession,
    async (password: string) => bcrypt.hash(password, 10)
  );
}
