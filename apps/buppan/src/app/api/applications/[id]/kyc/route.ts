import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getKycImages, createKycImage } from "@/lib";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getKycImages(id, prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await createKycImage(id, request, prisma);
}
