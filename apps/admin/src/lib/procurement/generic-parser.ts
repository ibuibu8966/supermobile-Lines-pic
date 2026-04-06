import Papa from "papaparse";
import * as XLSX from "xlsx";
import Encoding from "encoding-japanese";

export interface RawDataRow {
  [key: string]: string | number | null;
}

export interface ParseFileResult {
  success: boolean;
  headers: string[];
  data: RawDataRow[];
  totalRows: number;
  error?: string;
}

/**
 * CSVファイルを解析（UTF-8 & Shift-JIS対応）
 */
async function parseCSVFile(file: File): Promise<ParseFileResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let text: string;
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);

        // エンコーディング検出
        const detected = Encoding.detect(uint8Array);

        if (detected === "SJIS" || detected === "EUCJP") {
          // Shift-JIS または EUC-JPの場合は変換
          const unicodeArray = Encoding.convert(uint8Array, {
            to: "UNICODE",
            from: detected,
          });
          text = Encoding.codeToString(unicodeArray);
        } else {
          // UTF-8またはその他
          text = new TextDecoder("utf-8").decode(uint8Array);
        }

        // Papaparseでパース
        const parsed = Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          resolve({
            success: false,
            headers: [],
            data: [],
            totalRows: 0,
            error: `CSV解析エラー: ${parsed.errors[0].message}`,
          });
          return;
        }

        const rows = parsed.data as string[][];
        if (rows.length === 0) {
          resolve({
            success: false,
            headers: [],
            data: [],
            totalRows: 0,
            error: "CSVファイルが空です",
          });
          return;
        }

        // 1行目をヘッダーとして扱う
        const headers = rows[0].map((h, i) => String(h || `Column${i + 1}`));
        const dataRows = rows.slice(1);

        // データを object 配列に変換
        const data: RawDataRow[] = dataRows.map((row) => {
          const obj: RawDataRow = {};
          headers.forEach((header, i) => {
            obj[header] = row[i] !== undefined && row[i] !== "" ? row[i] : null;
          });
          return obj;
        });

        resolve({
          success: true,
          headers,
          data,
          totalRows: data.length,
        });
      } catch (err) {
        resolve({
          success: false,
          headers: [],
          data: [],
          totalRows: 0,
          error: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        headers: [],
        data: [],
        totalRows: 0,
        error: "ファイルの読み込みに失敗しました",
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Excelファイルを解析（.xlsx, .xls対応）
 */
async function parseExcelFile(file: File): Promise<ParseFileResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // 最初のシートを取得
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve({
            success: false,
            headers: [],
            data: [],
            totalRows: 0,
            error: "Excelファイルにシートが見つかりません",
          });
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
        }) as (string | number | null)[][];

        if (jsonData.length === 0) {
          resolve({
            success: false,
            headers: [],
            data: [],
            totalRows: 0,
            error: "Excelファイルが空です",
          });
          return;
        }

        // 1行目をヘッダーとして扱う
        const headers = jsonData[0].map((h, i) =>
          h !== null && h !== undefined && h !== ""
            ? String(h)
            : `Column${i + 1}`
        );
        const dataRows = jsonData.slice(1);

        // データを object 配列に変換
        const parsedData: RawDataRow[] = dataRows.map((row) => {
          const obj: RawDataRow = {};
          headers.forEach((header, i) => {
            const value = row[i];
            obj[header] = value !== undefined && value !== "" ? value : null;
          });
          return obj;
        });

        resolve({
          success: true,
          headers,
          data: parsedData,
          totalRows: parsedData.length,
        });
      } catch (err) {
        resolve({
          success: false,
          headers: [],
          data: [],
          totalRows: 0,
          error: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        headers: [],
        data: [],
        totalRows: 0,
        error: "ファイルの読み込みに失敗しました",
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * CSVまたはExcelファイルを解析（自動判定）
 */
export async function parseGenericFile(
  file: File
): Promise<ParseFileResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return parseCSVFile(file);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcelFile(file);
  } else {
    return {
      success: false,
      headers: [],
      data: [],
      totalRows: 0,
      error: "サポートされていないファイル形式です（CSV, XLSX, XLSのみ対応）",
    };
  }
}
