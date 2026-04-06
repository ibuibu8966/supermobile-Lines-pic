"use client";

import React, { useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import { WorkflowStep1 } from "./workflow-step1";
import { WorkflowStep2 } from "./workflow-step2";
import { WorkflowStep3 } from "./workflow-step3";
import { WorkflowStep4 } from "./workflow-step4";
import { WorkflowStep5 } from "./workflow-step5";

export interface WorkflowAppData {
  id: string;
  noReferral: boolean;
  referrals: { id: string; referrerName: string; fee: number }[];
  paymentStatus: string | null;
  invoiceUrl: string | null;
  invoicePdfPath: string | null;
  invoiceEmailPath: string | null;
  paymentImagePath: string | null;
  shippingImagePath: string | null;
  trackings: { id: string; carrier: string; trackingNumber: string }[];
  lines: { id: string }[];
  stats: { lineStatus: string | null; lineCount: number };
}

interface Props {
  app: WorkflowAppData;
  referrerTags: { id: number; name: string }[];
  onRefresh: () => void;
}

export function WorkflowRows({ app, referrerTags, onRefresh }: Props) {
  const [workflowOpen, setWorkflowOpen] = React.useState<Record<number, boolean>>({});

  const toggleStep = (step: number) =>
    setWorkflowOpen((prev) => ({ ...prev, [step]: !prev[step] }));

  // 楽観的オーバーライドstate（nullはprops値を使用）
  const [optStep1Done, setOptStep1Done] = React.useState<boolean | null>(null);
  const [optPaths, setOptPaths] = React.useState<{
    invoicePdfPath: string | null | undefined;
    invoiceEmailPath: string | null | undefined;
    paymentImagePath: string | null | undefined;
    shippingImagePath: string | null | undefined;
  }>({ invoicePdfPath: undefined, invoiceEmailPath: undefined, paymentImagePath: undefined, shippingImagePath: undefined });
  const [optLineStatus, setOptLineStatus] = React.useState<string | null | undefined>(undefined);
  const [optTrackingsCount, setOptTrackingsCount] = React.useState<number | null>(null);

  // propsが変わったら楽観的stateをリセット
  useEffect(() => {
    setOptStep1Done(null);
    setOptPaths({ invoicePdfPath: undefined, invoiceEmailPath: undefined, paymentImagePath: undefined, shippingImagePath: undefined });
    setOptLineStatus(undefined);
    setOptTrackingsCount(null);
  }, [app]);

  // 実効値（楽観的stateがあればそちらを優先）
  const effInvoicePdfPath = optPaths.invoicePdfPath !== undefined ? optPaths.invoicePdfPath : app.invoicePdfPath;
  const effInvoiceEmailPath = optPaths.invoiceEmailPath !== undefined ? optPaths.invoiceEmailPath : app.invoiceEmailPath;
  const effPaymentImagePath = optPaths.paymentImagePath !== undefined ? optPaths.paymentImagePath : app.paymentImagePath;
  const effShippingImagePath = optPaths.shippingImagePath !== undefined ? optPaths.shippingImagePath : app.shippingImagePath;
  const effLineStatus = optLineStatus !== undefined ? optLineStatus : app.stats.lineStatus;

  // ステップ完了判定（楽観的stateで即反映）
  const step2AllUploaded = !!(effInvoicePdfPath && app.invoiceUrl && effInvoiceEmailPath);
  const step1Done = optStep1Done !== null ? optStep1Done : (app.noReferral || app.referrals.length > 0);
  const step2Done = step2AllUploaded && (app.paymentStatus === "INVOICED" || app.paymentStatus === "PAID");
  const step3Done = !!(app.paymentStatus === "PAID" || effPaymentImagePath);
  const step4Done = effLineStatus === "SHIPPING_INSTRUCTED" || effLineStatus === "SHIPPED" || !!effShippingImagePath;
  const step5Done = optTrackingsCount !== null ? optTrackingsCount > 0 : app.trackings.length > 0;

  // onOptimisticChange コールバック群
  const handleStep1OptimisticChange = useCallback((done: boolean) => {
    setOptStep1Done(done);
  }, []);

  const handleStep2OptimisticChange = useCallback((
    field: "invoicePdfPath" | "invoiceEmailPath" | "paymentStatus",
    value: string | null,
  ) => {
    if (field === "invoicePdfPath") setOptPaths((p) => ({ ...p, invoicePdfPath: value }));
    else if (field === "invoiceEmailPath") setOptPaths((p) => ({ ...p, invoiceEmailPath: value }));
  }, []);

  const handleStep3OptimisticChange = useCallback((
    field: "paymentImagePath" | "paymentStatus",
    value: string | null,
  ) => {
    if (field === "paymentImagePath") setOptPaths((p) => ({ ...p, paymentImagePath: value }));
  }, []);

  const handleStep4OptimisticChange = useCallback((
    field: "shippingImagePath" | "lineStatus",
    value: string | null,
  ) => {
    if (field === "shippingImagePath") setOptPaths((p) => ({ ...p, shippingImagePath: value }));
    else if (field === "lineStatus") setOptLineStatus(value);
  }, []);

  const handleStep5OptimisticChange = useCallback((count: number) => {
    setOptTrackingsCount(count);
  }, []);

  const StepHeader = ({
    step,
    label,
    done,
    locked,
  }: {
    step: number;
    label: string;
    done: boolean;
    locked: boolean;
  }) => (
    <button
      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium rounded-lg border transition-colors bg-white hover:bg-gray-50 border-gray-300 cursor-pointer"
      onClick={() => toggleStep(step)}
    >
      <span className="flex items-center gap-2">
        {done ? (
          <CheckSquare className="h-4 w-4 text-green-500" />
        ) : (
          <Square className="h-4 w-4 text-gray-400" />
        )}
        <span className={done ? "text-green-700" : ""}>{label}</span>
        {done && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            OK
          </Badge>
        )}
        {!done && !locked && (
          <Badge variant="secondary" className="text-xs">
            未設定
          </Badge>
        )}
        {!done && locked && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            前のステップを完了してください
          </Badge>
        )}
      </span>
      {workflowOpen[step] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  return (
    <tr className="border-b">
      <td colSpan={23} className="p-0">
        <div className="bg-gray-50 p-4">
          <div className="max-w-[1024px]">
            <Card>
              <CardContent className="pt-4 space-y-2">

                {/* ステップ1: メール画像＆請求書発行 */}
                <div>
                  <StepHeader step={1} label="① メール画像＆請求書発行" done={step2Done} locked={false} />
                  {workflowOpen[1] && (
                    <WorkflowStep2
                      appId={app.id}
                      invoicePdfPath={app.invoicePdfPath}
                      invoiceUrl={app.invoiceUrl}
                      invoiceEmailPath={app.invoiceEmailPath}
                      paymentStatus={app.paymentStatus}
                      step2AllUploaded={step2AllUploaded}
                      locked={false}
                      onRefresh={onRefresh}
                      onOptimisticChange={handleStep2OptimisticChange}
                    />
                  )}
                </div>

                {/* ステップ2: 入金確認 */}
                <div>
                  <StepHeader step={2} label="② 入金確認" done={step3Done} locked={!step2Done} />
                  {workflowOpen[2] && (
                    <WorkflowStep3
                      appId={app.id}
                      paymentImagePath={app.paymentImagePath}
                      paymentStatus={app.paymentStatus}
                      locked={!step2Done}
                      onRefresh={onRefresh}
                      onOptimisticChange={handleStep3OptimisticChange}
                    />
                  )}
                </div>

                {/* ステップ3: 発送＆住所確認指示 */}
                <div>
                  <StepHeader step={3} label="③ 発送＆住所確認指示" done={step4Done} locked={!step3Done} />
                  {workflowOpen[3] && (
                    <WorkflowStep4
                      appId={app.id}
                      shippingImagePath={app.shippingImagePath}
                      lineStatus={app.stats.lineStatus}
                      lines={app.lines}
                      locked={!step3Done}
                      onRefresh={onRefresh}
                      onOptimisticChange={handleStep4OptimisticChange}
                    />
                  )}
                </div>

                {/* ステップ4: 追跡番号 */}
                <div>
                  <StepHeader step={4} label="④ 追跡番号" done={step5Done} locked={!step4Done} />
                  {workflowOpen[4] && (
                    <WorkflowStep5
                      appId={app.id}
                      trackings={app.trackings}
                      lines={app.lines}
                      locked={!step4Done}
                      onRefresh={onRefresh}
                      onOptimisticChange={handleStep5OptimisticChange}
                    />
                  )}
                </div>

                {/* ステップ5: キャッシュバック */}
                <div>
                  <StepHeader step={5} label="⑤ キャッシュバック" done={step1Done} locked={false} />
                  {workflowOpen[5] && (
                    <WorkflowStep1
                      appId={app.id}
                      noReferral={app.noReferral}
                      referrals={app.referrals}
                      referrerTags={referrerTags}
                      lineCount={app.stats.lineCount}
                      onRefresh={onRefresh}
                      onOptimisticChange={handleStep1OptimisticChange}
                    />
                  )}
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </td>
    </tr>
  );
}
