/**
 * Image Upload Service
 *
 * 画像アップロードのビジネスロジック
 * Supabase Storageを使用した画像管理
 */

import { logger } from '../shared/utils/logger';
import { ValidationError } from '../shared/errors/custom-errors';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface StorageClient {
  generateFilePath(entityId: string, imageType: string, fileName: string): string;
  extractFilePathFromUrl(url: string, entityId: string): string | null;
  uploadFile(filePath: string, buffer: Buffer, contentType: string): Promise<UploadResult>;
  deleteFile(filePath: string): Promise<void>;
}

/**
 * 画像アップロードサービス
 */
export class ImageUploadService {
  constructor(private storageClient: StorageClient) {}

  /**
   * ファイルのバリデーション
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // ファイルサイズチェック（10MB）
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'ファイルサイズは10MB以下にしてください',
      };
    }

    // ファイルタイプチェック
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: '許可されていないファイル形式です（JPEG、PNG、GIF、WebPのみ）',
      };
    }

    return { valid: true };
  }

  /**
   * 画像タイプのバリデーション
   */
  isValidImageType(imageType: string, validTypes: string[]): boolean {
    return validTypes.includes(imageType);
  }

  /**
   * 画像をアップロード
   */
  async uploadImage(
    entityId: string,
    imageType: string,
    file: File,
    existingUrl?: string | null
  ): Promise<UploadResult> {
    logger.info('画像アップロード開始', { entityId, imageType });

    // ファイルのバリデーション
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // 既存の画像がある場合は削除
    if (existingUrl) {
      const existingPath = this.storageClient.extractFilePathFromUrl(existingUrl, entityId);
      if (existingPath) {
        try {
          await this.storageClient.deleteFile(existingPath);
          logger.debug('既存画像削除完了', { path: existingPath });
        } catch (error) {
          logger.warn('既存画像削除失敗（続行）', { error });
        }
      }
    }

    // 新しい画像をアップロード
    const filePath = this.storageClient.generateFilePath(entityId, imageType, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await this.storageClient.uploadFile(
      filePath,
      buffer,
      file.type
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || '画像のアップロードに失敗しました');
    }

    logger.info('画像アップロード完了', { entityId, url: uploadResult.url });

    return uploadResult;
  }

  /**
   * 画像を削除
   */
  async deleteImage(url: string, entityId: string): Promise<void> {
    logger.info('画像削除開始', { entityId, url });

    const filePath = this.storageClient.extractFilePathFromUrl(url, entityId);
    if (!filePath) {
      throw new ValidationError('無効な画像URLです');
    }

    await this.storageClient.deleteFile(filePath);

    logger.info('画像削除完了', { entityId, filePath });
  }
}
