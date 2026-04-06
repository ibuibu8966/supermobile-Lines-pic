import { prisma } from "@/lib/database";
import { getDashboard } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  return await getDashboard("buppan", prisma);
}
