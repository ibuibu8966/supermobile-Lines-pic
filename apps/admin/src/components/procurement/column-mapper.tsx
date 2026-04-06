"use client";

import { useState, useMemo } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import type { RawDataRow } from "@/lib/procurement/generic-parser";
import type { ColumnMapping, FieldMapping } from "@/types/procurement-import";

interface ColumnMapperProps {
  headers: string[];
  data: RawDataRow[];
  onMappingChange: (mapping: ColumnMapping) => void;
  previewRows?: number;
}

const FIELD_LABELS: Record<FieldMapping, string> = {
  none: "（選択しない）",
  iccid: "ICCID（必須）",
  msisdn: "電話番号",
  simType: "SIMタイプ",
  carrierType: "キャリア",
  plan: "プラン名",
  autoCancelDate: "解約予定日",
  usageTag: "用途タグ",
};

export function ColumnMapper({
  headers,
  data,
  onMappingChange,
  previewRows = 10,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    // 初期マッピング: ヘッダー名から自動推測
    const initial: ColumnMapping = {};
    headers.forEach((header) => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes("iccid")) {
        initial[header] = "iccid";
      } else if (
        lowerHeader.includes("電話") ||
        lowerHeader.includes("msisdn") ||
        lowerHeader.includes("tel")
      ) {
        initial[header] = "msisdn";
      } else if (
        lowerHeader.includes("sim") &&
        (lowerHeader.includes("タイプ") || lowerHeader.includes("type"))
      ) {
        initial[header] = "simType";
      } else if (
        lowerHeader.includes("キャリア") ||
        lowerHeader.includes("carrier")
      ) {
        initial[header] = "carrierType";
      } else if (
        lowerHeader.includes("プラン") ||
        lowerHeader.includes("plan")
      ) {
        initial[header] = "plan";
      } else if (
        lowerHeader.includes("解約") ||
        lowerHeader.includes("終了") ||
        lowerHeader.includes("end") ||
        (lowerHeader.includes("auto") && lowerHeader.includes("cancel"))
      ) {
        initial[header] = "autoCancelDate";
      } else if (
        lowerHeader.includes("用途") ||
        lowerHeader.includes("タグ") ||
        lowerHeader.includes("tag")
      ) {
        initial[header] = "usageTag";
      } else {
        initial[header] = "none";
      }
    });
    return initial;
  });

  const handleMappingChange = (column: string, value: FieldMapping) => {
    const newMapping = { ...mapping, [column]: value };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  const validation = useMemo(() => {
    const iccidMapped = Object.values(mapping).includes("iccid");
    const duplicates = Object.entries(mapping).reduce(
      (acc, [col, field]) => {
        if (field === "none") return acc;
        if (!acc[field]) acc[field] = [];
        acc[field].push(col);
        return acc;
      },
      {} as Record<string, string[]>
    );

    const hasDuplicates = Object.values(duplicates).some(
      (cols) => cols.length > 1
    );

    return {
      iccidMapped,
      hasDuplicates,
      duplicates,
    };
  }, [mapping]);

  const previewData = data.slice(0, previewRows);

  return (
    <div className="space-y-4">
      {!validation.iccidMapped && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">ICCIDカラムを選択してください（必須）</span>
        </div>
      )}

      {validation.hasDuplicates && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">
            同じフィールドが複数のカラムに割り当てられています
          </span>
        </div>
      )}

      <div className="text-sm text-gray-600">
        プレビュー（最初の{previewData.length}行を表示）
      </div>

      <div className="border rounded-lg overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] sticky left-0 bg-white z-10">
                #
              </TableHead>
              {headers.map((header) => (
                <TableHead key={header} className="min-w-[180px]">
                  <div className="space-y-2">
                    <div className="font-semibold text-xs">{header}</div>
                    <Select
                      value={mapping[header] || "none"}
                      onValueChange={(value: FieldMapping) =>
                        handleMappingChange(header, value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell className="sticky left-0 bg-white font-medium text-xs text-gray-500">
                  {rowIndex + 1}
                </TableCell>
                {headers.map((header) => (
                  <TableCell key={header} className="text-sm">
                    {row[header] !== null && row[header] !== undefined
                      ? String(row[header])
                      : "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-gray-500">
        全 {data.length} 行のうち {previewData.length} 行を表示
      </div>
    </div>
  );
}
