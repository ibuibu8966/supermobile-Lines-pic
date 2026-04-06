import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { hashPassword } from "@/lib/auth/config";
import { resetPassword } from "@/lib/controllers/forgot-password.controller";

export async function POST(request: NextRequest) {
  return await resetPassword(request, prisma, hashPassword);
}
