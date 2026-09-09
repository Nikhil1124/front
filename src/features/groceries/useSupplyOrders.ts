import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { SupplyOrderDetail, SupplyOrderSummary, SupplyPaymentMethod } from '@/types/supply';

export interface CreateOrderPayload {
  pg_id: string;
  payment_method: SupplyPaymentMethod;
  delivery_slot_id?: string;
  delivery_note?: string;
  items: {
    item_id: string;
    quantity: number;
  }[];
  idempotency_key?: string;
}

export interface ApplicableDeliverySlot {
  id: string;
  scope_type: 'global' | 'area';
  area_id: string | null;
  label: string;
  start_time: string;
  end_time: string;
  display_order: number;
}

export function useApplicableDeliverySlotsQuery(pgId?: string) {
  return useQuery<ApplicableDeliverySlot[]>({
    queryKey: ['applicable_delivery_slots', pgId],
    queryFn: () => {
      const params = new URLSearchParams({ pg_id: pgId! });
      return apiFetch(`/v1/supply/delivery-slots/applicable?${params.toString()}`);
    },
    enabled: !!pgId,
  });
}

export function useSupplyOrdersQuery(pgId?: string, status?: string) {
  return useQuery<{ items: SupplyOrderSummary[] }>({
    queryKey: ['supply_orders', pgId, status],
    queryFn: () => {
      const params = new URLSearchParams({ pg_id: pgId! });
      if (status) params.append('status', status);
      return apiFetch(`/v1/supply/orders?${params.toString()}`);
    },
    enabled: !!pgId,
  });
}

/** An order stops changing once it is delivered or cancelled — polling past that is pure cost. */
const isOrderClosed = (status?: string) =>
  !!status && ['delivered', 'cancelled'].includes(status);

export function useSupplyOrderDetailQuery(orderId?: string) {
  return useQuery<SupplyOrderDetail>({
    queryKey: ['supply_order_detail', orderId],
    // `conditional` makes this an ADR-008 poll: the server answers 304 unless the order
    // actually moved, which skips its line-item join and its serialisation entirely.
    queryFn: () => apiFetch(`/v1/supply/orders/${orderId}`, { conditional: true }),
    enabled: !!orderId,
    // 15s, not 5s. An order passes through roughly four states in its life; polling three
    // times a second-and-a-half faster does not make a delivery arrive sooner, and at scale
    // this interval is the single largest source of load in the whole system.
    refetchInterval: (query) => (isOrderClosed(query.state.data?.status) ? false : 15000),
  });
}

export interface OrderTrackingInfo {
  order_id?: string;
  order_no?: string;
  status: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_label?: string | null;
  eta_window_start?: string | null;
  eta_window_end?: string | null;
  trip?: {
    id: string;
    vehicle_label: string;
    driver_name: string;
    driver_phone: string;
  };
}

export function useSupplyTrackingQuery(orderId?: string) {
  const detail = useSupplyOrderDetailQuery(orderId);
  return useQuery<OrderTrackingInfo>({
    queryKey: ['supply_order_tracking', orderId],
    queryFn: () => apiFetch(`/v1/supply/orders/${orderId}/tracking`, { conditional: true }),
    enabled: !!orderId,
    // Was a flat 10s that never stopped — it kept polling a delivered order for as long as
    // the screen stayed open. Now it stops with the order, and runs at half the detail
    // query's rate, since driver and ETA move more slowly than status does.
    refetchInterval: isOrderClosed(detail.data?.status) ? false : 30000,
  });
}

export function useCreateSupplyOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      apiFetch<SupplyOrderDetail>('/v1/supply/orders', {
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
      apiFetch<SupplyOrderDetail>(`/v1/supply/orders/${orderId}/cancel`, {
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
      apiFetch<SupplyOrderDetail>(`/v1/supply/orders/${orderId}/payment/submit-upi`, {
        method: 'POST',
        body: JSON.stringify({ upi_ref: upiRef }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supply_order_detail', data.id] });
    },
  });
}

/**
 * The property's credit line — limit, what's outstanding, what's left.
 *
 * `GET /v1/supply/credit/accounts/{pg_id}` is readable only by someone who manages the PG
 * (or PGow ops), which is exactly the set of people allowed to pay on credit — so this is
 * gated on the same condition the "Pay on credit" option is. Outstanding is derived
 * server-side from unpaid credit orders minus their allocations; nothing here is cached
 * across properties.
 */
export interface CreditAccount {
  pg_id: string;
  /** Decimal on the wire, like every other money field. */
  credit_limit: string;
  is_active: boolean;
  outstanding: string;
  available: string;
}

export function useCreditAccountQuery(pgId?: string, enabled = true) {
  return useQuery<CreditAccount>({
    queryKey: ['supply_credit_account', pgId],
    queryFn: () => apiFetch(`/v1/supply/credit/accounts/${pgId}`),
    enabled: !!pgId && enabled,
  });
}
