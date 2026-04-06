import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getSignedUrl as _getSignedUrl } from "@/lib/supabase";
import { getKycImageDetail, updateKycImage } from "@/lib";

const getSignedUrl = async (bucket: string, path: string): Promise<string> => {
  return (await _getSignedUrl(bucket, path)) ?? "";
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getKycImageDetail(id, prisma, getSignedUrl);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateKycImage(id, request, prisma);
}
