import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

type GetAdminSession = () => Promise<{ userId: string } | NextResponse>;

const updateCustomerSchema = z.object({
  lastName: z.string().max(50).optional(),
  firstName: z.string().max(50).optional(),
  lastNameKana: z.string().max(50).optional(),
  firstNameKana: z.string().max(50).optional(),
  email: z.string().email("メールアドレスの形式が正しくありません").optional(),
  phone: z.string().max(20).optional(),
  birthDate: z.string().nullable().optional(),
  postalCode: z.string().max(10).optional(),
  prefecture: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(200).optional(),
  building: z.string().max(200).nullable().optional(),
  // 法人情報
  companyName: z.string().max(100).nullable().optional(),
  companyNameKana: z.string().max(100).nullable().optional(),
  establishedDate: z.string().nullable().optional(),
  representativeLastName: z.string().max(50).nullable().optional(),
  representativeFirstName: z.string().max(50).nullable().optional(),
  representativeLastNameKana: z.string().max(50).nullable().optional(),
  representativeFirstNameKana: z.string().max(50).nullable().optional(),
  companyPostalCode: z.string().max(10).nullable().optional(),
  companyPrefecture: z.string().max(20).nullable().optional(),
  companyCity: z.string().max(100).nullable().optional(),
  companyAddress: z.string().max(200).nullable().optional(),
  companyBuilding: z.string().max(200).nullable().optional(),
});

export async function updateCustomer(
  id: string,
  request: NextRequest,
  prisma: PrismaClient,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;

  // 2. バリデーション
  const body = await request.json();
  const parseResult = updateCustomerSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  // 3. 存在確認
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  // 4. 日付フィールドの変換
  const data: Record<string, unknown> = { ...parseResult.data };
  if (data.birthDate !== undefined) {
    data.birthDate = data.birthDate ? new Date(data.birthDate as string) : null;
  }
  if (data.establishedDate !== undefined) {
    data.establishedDate = data.establishedDate ? new Date(data.establishedDate as string) : null;
  }

  // 5. 更新
  const updated = await prisma.customer.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
