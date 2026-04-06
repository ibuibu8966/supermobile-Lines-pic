"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfitLoss } from "@/hooks/use-profit-loss";
import { PLSummaryCards } from "./components/pl-summary-cards";
import { PLRevenueTable } from "./components/pl-revenue-table";
import { PLExpenseTable } from "./components/pl-expense-table";
import { PLReferralTable } from "./components/pl-referral-table";

/** 現在の月度を判定（18日以降なら翌月度） */
function getCurrentPeriod() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() >= 18) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month };
}

export function ProfitLossClient() {
  const initial = getCurrentPeriod();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const { data, isLoading, error } = useProfitLoss(year, month);

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  /** 期間表示テキスト */
  const periodStartMonth = month === 1 ? 12 : month - 1;
  const periodStartYear = month === 1 ? year - 1 : year;
  const periodText = `${periodStartYear}/${periodStartMonth}/18 〜 ${year}/${month}/17`;

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        データの取得に失敗しました
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 月ナビゲーター */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h2 className="text-xl font-bold">{year}年{month}月度</h2>
          <p className="text-sm text-gray-500">{periodText}</p>
        </div>
        <Button variant="outline" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <PLSummaryCards
            totalRevenue={data.totalRevenue}
            totalExpense={data.totalExpense}
            totalReferralFee={data.totalReferralFee}
            profit={data.profit}
          />

          {/* 売上明細 */}
          <PLRevenueTable
            groups={data.revenueGroups}
            totalRevenue={data.totalRevenue}
          />

          {/* 費用明細 */}
          <PLExpenseTable
            groups={data.expenseGroups}
            totalExpense={data.totalExpense}
          />

          {/* 紹介料明細 */}
          <PLReferralTable
            groups={data.referralGroups}
            totalReferralFee={data.totalReferralFee}
          />
        </>
      )}
    </div>
  );
}
