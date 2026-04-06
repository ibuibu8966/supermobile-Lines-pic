"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

function CompleteContent() {
  const searchParams = useSearchParams();
  const applicationNumber = searchParams.get("number") || "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle>お申込みありがとうございます</CardTitle>
          <CardDescription>
            お申込みを受け付けました
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">申込番号</p>
            <p className="text-2xl font-bold font-mono">{applicationNumber}</p>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              ご登録いただいたメールアドレス宛に確認メールをお送りしました。
            </p>
            <p>
              本人確認書類のご提出が必要です。マイページよりアップロードをお願いいたします。
            </p>
            <p>
              本人確認完了後、請求書をお送りいたします。入金確認後、SIMカードを発送いたします。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button className="w-full">
                マイページへログイン
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">
                トップページへ戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    }>
      <CompleteContent />
    </Suspense>
  );
}
