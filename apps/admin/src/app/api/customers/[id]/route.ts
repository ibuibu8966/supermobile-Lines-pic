import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getAdminSession } from "@/lib/auth/admin-session";
import { updateCustomer } from "@/controllers/customer.controller";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateCustomer(id, request, prisma, getAdminSession);
}
