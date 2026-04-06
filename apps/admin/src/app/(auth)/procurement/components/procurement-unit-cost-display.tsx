"use client";

import type { PurchaseOrderLine } from "@/types/procurement";

interface ProcurementUnitCostDisplayProps {
  lines: PurchaseOrderLine[];
}

export function ProcurementUnitCostDisplay({ lines }: ProcurementUnitCostDisplayProps) {
  const { includedAmount, simQuantity, unitCost } = calculateUnitCost(lines);

  if (unitCost === null) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-700">仕入れ単価</span>
        <span className="text-lg font-bold text-blue-900">
          ¥{unitCost.toLocaleString()}/枚
        </span>
      </div>
      <p className="text-xs text-blue-600 mt-1">
        ¥{includedAmount.toLocaleString()} ÷ {simQuantity.toLocaleString()}枚
      </p>
    </div>
  );
}

export function UnitCostBadge({ lines }: { lines: PurchaseOrderLine[] }) {
  const { unitCost } = calculateUnitCost(lines);
  if (unitCost === null) return <span className="text-gray-400">-</span>;
  return <span className="text-sm font-medium">¥{unitCost.toLocaleString()}/枚</span>;
}

function calculateUnitCost(lines: PurchaseOrderLine[]) {
  const includedAmount = lines
    .filter((l) => l.isIncludedInUnitCost)
    .reduce((sum, l) => sum + l.subtotal, 0);

  const simQuantity = lines
    .filter((l) => l.carrierType !== null)
    .reduce((sum, l) => sum + l.quantity, 0);

  return {
    includedAmount,
    simQuantity,
    unitCost: simQuantity > 0 ? Math.round(includedAmount / simQuantity) : null,
  };
}
