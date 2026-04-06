"use client";

import { NumericFormat } from "react-number-format";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

export function CurrencyInput({ value, onChange, className = "", placeholder }: CurrencyInputProps) {
  return (
    <NumericFormat
      value={value || ""}
      thousandSeparator=","
      onValueChange={(values) => {
        onChange(values.floatValue ?? 0);
      }}
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
    />
  );
}
