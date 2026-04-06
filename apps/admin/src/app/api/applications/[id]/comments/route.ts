import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getSignedUrl } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth/admin-session";

const BUCKET = "application-comments";

export const dynamic = "force-dynamic";

// コメント一覧取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const comments = await prisma.applicationComment.findMany({
    where: { applicationId: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // 画像がある場合は署名付きURLを付与
  const withUrls = await Promise.all(
    comments.map(async (c) => {
      if (!c.imageUrl) return { ...c, imageSignedUrl: null };
      const url = await getSignedUrl(BUCKET, c.imageUrl);
      return { ...c, imageSignedUrl: url };
    })
  );

  return NextResponse.json(withUrls);
}

// コメント投稿
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const { body } = await request.json();

  if (!body || typeof body !== "string" || body.trim() === "") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const comment = await prisma.applicationComment.create({
    data: {
      applicationId: id,
      userId: session.userId,
      body: body.trim(),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
