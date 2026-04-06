import type { RawDataRow } from "./generic-parser";
import type {
  ColumnMapping,
  MappedSimData,
  ImportValidation,
  ImportSummary,
  ManualSettings,
} from "@/types/procurement-import";

/**
 * カラムマッピングに基づいてデータを変換
 */
export function mapRowData(
  row: RawDataRow,
  mapping: ColumnMapping,
  usageTagMap: Map<string, number>, // タグ名 → タグID
  manualSettings?: ManualSettings // 手動設定（CSV値が優先）
): Partial<MappedSimData> {
  const result: Partial<MappedSimData> = {};

  for (const [columnName, fieldName] of Object.entries(mapping)) {
    if (fieldName === "none") continue;

    const value = row[columnName];
    if (value === null || value === undefined || value === "") continue;

    const strValue = String(value).trim();

    switch (fieldName) {
      case "iccid":
        result.iccid = strValue;
        break;

      case "msisdn":
        result.msisdn = strValue;
        break;

      case "simType": {
        const normalized = strValue.toUpperCase();
        if (normalized.includes("INDIVIDUAL") || normalized.includes("個人")) {
          result.simType = "INDIVIDUAL";
        } else if (
          normalized.includes("CORPORATE") ||
          normalized.includes("法人")
        ) {
          result.simType = "CORPORATE";
        } else if (normalized.includes("BOTH") || normalized.includes("両方")) {
          result.simType = "BOTH";
        }
        break;
      }

      case "carrierType": {
        const normalized = strValue.toUpperCase();
        if (normalized.includes("DOCOMO") || normalized.includes("ドコモ")) {
          result.carrierType = "DOCOMO";
        } else if (normalized.includes("AU") || normalized.includes("エーユー")) {
          result.carrierType = "AU";
        } else if (
          normalized.includes("SOFTBANK") ||
          normalized.includes("ソフトバンク")
        ) {
          result.carrierType = "SOFTBANK";
        } else if (
          normalized.includes("RAKUTEN") ||
          normalized.includes("楽天")
        ) {
          result.carrierType = "RAKUTEN";
        }
        break;
      }

      case "plan":
        result.plan = strValue;
        break;

      case "autoCancelDate": {
        const date = parseDate(strValue);
        if (date) {
          result.autoCancelDate = date.toISOString();
          result.isAutoCancel = true;
        }
        break;
      }

      case "usageTag": {
        // カンマ区切りで複数タグ対応
        const tagNames = strValue
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter((t) => t);
        const tagIds: number[] = [];
        for (const tagName of tagNames) {
          const tagId = usageTagMap.get(tagName);
          if (tagId !== undefined) {
            tagIds.push(tagId);
          }
        }
        if (tagIds.length > 0) {
          result.eligibleTagIds = tagIds;
        }
        break;
      }
    }
  }

  // 手動設定をCSV値がない場合のみ適用
  if (manualSettings) {
    if (!result.simType && manualSettings.simType) {
      result.simType = manualSettings.simType;
    }
    if (!result.carrierType && manualSettings.carrierType) {
      result.carrierType = manualSettings.carrierType;
    }
    if (!result.plan && manualSettings.plan) {
      result.plan = manualSettings.plan;
    }
    if (!result.autoCancelDate && manualSettings.autoCancelDate) {
      result.autoCancelDate = manualSettings.autoCancelDate;
      result.isAutoCancel = true;
    }
    if (manualSettings.isAutoCancel !== undefined && result.autoCancelDate) {
      result.isAutoCancel = manualSettings.isAutoCancel;
    }
    if (
      (!result.eligibleTagIds || result.eligibleTagIds.length === 0) &&
      manualSettings.eligibleTagIds &&
      manualSettings.eligibleTagIds.length > 0
    ) {
      result.eligibleTagIds = manualSettings.eligibleTagIds;
    }
  }

  return result;
}

/**
 * 日付文字列をパース（複数フォーマット対応）
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return new Date(dateStr.replace(/\//g, "-"));
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }

  // Excel serial date number (optional)
  const num = Number(dateStr);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    // Excelの日付シリアル値: 1900年1月1日からの日数
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    return date;
  }

  return null;
}

/**
 * マッピングされたデータをバリデーション
 */
export function validateMappedData(
  data: RawDataRow[],
  mapping: ColumnMapping,
  usageTagMap: Map<string, number>,
  manualSettings?: ManualSettings
): ImportSummary {
  const validations: ImportValidation[] = [];
  let validRows = 0;
  let invalidRows = 0;

  data.forEach((row, index) => {
    const mapped = mapRowData(row, mapping, usageTagMap, manualSettings);
    const errors: string[] = [];
    const warnings: string[] = [];

    // ICCID必須チェック
    if (!mapped.iccid) {
      errors.push("ICCIDが必要です");
    } else if (mapped.iccid.length < 15 || mapped.iccid.length > 20) {
      warnings.push("ICCIDの桁数が正しくない可能性があります");
    }

    // 電話番号フォーマットチェック
    if (mapped.msisdn) {
      const cleaned = mapped.msisdn.replace(/[^0-9]/g, "");
      if (cleaned.length < 10 || cleaned.length > 11) {
        warnings.push("電話番号の桁数が正しくない可能性があります");
      }
    }

    // 解約予定日チェック
    if (mapped.autoCancelDate) {
      const date = new Date(mapped.autoCancelDate);
      const now = new Date();
      if (date < now) {
        warnings.push("解約予定日が過去の日付です");
      }
    }

    const validation: ImportValidation = {
      row: index + 2, // ヘッダー行を考慮
      iccid: mapped.iccid || "（未設定）",
      errors,
      warnings,
    };

    validations.push(validation);

    if (errors.length > 0) {
      invalidRows++;
    } else {
      validRows++;
    }
  });

  return {
    totalRows: data.length,
    validRows,
    invalidRows,
    validations,
  };
}

/**
 * マッピング + バリデーション後の最終データ生成
 */
export function generateFinalData(
  data: RawDataRow[],
  mapping: ColumnMapping,
  usageTagMap: Map<string, number>,
  manualSettings?: ManualSettings
): MappedSimData[] {
  const results: MappedSimData[] = [];

  data.forEach((row) => {
    const mapped = mapRowData(row, mapping, usageTagMap, manualSettings);

    // ICCID必須
    if (!mapped.iccid) return;

    results.push(mapped as MappedSimData);
  });

  return results;
}
