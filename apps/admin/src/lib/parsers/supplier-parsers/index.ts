import { SUPPLIER_CONFIGS } from "./configs";
import { parseCSV } from "./csv-parser";
import { parseXLSX } from "./xlsx-parser";
import type { ParseResult, ImportOptions } from "./types";

export { SUPPLIER_CONFIGS, SUPPLIER_LIST } from "./configs";
export type {
  SupplierConfig,
  ParsedSimRow,
  ParseResult,
  ImportOptions,
  SimTypeOption,
} from "./types";

export async function parseSupplierFile(
  file: File,
  options: ImportOptions
): Promise<ParseResult> {
  const config = SUPPLIER_CONFIGS[options.supplier];

  if (!config) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: `不明な仕入れ先: ${options.supplier}` }],
      warnings: [],
      totalRows: 0,
    };
  }

  if (config.fileType === "csv") {
    return parseCSV(file, config, options);
  } else if (config.fileType === "xlsx") {
    return parseXLSX(file, config, options);
  }

  return {
    success: false,
    data: [],
    errors: [{ row: 0, message: `未対応のファイル形式: ${config.fileType}` }],
    warnings: [],
    totalRows: 0,
  };
}
