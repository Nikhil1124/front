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
  /** Which day this line runs on, or null for every day. 0=Monday..6=Sunday, matching
   *  Python's `date.weekday()` — the materialiser compares against it directly. */
  weekday: number | null;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** The one place the app's day names meet the server's numbers. Monday leads because
 *  `date.weekday()` does, and the materialiser's filter is a direct comparison against it. */
export const WEEKDAY_INDEX: Record<DayOfWeek, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

export const WEEKDAY_NAME: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export interface Subscription {
  id: string;
  pg_id: string;
  placed_by: string;
  /** "HH:MM:SS" — informational only; the materialiser runs on cron's own schedule. */
  deliver_at: string;
  is_active: boolean;
  payment_method: string;
  delivery_note: string;
  /** Every line, day-tagged. A plan is read by grouping on `weekday`; a line with null runs
   *  daily. There is no separate `schedule` object — the server has one list, not two. */
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
  /** One entry per item per day. Omit `weekday` for a line that runs every day. */
  items: Array<{ item_id: string; quantity: number; weekday?: number }>;
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
