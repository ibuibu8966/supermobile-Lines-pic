import * as XLSX from "xlsx";
import type { SupplierConfig, ParsedSimRow, ParseResult, ImportOptions } from "./types";

function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;

  // 数値の場合はExcelシリアル日付
  if (typeof value === "number") {
    // Excelのシリアル日付を変換（1900年1月1日が基準）
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString();
  }

  // 文字列の場合
  if (typeof value === "string") {
    // YYYY/MM/DD形式
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
      return new Date(value).toISOString();
    }
  }

  return undefined;
}

function mapRow(
  row: Record<string, unknown>,
  config: SupplierConfig,
  options: ImportOptions
): ParsedSimRow {
  const result: Partial<ParsedSimRow> = {
    supplier: config.code,
    simType: options.simType === "BOTH" ? "INDIVIDUAL" : options.simType,
  };

  for (const [sourceHeader, targetField] of Object.entries(config.headerMapping)) {
    let value = row[sourceHeader];

    if (value === undefined || value === null) continue;

    // 値を文字列に変換
    let strValue = String(value);

    // 日付フィールドの特別処理
    if (targetField === "supplierContractStart") {
      const dateValue = parseExcelDate(value);
      if (dateValue) {
        result.supplierContractStart = dateValue;
      }
      continue;
    }

    // トランスフォーマーがあれば適用
    if (config.transformers?.[targetField] && strValue) {
      strValue = config.transformers[targetField](strValue) as string;
    }

    if (strValue !== undefined && strValue !== "") {
      (result as Record<string, unknown>)[targetField] = strValue;
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

// Excelの実際のヘッダーに基づいて最適なheaderMappingを選択
function selectHeaderMapping(
  headers: string[],
  config: SupplierConfig
): Record<string, string> {
  const allMappings = [
    config.headerMapping,
    ...(config.alternativeHeaderMappings || []),
  ];

  let bestMapping = config.headerMapping;
  let bestScore = 0;

  for (const mapping of allMappings) {
    const score = Object.keys(mapping).filter((key) =>
      headers.includes(key)
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestMapping = mapping;
    }
  }

  return bestMapping;
}

export async function parseXLSX(
  file: File,
  config: SupplierConfig,
  options: ImportOptions
): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        // 最初のシートを取得
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // JSONに変換
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        // 実際のヘッダーから最適なマッピングを選択
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        const activeMapping = selectHeaderMapping(headers, config);
        const activeConfig = { ...config, headerMapping: activeMapping };

        const data: ParsedSimRow[] = [];
        const errors: Array<{ row: number; message: string }> = [];

        jsonData.forEach((row, index) => {
          try {
            const mappedRow = mapRow(row, activeConfig, options);

            if (mappedRow.iccid) {
              data.push(mappedRow);
            }
          } catch (err) {
            errors.push({
              row: index + 2,
              message: err instanceof Error ? err.message : "不明なエラー",
            });
          }
        });

        resolve({
          success: errors.length === 0,
          data,
          errors,
          warnings: [],
          totalRows: jsonData.length,
        });
      } catch (err) {
        resolve({
          success: false,
          data: [],
          errors: [
            {
              row: 0,
              message:
                err instanceof Error
                  ? `Excelファイルの解析に失敗: ${err.message}`
                  : "Excelファイルの解析に失敗しました",
            },
          ],
          warnings: [],
          totalRows: 0,
        });
      }
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

    reader.readAsArrayBuffer(file);
  });
}
