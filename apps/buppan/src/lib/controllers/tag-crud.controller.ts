/**
 * Tag CRUD Controller
 *
 * タグ系エンティティの汎用CRUDコントローラー
 */

import { NextRequest, NextResponse } from 'next/server';
import { TagCrudService, TagConfig, TagUpdateInput } from '../services/tag-crud.service';
import { logger } from '../shared/utils/logger';
import { z } from 'zod';

// 汎用作成スキーマ
const createTagSchema = z.object({
  code: z.string().min(1, 'コードは必須です').max(50),
  name: z.string().min(1, '名前は必須です').max(100),
  category: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

// 汎用更新スキーマ
const updateTagSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  category: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * タグ一覧取得コントローラー
 */
export async function getTagList(
  request: NextRequest,
  prisma: any,
  config: TagConfig
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const tagService = new TagCrudService(prisma, config);
  const tags = await tagService.getTagList(includeInactive);

  return NextResponse.json(tags);
}

/**
 * タグ作成コントローラー
 */
export async function createTag(
  request: NextRequest,
  prisma: any,
  config: TagConfig
): Promise<NextResponse> {
  // バリデーション
  const body = await request.json();
  const validated = createTagSchema.parse(body);

  // Service呼び出し
  const tagService = new TagCrudService(prisma, config);
  const created = await tagService.createTag(validated);

  return NextResponse.json(created, { status: 201 });
}

/**
 * タグ詳細取得コントローラー
 */
export async function getTagDetail(
  id: string,
  prisma: any,
  config: TagConfig
): Promise<NextResponse> {
  const tagId = parseInt(id);
  const tagService = new TagCrudService(prisma, config);
  const tag = await tagService.getTagDetail(tagId);
  return NextResponse.json(tag);
}

/**
 * タグ更新コントローラー
 */
export async function updateTag(
  id: string,
  request: NextRequest,
  prisma: any,
  config: TagConfig
): Promise<NextResponse> {
  const tagId = parseInt(id);

  // バリデーション
  const body = await request.json();
  const validated = updateTagSchema.parse(body);

  // Service呼び出し
  const tagService = new TagCrudService(prisma, config);
  const updated = await tagService.updateTag(tagId, validated);

  return NextResponse.json(updated);
}

/**
 * タグ削除コントローラー
 */
export async function deleteTag(
  id: string,
  prisma: any,
  config: TagConfig
): Promise<NextResponse> {
  const tagId = parseInt(id);

  // Service呼び出し
  const tagService = new TagCrudService(prisma, config);
  const result = await tagService.deleteTag(tagId);

  return NextResponse.json(result);
}
