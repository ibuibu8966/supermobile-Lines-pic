import { cache } from "react";
import { auth } from "@/auth";

/**
 * React Server Component内で同一リクエスト中のauth()呼び出しをキャッシュ。
 * Layout → Page → getAdminSession で auth() が何度呼ばれても1回だけ実行される。
 */
export const getSession = cache(() => auth());
