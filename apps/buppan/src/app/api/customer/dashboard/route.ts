import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { getCustomerDashboard } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  return await getCustomerDashboard(prisma, auth);
}
