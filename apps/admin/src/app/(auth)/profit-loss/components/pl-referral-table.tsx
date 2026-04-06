"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReferralGroup } from "@/types/profit-loss";

interface PLReferralTableProps {
  groups: ReferralGroup[];
  totalReferralFee: number;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
}

export function PLReferralTable({ groups, totalReferralFee }: PLReferralTableProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.referrerName))
  );

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">紹介料明細</h3>
        <p className="text-sm text-gray-500">該当するデータがありません</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">紹介料明細</h3>
      <div className="space-y-4">
        {groups.map((group) => {
          const isOpen = openGroups.has(group.referrerName);
          return (
            <div key={group.referrerName}>
              <button
                onClick={() => toggleGroup(group.referrerName)}
                className="w-full flex items-center justify-between py-2 px-3 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="font-medium text-sm">{group.referrerName}</span>
                  <span className="text-xs text-gray-500">({group.items.length}件)</span>
                </div>
                <span className="font-medium text-sm text-purple-700">
                  小計: {formatCurrency(group.subtotal)}
                </span>
              </button>
              {isOpen && (
                <table className="w-full mt-1">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="py-2 pl-10 text-left font-normal">日付</th>
                      <th className="py-2 text-left font-normal">申込番号</th>
                      <th className="py-2 pr-3 text-right font-normal">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 pl-10 text-sm text-gray-600">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-2 text-sm font-medium">
                          #{item.applicationNumber}
                        </td>
                        <td className="py-2 pr-3 text-sm text-right font-medium">
                          {formatCurrency(item.fee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t flex justify-end">
        <span className="font-bold text-purple-700">
          紹介料合計: {formatCurrency(totalReferralFee)}
        </span>
      </div>
    </div>
  );
}
