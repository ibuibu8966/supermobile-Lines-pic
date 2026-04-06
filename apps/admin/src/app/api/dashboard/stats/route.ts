import { getDashboardStats } from "@/controllers/dashboard-stats.controller";

export const dynamic = "force-dynamic";

export async function GET() {
  return await getDashboardStats();
}
