import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export function createAuthConfig(prisma: PrismaClient): NextAuthConfig {
  return {
    adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              customers: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (!user || !user.password || !user.isActive) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, user.password);

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            serviceId: user.serviceId,
            customerId: user.customers?.[0]?.id ?? null,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id as string;
          token.role = user.role as string;
          token.serviceId = user.serviceId as string | null;
          token.customerId = user.customerId as string | null;
        }
        return token;
      },
      async session({ session, token }) {
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.serviceId = token.serviceId as string | null;
          session.user.customerId = token.customerId as string | null;
        }
        return session;
      },
      async authorized({ auth, request: { nextUrl } }) {
        const isLoggedIn = !!auth?.user;
        const isAuthPage = nextUrl.pathname.startsWith("/login");

        if (isAuthPage) {
          if (isLoggedIn) {
            return Response.redirect(new URL("/", nextUrl));
          }
          return true;
        }

        return isLoggedIn;
      },
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
