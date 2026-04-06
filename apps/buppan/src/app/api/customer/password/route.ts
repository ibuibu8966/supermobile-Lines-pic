import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { hashPassword, verifyPassword } from "@/lib/auth/config";
import { changePassword } from "@/lib";

export const dynamic = "force-dynamic";

// パスワード変更
export async function PUT(request: NextRequest) {
  return await changePassword(request, prisma, auth, verifyPassword, hashPassword);
}
