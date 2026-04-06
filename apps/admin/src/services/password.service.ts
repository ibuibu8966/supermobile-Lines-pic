/**
 * Password change service
 */

import { PrismaClient } from "@/lib/database";
import { PasswordChangeRequest, PasswordChangeResult } from "@/entities";
import { NotFoundError, ValidationError } from "@/shared/errors/custom-errors";
import { logger } from "@/shared/utils/logger";

export class PasswordService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    request: PasswordChangeRequest,
    verifyPasswordFn: (password: string, hash: string) => Promise<boolean>,
    hashPasswordFn: (password: string) => Promise<string>
  ): Promise<PasswordChangeResult> {
    // Validate new password length
    if (request.newPassword.length < 8) {
      throw new ValidationError("新しいパスワードは8文字以上で入力してください");
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new NotFoundError("ユーザー情報が見つかりません");
    }

    // Verify current password
    const isValid = await verifyPasswordFn(request.currentPassword, user.password);

    if (!isValid) {
      throw new ValidationError("現在のパスワードが正しくありません");
    }

    // Hash and update new password
    const hashedPassword = await hashPasswordFn(request.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info("Password changed", { userId });

    return { success: true };
  }
}
