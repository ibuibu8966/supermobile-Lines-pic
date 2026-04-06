/**
 * Cancellation Controller
 *
 * 解約申請APIのコントローラー
 */

import { NextRequest, NextResponse } from 'next/server';
import { CancellationService } from '../services/cancellation.service';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';

/**
 * 解約申請コントローラー
 *
 * @param request NextRequest
 * @param prisma Prismaクライアント
 * @param authFn 認証関数
 * @returns 解約結果
 */
export async function requestCancellation(
  request: NextRequest,
  prisma: any,
  authFn: () => Promise<any>
): Promise<NextResponse> {
  try {
    // 認証チェック
    const session = await authFn();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // パラメータ取得
    const body = await request.json();
    const { lineId, reason } = body;

    if (!lineId) {
      return NextResponse.json(
        { error: '回線IDが必要です' },
        { status: 400 }
      );
    }

    // Service呼び出し
    const cancellationService = new CancellationService(prisma);
    const result = await cancellationService.requestCancellation(
      session.user.id,
      { lineId, reason }
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.logError('解約申請エラー', error);

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: '解約申請に失敗しました' },
      { status: 500 }
    );
  }
}
