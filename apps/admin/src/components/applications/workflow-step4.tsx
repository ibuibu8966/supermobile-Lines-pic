"use client";

import React, { useEffect, useCallback } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appId: string;
  shippingImagePath: string | null;
  lineStatus: string | null;
  lines: { id: string }[];
  locked?: boolean;
  onRefresh: () => void;
  onOptimisticChange: (field: "shippingImagePath" | "lineStatus", value: string | null) => void;
}

export function WorkflowStep4({ appId, shippingImagePath, lineStatus, lines, locked = false, onRefresh, onOptimisticChange }: Props) {
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  // ローカル楽観的state
  const [localShippingImagePath, setLocalShippingImagePath] = React.useState(shippingImagePath);

  // propsが変わったら同期
  useEffect(() => { setLocalShippingImagePath(shippingImagePath); }, [shippingImagePath]);

  const setL = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  // 展開時に signed URL を取得
  useEffect(() => {
    if (!shippingImagePath) return;
    fetch(`/api/applications/${appId}/workflow-upload`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.shipping) setImageUrl(data.shipping); })
      .catch(() => {});
  }, [appId, shippingImagePath]);

  const handleSetAllLinesStatus = useCallback(async (status: string) => {
    if (lines.length === 0) return;
    onOptimisticChange("lineStatus", status); // 即時反映
    setL(`lines_${status}`, true);
    try {
      await fetch(`/api/applications/${appId}/lines/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineIds: lines.map((l) => l.id), status }),
      });
      onRefresh();
    } catch {
      onOptimisticChange("lineStatus", lineStatus); // 失敗時に戻す
      toast.error("回線ステータス更新に失敗しました");
    }
    finally { setL(`lines_${status}`, false); }
  }, [appId, lines, lineStatus, onRefresh, onOptimisticChange]);

  const handleUpload = async (file: File) => {
    // 楽観的に「アップロード済み」表示
    setLocalShippingImagePath("uploading");
    onOptimisticChange("shippingImagePath", "uploading");
    setL("upload_shipping", true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("imageType", "shipping");
      const res = await fetch(`/api/applications/${appId}/workflow-upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
      onRefresh();
      toast.success("アップロード完了");
    } catch {
      // 失敗時に元に戻す
      setLocalShippingImagePath(shippingImagePath);
      onOptimisticChange("shippingImagePath", shippingImagePath);
      toast.error("アップロードに失敗しました");
    }
    finally { setL("upload_shipping", false); }
  };

  // 発送画像アップロードで自動SHIPPING_INSTRUCTED
  useEffect(() => {
    if (shippingImagePath && lineStatus !== "SHIPPING_INSTRUCTED" && lineStatus !== "SHIPPED") {
      handleSetAllLinesStatus("SHIPPING_INSTRUCTED");
    }
  }, [shippingImagePath, lineStatus, handleSetAllLinesStatus]);

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">発送指示画像</label>
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
            <img src={imageUrl} alt="発送＆住所確認" className="max-h-48 rounded border object-contain cursor-pointer hover:opacity-80" />
          </a>
        )}
        <div className="flex items-center gap-2">
          {localShippingImagePath && <span className="text-xs text-green-600">✓ アップロード済み</span>}
          <label className={`cursor-pointer flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 ${loading["upload_shipping"] || locked ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-3 w-3" />
            {localShippingImagePath ? "再アップロード" : "アップロード"}
            <input type="file" className="hidden" accept="image/*" disabled={locked}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          </label>
          {loading["upload_shipping"] && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
