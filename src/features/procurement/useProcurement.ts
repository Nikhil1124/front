/**
 * Procurement hooks — catalog browse + order submit + owner approve/reject.
 *
 * Manager mode drives `useProcurementCatalog` + `useSubmitProcurementOrder`.
 * Owner mode drives `useProcurementOrders` + `useApproveProcurementOrder` /
 * `useRejectProcurementOrder`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toProcurementCatalogItem, toProcurementOrder } from "../../data/mappers";
import type { ProcurementCatalogItem, ProcurementOrder } from "../../types";

// ─── Plain functions ─────────────────────────────────────────────────────────

export async function listProcurementCatalog(): Promise<ProcurementCatalogItem[]> {
  const dto = await apiFetch<{ items: any[] } | any[]>(API.PROCUREMENT_CATALOG);
  const items = Array.isArray(dto) ? dto : (dto?.items ?? []);
  return items.map(toProcurementCatalogItem);
}

export interface SubmitProcurementOrderParams {
  pg_id: string;
  order_type: "grocery" | "supplies" | "emergency";
  // Was `{item_name, category, quantity, unit, estimated_price}` — none of those fields
  // exist on the server's `ProcurementOrderItemRequest` (pg-backend
  // procurement/schemas.py), which wants `{item_id, quantity}` and nothing else.
  // `RequestModel.model_config = ConfigDict(extra="forbid")` on every request body means
  // the old shape was a guaranteed 422 on every submission — required `item_id` missing,
  // plus five fields the server doesn't recognise. Every requisition ever "submitted" from
  // this form failed silently into the caller's catch block.
  items: Array<{ item_id: string; quantity: number }>;
  notes?: string;
}

export function submitProcurementOrder(params: SubmitProcurementOrderParams): Promise<ProcurementOrder> {
  return apiFetch<any>(API.PROCUREMENT_ORDERS, {
    method: "POST",
    body: JSON.stringify(params),
  }).then(toProcurementOrder);
}

export async function listProcurementOrders(
  filters: { pgId?: string; status?: string; managerId?: string } = {},
): Promise<ProcurementOrder[]> {
  const params = new URLSearchParams();
  if (filters.pgId) params.append("pg_id", filters.pgId);
  if (filters.status) params.append("status", filters.status);
  if (filters.managerId) params.append("manager_id", filters.managerId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const dto = await apiFetch<{ items: any[] } | any[]>(`${API.PROCUREMENT_ORDERS}${qs}`);
  const items = Array.isArray(dto) ? dto : (dto?.items ?? []);
  return items.map(toProcurementOrder);
}

export function approveProcurementOrder(orderId: string): Promise<ProcurementOrder> {
  return apiFetch<any>(API.PROCUREMENT_ORDER_APPROVE(orderId), {
    method: "POST",
  }).then(toProcurementOrder);
}

export function rejectProcurementOrder(orderId: string, reason: string): Promise<ProcurementOrder> {
  return apiFetch<any>(API.PROCUREMENT_ORDER_REJECT(orderId), {
    method: "POST",
    body: JSON.stringify({ reason }),
  }).then(toProcurementOrder);
}

// ─── React bindings ──────────────────────────────────────────────────────────

export function useProcurementCatalog() {
  return useQuery({
    queryKey: qk.procurement.catalog(),
    queryFn: listProcurementCatalog,
    staleTime: 5 * 60_000,
  });
}

export function useProcurementOrders(filters: {
  pgId?: string;
  status?: string;
  managerId?: string;
} = {}) {
  return useQuery({
    queryKey: qk.procurement.orders(filters),
    queryFn: () => listProcurementOrders(filters),
  });
}

export function useSubmitProcurementOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitProcurementOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.procurement.ordersAll() });
    },
  });
}

export function useApproveProcurementOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => approveProcurementOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.procurement.ordersAll() });
    },
  });
}

export function useRejectProcurementOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { orderId: string; reason: string }) =>
      rejectProcurementOrder(params.orderId, params.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.procurement.ordersAll() });
    },
  });
}
