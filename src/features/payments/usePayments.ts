import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import { hapticCaution, hapticSuccess } from "../../utils/haptics";
import type { PaymentEntity } from "../../types";
// Re-exported: this module stays the public entry point for payments, while the pure
// URI builder lives somewhere a plain `node` check can import it.
import { buildUpiUri, type LaunchUpiParams } from "./upiUri";

export { buildUpiUri };
export type { LaunchUpiParams };

export interface PaymentRecord {
  id: string;
  pg_id: string;
  membership_id: string;
  guest_name?: string | null;
  room_no?: string | null;
  period: string; // "YYYY-MM-01"
  purpose: "rent" | "food" | "service";
  amount: string | number;
  status: "pending" | "verified" | "rejected";
  method: "upi_intent" | "upi_manual" | "cash";
  upi_ref?: string | null;
  rejection_reason?: string | null;
  verified_at?: string | null;
  verified_by_name?: string | null;
  created_at: string;
}

/** Mirrors the backend's `PaymentStatusFilter`; the API 422s on anything else. */
export type PaymentStatus = PaymentRecord["status"];

export interface RentDueInfo {
  pg_id: string;
  pg_name: string;
  owner_upi_vpa?: string | null;
  rent_amount: string | number;
  current_period: string;
  is_paid: boolean;
  pending_payment?: PaymentRecord | null;
}

export interface SubmitPaymentParams {
  pg_id: string;
  amount: number;
  period: string;
  purpose?: "rent" | "food" | "service";
  method?: "upi_intent" | "upi_manual" | "cash";
  upi_ref?: string;
  idempotency_key?: string;
}

// GET /v1/payments/due?pg_id=
export function getRentDue(pgId: string): Promise<RentDueInfo> {
  return apiFetch<RentDueInfo>(`${API.PAYMENT_DUE}?pg_id=${pgId}`);
}

// POST /v1/payments
export function submitPayment(params: SubmitPaymentParams): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>(API.PAYMENTS, {
    method: "POST",
    body: JSON.stringify({
      purpose: "rent",
      method: "upi_intent",
      ...params,
    }),
  });
}

// GET /v1/payments?pg_id=&status=&limit=&cursor=
export function listPayments(
  pgId: string,
  opts?: {
    status?: PaymentStatus;
    /** Narrow to one kind of payment. Rent, food and service all live in this one list. */
    purpose?: "rent" | "food" | "service";
    /** One month, as any date inside it (`YYYY-MM-01`). */
    period?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<Page<PaymentRecord>> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts?.status) params.append("status", opts.status);
  if (opts?.purpose) params.append("purpose", opts.purpose);
  if (opts?.period) params.append("period", opts.period);
  if (opts?.limit) params.append("limit", opts.limit.toString());
  if (opts?.cursor) params.append("cursor", opts.cursor);
  return apiFetch<Page<PaymentRecord>>(`${API.PAYMENTS}?${params.toString()}`);
}

export interface RentReminderResult {
  pg_id: string;
  period: string;
  /** Residents sent a reminder just now. */
  reminded: number;
  /** Skipped — this cycle's rent is already verified for them. */
  already_paid: number;
  /** Skipped — reminded recently, so this run stayed quiet. */
  on_cooldown: number;
}

/**
 * Nudge the residents who have not paid this cycle, and only them.
 *
 * Addressed per resident server-side, never broadcast: the old local version fired a
 * notification on the owner's own phone, which told the one person who already knew.
 */
export function sendRentReminders(pgId: string): Promise<RentReminderResult> {
  return apiFetch<RentReminderResult>(`${API.PAYMENT_REMINDERS}?pg_id=${pgId}`, {
    method: "POST",
  });
}

// POST /v1/payments/{id}/verify
export function verifyPayment(paymentId: string): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>(API.PAYMENT_VERIFY(paymentId), { method: "POST" });
}

// POST /v1/payments/{id}/reject
export function rejectPayment(paymentId: string, reason?: string): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>(API.PAYMENT_REJECT(paymentId), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// Direct NPCI-compliant UPI Intent Launcher with Clipboard Fallback
export async function launchUpiPayment(params: LaunchUpiParams): Promise<{ success: boolean; message: string }> {
  const upiUri = buildUpiUri(params);
  if (!upiUri) {
    if (!params.upiId.trim()) {
      return { success: false, message: "Owner has not configured a UPI ID yet." };
    }
    return {
      success: false,
      message:
        "The owner's UPI ID is incomplete, so payment cannot be started safely. Ask them to re-enter it in property settings.",
    };
  }

  // Copy VPA to clipboard as 100% reliable fallback
  try {
    await Clipboard.setStringAsync(params.upiId.trim().toLowerCase());
  } catch {
    // ignore clipboard error
  }

  try {
    const canOpen = await Linking.canOpenURL(upiUri);
    if (canOpen) {
      await Linking.openURL(upiUri);
      return {
        success: true,
        message: "UPI app opened. VPA copied to clipboard as fallback.",
      };
    } else {
      return {
        success: false,
        message: "No supported UPI app found. VPA copied to clipboard!",
      };
    }
  } catch {
    return {
      success: false,
      message: "Could not open UPI app. VPA copied to clipboard!",
    };
  }
}

export function usePaymentsQuery(pgId?: string, status?: PaymentStatus) {
  return useQuery<PaymentEntity[]>({
    queryKey: status ? [...qk.payments.list(pgId ?? ""), status] : qk.payments.list(pgId ?? ""),
    queryFn: async () => {
      if (!pgId) return [];
      const res = await listPayments(pgId, { status, limit: 100 });
      return res.items.map(map.toPayment);
    },
    enabled: !!pgId,
  });
}

/**
 * Every matching payment, not just the newest 100 — for screens that sum or bucket the
 * whole set (P&L category breakdown, period-over-period comparison, the owner's Balance
 * Sheet). Those computations silently undercounted for any property with more than 100
 * payments, with no indication to the owner that the numbers were partial.
 */
export function useAllPaymentsQuery(pgId?: string, status?: PaymentStatus) {
  return useQuery<PaymentEntity[]>({
    queryKey: [...(status ? [...qk.payments.list(pgId ?? ""), status] : qk.payments.list(pgId ?? "")), "all-pages"],
    queryFn: async () => {
      if (!pgId) return [];
      const items: PaymentEntity[] = [];
      let cursor: string | undefined;
      do {
        // 100, not 200: `/v1/payments` is the one list route capped at `le=100` (every other
        // list allows 200) — sending 200 422s every call, silently breaking this hook entirely.
        const res = await listPayments(pgId, { status, limit: 100, cursor });
        items.push(...res.items.map(map.toPayment));
        cursor = res.next_cursor ?? undefined;
      } while (cursor);
      return items;
    },
    enabled: !!pgId,
  });
}

export function useRentDueQuery(pgId?: string) {
  return useQuery<RentDueInfo>({
    queryKey: qk.payments.due(pgId ?? ""),
    queryFn: () => getRentDue(pgId!),
    enabled: !!pgId,
  });
}

export function useSubmitPaymentMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitPayment,
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.payments.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.payments.due(pgId) });
        qc.invalidateQueries({ queryKey: qk.payments.all(pgId) });
      }
    },
    onError: () => {},
  });
}

export function useVerifyPaymentMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => verifyPayment(paymentId),
    onSuccess: (updatedPayment) => {
      hapticSuccess();
      // Fall back to the API response's pg_id when pgId was not available at
      // mutation construction time (e.g. activePgId was still null on mount).
      // Without this, the cache is never invalidated and the payment stays
      // PENDING in the UI even though the backend already verified it.
      const effectivePgId = pgId ?? updatedPayment.pg_id;
      if (effectivePgId) {
        qc.invalidateQueries({ queryKey: qk.payments.list(effectivePgId) });
        qc.invalidateQueries({ queryKey: qk.payments.all(effectivePgId) });
        qc.invalidateQueries({ queryKey: qk.guests.list(effectivePgId) });
        qc.invalidateQueries({ queryKey: qk.expenses.all(effectivePgId) });
      }
    },
    onError: () => {
      // Handled by the caller via mutateAsync catch block
    },
  });
}

export function useRejectPaymentMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      rejectPayment(paymentId, reason),
    onSuccess: (updatedPayment) => {
      hapticCaution();
      // Same fallback as verify: use the response's pg_id if the hook was
      // constructed before activePgId was available.
      const effectivePgId = pgId ?? updatedPayment.pg_id;
      if (effectivePgId) {
        qc.invalidateQueries({ queryKey: qk.payments.list(effectivePgId) });
        qc.invalidateQueries({ queryKey: qk.payments.all(effectivePgId) });
      }
    },
    onError: () => {},
  });
}

export function useSendRentRemindersMutation(pgId?: string) {
  return useMutation({
    mutationFn: () => sendRentReminders(pgId!),
  });
}

export function usePayments() {
  return {
    getRentDue,
    submitPayment,
    listPayments,
    sendRentReminders,
    verifyPayment,
    rejectPayment,
    launchUpiPayment,
  };
}
