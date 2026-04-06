"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, parseCurrency } from "@/lib/utils/formatters";

interface EditableAmountFieldProps {
  orderId: string;
  value: number;
  onSave: (orderId: string, amount: number) => void;
  className?: string;
}

export function EditableAmountField({
  orderId,
  value,
  onSave,
  className = "w-40",
}: EditableAmountFieldProps) {
  const [editValue, setEditValue] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const displayValue = isEditing && editValue !== "" ? editValue : value.toLocaleString();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setEditValue(formatted);
  };

  const handleBlur = () => {
    if (editValue !== "") {
      const numericValue = parseCurrency(editValue);
      if (numericValue > 0) {
        onSave(orderId, numericValue);
      }
    }
    // 楽観的更新が完了するまで少し待機してからリセット（フリッカー防止）
    setTimeout(() => {
      setIsEditing(false);
      setEditValue("");
    }, 50);
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  return (
    <div className="relative inline-block">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        ¥
      </span>
      <Input
        type="text"
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${className} pl-6 text-right`}
      />
    </div>
  );
}
