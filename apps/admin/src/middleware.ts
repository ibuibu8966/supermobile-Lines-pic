import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 認証不要のパス
const publicPaths = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  const isLoggedIn = !!req.auth;

  // 公開パスは認証不要
  if (isPublicPath) {
    // ログイン済みでログインページにアクセスした場合はリダイレクト
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 非公開パスで未ログインの場合はログインページにリダイレクト
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 管理者権限チェック（ADMINまたはSUPER_ADMIN）
  const userRole = req.auth?.user?.role;
  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN" && userRole !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
