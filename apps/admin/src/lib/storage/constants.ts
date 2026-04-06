/**
 * Storage設定の定数定義
 */
export const STORAGE_CONFIG = {
  BUCKET_NAME: "procurement-images",
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ["image/png", "application/pdf"],
  ALLOWED_EXTENSIONS: [".png", ".pdf"],
} as const;

/**
 * 画像タイプとDBフィールドのマッピング
 */
export const IMAGE_TYPE_FIELD_MAP = {
  purchaseOrder: "purchaseOrderImagePath",
  quote: "quoteImagePath",
  invoice: "invoiceImagePath",
} as const;
