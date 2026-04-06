// 仕入れ先設定の型定義

export type SimTypeOption = "INDIVIDUAL" | "CORPORATE" | "BOTH";

export interface SupplierConfig {
  code: string;
  name: string;
  fileType: "csv" | "xlsx";
  encoding?: "utf-8" | "shift-jis";
  accept: string; // ファイル入力のaccept属性
  headerMapping: Record<string, string>;
  alternativeHeaderMappings?: Record<string, string>[]; // 代替カラム名マッピング
  simTypeOptions: SimTypeOption[]; // 選択可能なsimTypeオプション
  transformers?: {
    [field: string]: (value: string) => string | boolean | Date | undefined;
  };
}

export interface ParsedSimRow {
  iccid: string;
  msisdn?: string;
  supplier: string;
  simType?: string;
  carrierType?: string;
  plan?: string;
  isMnpEligible?: boolean;
  isAutoCancel?: boolean;
  autoCancelDate?: string;
  supplierContractStart?: string;
  supplierContractEnd?: string;
  eligibleTagIds?: number[];
}

export interface ParseResult {
  success: boolean;
  data: ParsedSimRow[];
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  totalRows: number;
}

export interface ImportOptions {
  supplier: string;
  simType: SimTypeOption;
  supplierContractEnd?: string; // 解約日（UI入力）
  carrierType?: string;
  isMnpEligible?: boolean;
  isAutoCancel?: boolean;
  autoCancelDate?: string;
  eligibleTagIds?: number[];
}
