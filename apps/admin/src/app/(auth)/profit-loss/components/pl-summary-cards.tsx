"use client";

import { TrendingUp, TrendingDown, Users, Wallet } from "lucide-react";

interface PLSummaryCardsProps {
  totalRevenue: number;
  totalExpense: number;
  totalReferralFee: number;
  profit: number;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export function PLSummaryCards({
  totalRevenue,
  totalExpense,
  totalReferralFee,
  profit,
}: PLSummaryCardsProps) {
  const cards = [
    {
      label: "売上",
      amount: totalRevenue,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "費用",
      amount: totalExpense,
      icon: TrendingDown,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "紹介料",
      amount: totalReferralFee,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "利益",
      amount: profit,
      icon: Wallet,
      color: profit >= 0 ? "text-green-600" : "text-red-600",
      bg: profit >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border p-4 ${card.bg}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-sm text-gray-600">{card.label}</span>
          </div>
          <p className={`text-xl font-bold ${card.color}`}>
            {formatCurrency(card.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
