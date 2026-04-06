/**
 * 数値フォーマット用ユーティリティ関数
 */

/**
 * 数値を通貨フォーマット（カンマ区切り）に変換
 * @param value - フォーマットする値（文字列または数値）
 * @returns カンマ区切りの文字列
 */
export function formatCurrency(value: string | number): string {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  const digits = value.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10).toLocaleString() : "";
}

/**
 * 通貨フォーマット文字列を数値に変換
 * @param value - パースする文字列
 * @returns 数値
 */
export function parseCurrency(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return parseInt(digits, 10) || 0;
}

/**
 * 日付を YYYY-MM-DD フォーマットに変換
 * @param date - 日付文字列またはDateオブジェクト
 * @returns YYYY-MM-DD形式の文字列、または空文字列
 */
export function formatDateForInput(date: string | Date | null): string {
  if (!date) return "";
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}
