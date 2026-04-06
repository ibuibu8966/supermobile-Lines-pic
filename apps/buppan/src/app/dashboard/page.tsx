"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phone,
  Plus,
  ChevronRight,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { useDashboard } from "./context";

export default function DashboardPage() {
  const { data, loading } = useDashboard();

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const customer = data?.customer;
  const applications = data?.applications ?? [];
  const lineStats = data?.lineStats ?? { active: 0, pending: 0, cancelled: 0 };

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          顧客情報が見つかりません
        </h1>
        <p className="text-muted-foreground mb-6">
          申し込みを完了してからマイページをご利用ください。
        </p>
        <Link href="/apply">
          <Button>新規申し込み</Button>
        </Link>
      </div>
    );
  }

  const recentApplications = applications.slice(0, 3);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "SHIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" />
            承認済み
          </span>
        );
      case "SUBMITTED":
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3" />
            審査中
          </span>
        );
      case "REJECTED":
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="h-3 w-3" />
            {status === "REJECTED" ? "却下" : "キャンセル"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 回線サマリー */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {lineStats.active}
              </p>
              <p className="text-sm text-muted-foreground mt-1">契約中の回線</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">
                {lineStats.pending}
              </p>
              <p className="text-sm text-muted-foreground mt-1">申込中の回線</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-muted-foreground">
                {lineStats.cancelled}
              </p>
              <p className="text-sm text-muted-foreground mt-1">解約済みの回線</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最新の申込 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              最新の申込
            </CardTitle>
            <CardDescription>直近の申込状況</CardDescription>
          </div>
          <Link href="/dashboard/history">
            <Button variant="ghost" size="sm">
              すべて見る
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">申込がありません</p>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">{app.applicationNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.plan.name} × {app.lineCount}回線
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(app.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(app.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* クイックリンク */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/apply">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">追加申込</p>
                  <p className="text-sm text-muted-foreground">新しい回線を申し込む</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/lines">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">契約回線一覧</p>
                  <p className="text-sm text-muted-foreground">
                    契約中の回線を確認する
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
