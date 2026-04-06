"use client";

import React, { useEffect, useCallback } from "react";
import { Loader2, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appId: string;
  invoicePdfPath: string | null;
  invoiceUrl: string | null;
  invoiceEmailPath: string | null;
  paymentStatus: string | null;
  step2AllUploaded: boolean;
  locked?: boolean;
  onRefresh: () => void;
  onOptimisticChange: (field: "invoicePdfPath" | "invoiceEmailPath" | "paymentStatus", value: string | null) => void;
}

export function WorkflowStep2({
  appId,
  invoicePdfPath,
  invoiceUrl,
  invoiceEmailPath,
  paymentStatus,
  step2AllUploaded,
  locked = false,
  onRefresh,
  onOptimisticChange,
}: Props) {
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [newInvoiceUrl, setNewInvoiceUrl] = React.useState(invoiceUrl ?? "");
  const [imageUrls, setImageUrls] = React.useState<{ invoicePdf: string | null; invoiceEmail: string | null }>({
    invoicePdf: null,
    invoiceEmail: null,
  });

  // ローカル楽観的state（アップロード済み表示用）
  const [localInvoicePdfPath, setLocalInvoicePdfPath] = React.useState(invoicePdfPath);
  const [localInvoiceEmailPath, setLocalInvoiceEmailPath] = React.useState(invoiceEmailPath);

  // propsが変わったら同期
  useEffect(() => { setLocalInvoicePdfPath(invoicePdfPath); }, [invoicePdfPath]);
  useEffect(() => { setLocalInvoiceEmailPath(invoiceEmailPath); }, [invoiceEmailPath]);
  useEffect(() => { setNewInvoiceUrl(invoiceUrl ?? ""); }, [invoiceUrl]);

  const setL = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  // 展開時に signed URL を取得
  useEffect(() => {
    if (!invoicePdfPath && !invoiceEmailPath) return;
    fetch(`/api/applications/${appId}/workflow-upload`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) setImageUrls({ invoicePdf: data.invoicePdf ?? null, invoiceEmail: data.invoiceEmail ?? null });
      })
      .catch(() => {});
  }, [appId, invoicePdfPath, invoiceEmailPath]);

  const handleSaveInvoiceUrl = async () => {
    setL("invoiceUrl", true);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceUrl: newInvoiceUrl || null }),
      });
      if (!res.ok) throw new Error();
      onRefresh();
      toast.success("URLを保存しました");
    } catch { toast.error("保存に失敗しました"); }
    finally { setL("invoiceUrl", false); }
  };

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

  const handleUpload = async (imageType: "invoicePdf" | "invoiceEmail", file: File) => {
    // 楽観的に「アップロード済み」表示
    if (imageType === "invoicePdf") {
      setLocalInvoicePdfPath("uploading");
      onOptimisticChange("invoicePdfPath", "uploading");
    } else {
      setLocalInvoiceEmailPath("uploading");
      onOptimisticChange("invoiceEmailPath", "uploading");
    }
    setL(`upload_${imageType}`, true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("imageType", imageType);
      const res = await fetch(`/api/applications/${appId}/workflow-upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) setImageUrls((prev) => ({ ...prev, [imageType]: data.url }));
      onRefresh();
      toast.success("アップロード完了");
    } catch {
      // 失敗時に元に戻す
      if (imageType === "invoicePdf") {
        setLocalInvoicePdfPath(invoicePdfPath);
        onOptimisticChange("invoicePdfPath", invoicePdfPath);
      } else {
        setLocalInvoiceEmailPath(invoiceEmailPath);
        onOptimisticChange("invoiceEmailPath", invoiceEmailPath);
      }
      toast.error("アップロードに失敗しました");
    }
    finally { setL(`upload_${imageType}`, false); }
  };

  // 3点揃ったら自動でINVOICEDに
  useEffect(() => {
    if (step2AllUploaded && paymentStatus !== "INVOICED" && paymentStatus !== "PAID") {
      handleSetPaymentStatus("INVOICED");
    }
  }, [step2AllUploaded, paymentStatus, handleSetPaymentStatus]);

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
      {/* 請求書PDF */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">請求書PDF</label>
        {imageUrls.invoicePdf && (() => {
          const isPdf = !!(invoicePdfPath?.toLowerCase().endsWith(".pdf"));
          return isPdf ? (
            <div className="mb-2">
              <iframe
                src={`${imageUrls.invoicePdf}#zoom=page-fit&toolbar=0`}
                className="rounded border"
                style={{ width: "100%", height: "600px" }}
                title="請求書PDF"
              />
              <a href={imageUrls.invoicePdf} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3" />別タブで開く
              </a>
            </div>
          ) : (
            <a href={imageUrls.invoicePdf} target="_blank" rel="noopener noreferrer" className="block mb-2">
              <img src={imageUrls.invoicePdf} alt="請求書PDF" className="max-h-48 rounded border object-contain cursor-pointer hover:opacity-80"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </a>
          );
        })()}
        <div className="flex items-center gap-2">
          {localInvoicePdfPath && <span className="text-xs text-green-600">✓ アップロード済み</span>}
          <label className={`cursor-pointer flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 ${loading["upload_invoicePdf"] || locked ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-3 w-3" />
            {localInvoicePdfPath ? "再アップロード" : "アップロード"}
            <input type="file" className="hidden" accept="image/*,application/pdf" disabled={locked}
              onChange={(e) => e.target.files?.[0] && handleUpload("invoicePdf", e.target.files[0])} />
          </label>
          {loading["upload_invoicePdf"] && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>
      {/* 請求書URL */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">請求書URL</label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={newInvoiceUrl}
            onChange={(e) => setNewInvoiceUrl(e.target.value)}
            onBlur={handleSaveInvoiceUrl}
            placeholder="https://..."
            disabled={locked}
          />
          {loading.invoiceUrl && <Loader2 className="h-4 w-4 animate-spin text-gray-400 self-center" />}
          {invoiceUrl && (
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 hover:text-blue-700">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
      {/* メール画像 */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">メール画像</label>
        {imageUrls.invoiceEmail && (
          <a href={imageUrls.invoiceEmail} target="_blank" rel="noopener noreferrer" className="block mb-2">
            <img src={imageUrls.invoiceEmail} alt="メール画像" className="max-h-48 rounded border object-contain cursor-pointer hover:opacity-80" />
          </a>
        )}
        <div className="flex items-center gap-2">
          {localInvoiceEmailPath && <span className="text-xs text-green-600">✓ アップロード済み</span>}
          <label className={`cursor-pointer flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 ${loading["upload_invoiceEmail"] || locked ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-3 w-3" />
            {localInvoiceEmailPath ? "再アップロード" : "アップロード"}
            <input type="file" className="hidden" accept="image/*" disabled={locked}
              onChange={(e) => e.target.files?.[0] && handleUpload("invoiceEmail", e.target.files[0])} />
          </label>
          {loading["upload_invoiceEmail"] && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>
      {!step2AllUploaded && (
        <p className="text-xs text-amber-600">請求書PDF・URL・メール画像の3点を揃えると自動で請求書発行済みになります</p>
      )}
    </div>
  );
}
