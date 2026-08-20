import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { API } from '@/config';
import { SupplyOrderDetail, SupplyOrderSummary } from '@/types/supply';

export interface CreateOrderPayload {
  pg_id: string;
  payment_method: 'upi' | 'credit' | 'cash';
  delivery_slot?: string;
  delivery_notes?: string;
  items: {
    item_id: string;
    quantity: number;
  }[];
}

export function useSupplyOrdersQuery(pgId?: string, status?: string) {
  return useQuery<{ items: SupplyOrderSummary[] }>({
    queryKey: ['supply_orders', pgId, status],
    queryFn: () => {
      const params = new URLSearchParams({ pg_id: pgId! });
      if (status) params.append('status', status);
      return apiFetch(`${API.SUPPLY_ORDERS}?${params.toString()}`);
    },
    enabled: !!pgId,
  });
}

export function useSupplyOrderDetailQuery(orderId?: string) {
  return useQuery<SupplyOrderDetail>({
    queryKey: ['supply_order_detail', orderId],
    queryFn: () => apiFetch(API.SUPPLY_ORDER(orderId!)),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Auto-poll while order is active
      if (status && !['delivered', 'cancelled'].includes(status)) {
        return 5000;
      }
      return false;
    },
  });
}

export interface OrderTrackingInfo {
  status: string;
  trip?: {
    id: string;
    vehicle_label: string;
    driver_name: string;
    driver_phone: string;
  };
}

export function useSupplyTrackingQuery(orderId?: string) {
  return useQuery<OrderTrackingInfo>({
    queryKey: ['supply_order_tracking', orderId],
    queryFn: () => apiFetch(API.SUPPLY_ORDER_TRACKING(orderId!)),
    enabled: !!orderId,
    refetchInterval: 10000,
  });
}

export function useCreateSupplyOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      apiFetch<SupplyOrderDetail>(API.SUPPLY_ORDERS, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supply_orders'] });
      queryClient.setQueryData(['supply_order_detail', data.id], data);
    },
  });
}

export function useCancelSupplyOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      apiFetch<SupplyOrderDetail>(API.SUPPLY_ORDER_CANCEL(orderId), {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supply_orders'] });
      queryClient.invalidateQueries({ queryKey: ['supply_order_detail', data.id] });
    },
  });
}

export function useSubmitUpiPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, upiRef }: { orderId: string; upiRef: string }) =>
      apiFetch<SupplyOrderDetail>(API.SUPPLY_ORDER_PAYMENT_UPI(orderId), {
        method: 'POST',
        body: JSON.stringify({ upi_ref: upiRef }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supply_order_detail', data.id] });
    },
  });
}
