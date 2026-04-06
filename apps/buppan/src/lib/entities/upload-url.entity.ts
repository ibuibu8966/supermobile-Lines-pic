/**
 * Upload URL entity
 */

export interface UploadUrlRequest {
  bucket: string;
  path: string;
}

export interface UploadUrlResult {
  signedUrl: string;
  path: string;
}
