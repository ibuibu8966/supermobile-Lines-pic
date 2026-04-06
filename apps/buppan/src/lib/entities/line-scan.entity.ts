/**
 * Line Scan Domain Entity
 *
 * 回線へのICCID一括割当に関するドメインエンティティ定義
 */

/**
 * Line Scan Input
 */
export interface LineScanInput {
  iccids: string[];
  contractMonth: Date;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
}

/**
 * Line Scan Result
 */
export interface LineScanResult {
  message: string;
  assignedCount: number;
  lines: any[];
  warnings?: string[];
  failedIccids?: string[]; // 一部チャンク失敗時に失敗したICCIDリストを返す
}
