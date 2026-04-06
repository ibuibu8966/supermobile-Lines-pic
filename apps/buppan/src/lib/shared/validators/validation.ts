/**
 * 共通バリデーションユーティリティ
 *
 * parseInt()などの型変換時の安全性を保証するヘルパー関数
 */

/**
 * 安全なparseInt - NaNを返さず、デフォルト値またはnullを返す
 */
export function safeParseInt(value: string | null | undefined, defaultValue?: number): number | null {
  if (value === null || value === undefined || value === '') {
    return defaultValue ?? null;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return defaultValue ?? null;
  }

  return parsed;
}

/**
 * ページネーションパラメータのパース
 * - pageは1以上
 * - pageSizeは1-200の範囲
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: {
    defaultPageSize?: number;
    maxPageSize?: number;
  } = {}
): PaginationParams {
  const defaultPageSize = options.defaultPageSize ?? 50;
  const maxPageSize = options.maxPageSize ?? 200;

  const page = Math.max(1, safeParseInt(searchParams.get('page')) ?? 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, safeParseInt(searchParams.get('pageSize')) ?? defaultPageSize)
  );

  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

/**
 * 日付範囲フィルタのパース（タイムゾーン考慮）
 * - fromは当日の00:00:00
 * - toは当日の23:59:59
 */
export interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

export function parseDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): DateRangeFilter | undefined {
  const filter: DateRangeFilter = {};

  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      // 当日の00:00:00に設定
      fromDate.setHours(0, 0, 0, 0);
      filter.gte = fromDate;
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      // 当日の23:59:59に設定
      toDate.setHours(23, 59, 59, 999);
      filter.lte = toDate;
    }
  }

  // フィルタが空の場合はundefinedを返す
  if (Object.keys(filter).length === 0) {
    return undefined;
  }

  return filter;
}

/**
 * 配列パラメータのパース（カンマ区切り）
 */
export function parseArrayParam(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

/**
 * 数値配列パラメータのパース（カンマ区切り）
 */
export function parseNumberArrayParam(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => safeParseInt(v.trim()))
    .filter((n): n is number => n !== null);
}

/**
 * ブール値パラメータのパース
 */
export function parseBooleanParam(value: string | null | undefined): boolean {
  return value === 'true' || value === '1';
}
