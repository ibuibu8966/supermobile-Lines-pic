"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  FileText,
  CheckSquare,
  Package,
  Check,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface KycImage {
  id: string;
  type: string;
  storagePath: string;
  status: string;
  signedUrl: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface Customer {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string | null;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string | null;
}

interface Application {
  id: string;
  applicationNumber: string;
  customer: Customer;
  plan: { id: string; name: string };
  lineCount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  kycImages: KycImage[];
}

const kycTypeLabels: Record<string, string> = {
  ID_FRONT: "本人確認書類（表）",
  ID_BACK: "本人確認書類（裏）",
  SELFIE: "セルフィー",
  ADDRESS_PROOF: "住所確認書類",
};

export default function KycManagementPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/admin/kyc");
      const data = await response.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (imageId: string) => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/kyc/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      if (response.ok) {
        await fetchApplications();
        // 選択中の申込を更新
        if (selectedApplication) {
          const updatedApp = applications.find(
            (a) => a.id === selectedApplication.id
          );
          if (updatedApp) {
            setSelectedApplication(updatedApp);
          }
        }
      }
    } catch (error) {
      console.error("Error approving image:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (imageId: string) => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/kyc/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", reviewNote: rejectNote }),
      });

      if (response.ok) {
        setIsRejectModalOpen(false);
        setRejectNote("");
        await fetchApplications();
      }
    } catch (error) {
      console.error("Error rejecting image:", error);
    } finally {
      setProcessing(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">確認待ち</Badge>;
      case "APPROVED":
        return <Badge variant="success">承認済み</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">不備あり</Badge>;
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
          <h2 className="text-2xl font-bold">KYC確認</h2>
          <Badge variant="outline">{applications.length}件 確認待ち</Badge>
        </div>

        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                確認待ちの申込はありません
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 申込一覧 */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                申込一覧
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
                    setSelectedImageIndex(0);
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
                      <Badge variant="warning">
                        {app.kycImages.filter((i) => i.status === "PENDING")
                          .length}
                        件 未確認
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{app.plan.name}</span>
                      <span>×{app.lineCount}回線</span>
                      <span>{formatDate(app.createdAt)}</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {app.kycImages.map((img) => (
                        <div
                          key={img.id}
                          className={`w-8 h-8 rounded border ${
                            img.status === "PENDING"
                              ? "border-yellow-400 bg-yellow-50"
                              : img.status === "APPROVED"
                                ? "border-green-400 bg-green-50"
                                : "border-red-400 bg-red-50"
                          }`}
                        >
                          {img.signedUrl && (
                            <img
                              src={img.signedUrl}
                              alt={img.type}
                              className="w-full h-full object-cover rounded"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 詳細パネル */}
            <div className="lg:sticky lg:top-4">
              {selectedApplication ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {selectedApplication.applicationNumber}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 画像プレビュー */}
                    {selectedApplication.kycImages.length > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium">
                            {
                              kycTypeLabels[
                                selectedApplication.kycImages[selectedImageIndex]
                                  ?.type
                              ]
                            }
                          </p>
                          {getStatusBadge(
                            selectedApplication.kycImages[selectedImageIndex]
                              ?.status
                          )}
                        </div>
                        <div
                          className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => setIsImageModalOpen(true)}
                        >
                          {selectedApplication.kycImages[selectedImageIndex]
                            ?.signedUrl ? (
                            <img
                              src={
                                selectedApplication.kycImages[selectedImageIndex]
                                  .signedUrl
                              }
                              alt="KYC画像"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              画像を読み込めません
                            </div>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 right-2"
                          >
                            <ZoomIn className="h-4 w-4 mr-1" />
                            拡大
                          </Button>
                        </div>
                        {selectedApplication.kycImages.length > 1 && (
                          <div className="flex justify-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={selectedImageIndex === 0}
                              onClick={() =>
                                setSelectedImageIndex((i) => i - 1)
                              }
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm py-2">
                              {selectedImageIndex + 1} /{" "}
                              {selectedApplication.kycImages.length}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                selectedImageIndex ===
                                selectedApplication.kycImages.length - 1
                              }
                              onClick={() =>
                                setSelectedImageIndex((i) => i + 1)
                              }
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 顧客情報 */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">顧客情報</h4>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <dt className="text-muted-foreground">氏名</dt>
                        <dd>{selectedApplication.customer.name}</dd>
                        <dt className="text-muted-foreground">種別</dt>
                        <dd>
                          {selectedApplication.customer.type === "INDIVIDUAL"
                            ? "個人"
                            : "法人"}
                        </dd>
                        <dt className="text-muted-foreground">メール</dt>
                        <dd className="truncate">
                          {selectedApplication.customer.email}
                        </dd>
                        <dt className="text-muted-foreground">電話番号</dt>
                        <dd>{selectedApplication.customer.phone}</dd>
                        {selectedApplication.customer.birthDate && (
                          <>
                            <dt className="text-muted-foreground">生年月日</dt>
                            <dd>
                              {new Date(
                                selectedApplication.customer.birthDate
                              ).toLocaleDateString("ja-JP")}
                            </dd>
                          </>
                        )}
                        <dt className="text-muted-foreground">住所</dt>
                        <dd className="col-span-1">
                          〒{selectedApplication.customer.postalCode}
                          <br />
                          {selectedApplication.customer.prefecture}
                          {selectedApplication.customer.city}
                          {selectedApplication.customer.address}
                          {selectedApplication.customer.building && (
                            <>
                              <br />
                              {selectedApplication.customer.building}
                            </>
                          )}
                        </dd>
                      </dl>
                    </div>

                    {/* 承認/不備ボタン */}
                    {selectedApplication.kycImages[selectedImageIndex]
                      ?.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() =>
                            handleApprove(
                              selectedApplication.kycImages[selectedImageIndex]
                                .id
                            )
                          }
                          disabled={processing}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setIsRejectModalOpen(true)}
                          disabled={processing}
                        >
                          <X className="h-4 w-4 mr-1" />
                          不備
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      左の一覧から申込を選択してください
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      {/* 画像拡大モーダル */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedApplication?.kycImages[selectedImageIndex]?.type &&
                kycTypeLabels[
                  selectedApplication.kycImages[selectedImageIndex].type
                ]}
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
            {selectedApplication?.kycImages[selectedImageIndex]?.signedUrl && (
              <img
                src={
                  selectedApplication.kycImages[selectedImageIndex].signedUrl
                }
                alt="KYC画像"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 不備理由入力モーダル */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>不備の理由を入力</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="不備の理由を入力してください..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedApplication &&
                handleReject(
                  selectedApplication.kycImages[selectedImageIndex].id
                )
              }
              disabled={processing}
            >
              不備として登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
