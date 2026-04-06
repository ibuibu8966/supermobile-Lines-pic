/**
 * Password change controller
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { PasswordService } from "../services/password.service";
import { z } from "zod";
import { handleApiError } from "../shared/errors/api-errors";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
  newPassword: z.string().min(1, "新しいパスワードを入力してください"),
});

export async function changePassword(
  request: NextRequest,
  prisma: PrismaClient,
  authFn: () => Promise<{ user?: { id?: string } } | null>,
  verifyPasswordFn: (password: string, hash: string) => Promise<boolean>,
  hashPasswordFn: (password: string) => Promise<string>
) {
  try {
    // Authenticate
    const session = await authFn();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = passwordChangeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Change password
    const service = new PasswordService(prisma);
    const result = await service.changePassword(
      session.user.id,
      data,
      verifyPasswordFn,
      hashPasswordFn
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
