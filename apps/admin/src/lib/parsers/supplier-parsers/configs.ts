import type { SupplierConfig } from "./types";

// 日付文字列をISO形式に変換（YYYYMMDD → ISO）
function parseJapaneseDate(value: string): string | undefined {
  if (!value) return undefined;

  // YYYYMMDD形式
  if (/^\d{8}$/.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return new Date(`${year}-${month}-${day}`).toISOString();
  }

  // YYYY/MM/DD形式
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    return new Date(value).toISOString();
  }

  return undefined;
}

// 顧客区分をsimTypeに変換
function parseSimType(value: string): string {
  if (value === "法人") return "CORPORATE";
  if (value === "個人") return "INDIVIDUAL";
  return "INDIVIDUAL";
}

export const SUPPLIER_CONFIGS: Record<string, SupplierConfig> = {
  sophia: {
    code: "sophia",
    name: "ソフィア",
    fileType: "csv",
    encoding: "shift-jis",
    accept: ".csv",
    simTypeOptions: ["INDIVIDUAL", "CORPORATE", "BOTH"],
    headerMapping: {
      ICCID: "iccid",
      電話番号: "msisdn",
      顧客区分: "simType",
      申込サービス: "plan",
      サービス開始日: "supplierContractStart",
    },
    transformers: {
      simType: parseSimType,
      supplierContractStart: parseJapaneseDate,
    },
  },
  arts: {
    code: "arts",
    name: "アーツ",
    fileType: "xlsx",
    accept: ".xlsx,.xls",
    simTypeOptions: ["INDIVIDUAL", "CORPORATE"],
    headerMapping: {
      "製造番号/ICCID": "iccid",
      電話番号: "msisdn",
      商品マスタ: "plan",
      キャリア開通日: "supplierContractStart",
    },
    alternativeHeaderMappings: [
      {
        ICCID: "iccid",
        "SIM電話番号": "msisdn",
        データ容量: "plan",
      },
    ],
    transformers: {
      supplierContractStart: parseJapaneseDate,
    },
  },
};

export const SUPPLIER_LIST = Object.values(SUPPLIER_CONFIGS);
