/**
 * Line Scan Domain Entity
 *
 * 回線へのICCID一括割当に関するドメインエンティティ定義
 */

/**
 * Line Scan Input（一括登録用）
 */
export interface LineScanInput {
  iccids: string[];
  contractMonth: Date;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
}

/**
 * Line Scan Result（一括登録用）
 */
export interface LineScanResult {
  message: string;
  assignedCount: number;
  lines: any[];
  warnings?: string[];
  conflicts?: LineScanConflict[];
}

/**
 * Single Line Scan Input（1件登録用）
 */
export interface SingleLineScanInput {
  iccid: string;
  contractMonth: Date;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
}

/**
 * 競合情報
 */
export interface LineScanConflict {
  iccid: string;
  currentApplicationId: string;
  currentApplicationNumber: string;
  currentCustomerName: string;
  currentLineId: string;
}

/**
 * Single Line Scan Result（1件登録用）
 */
export type SingleLineScanResult =
  | {
      status: 'ok';
      line: {
        id: string;
        lineNumber: number;
        simId: string;
        msisdn: string | null;
        status: string;
      };
    }
  | {
      status: 'conflict';
      conflict: LineScanConflict;
    }
  | {
      status: 'no_lines';
    };

/**
 * Force Reassign Input（競合解決用）
 */
export interface ForceReassignInput {
  iccid: string;
  cancelLineId: string;
  contractMonth: Date;
  lineTagId?: number | null;
  lineReserveTagId?: number | null;
}
