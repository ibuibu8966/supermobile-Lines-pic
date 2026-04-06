"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface Supplier {
  id: number;
  name: string;
  code: string;
}

const CARRIER_OPTIONS = [
  { value: "DOCOMO", label: "ドコモ" },
  { value: "AU", label: "au" },
  { value: "SOFTBANK", label: "ソフトバンク" },
  { value: "RAKUTEN", label: "楽天" },
];

export default function NewProcurementPage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // 固定値
  const carrierType = "DOCOMO";
  const unitPrice = 1000;

  const { data: suppliers, isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create purchase order");
      return res.json();
    },
    onSuccess: () => {
      router.push("/procurement");
    },
  });

  const totalAmount = quantity
    ? parseInt(quantity) * unitPrice
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      supplierId: parseInt(supplierId),
      carrierType,
      quantity: parseInt(quantity),
      unitPrice,
      totalAmount,
      note: note || null,
    });
  };

  const isValid =
    supplierId && quantity && parseInt(quantity) > 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/procurement" prefetch={false}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">新規発注</h1>
        <p className="text-sm text-muted-foreground mt-1">
          新しい発注を作成します
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>発注情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="supplier">
                仕入れ先 <span className="text-red-500">*</span>
              </Label>
              {loadingSuppliers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  読み込み中...
                </div>
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="仕入れ先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier">
                回線種別
              </Label>
              <Input
                id="carrier"
                type="text"
                value="ドコモ"
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                ※ 現在はドコモ回線のみ対応しています
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">
                回線数 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  枚
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">
                回線単価
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ¥
                </span>
                <Input
                  id="unitPrice"
                  type="text"
                  value="1,000"
                  disabled
                  className="pl-8 bg-gray-50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                ※ 標準単価: ¥1,000/回線
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">請求金額</span>
                <span className="text-2xl font-bold text-gray-900">
                  ¥{totalAmount.toLocaleString()}
                </span>
              </div>
              {quantity && (
                <p className="text-xs text-muted-foreground mt-1">
                  {parseInt(quantity).toLocaleString()}枚 × ¥{unitPrice.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">備考</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="備考があれば入力してください"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Link href="/procurement" prefetch={false} className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  キャンセル
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1"
                disabled={!isValid || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "発注を作成"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
