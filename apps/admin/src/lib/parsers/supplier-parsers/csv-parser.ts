import Encoding from "encoding-japanese";
import Papa from "papaparse";
import type { SupplierConfig, ParsedSimRow, ParseResult, ImportOptions } from "./types";

function mapRow(
  row: Record<string, string>,
  config: SupplierConfig,
  options: ImportOptions
): ParsedSimRow {
  const result: Partial<ParsedSimRow> = {
    supplier: config.code,
  };

  for (const [sourceHeader, targetField] of Object.entries(config.headerMapping)) {
    let value = row[sourceHeader];

    // simTypeの処理
    if (targetField === "simType") {
      if (options.simType === "BOTH") {
        // "両方"の場合はCSVの値を使う
        if (config.transformers?.simType && value) {
          value = config.transformers.simType(value) as string;
        }
      } else {
        // "法人のみ"または"個人のみ"の場合は選択した値を使う
        value = options.simType;
      }
      result.simType = value;
      continue;
    }

    // トランスフォーマーがあれば適用
    if (config.transformers?.[targetField] && value) {
      value = config.transformers[targetField](value) as string;
    }

    if (value !== undefined && value !== "") {
      (result as Record<string, unknown>)[targetField] = value;
    }
  }

  // UI入力の解約日を設定
  if (options.supplierContractEnd) {
    result.supplierContractEnd = options.supplierContractEnd;
  }

  // UI入力の追加設定を反映
  if (options.carrierType) {
    result.carrierType = options.carrierType;
  }
  if (options.isMnpEligible) {
    result.isMnpEligible = options.isMnpEligible;
  }
  if (options.isAutoCancel) {
    result.isAutoCancel = options.isAutoCancel;
  }
  if (options.autoCancelDate) {
    result.autoCancelDate = options.autoCancelDate;
  }
  if (options.eligibleTagIds && options.eligibleTagIds.length > 0) {
    result.eligibleTagIds = options.eligibleTagIds;
  }

  return result as ParsedSimRow;
}

export async function parseCSV(
  file: File,
  config: SupplierConfig,
  options: ImportOptions
): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      let text: string;

      // Shift-JISの場合はエンコーディング変換
      if (config.encoding === "shift-jis") {
        const uint8Array = new Uint8Array(e.target?.result as ArrayBuffer);
        const detected = Encoding.detect(uint8Array);
        const unicodeArray = Encoding.convert(uint8Array, {
          to: "UNICODE",
          from: detected || "SJIS",
        });
        text = Encoding.codeToString(unicodeArray);
      } else {
        text = e.target?.result as string;
      }

      // Papaparseでパース
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });

      const data: ParsedSimRow[] = [];
      const errors: Array<{ row: number; message: string }> = [];

      parsed.data.forEach((row: unknown, index: number) => {
        try {
          const mappedRow = mapRow(row as Record<string, string>, config, options);

          if (mappedRow.iccid) {
            data.push(mappedRow);
          }
        } catch (err) {
          errors.push({
            row: index + 2, // ヘッダー行 + 0-indexed
            message: err instanceof Error ? err.message : "不明なエラー",
          });
        }
      });

      resolve({
        success: errors.length === 0,
        data,
        errors,
        warnings: [],
        totalRows: parsed.data.length,
      });
    };

    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        errors: [{ row: 0, message: "ファイルの読み込みに失敗しました" }],
        warnings: [],
        totalRows: 0,
      });
    };

    // Shift-JISの場合はArrayBufferとして読み込む
    if (config.encoding === "shift-jis") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}
