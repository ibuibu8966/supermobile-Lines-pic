import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getSignedUrl as _getSignedUrl } from "@/lib/supabase";
import { getKycList } from "@/lib";

const getSignedUrl = async (bucket: string, path: string): Promise<string> => {
  return (await _getSignedUrl(bucket, path)) ?? "";
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return await getKycList("buppan", request, prisma, getSignedUrl);
}
