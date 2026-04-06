import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { uploadFile, getSignedUrl } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

const BUCKET = "application-comments";

// 画像付きコメント投稿
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const body = (formData.get("body") as string | null)?.trim() || null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!body && !file) {
    return NextResponse.json({ error: "body or file required" }, { status: 400 });
  }

  // ファイルサイズ制限 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "ファイルサイズは10MB以下にしてください" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadFile(BUCKET, path, buffer, file.type);
  if (!uploaded) {
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }

  // 署名付きURLを生成（1時間有効）
  const signedUrl = await getSignedUrl(BUCKET, uploaded.path);

  const comment = await prisma.applicationComment.create({
    data: {
      applicationId: id,
      userId: session.userId,
      body: body,
      imageUrl: uploaded.path,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ...comment, imageSignedUrl: signedUrl }, { status: 201 });
}
