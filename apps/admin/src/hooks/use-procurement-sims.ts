import { useQuery } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";

export interface ProcurementSim {
  iccid: string;
  msisdn: string | null;
  supplierId: number;
  purchaseOrderId: string | null;
  simType: "INDIVIDUAL" | "CORPORATE" | "BOTH";
  carrierType: "DOCOMO" | "AU" | "SOFTBANK" | "RAKUTEN" | null;
  plan: string | null;
  supplierContractStart: string | null;
  supplierContractEnd: string | null;
  isAutoCancel: boolean;
  autoCancelDate: string | null;
  currentContractId: string | null;
  status: "IN_STOCK" | "ACTIVE";
  consumedTagIds: number[];
  eligibleTagIds: number[];
  simLocationTagId: number | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: number;
    name: string;
    code: string | null;
  };
  simLocationTag: {
    id: number;
    name: string;
    code: string;
  } | null;
}

/**
 * 発注に紐づくSIM一覧を取得するカスタムフック
 */
export function useProcurementSims(purchaseOrderId: string | null) {
  return useQuery<ProcurementSim[]>({
    queryKey: queryKeys.procurementSims(purchaseOrderId ?? ""),
    queryFn: async () => {
      if (!purchaseOrderId) return [];
      const res = await fetch(`/api/procurement/${purchaseOrderId}/sims`);
      if (!res.ok) throw new Error("SIM一覧の取得に失敗しました");
      return res.json();
    },
    enabled: !!purchaseOrderId,
    staleTime: STALE_TIMES.SHORT,
  });
}
