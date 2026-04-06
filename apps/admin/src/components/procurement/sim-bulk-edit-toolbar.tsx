"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";

interface UsageTag {
  id: number;
  name: string;
  code: string;
}

interface SimBulkEditToolbarProps {
  selectedIccids: string[];
  purchaseOrderId: string;
  onComplete: () => void;
}

export function SimBulkEditToolbar({
  selectedIccids,
  purchaseOrderId,
  onComplete,
}: SimBulkEditToolbarProps) {
  const queryClient = useQueryClient();
  const [field, setField] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [usageTags, setUsageTags] = useState<UsageTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/usage-tags")
      .then((res) => res.json())
      .then((data) => setUsageTags(data))
      .catch(() => {});
  }, []);

  if (selectedIccids.length === 0) return null;

  const handleBulkUpdate = async () => {
    if (!field) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = { iccids: selectedIccids };

      if (field === "simType") body.simType = value;
      else if (field === "carrierType") body.carrierType = value || null;
      else if (field === "plan") body.plan = value || null;
      else if (field === "eligibleTagIds") body.eligibleTagIds = selectedTagIds;
      else if (field === "status") body.status = value;

      const res = await fetch(
        `/api/procurement/${purchaseOrderId}/sims/bulk-update`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "更新に失敗しました");
        return;
      }

      toast.success(`${result.updated}件のSIMを更新しました`);
      queryClient.invalidateQueries({
        queryKey: queryKeys.procurementSims(purchaseOrderId),
      });
      onComplete();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Badge variant="secondary">{selectedIccids.length}件選択中</Badge>

      <Select value={field} onValueChange={(v) => { setField(v); setValue(""); setSelectedTagIds([]); }}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="変更項目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="simType">SIMタイプ</SelectItem>
          <SelectItem value="carrierType">キャリア</SelectItem>
          <SelectItem value="plan">プラン</SelectItem>
          <SelectItem value="eligibleTagIds">利用可能タグ</SelectItem>
          <SelectItem value="status">ステータス</SelectItem>
        </SelectContent>
      </Select>

      {field === "simType" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIVIDUAL">個人回線</SelectItem>
            <SelectItem value="CORPORATE">法人回線</SelectItem>
            <SelectItem value="BOTH">両方</SelectItem>
          </SelectContent>
        </Select>
      )}

      {field === "carrierType" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DOCOMO">ドコモ</SelectItem>
            <SelectItem value="AU">au</SelectItem>
            <SelectItem value="SOFTBANK">ソフトバンク</SelectItem>
            <SelectItem value="RAKUTEN">楽天モバイル</SelectItem>
          </SelectContent>
        </Select>
      )}

      {field === "status" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IN_STOCK">在庫</SelectItem>
            <SelectItem value="ACTIVE">利用中</SelectItem>
            <SelectItem value="RETURNING">返却中</SelectItem>
            <SelectItem value="RETIRED">廃棄</SelectItem>
            <SelectItem value="CANCELLED">解約</SelectItem>
          </SelectContent>
        </Select>
      )}

      {field === "eligibleTagIds" && (
        <div className="flex items-center gap-1 flex-wrap">
          {usageTags.map((tag) => (
            <Badge
              key={tag.id}
              variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                setSelectedTagIds((prev) =>
                  prev.includes(tag.id)
                    ? prev.filter((id) => id !== tag.id)
                    : [...prev, tag.id]
                );
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {field === "plan" && (
        <input
          type="text"
          className="border rounded px-2 py-1 text-sm w-[200px]"
          placeholder="プラン名を入力"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}

      <Button
        size="sm"
        onClick={handleBulkUpdate}
        disabled={loading || !field || (field !== "eligibleTagIds" && !value) || (field === "eligibleTagIds" && selectedTagIds.length === 0)}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Edit2 className="h-4 w-4 mr-1" />
            一括更新
          </>
        )}
      </Button>
    </div>
  );
}
