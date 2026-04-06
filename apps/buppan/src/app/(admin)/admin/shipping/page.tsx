"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package,
  Barcode,
  Check,
  X,
  Truck,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

interface SimInfo {
  iccid: string;
  msisdn: string | null;
  carrierType: string | null;
  status: string;
}

interface ApplicationLine {
  id: string;
  lineNumber: number;
  simId: string | null;
  msisdn: string | null;
  status: string;
  sim: SimInfo | null;
}

interface Customer {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string | null;
}

interface UsageTag {
  id: number;
  code: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  usageTags: UsageTag[];
}

interface Application {
  id: string;
  applicationNumber: string;
  customer: Customer;
  plan: Plan;
  lineCount: number;
  totalAmount: number;
  paidAt: string;
  createdAt: string;
  lines: ApplicationLine[];
  assignedCount: number;
}

export default function ShippingManagementPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [iccidInput, setIccidInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipping, setShipping] = useState(false);
  const iccidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    // 回線選択時に入力フィールドにフォーカス
    if (selectedLineId && iccidInputRef.current) {
      iccidInputRef.current.focus();
    }
  }, [selectedLineId]);

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/admin/shipping");
      const data = await response.json();
      setApplications(data.applications || []);

      // 選択中の申込を更新
      if (selectedApplication) {
        const updated = (data.applications || []).find(
          (a: Application) => a.id === selectedApplication.id
        );
        if (updated) {
          setSelectedApplication(updated);
        }
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!selectedLineId || !iccidInput) return;

    setScanning(true);
    setScanError(null);

    try {
      const response = await fetch("/api/admin/shipping/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationLineId: selectedLineId,
          iccid: iccidInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setScanError(data.error || "スキャンに失敗しました");
        return;
      }

      // 成功したら申込を再取得
      await fetchApplications();
      setIccidInput("");
      setSelectedLineId(null);
    } catch (error) {
      console.error("Error scanning:", error);
      setScanError("スキャン処理中にエラーが発生しました");
    } finally {
      setScanning(false);
    }
  };

  const handleShip = async () => {
    if (!selectedApplication || selectedLineIds.length === 0) return;

    setShipping(true);

    try {
      const response = await fetch("/api/admin/shipping/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplication.id,
          lineIds: selectedLineIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "発送処理に失敗しました");
        return;
      }

      alert(
        `${data.shippedLineCount}回線を発送しました。Contract ${data.contractCount}件作成。`
      );
      setIsShipModalOpen(false);
      setSelectedLineIds([]);
      await fetchApplications();
    } catch (error) {
      console.error("Error shipping:", error);
      alert("発送処理中にエラーが発生しました");
    } finally {
      setShipping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && iccidInput.length >= 15) {
      handleScan();
    }
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId]
    );
  };

  const selectAllAssignedLines = () => {
    if (!selectedApplication) return;
    const assignedLineIds = selectedApplication.lines
      .filter((l) => l.simId && l.status === "ACTIVATED")
      .map((l) => l.id);
    setSelectedLineIds(assignedLineIds);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLineStatusBadge = (status: string) => {
    switch (status) {
      case "NOT_ACTIVATED":
        return <Badge variant="secondary">未割当</Badge>;
      case "ACTIVATED":
        return <Badge variant="warning">割当済</Badge>;
      case "SHIPPED":
        return <Badge variant="success">発送済</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">発送管理</h2>
          <Badge variant="outline">{applications.length}件 発送待ち</Badge>
        </div>

        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">発送待ちの申込はありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 申込一覧 */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                発送待ち申込
              </h3>
              {applications.map((app) => (
                <Card
                  key={app.id}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    selectedApplication?.id === app.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedApplication(app);
                    setSelectedLineId(null);
                    setIccidInput("");
                    setScanError(null);
                    setSelectedLineIds([]);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{app.applicationNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {app.customer.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            app.assignedCount === app.lineCount
                              ? "success"
                              : "warning"
                          }
                        >
                          {app.assignedCount}/{app.lineCount} 割当済
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{app.plan.name}</span>
                      <span>×{app.lineCount}回線</span>
                      <span>入金: {formatDate(app.paidAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 詳細パネル */}
            <div className="lg:sticky lg:top-4 space-y-4">
              {selectedApplication ? (
                <>
                  {/* 配送先情報 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">配送先情報</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p>〒{selectedApplication.customer.postalCode}</p>
                          <p>
                            {selectedApplication.customer.prefecture}
                            {selectedApplication.customer.city}
                            {selectedApplication.customer.address}
                            {selectedApplication.customer.building && (
                              <> {selectedApplication.customer.building}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedApplication.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedApplication.customer.email}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SIMスキャン */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Barcode className="h-4 w-4" />
                        SIMスキャン
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedLineId ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            回線 #
                            {
                              selectedApplication.lines.find(
                                (l) => l.id === selectedLineId
                              )?.lineNumber
                            }{" "}
                            にSIMを割り当て
                          </p>
                          <div className="flex gap-2">
                            <Input
                              ref={iccidInputRef}
                              placeholder="ICCIDをスキャンまたは入力"
                              value={iccidInput}
                              onChange={(e) => setIccidInput(e.target.value)}
                              onKeyDown={handleKeyDown}
                              disabled={scanning}
                              className="font-mono"
                            />
                            <Button
                              onClick={handleScan}
                              disabled={
                                scanning ||
                                !iccidInput ||
                                iccidInput.length < 15
                              }
                            >
                              {scanning ? "処理中..." : "割当"}
                            </Button>
                          </div>
                          {scanError && (
                            <p className="text-sm text-red-500">{scanError}</p>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLineId(null);
                              setIccidInput("");
                              setScanError(null);
                            }}
                          >
                            キャンセル
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          下の回線一覧から未割当の回線を選択してください
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 回線一覧 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">回線一覧</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllAssignedLines}
                          disabled={
                            !selectedApplication.lines.some(
                              (l) => l.simId && l.status === "ACTIVATED"
                            )
                          }
                        >
                          割当済みを全選択
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedApplication.lines.map((line) => (
                          <div
                            key={line.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              selectedLineId === line.id
                                ? "border-primary bg-primary/5"
                                : "border-gray-200"
                            } ${
                              line.status === "NOT_ACTIVATED"
                                ? "cursor-pointer hover:bg-gray-50"
                                : ""
                            }`}
                            onClick={() => {
                              if (line.status === "NOT_ACTIVATED") {
                                setSelectedLineId(line.id);
                                setScanError(null);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {line.status === "ACTIVATED" && (
                                <Checkbox
                                  checked={selectedLineIds.includes(line.id)}
                                  onCheckedChange={() =>
                                    toggleLineSelection(line.id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <div>
                                <p className="font-medium">
                                  回線 #{line.lineNumber}
                                </p>
                                {line.sim && (
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {line.sim.iccid}
                                  </p>
                                )}
                                {line.msisdn && (
                                  <p className="text-xs text-muted-foreground">
                                    {line.msisdn}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getLineStatusBadge(line.status)}
                              {line.status === "NOT_ACTIVATED" && (
                                <Button variant="outline" size="sm">
                                  スキャン
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 発送ボタン */}
                      {selectedLineIds.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            className="w-full"
                            onClick={() => setIsShipModalOpen(true)}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            {selectedLineIds.length}回線を発送
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      左の一覧から申込を選択してください
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      {/* 発送確認モーダル */}
      <Dialog open={isShipModalOpen} onOpenChange={setIsShipModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>発送確認</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>以下の内容で発送処理を行います。よろしいですか？</p>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <p>
                <strong>申込番号:</strong>{" "}
                {selectedApplication?.applicationNumber}
              </p>
              <p>
                <strong>顧客:</strong> {selectedApplication?.customer.name}
              </p>
              <p>
                <strong>発送回線数:</strong> {selectedLineIds.length}回線
              </p>
              <p>
                <strong>プラン:</strong> {selectedApplication?.plan.name}
              </p>
              {selectedApplication?.plan.usageTags &&
                selectedApplication.plan.usageTags.length > 0 && (
                  <p>
                    <strong>用途タグ:</strong>{" "}
                    {selectedApplication.plan.usageTags
                      .map((t) => t.name)
                      .join(", ")}
                  </p>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
              発送処理を行うと、SIMが「利用中」に変更され、契約が作成されます。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsShipModalOpen(false)}
              disabled={shipping}
            >
              キャンセル
            </Button>
            <Button onClick={handleShip} disabled={shipping}>
              {shipping ? "処理中..." : "発送を実行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
