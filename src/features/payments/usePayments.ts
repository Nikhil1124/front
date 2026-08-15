import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";

import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

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

export interface LaunchUpiParams {
  upiId: string;
  payeeName?: string;
  amount: number;
  note?: string;
  preferredApp?: "PHONEPE" | "PAYTM" | "GPAY" | "GENERIC";
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
  opts?: { status?: PaymentStatus; limit?: number; cursor?: string }
): Promise<Page<PaymentRecord>> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts?.status) params.append("status", opts.status);
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
export async function launchUpiPayment({
  upiId,
  payeeName = "PG Co Living",
  amount,
  note = "PG Rent Payment",
}: LaunchUpiParams): Promise<{ success: boolean; message: string }> {
  const cleanUpi = upiId.trim().toLowerCase();
  if (!cleanUpi) {
    return { success: false, message: "Owner has not configured a UPI ID yet." };
  }
  // Never complete a partial VPA. Appending a default handle here would send the
  // resident's rent to whoever happens to own `<that-handle>@ybl` — a real person, just
  // not this owner. The backend already rejects a VPA without '@', so reaching this means
  // the data is wrong and the only safe move is to stop.
  if (!cleanUpi.includes("@")) {
    return {
      success: false,
      message:
        "The owner's UPI ID is incomplete, so payment cannot be started safely. Ask them to re-enter it in property settings.",
    };
  }

  const cleanName = payeeName.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "PG Co Living";
  const cleanNote = note.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "PG Rent";
  const formattedAmount = Number(amount).toFixed(2);
  const txnRef = `PGOW${Date.now()}`;
  const txnId = `T${Date.now()}`;

  // 1. Copy VPA to clipboard as 100% reliable fallback
  try {
    await Clipboard.setStringAsync(cleanUpi);
  } catch {
    // ignore clipboard error
  }

  // 2. Build strict NPCI UPI URI
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
    cleanName
  )}&mc=0000&tr=${txnRef}&tid=${txnId}&tn=${encodeURIComponent(
    cleanNote
  )}&am=${formattedAmount}&cu=INR`;

  try {
    const canOpen = await Linking.canOpenURL(upiUri);
    if (canOpen) {
      await Linking.openURL(upiUri);
      return {
        success: true,
        message: `Launching UPI App... (Copied UPI ID: ${cleanUpi})`,
      };
    }
  } catch {
    // fall through to clipboard message
  }

  return {
    success: true,
    message: `📋 Copied UPI ID: ${cleanUpi}! Open your UPI app (PhonePe / GPay / Paytm) and pay ₹${Math.round(
      amount
    )}.`,
  };
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
