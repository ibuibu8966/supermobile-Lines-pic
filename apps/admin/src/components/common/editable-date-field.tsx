"use client";

import { Input } from "@/components/ui/input";
import { formatDateForInput } from "@/lib/utils/formatters";

interface EditableDateFieldProps {
  orderId: string;
  value: string | null;
  onSave: (orderId: string, date: string) => void;
  className?: string;
}

export function EditableDateField({
  orderId,
  value,
  onSave,
  className = "w-40",
}: EditableDateFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 即座に保存（楽観的更新と統合）
    onSave(orderId, e.target.value);
  };

  return (
    <Input
      type="date"
      value={formatDateForInput(value)}
      onChange={handleChange}
      className={className}
    />
  );
}
