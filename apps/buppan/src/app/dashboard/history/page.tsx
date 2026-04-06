import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ユーザーに紐づく顧客情報を取得
  const customer = await prisma.customer.findFirst({
    where: {
      userId: session.user.id,
    },
  });

  if (!customer) {
    redirect("/dashboard");
  }

  // 申込履歴を取得
  const applications = await prisma.application.findMany({
    where: {
      customerId: customer.id,
    },
    include: {
      plan: true,
      lines: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            申し込み履歴
          </CardTitle>
          <CardDescription>
            全 {applications.length} 件の申込
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              申し込み履歴がありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">申込番号</TableHead>
                    <TableHead className="min-w-[90px]">申込日</TableHead>
                    <TableHead className="min-w-[100px]">プラン</TableHead>
                    <TableHead className="text-right min-w-[70px]">回線数</TableHead>
                    <TableHead className="text-right min-w-[80px]">金額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        {app.applicationNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>{app.plan.name}</TableCell>
                      <TableCell className="text-right">
                        {app.lineCount}回線
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(app.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
