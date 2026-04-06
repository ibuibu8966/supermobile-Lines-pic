import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getApplicationDetail, updateApplication } from "@/lib";
import { auth } from "@/auth";

const getAdminSession = async () => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { id: session.user.id!, role: session.user.role!, scopedServiceId: (session.user as any).serviceId ?? null };
};

const assertServiceAccess = () => undefined;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getApplicationDetail(id, prisma, getAdminSession, assertServiceAccess);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateApplication(id, request, prisma, getAdminSession, assertServiceAccess);
}
