import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { prisma } from "@/lib/database";
import { UserService } from "@/services/user.service";
import { UserRepository } from "@/repositories/user.repository";
import { getAdminSession } from "@/lib/auth/admin-session";
import { UsersClient } from "./users-client";

export const metadata = {
  title: "ユーザー管理 | SIM統合管理システム",
};

export default async function UsersPage() {
  const queryClient = new QueryClient();

  try {
    const session = await getAdminSession();
    if (session && !("status" in session)) {
      const userService = new UserService(new UserRepository(prisma));
      const users = await userService.getUserList(
        { includeInactive: true },
        session
      );

      queryClient.setQueryData(
        ["users", { includeInactive: "true" }],
        users
      );
    }
  } catch {
    // プリフェッチ失敗時はクライアント側でフォールバック取得
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersClient />
    </HydrationBoundary>
  );
}
