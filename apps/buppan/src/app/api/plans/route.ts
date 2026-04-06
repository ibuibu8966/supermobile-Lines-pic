import { prisma } from "@/lib/database";
import { getServicePlans } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  return await getServicePlans(prisma, "buppan");
}
