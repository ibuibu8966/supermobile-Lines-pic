/**
 * 解約関連のエンティティ定義
 */

export interface CancellationRequest {
  lineId: string;
  reason?: string;
}

export interface CancellationResult {
  success: boolean;
}
