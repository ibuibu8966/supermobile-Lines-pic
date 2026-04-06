import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { NextURL } from "next/dist/server/web/next-url";
import { createAuthConfig } from "@/lib/auth/config";
import { prisma } from "@/lib/database";

const authConfig = createAuthConfig(prisma);

interface AuthorizedParams {
  auth: Session | null;
  request: { nextUrl: NextURL };
}

// 物販用のページ設定を上書き
const buppanAuthConfig: NextAuthConfig = {
  ...authConfig,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    ...authConfig.callbacks,
    async authorized({ auth, request: { nextUrl } }: AuthorizedParams) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // 公開ページ（認証不要）
      const publicPaths = ["/", "/apply", "/login", "/register", "/forgot-password", "/legal", "/privacy", "/terms"];
      const isPublicPage = publicPaths.some(
        (path) => pathname === path || pathname.startsWith("/apply/") || pathname.startsWith("/documents/")
      );

      // API Routes（認証不要のもの）
      const publicApiPaths = ["/api/plans", "/api/applications", "/api/upload-url", "/api/coupon"];
      const isPublicApi = publicApiPaths.some((path) =>
        pathname.startsWith(path)
      );

      // 公開ページとAPIはそのまま通す
      if (isPublicPage || isPublicApi) {
        return true;
      }

      // 管理画面へのアクセス制御
      const isAdminPage = pathname.startsWith("/admin");
      const isAdminApi = pathname.startsWith("/api/admin");

      if (isAdminPage || isAdminApi) {
        if (!isLoggedIn) {
          return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl));
        }
        const user = auth?.user;
        // ADMIN または SUPER_ADMIN のみアクセス可能
        if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // 顧客マイページへのアクセス制御
      const isCustomerPage = pathname.startsWith("/dashboard");
      const isCustomerApi = pathname.startsWith("/api/customer");

      if (isCustomerPage || isCustomerApi) {
        if (!isLoggedIn) {
          return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl));
        }
        return true;
      }

      // 認証ページ
      if (pathname === "/login" || pathname === "/register") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // その他のページは認証必須
      if (!isLoggedIn) {
        return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl));
      }
      return true;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(buppanAuthConfig);
