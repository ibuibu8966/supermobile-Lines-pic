/**
 * API エラーハンドリングユーティリティ
 *
 * Next.js APIルートでの統一的なエラーレスポンス生成
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  BusinessRuleError,
  DataIntegrityError,
} from './custom-errors';
import { logger } from '../utils/logger';

export interface ApiError {
  error: string;
  details?: unknown;
}

/**
 * 共通のエラーレスポンス関数
 */
export function createErrorResponse(message: string, status: number = 500): NextResponse<ApiError> {
  logger.error(`[API Error] ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export function createNotFoundResponse(resource: string): NextResponse<ApiError> {
  return createErrorResponse(`${resource}が見つかりません`, 404);
}

export function createValidationErrorResponse(message: string): NextResponse<ApiError> {
  return createErrorResponse(message, 400);
}

export function createUnauthorizedResponse(message: string = '認証が必要です'): NextResponse<ApiError> {
  return createErrorResponse(message, 401);
}

export function createForbiddenResponse(message: string = 'アクセス権限がありません'): NextResponse<ApiError> {
  return createErrorResponse(message, 403);
}

export function createConflictResponse(message: string): NextResponse<ApiError> {
  return createErrorResponse(message, 409);
}

/**
 * Zodバリデーションエラーを処理
 */
export function handleZodError(error: ZodError): NextResponse<ApiError> {
  const messages = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return NextResponse.json(
    {
      error: 'バリデーションエラー',
      details: messages,
    },
    { status: 400 }
  );
}

/**
 * Prismaエラーを処理
 */
export function handlePrismaError(error: unknown): NextResponse<ApiError> | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return createConflictResponse('このデータは既に存在します');

      case 'P2025': // Record not found
        return createNotFoundResponse('データ');

      case 'P2003': // Foreign key constraint violation
        return createErrorResponse('関連するデータが見つかりません', 400);

      case 'P2014': // Invalid ID
        return createValidationErrorResponse('無効なIDが指定されました');

      default:
        logger.error('[Prisma Error]', { code: error.code, message: error.message });
        return createErrorResponse('データベースエラーが発生しました', 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return createValidationErrorResponse('データの形式が正しくありません');
  }

  return null;
}

/**
 * カスタムエラーをNextResponseに変換する
 */
export function handleCustomError(error: unknown): NextResponse<ApiError> | null {
  if (error instanceof NotFoundError) {
    return createErrorResponse(error.message, 404);
  }

  if (error instanceof ValidationError || error instanceof BadRequestError) {
    return createErrorResponse(error.message, 400);
  }

  if (error instanceof UnauthorizedError) {
    return createErrorResponse(error.message, 401);
  }

  if (error instanceof ForbiddenError) {
    return createErrorResponse(error.message, 403);
  }

  if (error instanceof ConflictError || error instanceof DataIntegrityError) {
    return createErrorResponse(error.message, 409);
  }

  if (error instanceof BusinessRuleError) {
    return createErrorResponse(error.message, 422);
  }

  return null;
}

/**
 * 統合エラーハンドラ
 * すべてのエラータイプを処理する
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  // Zodエラー
  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  // カスタムエラー
  const customErrorResponse = handleCustomError(error);
  if (customErrorResponse) {
    return customErrorResponse;
  }

  // Prismaエラー
  const prismaErrorResponse = handlePrismaError(error);
  if (prismaErrorResponse) {
    return prismaErrorResponse;
  }

  // 標準エラー
  if (error instanceof Error) {
    logger.error('[Unhandled Error]', { name: error.name, message: error.message, stack: error.stack });
    return createErrorResponse('サーバーエラーが発生しました', 500);
  }

  // 不明なエラー
  logger.error('[Unknown Error]', { error });
  return createErrorResponse('予期しないエラーが発生しました', 500);
}

/**
 * 非同期関数をエラーハンドリングでラップする
 * APIルートでの使用を想定
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  }) as T;
}
