/**
 * 画像タイプ
 */
export type ImageType = "purchaseOrder" | "quote" | "invoice";

/**
 * アップロード結果
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * ファイルバリデーション結果
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}
