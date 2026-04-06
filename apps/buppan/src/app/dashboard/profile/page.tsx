"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  CreditCard,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useDashboard } from "../context";

export default function ProfilePage() {
  const { data, loading } = useDashboard();

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const customer = data?.customer;

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          顧客情報が見つかりません
        </h1>
        <p className="text-muted-foreground">
          申し込みを完了してからマイページをご利用ください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            会員情報
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本情報 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">基本情報</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">氏名</p>
                  <p className="font-medium">{customer.lastName} {customer.firstName}</p>
                  <p className="text-xs text-muted-foreground">{customer.lastNameKana} {customer.firstNameKana}</p>
                </div>
              </div>
              {customer.birthDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">生年月日</p>
                    <p className="font-medium">{new Date(customer.birthDate).toLocaleDateString("ja-JP")}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">メールアドレス</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">電話番号</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">住所</p>
                  <p className="font-medium">
                    〒{customer.postalCode} {customer.prefecture}{customer.city}{customer.address}
                    {customer.building && ` ${customer.building}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 法人情報（法人のみ） */}
          {customer.type === "CORPORATE" && customer.companyName && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">法人情報</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">会社名</p>
                      <p className="font-medium">{customer.companyName}</p>
                      {customer.companyNameKana && <p className="text-xs text-muted-foreground">{customer.companyNameKana}</p>}
                    </div>
                  </div>
                  {customer.establishedDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">設立日</p>
                        <p className="font-medium">{new Date(customer.establishedDate).toLocaleDateString("ja-JP")}</p>
                      </div>
                    </div>
                  )}
                  {customer.companyAddress && (
                    <div className="flex items-start gap-3 md:col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">会社住所</p>
                        <p className="font-medium">
                          {customer.companyPostalCode && `〒${customer.companyPostalCode} `}
                          {customer.companyPrefecture}{customer.companyCity}{customer.companyAddress}
                          {customer.companyBuilding && ` ${customer.companyBuilding}`}
                        </p>
                      </div>
                    </div>
                  )}
                  {customer.representativeLastName && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">代表者名</p>
                        <p className="font-medium">{customer.representativeLastName} {customer.representativeFirstName}</p>
                        {customer.representativeLastNameKana && (
                          <p className="text-xs text-muted-foreground">{customer.representativeLastNameKana} {customer.representativeFirstNameKana}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">担当者名</p>
                      <p className="font-medium">{customer.lastName} {customer.firstName}</p>
                      <p className="text-xs text-muted-foreground">{customer.lastNameKana} {customer.firstNameKana}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 本人確認書類 */}
          {customer.kycImages.length > 0 && (() => {
            const latestExpiryDate = customer.kycImages
              .map((k) => k.expiryDate)
              .filter(Boolean)
              .sort()
              .at(-1);
            const kyc = customer.kycImages.find((k) => k.expiryDate === latestExpiryDate) ?? customer.kycImages[0];
            const isExpired = kyc.expiryDate && new Date(kyc.expiryDate) < new Date();
            return (
              <>
                <div className="border-t border-border" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">本人確認書類</p>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">有効期限</p>
                        <p className={`font-medium ${isExpired ? "text-red-500" : ""}`}>
                          {kyc.expiryDate ? new Date(kyc.expiryDate).toLocaleDateString("ja-JP") : "未登録"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          期限切れ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
