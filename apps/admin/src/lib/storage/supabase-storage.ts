import { supabaseAdmin } from "@/lib/supabase/client";
import { STORAGE_CONFIG } from "./constants";
import type { UploadResult } from "@/types/storage";
import { logger } from "@/shared/utils/logger";

/**
 * Supabase Storageの操作を抽象化したクラス
 */
export class SupabaseStorage {
  private bucketName = STORAGE_CONFIG.BUCKET_NAME;

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    filePath: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    try {
      const { error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        return {
          success: false,
          error: `アップロードに失敗しました: ${error.message}`,
        };
      }

      const { data } = supabaseAdmin.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        success: true,
        url: data.publicUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: `アップロード中にエラーが発生しました: ${error}`,
      };
    }
  }

  /**
   * ファイルを削除
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        logger.error("Failed to delete file", { error });
      }
    } catch (error) {
      logger.error("Error deleting file", { error });
    }
  }

  /**
   * ファイルパスを生成
   */
  generateFilePath(
    orderId: string,
    imageType: string,
    fileName: string
  ): string {
    const ext = fileName.split(".").pop();
    return `${orderId}/${imageType}-${Date.now()}.${ext}`;
  }

  /**
   * URLからファイルパスを抽出
   */
  extractFilePathFromUrl(url: string, orderId: string): string | null {
    try {
      const fileName = url.split("/").pop();
      return fileName ? `${orderId}/${fileName}` : null;
    } catch {
      return null;
    }
  }
}

export const supabaseStorage = new SupabaseStorage();
