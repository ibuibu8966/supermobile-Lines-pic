"use client";

import Script from "next/script";
import { useState, useEffect } from "react";
import { Loader2, Smartphone, Monitor } from "lucide-react";

export default function EkycPage() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    // モバイル判定
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);
    if (mobile) {
      // スマホの場合は自動でPICを起動
      setShowQR(true);
    }
  }, []);

  // 判定中
  if (isMobile === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // スマホの場合：PICが自動起動
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="bg-card border-b">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold">本人確認</h1>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">本人確認を起動中です...</p>
          </div>
        </main>
        <Script
          src="https://app.protechidchecker.com/apps/org7834"
          strategy="afterInteractive"
          charSet="utf-8"
        />
      </div>
    );
  }

  // PCの場合：ボタンを表示 → クリックでQRコード表示
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">本人確認</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        {!showQR ? (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center space-y-2">
              <Monitor className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold">PCからのご利用</h2>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center space-y-2">
              <p className="font-medium text-red-800">対象外端末のため、ご利用頂けません。</p>
              <p className="text-sm text-red-700">
                本人確認にはスマートフォンのカメラが必要です。
                下のボタンからQRコードを表示し、スマートフォンで読み取ってください。
              </p>
            </div>
            <button
              className="w-full flex items-center justify-center gap-3 h-14 text-lg font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => setShowQR(true)}
            >
              <Smartphone className="h-5 w-5" />
              スマホで本人確認をする
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">QRコードを表示中です...</p>
            <p className="text-sm text-muted-foreground">
              表示されたQRコードをスマートフォンで読み取ってください。
            </p>
          </div>
        )}
      </main>
      {showQR && (
        <Script
          src="https://app.protechidchecker.com/apps/org7834"
          strategy="afterInteractive"
          charSet="utf-8"
        />
      )}
    </div>
  );
}
