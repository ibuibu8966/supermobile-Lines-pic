"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, FileText, ZoomIn } from "lucide-react";
import { validateFile, isPDF } from "@/lib/storage/validation";

interface ImageUploadFieldProps {
  orderId: string;
  label: string;
  imageType: "purchaseOrder" | "quote" | "invoice";
  currentImageUrl?: string | null;
  onUpload: (orderId: string, imageType: string, file: File) => Promise<void>;
  onDelete: (orderId: string, imageType: string) => Promise<void>;
  isUploading?: boolean;
}

export function ImageUploadField({
  orderId,
  label,
  imageType,
  currentImageUrl,
  onUpload,
  onDelete,
  isUploading = false,
}: ImageUploadFieldProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPDFFile = isPDF(currentImageUrl);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    await onUpload(orderId, imageType, file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("ファイルを削除しますか？")) return;
    await onDelete(orderId, imageType);
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {currentImageUrl ? (
        <div className="relative group w-full">
          {isPDFFile ? (
            /* PDF: iframeで直接埋め込み表示 */
            <div
              className="relative w-full border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer"
              style={{ height: "380px" }}
              onClick={() => setIsPreviewOpen(true)}
            >
              <iframe
                src={`${currentImageUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="border-0 pointer-events-none origin-top-left"
                style={{
                  width: "167%",
                  height: "167%",
                  transform: "scale(0.6)",
                  transformOrigin: "top left",
                }}
                title={label}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1">
                <span className="text-xs text-white bg-black/40 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">クリックで拡大</span>
              </div>
            </div>
          ) : (
            /* 画像: サムネイル直接表示 + ホバーで拡大アイコン */
            <div
              className="relative w-full border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer"
              style={{ height: "420px" }}
              onClick={() => setIsPreviewOpen(true)}
            >
              <img
                src={currentImageUrl}
                alt={label}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          )}

          {/* 削除ボタン（右上に重ねて表示） */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={isUploading}
            className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 shadow hover:bg-red-50 hover:border-red-400 transition-colors z-10"
            title="削除"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
            ) : (
              <X className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
            )}
          </button>
        </div>
      ) : (
        /* ファイルなし: アップロードエリア */
        <div
          className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,application/pdf"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
            id={`file-input-${orderId}-${imageType}`}
          />
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">アップロード中...</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">PNG / PDF</span>
            </>
          )}
        </div>
      )}

      {/* 拡大プレビューモーダル */}
      {isPreviewOpen && currentImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 shadow-lg z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="w-full h-full p-4">
              {isPDFFile ? (
                <iframe
                  src={currentImageUrl}
                  className="w-full h-full border-0"
                  title={label}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={currentImageUrl}
                  alt={label}
                  className="w-full h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
