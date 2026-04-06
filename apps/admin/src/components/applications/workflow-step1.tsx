"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/common/currency-input";

interface ReferrerTag { id: number; name: string }
interface Referral { id: string; referrerName: string; fee: number }

interface Props {
  appId: string;
  noReferral: boolean;
  referrals: Referral[];
  referrerTags: ReferrerTag[];
  lineCount: number;
  onRefresh: () => void;
  onOptimisticChange: (done: boolean) => void;
}

export function WorkflowStep1({ appId, noReferral, referrals, referrerTags, lineCount, onRefresh, onOptimisticChange }: Props) {
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [newReferrerName, setNewReferrerName] = React.useState("");
  const [newReferrerFee, setNewReferrerFee] = React.useState("");

  // ローカル楽観的state
  const [localNoReferral, setLocalNoReferral] = React.useState(noReferral);
  const [localReferrals, setLocalReferrals] = React.useState<Referral[]>(referrals);

  // propsが変わったら同期
  useEffect(() => { setLocalNoReferral(noReferral); }, [noReferral]);
  useEffect(() => { setLocalReferrals(referrals); }, [referrals]);

  // 楽観的な完了状態を親に通知
  useEffect(() => {
    onOptimisticChange(localNoReferral || localReferrals.length > 0);
  }, [localNoReferral, localReferrals, onOptimisticChange]);

  const setL = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  const handleSetNoReferral = async (value: boolean) => {
    setLocalNoReferral(value); // 即時反映
    setL("noReferral", true);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noReferral: value }),
      });
      if (!res.ok) throw new Error();
      onRefresh();
      toast.success(value ? "紹介者なしに設定しました" : "紹介者なしを解除しました");
    } catch {
      setLocalNoReferral(!value); // 失敗時に戻す
      toast.error("更新に失敗しました");
    }
    finally { setL("noReferral", false); }
  };

  const handleAddReferral = async () => {
    if (!newReferrerName || !newReferrerFee) return;
    const tmpId = `tmp_${Date.now()}`;
    const tmpEntry: Referral = { id: tmpId, referrerName: newReferrerName, fee: Number(newReferrerFee) };
    setLocalReferrals((prev) => [...prev, tmpEntry]); // 即時追加
    setNewReferrerName("");
    setNewReferrerFee("");
    setL("addReferral", true);
    try {
      const res = await fetch(`/api/applications/${appId}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerName: tmpEntry.referrerName, fee: tmpEntry.fee }),
      });
      if (!res.ok) throw new Error();
      onRefresh(); // 正式IDで上書き
      toast.success("紹介者を追加しました");
    } catch {
      setLocalReferrals((prev) => prev.filter((r) => r.id !== tmpId)); // 失敗時に除去
      toast.error("追加に失敗しました");
    }
    finally { setL("addReferral", false); }
  };

  const handleDeleteReferral = async (rid: string) => {
    const removed = localReferrals.find((r) => r.id === rid);
    setLocalReferrals((prev) => prev.filter((r) => r.id !== rid)); // 即時除去
    setL(`delRef_${rid}`, true);
    try {
      const res = await fetch(`/api/applications/${appId}/referrals/${rid}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onRefresh();
      toast.success("紹介者を削除しました");
    } catch {
      if (removed) setLocalReferrals((prev) => [...prev, removed]); // 失敗時に戻す
      toast.error("削除に失敗しました");
    }
    finally { setL(`delRef_${rid}`, false); }
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
      {/* 紹介者なし */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`noReferral_${appId}`}
          checked={localNoReferral}
          onChange={(e) => handleSetNoReferral(e.target.checked)}
          disabled={loading.noReferral}
          className="h-4 w-4"
        />
        <label htmlFor={`noReferral_${appId}`} className="text-sm">紹介者なし</label>
        {loading.noReferral && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
      </div>
      {/* 紹介者一覧 */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-1 text-xs text-gray-400">
          <span>紹介者名</span>
          <span className="text-right w-24">紹介料</span>
          <span className="text-right w-24">紹介料合計</span>
          <span className="w-4" />
        </div>
        {localReferrals.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-400">—</div>
        ) : (
          localReferrals.map((ref) => {
            const isTmp = ref.id.startsWith("tmp_");
            const total = ref.fee * lineCount;
            return (
              <div
                key={ref.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 bg-white border rounded px-3 py-2 text-sm items-center ${isTmp ? "opacity-60" : ""}`}
              >
                <span>{ref.referrerName}</span>
                <span className="text-right w-24">¥{ref.fee.toLocaleString()}</span>
                <span className="text-right w-24 font-medium">¥{total.toLocaleString()}</span>
                <button
                  onClick={() => !isTmp && handleDeleteReferral(ref.id)}
                  disabled={loading[`delRef_${ref.id}`] || isTmp}
                  className="text-red-400 hover:text-red-600 w-4 disabled:opacity-40"
                >
                  {loading[`delRef_${ref.id}`]
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            );
          })
        )}
      </div>
      {/* 追加フォーム */}
      {!localNoReferral && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-end px-3 py-2 bg-white border rounded">
          <div>
            <label className="text-xs text-gray-500">紹介者名</label>
            <select
              className="w-full mt-1 px-2 py-1 border rounded text-sm"
              value={newReferrerName}
              onChange={(e) => setNewReferrerName(e.target.value)}
            >
              <option value="">選択してください</option>
              {referrerTags.map((tag) => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500">紹介料</label>
            <CurrencyInput
              className="w-full mt-1 px-2 py-1 border rounded text-sm"
              value={Number(newReferrerFee) || 0}
              onChange={(val) => setNewReferrerFee(String(val))}
              placeholder="金額"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500">紹介料合計</label>
            <div className="mt-1 px-2 py-1 text-sm font-medium text-gray-700">
              ¥{((Number(newReferrerFee) || 0) * lineCount).toLocaleString()}
            </div>
          </div>
          <Button size="sm" onClick={handleAddReferral} disabled={loading.addReferral || !newReferrerName || !newReferrerFee}>
            {loading.addReferral ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
            追加
          </Button>
        </div>
      )}
    </div>
  );
}
