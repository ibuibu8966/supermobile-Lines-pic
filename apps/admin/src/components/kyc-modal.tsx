"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ImageOff } from "lucide-react";

interface KycModalProps {
  applicationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialImageType?: string;
}

interface KycImage {
  id: string;
  type: string;
  signedUrl: string | null;
  status: string;
  expiryDate: string | null;
}

interface ApplicationDetail {
  id: string;
  applicationNumber: string;
  customer: {
    type: string;
    lastName: string;
    firstName: string;
    lastNameKana: string | null;
    firstNameKana: string | null;
    companyName: string | null;
    companyNameKana: string | null;
    email: string | null;
    phone: string | null;
    postalCode: string | null;
    prefecture: string | null;
    city: string | null;
    address: string | null;
    building: string | null;
  };
  service: {
    name: string;
  };
  plan: {
    name: string;
  } | null;
  kycImages: KycImage[];
}

const KYC_TYPE_LABELS: Record<string, string> = {
  ID_FRONT: "表",
  ID_BACK: "裏",
  SELFIE: "自撮り",
  ADDRESS_PROOF: "住所",
  CORPORATE_REGISTRY: "謄本",
};

const KYC_TYPE_FULL_LABELS: Record<string, string> = {
  ID_FRONT: "身分証（表）",
  ID_BACK: "身分証（裏）",
  SELFIE: "自撮り",
  ADDRESS_PROOF: "住所証明",
  CORPORATE_REGISTRY: "登記簿謄本",
};

const isPdfUrl = (url: string | null): boolean => {
  if (!url) return false;
  const pathWithoutQuery = url.split("?")[0];
  return pathWithoutQuery.toLowerCase().endsWith(".pdf");
};

export function KycModal({ applicationId, isOpen, onClose, initialImageType }: KycModalProps) {
  const [selectedImageType, setSelectedImageType] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [tryIframe, setTryIframe] = useState(false);

  // initialImageTypeが変更されたら選択を更新
  useEffect(() => {
    if (isOpen && initialImageType) {
      setSelectedImageType(initialImageType);
      setImageError(false);
      setTryIframe(false);
    }
  }, [isOpen, initialImageType]);

  const { data: application, isLoading } = useQuery<ApplicationDetail>({
    queryKey: ["application-kyc", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`);
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json();
    },
    enabled: isOpen && !!applicationId,
  });

  // 最初の画像タイプを選択状態にする
  const currentImageType = selectedImageType || application?.kycImages[0]?.type || null;
  const currentImage = application?.kycImages.find((img) => img.type === currentImageType);

  const getCustomerName = () => {
    if (!application) return "";
    const { customer } = application;
    if (customer.type === "CORPORATE" && customer.companyName) {
      return customer.companyName;
    }
    return `${customer.lastName} ${customer.firstName}`;
  };

  const getCustomerNameKana = () => {
    if (!application) return "";
    const { customer } = application;
    if (customer.type === "CORPORATE" && customer.companyNameKana) {
      return customer.companyNameKana;
    }
    return `${customer.lastNameKana || ""} ${customer.firstNameKana || ""}`.trim();
  };

  const getFullAddress = () => {
    if (!application) return "";
    const { customer } = application;
    const parts = [
      customer.prefecture,
      customer.city,
      customer.address,
      customer.building,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>本人確認書類</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : application ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左カラム: 申込情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                申込情報
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">申込タイプ</span>
                  <div className="font-medium">
                    <Badge variant={application.customer.type === "CORPORATE" ? "default" : "secondary"}>
                      {application.customer.type === "CORPORATE" ? "法人" : "個人"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">申込番号</span>
                  <p className="font-medium">{application.applicationNumber}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">
                    {application.customer.type === "CORPORATE" ? "会社名" : "名前"}
                  </span>
                  <p className="font-medium">{getCustomerName()}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">カナ</span>
                  <p className="font-medium text-gray-600">{getCustomerNameKana() || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">電話番号</span>
                  <p className="font-medium">{application.customer.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">メール</span>
                  <p className="font-medium truncate">{application.customer.email || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">郵便番号</span>
                  <p className="font-medium">
                    {application.customer.postalCode ? `〒${application.customer.postalCode}` : "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">住所</span>
                  <p className="font-medium">{getFullAddress() || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">サービス</span>
                  <p className="font-medium">{application.service.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">プラン</span>
                  <p className="font-medium">{application.plan?.name || "—"}</p>
                </div>
              </div>
            </div>

            {/* 右カラム: 画像表示 */}
            <div className="space-y-4">
              {/* タブ */}
              <div className="flex gap-2 border-b">
                {application.kycImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setSelectedImageType(img.type);
                      setImageError(false);
                      setTryIframe(false);
                    }}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      currentImageType === img.type
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {KYC_TYPE_LABELS[img.type] || img.type}
                  </button>
                ))}
              </div>

              {/* 画像表示 */}
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                {currentImage ? (
                  currentImage.signedUrl ? (
                    imageError ? (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ImageOff className="h-12 w-12" />
                        <p>画像の読み込みに失敗しました</p>
                      </div>
                    ) : isPdfUrl(currentImage.signedUrl) || tryIframe ? (
                      <iframe
                        src={currentImage.signedUrl}
                        className="w-full h-[500px]"
                        title={KYC_TYPE_FULL_LABELS[currentImage.type] || currentImage.type}
                      />
                    ) : (
                      <img
                        src={currentImage.signedUrl}
                        alt={KYC_TYPE_FULL_LABELS[currentImage.type] || currentImage.type}
                        className="max-w-full max-h-[500px] object-contain"
                        onError={() => setTryIframe(true)}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <ImageOff className="h-12 w-12" />
                      <p>画像URLの取得に失敗しました</p>
                    </div>
                  )
                ) : (
                  <p className="text-gray-400">画像がありません</p>
                )}
              </div>

              {/* 有効期限 */}
              {currentImage?.expiryDate && (
                <div className="text-sm">
                  <span className="text-gray-500">有効期限: </span>
                  <span className="font-medium">{formatDate(currentImage.expiryDate)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            データの取得に失敗しました
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
