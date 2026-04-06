import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { getCustomerLines } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  return await getCustomerLines(prisma, auth);
}
