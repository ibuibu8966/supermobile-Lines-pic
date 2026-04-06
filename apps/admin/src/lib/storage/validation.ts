import { STORAGE_CONFIG } from "./constants";

/**
 * ファイルバリデーション結果
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * ファイルのバリデーション
 */
export function validateFile(file: File): FileValidationResult {
  // ファイルタイプチェック
  if (!STORAGE_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "PNG画像またはPDFファイルのみアップロード可能です",
    };
  }

  // ファイルサイズチェック
  if (file.size > STORAGE_CONFIG.MAX_FILE_SIZE) {
    const maxSizeMB = STORAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `ファイルサイズは${maxSizeMB}MB以下にしてください`,
    };
  }

  return { valid: true };
}

/**
 * URLがPDFかどうか判定
 */
export function isPDF(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf");
}

/**
 * 画像タイプのバリデーション
 */
export function isValidImageType(imageType: string): boolean {
  return ["purchaseOrder", "quote", "invoice"].includes(imageType);
}
