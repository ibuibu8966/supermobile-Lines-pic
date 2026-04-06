"use client";

import React, { useEffect, useCallback } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appId: string;
  paymentImagePath: string | null;
  paymentStatus: string | null;
  locked?: boolean;
  onRefresh: () => void;
  onOptimisticChange: (field: "paymentImagePath" | "paymentStatus", value: string | null) => void;
}

export function WorkflowStep3({ appId, paymentImagePath, paymentStatus, locked = false, onRefresh, onOptimisticChange }: Props) {
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  // ローカル楽観的state
  const [localPaymentImagePath, setLocalPaymentImagePath] = React.useState(paymentImagePath);

  // propsが変わったら同期
  useEffect(() => { setLocalPaymentImagePath(paymentImagePath); }, [paymentImagePath]);

  const setL = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  // 展開時に signed URL を取得
  useEffect(() => {
    if (!paymentImagePath) return;
    fetch(`/api/applications/${appId}/workflow-upload`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.payment) setImageUrl(data.payment); })
      .catch(() => {});
  }, [appId, paymentImagePath]);

  const handleSetPaymentStatus = useCallback(async (status: string) => {
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: status }),
      });
      if (!res.ok) throw new Error();
      onRefresh();
    } catch { toast.error("更新に失敗しました"); }
  }, [appId, onRefresh]);

  const handleUpload = async (file: File) => {
    // 楽観的に「アップロード済み」表示
    setLocalPaymentImagePath("uploading");
    onOptimisticChange("paymentImagePath", "uploading");
    setL("upload_payment", true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("imageType", "payment");
      const res = await fetch(`/api/applications/${appId}/workflow-upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
      onRefresh();
      toast.success("アップロード完了");
    } catch {
      // 失敗時に元に戻す
      setLocalPaymentImagePath(paymentImagePath);
      onOptimisticChange("paymentImagePath", paymentImagePath);
      toast.error("アップロードに失敗しました");
    }
    finally { setL("upload_payment", false); }
  };

  // 入金確認画像アップロードで自動PAID
  useEffect(() => {
    if (paymentImagePath && paymentStatus !== "PAID") {
      handleSetPaymentStatus("PAID");
    }
  }, [paymentImagePath, paymentStatus, handleSetPaymentStatus]);

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">入金確認画像</label>
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
            <img src={imageUrl} alt="入金確認" className="max-h-48 rounded border object-contain cursor-pointer hover:opacity-80" />
          </a>
        )}
        <div className="flex items-center gap-2">
          {localPaymentImagePath && <span className="text-xs text-green-600">✓ アップロード済み</span>}
          <label className={`cursor-pointer flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 ${loading["upload_payment"] || locked ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-3 w-3" />
            {localPaymentImagePath ? "再アップロード" : "アップロード"}
            <input type="file" className="hidden" accept="image/*" disabled={locked}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          </label>
          {loading["upload_payment"] && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>
      {!localPaymentImagePath && (
        <p className="text-xs text-amber-600">入金確認画像をアップロードすると自動で入金済みになります</p>
      )}
    </div>
  );
}
