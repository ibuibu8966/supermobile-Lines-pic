"use client";

import React, { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const CARRIER_LABELS: Record<string, string> = {
  YAMATO: "ヤマト運輸",
  SAGAWA: "佐川急便",
  YUBIN: "日本郵便",
};

interface Tracking { id: string; carrier: string; trackingNumber: string }

interface Props {
  appId: string;
  trackings: Tracking[];
  lines: { id: string }[];
  locked?: boolean;
  onRefresh: () => void;
  onOptimisticChange: (count: number) => void;
}

export function WorkflowStep5({ appId, trackings, lines, locked = false, onRefresh, onOptimisticChange }: Props) {
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [newCarrier, setNewCarrier] = React.useState("");
  const [newTrackingNumber, setNewTrackingNumber] = React.useState("");

  // ローカル楽観的state
  const [localTrackings, setLocalTrackings] = React.useState<Tracking[]>(trackings);

  // propsが変わったら同期
  useEffect(() => { setLocalTrackings(trackings); }, [trackings]);

  // 楽観的な件数を親に通知
  useEffect(() => {
    onOptimisticChange(localTrackings.length);
  }, [localTrackings, onOptimisticChange]);

  const setL = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  const handleAddTracking = useCallback(async () => {
    if (!newTrackingNumber) return;
    const tmpId = `tmp_${Date.now()}`;
    const tmpEntry: Tracking = { id: tmpId, carrier: newCarrier, trackingNumber: newTrackingNumber };
    setLocalTrackings((prev) => [...prev, tmpEntry]); // 即時追加
    setNewCarrier("");
    setNewTrackingNumber("");
    setL("addTracking", true);
    try {
      const res = await fetch(`/api/applications/${appId}/trackings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier: newCarrier || "", trackingNumber: newTrackingNumber }),
      });
      if (!res.ok) throw new Error("failed");
      // 追跡番号追加と同時に全回線をSHIPPEDに
      if (lines.length > 0) {
        await fetch(`/api/applications/${appId}/lines/bulk`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineIds: lines.map((l) => l.id), status: "SHIPPED" }),
        });
      }
      onRefresh(); // 正式IDで上書き
      toast.success("追跡番号を追加しました");
    } catch {
      setLocalTrackings((prev) => prev.filter((t) => t.id !== tmpId)); // 失敗時に除去
      toast.error("追加に失敗しました");
    }
    finally { setL("addTracking", false); }
  }, [appId, newCarrier, newTrackingNumber, lines, onRefresh]);

  const handleDeleteTracking = useCallback(async (tid: string) => {
    const removed = localTrackings.find((t) => t.id === tid);
    setLocalTrackings((prev) => prev.filter((t) => t.id !== tid)); // 即時除去
    setL(`delTrack_${tid}`, true);
    try {
      const res = await fetch(`/api/applications/${appId}/trackings/${tid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      onRefresh();
      toast.success("追跡番号を削除しました");
    } catch {
      if (removed) setLocalTrackings((prev) => [...prev, removed]); // 失敗時に戻す
      toast.error("削除に失敗しました");
    }
    finally { setL(`delTrack_${tid}`, false); }
  }, [appId, localTrackings, onRefresh]);

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
      <div className="space-y-1">
        {/* ヘッダー */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-1 text-xs text-gray-400">
          <span>配送業者</span>
          <span className="w-40">追跡番号</span>
          <span className="w-4" />
        </div>
        {/* データ行 */}
        {localTrackings.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-400">—</div>
        ) : (
          localTrackings.map((tr) => {
            const isTmp = tr.id.startsWith("tmp_");
            return (
              <div
                key={tr.id}
                className={`grid grid-cols-[1fr_auto_auto] gap-x-4 bg-white border rounded px-3 py-2 text-sm items-center ${isTmp ? "opacity-60" : ""}`}
              >
                <span>{CARRIER_LABELS[tr.carrier] ?? (tr.carrier || "—")}</span>
                <span className="w-40 font-mono">{tr.trackingNumber}</span>
                <button
                  onClick={() => !isTmp && handleDeleteTracking(tr.id)}
                  disabled={loading[`delTrack_${tr.id}`] || isTmp || locked}
                  className="text-red-400 hover:text-red-600 w-4 disabled:opacity-40"
                >
                  {loading[`delTrack_${tr.id}`]
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            );
          })
        )}
        {/* 入力フォーム */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-end px-3 py-2 bg-white border rounded">
          <div>
            <label className="text-xs text-gray-500">配送業者</label>
            <select
              className="w-full mt-1 px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={newCarrier}
              onChange={(e) => setNewCarrier(e.target.value)}
              disabled={locked}
            >
              <option value="">選択してください</option>
              <option value="YAMATO">ヤマト運輸</option>
              <option value="SAGAWA">佐川急便</option>
              <option value="YUBIN">日本郵便</option>
            </select>
          </div>
          <div className="w-40">
            <label className="text-xs text-gray-500">追跡番号</label>
            <input
              className="w-full mt-1 px-2 py-1 border rounded text-sm font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={newTrackingNumber}
              onChange={(e) => setNewTrackingNumber(e.target.value)}
              placeholder="追跡番号"
              disabled={locked}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddTracking}
            disabled={loading.addTracking || !newCarrier || !newTrackingNumber || locked}
          >
            {loading.addTracking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
            追加
          </Button>
        </div>
      </div>
    </div>
  );
}
