"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tags, MapPin, Tag, Bookmark, UserPlus, Plus } from "lucide-react";
import { TagManager, TagManagerConfig } from "@/components/tags/tag-manager";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";

// Configuration for each tag type
const TAG_CONFIGS: Record<string, TagManagerConfig> = {
  usage: {
    apiEndpoint: "/api/usage-tags",
    queryKey: queryKeys.usageTags,
    queryFn: api.getUsageTags,
    title: "用途タグ一覧",
    emptyMessage: "用途タグが登録されていません",
    hasCategoryGrouping: true,
    formFields: [
      { name: "name", label: "表示名", placeholder: "ポケカ認証", required: true },
      { name: "category", label: "カテゴリ", placeholder: "認証系" },
      { name: "description", label: "説明", type: "textarea", placeholder: "このタグの説明..." },
      { name: "displayOrder", label: "表示順", type: "number" },
    ],
    renderCount: (count) => `契約: ${count.contractTags ?? 0} / プラン: ${count.planTags ?? 0}`,
    labels: {
      createButton: "新規タグ作成",
      modalCreateTitle: "新規用途タグ作成",
      modalEditTitle: "用途タグ編集",
    },
  },
  "sim-location": {
    apiEndpoint: "/api/sim-location-tags",
    queryKey: queryKeys.simLocationTags,
    queryFn: api.getSimLocationTags,
    title: "SIMの場所一覧",
    emptyMessage: "SIMの場所タグが登録されていません",
    formFields: [
      { name: "name", label: "表示名", placeholder: "倉庫A", required: true },
      { name: "displayOrder", label: "表示順", type: "number" },
    ],
    renderCount: (count) => `${count.sims ?? 0}件`,
    labels: {
      createButton: "新規作成",
      modalCreateTitle: "新規SIMの場所作成",
      modalEditTitle: "SIMの場所編集",
    },
  },
  line: {
    apiEndpoint: "/api/line-tags",
    queryKey: queryKeys.lineTags,
    queryFn: api.getLineTags,
    title: "回線タグ一覧",
    emptyMessage: "回線タグが登録されていません",
    formFields: [
      { name: "name", label: "表示名", placeholder: "MNP用", required: true },
      { name: "displayOrder", label: "表示順", type: "number" },
    ],
    renderCount: (count) => `${count.applicationLines ?? 0}件`,
    labels: {
      createButton: "新規作成",
      modalCreateTitle: "新規回線タグ作成",
      modalEditTitle: "回線タグ編集",
    },
  },
  "line-reserve": {
    apiEndpoint: "/api/line-reserve-tags",
    queryKey: queryKeys.lineReserveTags,
    queryFn: api.getLineReserveTags,
    title: "回線予備タグ一覧",
    emptyMessage: "回線予備タグが登録されていません",
    formFields: [
      { name: "name", label: "表示名", placeholder: "予備1", required: true },
      { name: "displayOrder", label: "表示順", type: "number" },
    ],
    renderCount: (count) => `${count.applicationLines ?? 0}件`,
    labels: {
      createButton: "新規作成",
      modalCreateTitle: "新規回線予備タグ作成",
      modalEditTitle: "回線予備タグ編集",
    },
  },
  referrer: {
    apiEndpoint: "/api/referrer-tags",
    queryKey: queryKeys.referrerTags,
    queryFn: api.getReferrerTags,
    title: "紹介者タグ一覧",
    emptyMessage: "紹介者タグが登録されていません",
    formFields: [
      { name: "name", label: "表示名", placeholder: "パートナーA", required: true },
      { name: "displayOrder", label: "表示順", type: "number" },
    ],
    renderCount: (count) => `${count.customers ?? 0}件`,
    labels: {
      createButton: "新規作成",
      modalCreateTitle: "新規紹介者タグ作成",
      modalEditTitle: "紹介者タグ編集",
    },
  },
};

const TAB_ITEMS = [
  { value: "usage", label: "用途タグ", icon: Tags },
  { value: "sim-location", label: "SIMの場所", icon: MapPin },
  { value: "line", label: "回線タグ", icon: Tag },
  { value: "line-reserve", label: "回線予備タグ", icon: Bookmark },
  { value: "referrer", label: "紹介者", icon: UserPlus },
];

export function TagsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "usage";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [createTrigger, setCreateTrigger] = useState(0);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.replace(`/tags?tab=${value}`, { scroll: false });
  };

  const triggerCreate = () => {
    setCreateTrigger((prev) => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Underlined tabs with icons + Create button */}
          <div className="flex justify-between items-center border-b mb-6">
            <TabsList className="justify-start bg-transparent p-0 h-auto">
              {TAB_ITEMS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button onClick={triggerCreate} className="mb-1">
              <Plus className="h-4 w-4 mr-2" />
              {TAG_CONFIGS[activeTab]?.labels.createButton || "新規作成"}
            </Button>
          </div>

          {TAB_ITEMS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              <TagManager config={TAG_CONFIGS[tab.value]} createTrigger={createTrigger} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
