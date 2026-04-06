/**
 * Forgot password controller
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/database";
import { PasswordService } from "../services/password.service";
import { z } from "zod";
import { handleApiError } from "../shared/errors/api-errors";

const forgotPasswordSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  birthDate: z.string().min(1, "生年月日を入力してください"),
  newPassword: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export async function resetPassword(
  request: NextRequest,
  prisma: PrismaClient,
  hashPasswordFn: (password: string) => Promise<string>
) {
  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, birthDate, newPassword } = validation.data;

    const service = new PasswordService(prisma);
    const result = await service.resetPasswordByIdentity(
      email,
      birthDate,
      newPassword,
      hashPasswordFn
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
