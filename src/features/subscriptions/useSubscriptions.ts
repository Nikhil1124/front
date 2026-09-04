/**
 * Standing grocery orders — `/v1/supply/subscriptions`. A subscription is a recurring line
 * order against the real Supply catalog (same items/audience rules as one-off orders and
 * procurement requisitions); `app/jobs/supply_materialise.py` turns an active one into a
 * real order once a day server-side, on its own cron schedule.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";

export interface SubscriptionItem {
  item_id: string;
  item_name: string;
  unit_label: string;
  quantity: number;
}

export interface Subscription {
  id: string;
  pg_id: string;
  placed_by: string;
  /** "HH:MM:SS" — informational only; the materialiser runs on cron's own schedule. */
  deliver_at: string;
  is_active: boolean;
  payment_method: string;
  delivery_note: string;
  items: SubscriptionItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Mirrors `ApproveProcurementOrderRequest`'s own restriction: 'card'/'upi' are valid
 * server-side but have no real payment gateway wired up yet, so only 'credit' (billed to
 * the property) is offered here — see the matching note in ProcurementScreen.tsx.
 */
export type SubscriptionPaymentMethod = "credit";

export interface CreateSubscriptionParams {
  pg_id: string;
  deliver_at: string;
  payment_method: SubscriptionPaymentMethod;
  delivery_note?: string;
  items: Array<{ item_id: string; quantity: number }>;
}

export function listSubscriptions(pgId: string): Promise<Subscription[]> {
  return apiFetch<Subscription[]>(`${API.SUPPLY_SUBSCRIPTIONS}?pg_id=${pgId}`);
}

export function createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
  return apiFetch<Subscription>(API.SUPPLY_SUBSCRIPTIONS, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function pauseSubscription(id: string): Promise<Subscription> {
  return apiFetch<Subscription>(API.SUPPLY_SUBSCRIPTION_PAUSE(id), { method: "POST" });
}

export function resumeSubscription(id: string): Promise<Subscription> {
  return apiFetch<Subscription>(API.SUPPLY_SUBSCRIPTION_RESUME(id), { method: "POST" });
}

export function useSubscriptionsQuery(pgId?: string) {
  return useQuery<Subscription[]>({
    queryKey: qk.subscriptions.list(pgId ?? ""),
    queryFn: () => listSubscriptions(pgId!),
    enabled: !!pgId,
  });
}

export function useCreateSubscriptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: qk.subscriptions.list(sub.pg_id) });
    },
  });
}

export function useSetSubscriptionActiveMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? resumeSubscription(id) : pauseSubscription(id),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.subscriptions.list(pgId) });
    },
  });
}
