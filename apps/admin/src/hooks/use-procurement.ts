import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, STALE_TIMES } from "@/lib/api/query-keys";
import type { PurchaseOrder, PurchaseOrderType, SimplePaymentStatus } from "@/types/procurement";

/**
 * Procurement管理用カスタムフック
 * 発注データの取得と更新を管理
 */
export function useProcurement(typeFilter?: PurchaseOrderType) {
  const queryClient = useQueryClient();

  const queryKey = typeFilter
    ? [...queryKeys.procurement, typeFilter]
    : queryKeys.procurement;

  // 発注データの取得
  const { data: orders, isLoading, error } = useQuery<PurchaseOrder[]>({
    queryKey,
    queryFn: () => {
      const url = typeFilter
        ? `/api/procurement?type=${typeFilter}`
        : "/api/procurement";
      return fetch(url).then((r) => r.json());
    },
    staleTime: STALE_TIMES.MASTER,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // 発注データの更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/procurement/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<PurchaseOrder[]>(queryKey);

      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) => {
          if (order.id === id) {
            const update: Partial<PurchaseOrder> = {};
            if (data.status !== undefined) update.status = data.status as string;
            if (data.paymentStatus !== undefined) update.paymentStatus = data.paymentStatus as SimplePaymentStatus | null;
            if (data.totalAmount !== undefined) update.totalAmount = data.totalAmount as number;
            if (data.invoiceDate !== undefined) {
              update.invoiceDate = data.invoiceDate instanceof Date
                ? data.invoiceDate.toISOString()
                : (data.invoiceDate as string | null);
            }
            if (data.deliveryDate !== undefined) {
              update.deliveryDate = data.deliveryDate instanceof Date
                ? data.deliveryDate.toISOString()
                : (data.deliveryDate as string | null);
            }
            if (data.paymentDueDate !== undefined) {
              update.paymentDueDate = data.paymentDueDate instanceof Date
                ? data.paymentDueDate.toISOString()
                : (data.paymentDueDate as string | null);
            }
            return { ...order, ...update };
          }
          return order;
        });
      });

      return { previousOrders };
    },
    onSuccess: (updatedOrder, { id }) => {
      // APIレスポンスで該当データのみ更新（再フェッチ不要）
      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) =>
          order.id === id ? updatedOrder : order
        );
      });
    },
    onError: (err, variables, context) => {
      // エラー時はロールバック
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKey, context.previousOrders);
      }
    },
  });

  // 画像アップロード（楽観的更新付き）
  const uploadImageMutation = useMutation({
    mutationFn: async ({
      id,
      imageType,
      file,
    }: {
      id: string;
      imageType: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("imageType", imageType);

      const res = await fetch(`/api/procurement/${id}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Upload error details:", errorData);
        throw new Error(errorData.details || "Failed to upload image");
      }
      return res.json();
    },
    onMutate: async ({ id, imageType, file }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousOrders = queryClient.getQueryData<PurchaseOrder[]>(queryKey);

      const fieldMap = {
        purchaseOrder: "purchaseOrderImagePath",
        quote: "quoteImagePath",
        invoice: "invoiceImagePath",
      } as const;

      const fieldName = fieldMap[imageType as keyof typeof fieldMap];

      const previewUrl = URL.createObjectURL(file);

      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) => {
          if (order.id === id) {
            return { ...order, [fieldName]: previewUrl };
          }
          return order;
        });
      });

      return { previousOrders, previewUrl };
    },
    onSuccess: (updatedOrder, { id }) => {
      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) => (order.id === id ? updatedOrder : order));
      });
    },
    onError: (err, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKey, context.previousOrders);
      }
      if (context?.previewUrl) {
        URL.revokeObjectURL(context.previewUrl);
      }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.previewUrl) {
        URL.revokeObjectURL(context.previewUrl);
      }
    },
  });

  // 画像削除（楽観的更新付き）
  const deleteImageMutation = useMutation({
    mutationFn: async ({ id, imageType }: { id: string; imageType: string }) => {
      const res = await fetch(
        `/api/procurement/${id}/upload-image?imageType=${imageType}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete image");
      return res.json();
    },
    onMutate: async ({ id, imageType }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<PurchaseOrder[]>(queryKey);

      const fieldMap = {
        purchaseOrder: "purchaseOrderImagePath",
        quote: "quoteImagePath",
        invoice: "invoiceImagePath",
      } as const;
      const fieldName = fieldMap[imageType as keyof typeof fieldMap];

      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) => {
          if (order.id === id) {
            return { ...order, [fieldName]: null };
          }
          return order;
        });
      });

      return { previousOrders };
    },
    onSuccess: (updatedOrder, { id }) => {
      queryClient.setQueryData<PurchaseOrder[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((order) => (order.id === id ? updatedOrder : order));
      });
    },
    onError: (err, variables, context) => {
      // エラー時はロールバック
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKey, context.previousOrders);
      }
    },
  });

  return {
    orders,
    isLoading,
    error,
    updateMutation,
    uploadImageMutation,
    deleteImageMutation,
  };
}
