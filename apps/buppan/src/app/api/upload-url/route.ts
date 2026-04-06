import { NextRequest } from "next/server";
import { createSignedUploadUrl } from "@/lib/supabase";
import { createUploadUrl } from "@/lib";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return await createUploadUrl(request, createSignedUploadUrl);
}
