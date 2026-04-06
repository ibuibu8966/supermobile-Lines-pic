import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAllApplications } from "@/lib";
import { auth } from "@/auth";
import { getSignedUrl as _getSignedUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const getAdminSession = async () => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { id: session.user.id!, role: session.user.role!, scopedServiceId: (session.user as any).serviceId ?? null };
};

const getSignedUrl = async (bucket: string, path: string): Promise<string> => {
  return (await _getSignedUrl(bucket, path)) ?? "";
};

export async function GET(request: NextRequest) {
  return await getAllApplications(request, prisma, getAdminSession, getSignedUrl);
}
