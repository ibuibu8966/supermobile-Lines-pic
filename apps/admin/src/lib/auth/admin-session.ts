import { getSession } from "@/lib/auth/cached-session";
import { NextResponse } from "next/server";

export interface AdminSession {
  userId: string;
  role: "ADMIN" | "EMPLOYEE" | "SUPER_ADMIN";
  serviceId: string | null;
  isSuperAdmin: boolean;
  /** ADMIN → そのserviceId, SUPER_ADMIN/EMPLOYEE → null（制限なし） */
  scopedServiceId: string | null;
}

export async function getAdminSession(): Promise<AdminSession | NextResponse> {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const { id, role, serviceId } = session.user;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json(
      { error: "管理者権限が必要です" },
      { status: 403 }
    );
  }
  if (role === "ADMIN" && !serviceId) {
    return NextResponse.json(
      { error: "サービスが割り当てられていません" },
      { status: 403 }
    );
  }
  // SUPER_ADMIN と EMPLOYEE は全サービスにアクセス可能
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "EMPLOYEE";
  return {
    userId: id!,
    role: role as "ADMIN" | "EMPLOYEE" | "SUPER_ADMIN",
    serviceId: serviceId ?? null,
    isSuperAdmin,
    scopedServiceId: isSuperAdmin ? null : serviceId!,
  };
}

export function assertServiceAccess(
  session: AdminSession,
  resourceServiceId: string | null
): NextResponse | null {
  if (session.isSuperAdmin) return null;
  if (session.serviceId === resourceServiceId) return null;
  return NextResponse.json(
    { error: "このリソースへのアクセス権限がありません" },
    { status: 403 }
  );
}
