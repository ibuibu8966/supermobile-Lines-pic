"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { ManualSettings, ColumnMapping } from "@/types/procurement-import";

interface UsageTag {
  id: number;
  name: string;
  code: string;
}

interface ManualSettingsFormProps {
  mapping: ColumnMapping;
  usageTags: UsageTag[];
  onSettingsChange: (settings: ManualSettings) => void;
}

const SIM_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "個人回線" },
  { value: "CORPORATE", label: "法人回線" },
  { value: "BOTH", label: "両方" },
];

const CARRIER_OPTIONS = [
  { value: "DOCOMO", label: "ドコモ" },
  { value: "AU", label: "au" },
  { value: "SOFTBANK", label: "ソフトバンク" },
  { value: "RAKUTEN", label: "楽天モバイル" },
];

export function ManualSettingsForm({
  mapping,
  usageTags,
  onSettingsChange,
}: ManualSettingsFormProps) {
  const [settings, setSettings] = useState<ManualSettings>({});

  // CSVでマッピングされているフィールドを判定（注記表示のため）
  const mappedFields = Object.values(mapping);
  const hasSimType = mappedFields.includes("simType");
  const hasCarrierType = mappedFields.includes("carrierType");
  const hasPlan = mappedFields.includes("plan");
  const hasAutoCancelDate = mappedFields.includes("autoCancelDate");
  const hasUsageTag = mappedFields.includes("usageTag");

  const updateSetting = <K extends keyof ManualSettings>(
    key: K,
    value: ManualSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleTagToggle = (tagId: number) => {
    const currentTags = settings.eligibleTagIds || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];
    updateSetting("eligibleTagIds", newTags.length > 0 ? newTags : undefined);
  };

  return (
    <Card className="max-w-[1024px]">
      <CardHeader>
        <CardTitle className="text-base">
          一括設定（全行に適用）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SIMタイプ - 常に表示 */}
          <div className="space-y-2">
            <Label>
              SIMタイプ（任意）
              {hasSimType && <span className="text-xs text-gray-500 ml-2">※CSVの値が優先</span>}
            </Label>
            <Select
              value={settings.simType}
              onValueChange={(value) =>
                updateSetting("simType", value as ManualSettings["simType"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent>
                {SIM_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* キャリア - 常に表示 */}
          <div className="space-y-2">
            <Label>
              キャリア（任意）
              {hasCarrierType && <span className="text-xs text-gray-500 ml-2">※CSVの値が優先</span>}
            </Label>
            <Select
              value={settings.carrierType}
              onValueChange={(value) =>
                updateSetting(
                  "carrierType",
                  value as ManualSettings["carrierType"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* プラン - 常に表示 */}
          <div className="space-y-2">
            <Label>
              プラン（任意）
              {hasPlan && <span className="text-xs text-gray-500 ml-2">※CSVの値が優先</span>}
            </Label>
            <Input
              type="text"
              placeholder="例: 音声プラン"
              value={settings.plan || ""}
              onChange={(e) => {
                const value = e.target.value;
                updateSetting("plan", value || undefined);
              }}
            />
          </div>

          {/* 解約予定日 - 常に表示 */}
          <div className="space-y-2">
            <Label>
              解約予定日（任意）
              {hasAutoCancelDate && <span className="text-xs text-gray-500 ml-2">※CSVの値が優先</span>}
            </Label>
            <Input
              type="date"
              value={
                settings.autoCancelDate
                  ? settings.autoCancelDate.split("T")[0]
                  : ""
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  const isoDate = new Date(value).toISOString();
                  updateSetting("autoCancelDate", isoDate);
                } else {
                  updateSetting("autoCancelDate", undefined);
                }
              }}
            />
          </div>

          {/* 自動解約 - 常に表示 */}
          <div className="space-y-2">
            <Label>自動解約</Label>
            <div className="flex items-center gap-2 h-10">
              <Checkbox
                checked={settings.isAutoCancel ?? false}
                onCheckedChange={(checked) =>
                  updateSetting("isAutoCancel", checked ? true : undefined)
                }
              />
              <span className="text-sm">自動解約を有効にする</span>
            </div>
          </div>
        </div>

        {/* 用途タグ - 常に表示 */}
        {usageTags.length > 0 && (
          <div className="space-y-2">
            <Label>
              用途タグ（複数選択可）
              {hasUsageTag && <span className="text-xs text-gray-500 ml-2">※CSVの値が優先</span>}
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
              {usageTags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.eligibleTagIds?.includes(tag.id) ?? false}
                    onCheckedChange={() => handleTagToggle(tag.id)}
                  />
                  <span className="text-sm">{tag.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
