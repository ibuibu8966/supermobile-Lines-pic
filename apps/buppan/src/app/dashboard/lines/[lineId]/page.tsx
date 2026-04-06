"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, User, MapPin, Download, FileText } from "lucide-react";
import { useDashboard } from "../../context";
import * as XLSX from "xlsx";

interface LineDetail {
  id: string;
  lineNumber: number;
  msisdn: string | null;
  status: string;
  application: {
    applicationNumber: string;
    plan: { name: string };
    createdAt: string;
  };
}

interface CustomerOverride {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
}

const TAP_COUNT = 5;
const TAP_WINDOW_MS = 2000;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function LineDetailPage() {
  const params = useParams();
  const lineId = params.lineId as string;

  const [line, setLine] = useState<LineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState<CustomerOverride | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const tapTimestamps = useRef<number[]>([]);

  const { data: dashboardData } = useDashboard();
  const customer = dashboardData?.customer;

  useEffect(() => {
    const fetchLine = async () => {
      try {
        const res = await fetch("/api/customer/lines");
        if (res.ok) {
          const data = await res.json();
          const found = data.lines.find((l: LineDetail) => l.id === lineId);
          setLine(found || null);
        }
      } catch (error) {
        console.error("Failed to fetch line:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLine();
  }, [lineId]);

  const getDisplayCustomer = (): CustomerOverride | null => {
    if (!customer) return null;
    if (override) return override;
    return {
      lastName: customer.lastName,
      firstName: customer.firstName,
      lastNameKana: customer.lastNameKana,
      firstNameKana: customer.firstNameKana,
      phone: customer.phone,
      postalCode: customer.postalCode,
      prefecture: customer.prefecture,
      city: customer.city,
      address: customer.address,
      building: customer.building || "",
    };
  };

  const handleTitleTap = () => {
    const now = Date.now();
    tapTimestamps.current.push(now);
    tapTimestamps.current = tapTimestamps.current.filter(
      (t) => now - t < TAP_WINDOW_MS
    );
    if (tapTimestamps.current.length >= TAP_COUNT) {
      tapTimestamps.current = [];
      if (isEditing) {
        setIsEditing(false);
      } else {
        const display = getDisplayCustomer();
        if (!display) return;
        if (!override) {
          setOverride({ ...display });
        }
        setIsEditing(true);
      }
    }
  };

  const updateField = (field: keyof CustomerOverride, value: string) => {
    setOverride((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // DBデータ（override前）を使ったExcelダウンロード
  const handleDownloadCSV = () => {
    if (!customer || !line) return;

    const address = `〒${customer.postalCode} ${customer.prefecture}${customer.city}${customer.address}${customer.building ? " " + customer.building : ""}`;
    const today = todayString();

    const now = new Date();
    const billingMonth =
      now.getMonth() === 0
        ? `${now.getFullYear() - 1}年12月分`
        : `${now.getFullYear()}年${now.getMonth()}月分`;

    const statusLabel = ["ACTIVATED", "SHIPPED", "SHIPPING_INSTRUCTED"].includes(line.status)
      ? "利用中"
      : line.status === "NOT_ACTIVATED"
      ? "未開通"
      : "解約済み";

    const birthDateStr = (customer as { birthDate?: string | Date | null }).birthDate
      ? formatDate(String((customer as { birthDate?: string | Date | null }).birthDate))
      : "-";

    const data: [string, string][] = [
      ["ご利用明細書", ""],
      ["発行日", today],
      ["発行元", "Buppan mobile / 合同会社ピーチ"],
      ["", ""],
      ["■ ご契約電話番号", ""],
      ["電話番号", line.msisdn || "-"],
      ["", ""],
      ["■ ご契約者情報", ""],
      ["氏名", `${customer.lastName} ${customer.firstName}`],
      ["氏名（カナ）", `${customer.lastNameKana} ${customer.firstNameKana}`],
      ["生年月日", birthDateStr],
      ["連絡先電話番号", customer.phone],
      ["住所", address],
      ["", ""],
      ["■ ご契約内容", ""],
      ["プラン名", line.application.plan.name],
      ["申込番号", line.application.applicationNumber],
      ["契約開始日", formatDate(line.application.createdAt)],
      ["ステータス", statusLabel],
      ["", ""],
      [`■ ご利用料金（${billingMonth}）`, ""],
      ["月額料金", "詳細は別途ご確認ください"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "利用明細");
    XLSX.writeFile(wb, `利用明細_${line.msisdn || line.id}_${today}.xlsx`);
  };

  // DBデータ（override前）を使ったPDF印刷
  const handleDownloadPDF = () => {
    if (!customer || !line) return;

    const address = `〒${customer.postalCode} ${customer.prefecture}${customer.city}${customer.address}${customer.building ? " " + customer.building : ""}`;
    const today = todayString();
    const contractStart = formatDate(line.application.createdAt);

    const now = new Date();
    const billingMonth =
      now.getMonth() === 0
        ? `${now.getFullYear() - 1}年12月分`
        : `${now.getFullYear()}年${now.getMonth()}月分`;

    const statusLabel = ["ACTIVATED", "SHIPPED", "SHIPPING_INSTRUCTED"].includes(line.status)
      ? "利用中"
      : line.status === "NOT_ACTIVATED"
      ? "未開通"
      : "解約済み";

    const birthDateStr = (customer as { birthDate?: string | Date | null }).birthDate
      ? formatDate(String((customer as { birthDate?: string | Date | null }).birthDate))
      : "-";

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>ご利用明細書</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif; font-size: 12pt; color: #222; }
    .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #222; padding-bottom: 12px; }
    .header h1 { font-size: 20pt; font-weight: bold; letter-spacing: 0.1em; }
    .header p { font-size: 10pt; color: #555; margin-top: 4px; }
    .issue-date { text-align: right; font-size: 10pt; color: #555; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11pt; font-weight: bold; background: #f0f0f0; padding: 6px 10px; border-left: 4px solid #333; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 12px; border: 1px solid #ccc; font-size: 11pt; }
    td:first-child { background: #fafafa; font-weight: bold; width: 35%; }
    .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #888; border-top: 1px solid #ccc; padding-top: 12px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>ご利用明細書</h1>
    <p>Buppan mobile / 合同会社ピーチ</p>
  </div>
  <div class="issue-date">発行日：${today}</div>

  <div class="section">
    <div class="section-title">■ ご契約電話番号</div>
    <table>
      <tr><td>電話番号</td><td>${line.msisdn || "-"}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">■ ご契約者情報</div>
    <table>
      <tr><td>氏名</td><td>${customer.lastName} ${customer.firstName}</td></tr>
      <tr><td>氏名（カナ）</td><td>${customer.lastNameKana} ${customer.firstNameKana}</td></tr>
      <tr><td>生年月日</td><td>${birthDateStr}</td></tr>
      <tr><td>連絡先電話番号</td><td>${customer.phone}</td></tr>
      <tr><td>住所</td><td>${address}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">■ ご契約内容</div>
    <table>
      <tr><td>プラン名</td><td>${line.application.plan.name}</td></tr>
      <tr><td>申込番号</td><td>${line.application.applicationNumber}</td></tr>
      <tr><td>契約開始日</td><td>${contractStart}</td></tr>
      <tr><td>ステータス</td><td>${statusLabel}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">■ ご利用料金（${billingMonth}）</div>
    <table>
      <tr><td>月額料金</td><td>詳細は別途ご確認ください</td></tr>
    </table>
  </div>

  <div class="footer">
    本書は、上記のお客様が上記の電話番号をご契約されていることを証明するものです。
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onafterprint = () => URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!line) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">回線が見つかりません</p>
      </div>
    );
  }

  const displayCustomer = getDisplayCustomer();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {line.msisdn || "-"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayCustomer && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4
                  className="text-sm font-semibold flex items-center gap-2 select-none"
                  onClick={handleTitleTap}
                >
                  <User className="h-4 w-4" />
                  契約者情報
                </h4>
              </div>

              {isEditing ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">姓</label>
                    <Input
                      value={displayCustomer.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">名</label>
                    <Input
                      value={displayCustomer.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      姓（カナ）
                    </label>
                    <Input
                      value={displayCustomer.lastNameKana}
                      onChange={(e) =>
                        updateField("lastNameKana", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      名（カナ）
                    </label>
                    <Input
                      value={displayCustomer.firstNameKana}
                      onChange={(e) =>
                        updateField("firstNameKana", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      電話番号
                    </label>
                    <Input
                      value={displayCustomer.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      郵便番号
                    </label>
                    <Input
                      value={displayCustomer.postalCode}
                      onChange={(e) =>
                        updateField("postalCode", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      都道府県
                    </label>
                    <Input
                      value={displayCustomer.prefecture}
                      onChange={(e) =>
                        updateField("prefecture", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      市区町村
                    </label>
                    <Input
                      value={displayCustomer.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">
                      住所
                    </label>
                    <Input
                      value={displayCustomer.address}
                      onChange={(e) => updateField("address", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">
                      建物名
                    </label>
                    <Input
                      value={displayCustomer.building}
                      onChange={(e) => updateField("building", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">氏名:</span>
                    <span className="font-medium">
                      {displayCustomer.lastName} {displayCustomer.firstName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground ml-5">カナ:</span>
                    <span>
                      {displayCustomer.lastNameKana}{" "}
                      {displayCustomer.firstNameKana}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">電話:</span>
                    <span className="font-medium">{displayCustomer.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 md:col-span-2">
                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">住所:</span>
                    <span className="font-medium">
                      〒{displayCustomer.postalCode}{" "}
                      {displayCustomer.prefecture}
                      {displayCustomer.city}
                      {displayCustomer.address}
                      {displayCustomer.building &&
                        ` ${displayCustomer.building}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 利用明細ダウンロード */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              利用明細
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              この回線の利用明細をダウンロードできます。
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Excel (.xlsx) でダウンロード
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                PDF で印刷・保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
