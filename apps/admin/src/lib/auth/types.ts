import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      serviceId: string | null;
      customerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: string;
    serviceId: string | null;
    customerId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    serviceId: string | null;
    customerId: string | null;
  }
}

export type UserRole = "CUSTOMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  serviceId: string | null;
  customerId: string | null;
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "EMPLOYEE";
}

export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "EMPLOYEE";
}

export function canAccessService(
  userRole: string,
  userServiceId: string | null,
  targetServiceId: string
): boolean {
  if (userRole === "SUPER_ADMIN" || userRole === "EMPLOYEE") {
    return true;
  }
  if (userRole === "ADMIN" && userServiceId === targetServiceId) {
    return true;
  }
  return false;
}
