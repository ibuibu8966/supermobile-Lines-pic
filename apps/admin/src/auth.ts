import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/auth/config";
import { prisma } from "@/lib/database";

export const { handlers, auth, signIn, signOut } = NextAuth(createAuthConfig(prisma));
