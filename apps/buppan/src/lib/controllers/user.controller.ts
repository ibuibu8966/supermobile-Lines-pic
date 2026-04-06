/**
 * User Controller
 *
 * APIリクエストを受け取り、Service層を呼び出す薄いコントローラー
 * 認証、パラメータパース、レスポンス整形のみを担当
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { parseBooleanParam } from '../shared/validators/validation';
import { logger } from '../shared/utils/logger';
import { NotFoundError } from '../shared/errors/custom-errors';

type GetAdminSession = () => Promise<
  | { id: string; role: string; scopedServiceId?: string | null }
  | NextResponse
>;

type AssertServiceAccess = (
  session: { scopedServiceId?: string | null },
  serviceId: string | null
) => NextResponse | null;

/**
 * ユーザー一覧取得コントローラー
 */
export async function getAllUsers(
  request: NextRequest,
  prisma: any,
  getAdminSession: GetAdminSession
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. パラメータパース
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    includeInactive: parseBooleanParam(searchParams.get('includeInactive')),
    role: searchParams.get('role') || undefined,
    serviceId: searchParams.get('serviceId') || undefined,
  };

  // 3. Service呼び出し
  const userService = new UserService(new UserRepository(prisma));
  const users = await userService.getUserList(filters, session);

  // 4. レスポンス
  return NextResponse.json(users);
}

/**
 * ユーザー作成コントローラー
 */
const createUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  role: z.enum(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']),
  serviceId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function createUser(
  request: NextRequest,
  prisma: any,
  getAdminSession: GetAdminSession,
  hashPassword: (password: string) => Promise<string>
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. バリデーション
  const body = await request.json();
  const validated = createUserSchema.parse(body);

  // 3. パスワードハッシュ化
  const hashedPassword = await hashPassword(validated.password);

  // 4. Service呼び出し
  const userService = new UserService(new UserRepository(prisma));
  const user = await userService.createUser(
    {
      ...validated,
      password: hashedPassword,
    },
    session
  );

  // 5. レスポンス
  return NextResponse.json(user, { status: 201 });
}

/**
 * ユーザー詳細取得コントローラー
 */
export async function getUserDetail(
  id: string,
  prisma: any,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. Service呼び出し
  const userService = new UserService(new UserRepository(prisma));
  const user = await userService.getUserDetail(id);

  if (!user) {
    throw new NotFoundError('User', id);
  }

  // 3. アクセス権限チェック
  const accessDenied = assertServiceAccess(session, user.serviceId);
  if (accessDenied) return accessDenied;

  // 4. レスポンス
  return NextResponse.json(user);
}

/**
 * ユーザー更新コントローラー
 */
const updateUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').optional(),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください').optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  serviceId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function updateUser(
  id: string,
  request: NextRequest,
  prisma: any,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. 既存ユーザーの確認とアクセス権限チェック
  const userService = new UserService(new UserRepository(prisma));
  const existingUser = await userService.getUserDetail(id);

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  const accessDenied = assertServiceAccess(session, existingUser.serviceId);
  if (accessDenied) return accessDenied;

  // 3. バリデーション
  const body = await request.json();
  const validated = updateUserSchema.parse(body);

  // 4. Service呼び出し
  const updated = await userService.updateUser(id, validated, session);

  // 5. レスポンス
  return NextResponse.json(updated);
}

/**
 * ユーザー削除コントローラー
 */
export async function deleteUser(
  id: string,
  prisma: any,
  getAdminSession: GetAdminSession,
  assertServiceAccess: AssertServiceAccess
): Promise<NextResponse> {
  // 1. 認証チェック
  const sessionResult = await getAdminSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const session = sessionResult;

  // 2. 既存ユーザーの確認とアクセス権限チェック
  const userService = new UserService(new UserRepository(prisma));
  const existingUser = await userService.getUserDetail(id);

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  const accessDenied = assertServiceAccess(session, existingUser.serviceId);
  if (accessDenied) return accessDenied;

  // 3. Service呼び出し
  const result = await userService.deleteUser(id);

  // 4. レスポンス
  return NextResponse.json(result);
}
