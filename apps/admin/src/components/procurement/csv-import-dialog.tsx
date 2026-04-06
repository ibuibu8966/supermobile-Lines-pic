"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import { parseGenericFile, type RawDataRow } from "@/lib/procurement/generic-parser";
import { ColumnMapper } from "./column-mapper";
import { ManualSettingsForm } from "./manual-settings-form";
import {
  validateMappedData,
  generateFinalData,
} from "@/lib/procurement/data-mapper";
import type {
  ColumnMapping,
  MappedSimData,
  ImportSummary,
  ManualSettings,
} from "@/types/procurement-import";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  supplierId: number;
}

type Step = "upload" | "mapping" | "preview" | "result";

interface UsageTag {
  id: number;
  name: string;
  code: string;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  supplierId,
}: CsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [manualSettings, setManualSettings] = useState<ManualSettings>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [previewData, setPreviewData] = useState<MappedSimData[]>([]);
  const [usageTags, setUsageTags] = useState<UsageTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    success: number;
    updated: number;
    failed: number;
    errors: Array<{ iccid: string; error: string }>;
  } | null>(null);

  // 用途タグ取得
  useEffect(() => {
    if (open) {
      fetch("/api/usage-tags")
        .then((res) => res.json())
        .then((data) => setUsageTags(data))
        .catch(() => {});
    }
  }, [open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError("");

    try {
      const result = await parseGenericFile(selectedFile);

      if (!result.success) {
        setError(result.error || "ファイルの解析に失敗しました");
        setFile(null);
        return;
      }

      setHeaders(result.headers);
      setRawData(result.data);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラー");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === "mapping") {
      // マッピング完了 → プレビュー
      const usageTagMap = new Map(usageTags.map((t) => [t.name, t.id]));
      const validationSummary = validateMappedData(
        rawData,
        mapping,
        usageTagMap,
        manualSettings
      );
      const finalData = generateFinalData(
        rawData,
        mapping,
        usageTagMap,
        manualSettings
      );
      setSummary(validationSummary);
      setPreviewData(finalData);
      setStep("preview");
    } else if (step === "preview") {
      // プレビュー完了 → インポート実行
      handleImport();
    }
  };

  const handleBack = () => {
    if (step === "preview") {
      setStep("mapping");
    } else if (step === "mapping") {
      setStep("upload");
      setFile(null);
      setHeaders([]);
      setRawData([]);
      setMapping({});
    } else if (step === "result") {
      handleReset();
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setMapping({});
    setManualSettings({});
    setUpdateExisting(false);
    setSummary(null);
    setImportResult(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError("");

    try {
      const usageTagMap = new Map(usageTags.map((t) => [t.name, t.id]));
      const finalData = generateFinalData(
        rawData,
        mapping,
        usageTagMap,
        manualSettings
      );

      const response = await fetch(
        `/api/procurement/${purchaseOrderId}/import-sims`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sims: finalData,
            supplierId,
            updateExisting,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "インポートに失敗しました");
        return;
      }

      setImportResult(result);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setImporting(false);
    }
  };

  const canProceedToPreview =
    step === "mapping" && Object.values(mapping).includes("iccid");

  const canImport =
    step === "preview" && summary && summary.invalidRows === 0;

  // プレビュー画面のみ幅を広げる
  const dialogWidth = step === "preview" ? "max-w-[95vw]" : "w-[1024px] max-w-[95vw]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogWidth} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>SIM CSVインポート</DialogTitle>
          <DialogDescription>
            CSVまたはExcelファイルからSIMデータをインポートします
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: ファイルアップロード */}
        {step === "upload" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ステップ 1: ファイルを選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer space-y-2 block"
                    >
                      {loading ? (
                        <Loader2 className="h-12 w-12 mx-auto text-gray-400 animate-spin" />
                      ) : (
                        <Upload className="h-12 w-12 mx-auto text-gray-400" />
                      )}
                      <div className="text-sm text-gray-600">
                        {loading
                          ? "ファイルを解析中..."
                          : "クリックしてファイルを選択"}
                      </div>
                      <div className="text-xs text-gray-500">
                        CSV, XLSX, XLS形式に対応
                      </div>
                    </label>
                  </div>

                  {file && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                      {file.name.endsWith(".csv") ? (
                        <FileText className="h-5 w-5 text-green-600" />
                      ) : (
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      )}
                      <span className="text-sm font-medium">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: カラムマッピング */}
        {step === "mapping" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ステップ 2: カラムを選択
                </CardTitle>
                <DialogDescription>
                  各カラムがどのフィールドに対応するか選択してください
                </DialogDescription>
              </CardHeader>
              <CardContent>
                <ColumnMapper
                  headers={headers}
                  data={rawData}
                  onMappingChange={setMapping}
                  previewRows={10}
                />
              </CardContent>
            </Card>

            <ManualSettingsForm
              mapping={mapping}
              usageTags={usageTags}
              onSettingsChange={setManualSettings}
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceedToPreview}
              >
                次へ
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: プレビュー & バリデーション */}
        {step === "preview" && summary && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ステップ 3: データ確認
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-gray-600">総件数</div>
                    <div className="text-2xl font-bold">
                      {summary.totalRows}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-gray-600">正常</div>
                    <div className="text-2xl font-bold text-green-600">
                      {summary.validRows}
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-sm text-gray-600">エラー</div>
                    <div className="text-2xl font-bold text-red-600">
                      {summary.invalidRows}
                    </div>
                  </div>
                </div>

                {summary.invalidRows > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">
                      エラーがある行を修正してから再度アップロードしてください
                    </span>
                  </div>
                )}

                <div className="border rounded-lg overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10 w-[50px]">
                          行
                        </TableHead>
                        <TableHead className="sticky left-[50px] bg-white z-10 min-w-[150px]">
                          ICCID
                        </TableHead>
                        <TableHead className="min-w-[120px]">電話番号</TableHead>
                        <TableHead className="min-w-[100px]">SIMタイプ</TableHead>
                        <TableHead className="min-w-[120px]">キャリア</TableHead>
                        <TableHead className="min-w-[150px]">プラン</TableHead>
                        <TableHead className="min-w-[120px]">解約予定日</TableHead>
                        <TableHead className="min-w-[100px]">自動解約</TableHead>
                        <TableHead className="min-w-[200px]">用途タグ</TableHead>
                        <TableHead className="sticky right-[100px] bg-white z-10 w-[100px]">
                          ステータス
                        </TableHead>
                        <TableHead className="sticky right-0 bg-white z-10 min-w-[200px]">
                          メッセージ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((data, index) => {
                        const validation = summary.validations[index];
                        const hasError = validation?.errors.length > 0;
                        const hasWarning = validation?.warnings.length > 0;

                        // 用途タグ名取得
                        const tagNames = (data.eligibleTagIds || [])
                          .map((id) => usageTags.find((t) => t.id === id)?.name)
                          .filter(Boolean)
                          .join(", ");

                        const rowBg = hasError ? "bg-red-50" : "bg-white";

                        return (
                          <TableRow key={index}>
                            <TableCell className={`sticky left-0 ${rowBg} font-medium text-xs`}>
                              {index + 2}
                            </TableCell>
                            <TableCell className={`sticky left-[50px] ${rowBg} font-mono text-xs`}>
                              {data.iccid}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.msisdn || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.simType === "INDIVIDUAL"
                                ? "個人回線"
                                : data.simType === "CORPORATE"
                                ? "法人回線"
                                : data.simType === "BOTH"
                                ? "両方"
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.carrierType === "DOCOMO"
                                ? "ドコモ"
                                : data.carrierType === "AU"
                                ? "au"
                                : data.carrierType === "SOFTBANK"
                                ? "ソフトバンク"
                                : data.carrierType === "RAKUTEN"
                                ? "楽天モバイル"
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.plan || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.autoCancelDate
                                ? new Date(data.autoCancelDate).toLocaleDateString("ja-JP")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {data.isAutoCancel ? "有効" : "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {tagNames || "-"}
                            </TableCell>
                            <TableCell className="sticky right-[100px] bg-white">
                              {hasError ? (
                                <Badge variant="destructive">エラー</Badge>
                              ) : hasWarning ? (
                                <Badge variant="secondary">警告</Badge>
                              ) : (
                                <Badge variant="default">OK</Badge>
                              )}
                            </TableCell>
                            <TableCell className="sticky right-0 bg-white text-sm">
                              {validation
                                ? [...validation.errors, ...validation.warnings].join(", ") || "-"
                                : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                <Label htmlFor="update-existing" className="text-sm cursor-pointer">
                  既存SIMを更新する
                </Label>
              </div>
              <span className="text-xs text-amber-700">
                {updateExisting
                  ? "既に登録済みのICCIDがあれば、電話番号・仕入先・プラン等を上書き更新します"
                  : "既に登録済みのICCIDはスキップされます"}
              </span>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canImport || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    インポート実行
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: インポート結果 */}
        {step === "result" && importResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  インポート完了
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-gray-600">新規登録</div>
                    <div className="text-2xl font-bold text-green-600">
                      {importResult.success}件
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-gray-600">更新</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {importResult.updated}件
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-sm text-gray-600">失敗</div>
                    <div className="text-2xl font-bold text-red-600">
                      {importResult.failed}件
                    </div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">エラー詳細:</div>
                    <div className="border rounded-lg overflow-auto max-h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ICCID</TableHead>
                            <TableHead>エラー内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.errors.map((err, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">
                                {err.iccid}
                              </TableCell>
                              <TableCell className="text-sm">
                                {err.error}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleReset}>
                さらにインポート
              </Button>
              <Button onClick={() => onOpenChange(false)}>閉じる</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
