import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Home, FileText } from "lucide-react";

export default function ApplyCompletePage() {
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardContent className="pt-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            申込が完了しました
          </h1>
          <p className="text-muted-foreground mb-6">
            追加回線の申込を受け付けました。
            <br />
            審査完了後、SIMカードを発送いたします。
          </p>

          <div className="space-y-3">
            <Link href="/dashboard/history">
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                申込履歴を確認
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                ダッシュボードに戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
