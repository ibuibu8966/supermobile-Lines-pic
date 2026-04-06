"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function EkycPage() {
  const router = useRouter();

  // PIC完了後のリダイレクトで戻ってきた場合の処理は不要
  // PICのリダイレクト先を /apply?step=4&kyc=complete に設定するため、
  // このページには完了後に戻ってこない

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
          <p className="text-muted-foreground">本人確認の準備中です...</p>
          <p className="text-sm text-muted-foreground">
            QRコードが表示されたら、スマートフォンで読み取ってください。
          </p>
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
