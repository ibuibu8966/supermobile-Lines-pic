/**
 * Upload URL controller
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "../shared/errors/api-errors";
import { ValidationError } from "../shared/errors/custom-errors";

const ALLOWED_BUCKETS = ["kyc"];

const uploadUrlSchema = z.object({
  bucket: z.string().min(1, "bucket は必須です"),
  path: z.string().min(1, "path は必須です"),
});

export async function createUploadUrl(
  request: NextRequest,
  createSignedUploadUrlFn: (bucket: string, path: string) => Promise<{ signedUrl: string; path: string } | null>
) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = uploadUrlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { bucket, path } = validation.data;

    // Validate bucket
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      throw new ValidationError("許可されていないバケットです");
    }

    // Validate path prefix
    if (!path.startsWith("kyc/")) {
      throw new ValidationError("不正なパスです");
    }

    // Create signed upload URL
    const result = await createSignedUploadUrlFn(bucket, path);

    if (!result) {
      return NextResponse.json(
        { error: "アップロードURLの生成に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: result.signedUrl,
      path: result.path,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
