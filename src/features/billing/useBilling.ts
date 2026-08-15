/**
 * PGow's own billing: what the owner pays PGow, as opposed to what residents pay the owner.
 *
 * React Query rather than the Zustand store, unlike most of this app. The subscription screen
 * asks a question that changes as the user taps — "what would THIS plan cost me?" — and a
 * query keyed on the selected plan answers that natively, where a store action would need its
 * own loading flag, its own cache and its own invalidation.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";

/** `one_time` and `usage` price by the unit; the other two are a flat charge per cycle. */
export type BillingPeriod = "monthly" | "yearly" | "one_time" | "usage";

export interface Plan {
  id: string;
  code: string;
  name: string;
  /** Zero on the per-unit plans, where `unit_price` is the real figure. */
  price: string;
  billing_period: BillingPeriod;
  bed_limit: number | null;
  /** A bed on `one_time` (₹50), a resident on `usage` (₹75). */
  unit_price: string | null;
  /** Free units before anything is charged — the five seats on pay-per-user. */
  included_units: number;
}

export interface SubscriptionQuote {
  plan_code: string;
  /** What activating costs today. Zero for pay-per-user, which bills as residents arrive. */
  amount_due_now: string;
  explanation: string;
}

export interface Subscription {
  id: string;
  pg_id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  price: string;
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
}

export interface Invoice {
  id: string;
  pg_id: string;
  subscription_id: string;
  period: string;
  amount: string;
  status: "issued" | "paid" | "void";
  method: "upi_intent" | "upi_manual" | "bank_transfer" | null;
  upi_ref: string | null;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
}

// ─── Plain functions ─────────────────────────────────────────────────────────

export function listPlans(): Promise<Plan[]> {
  return apiFetch<Plan[]>(API.BILLING_PLANS);
}

export function getQuote(pgId: string, planCode: string): Promise<SubscriptionQuote> {
  return apiFetch<SubscriptionQuote>(
    `${API.BILLING_QUOTE}?pg_id=${pgId}&plan_code=${encodeURIComponent(planCode)}`
  );
}

export function getSubscription(pgId: string): Promise<Subscription | null> {
  return apiFetch<Subscription | null>(`${API.BILLING_SUBSCRIPTION}?pg_id=${pgId}`);
}

export function subscribe(pgId: string, planCode: string): Promise<Subscription> {
  return apiFetch<Subscription>(API.BILLING_SUBSCRIBE, {
    method: "POST",
    body: JSON.stringify({ pg_id: pgId, plan_code: planCode }),
  });
}

export function listInvoices(pgId: string): Promise<Page<Invoice>> {
  return apiFetch<Page<Invoice>>(`${API.BILLING_INVOICES}?pg_id=${pgId}`);
}

/**
 * Tell PGow how the bill was paid. This does NOT settle it — PGow confirms the money landed,
 * for the same reason a resident cannot verify their own rent.
 */
export function reportInvoicePayment(
  invoiceId: string,
  params: { method: "upi_intent" | "upi_manual" | "bank_transfer"; upi_ref?: string }
): Promise<Invoice> {
  return apiFetch<Invoice>(API.BILLING_INVOICE_PAY(invoiceId), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── React bindings ──────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: qk.billing.plans(),
    queryFn: listPlans,
    // A price list changes rarely; refetching it per screen open is wasted data on a phone.
    staleTime: 10 * 60_000,
  });
}

export function useQuote(pgId: string | null, planCode: string | null) {
  return useQuery({
    queryKey: qk.billing.quote(pgId ?? "", planCode ?? ""),
    queryFn: () => getQuote(pgId!, planCode!),
    enabled: !!pgId && !!planCode,
  });
}

export function useSubscription(pgId: string | null) {
  return useQuery({
    queryKey: qk.billing.subscription(pgId ?? ""),
    queryFn: () => getSubscription(pgId!),
    enabled: !!pgId,
  });
}

export function useInvoices(pgId: string | null) {
  return useQuery({
    queryKey: qk.billing.invoices(pgId ?? ""),
    queryFn: async () => (await listInvoices(pgId!)).items,
    enabled: !!pgId,
  });
}

export function useSubscribe(pgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planCode: string) => subscribe(pgId!, planCode),
    onSuccess: () => {
      // Subscribing changes the subscription, the invoice list, and `subscription_active` on
      // the property itself — all three have to be re-read, not just the one that was posted.
      queryClient.invalidateQueries({ queryKey: qk.billing.all(pgId ?? "") });
      queryClient.invalidateQueries({ queryKey: qk.properties.all() });
    },
  });
}

export function useReportInvoicePayment(pgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      invoiceId: string;
      method: "upi_intent" | "upi_manual" | "bank_transfer";
      upi_ref?: string;
    }) => reportInvoicePayment(params.invoiceId, { method: params.method, upi_ref: params.upi_ref }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.billing.invoices(pgId ?? "") });
    },
  });
}
