import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { uploadFile as _uploadFile } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth/config";
import { createCustomerApplication, withErrorHandling } from "@/lib";

export const dynamic = "force-dynamic";

const uploadFile = async (bucket: string, path: string, buffer: Buffer, contentType: string): Promise<void> => {
  await _uploadFile(bucket, path, buffer, contentType);
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  return await createCustomerApplication(
    'buppan',
    request,
    prisma,
    hashPassword,
    uploadFile
  );
});
