/**
 * The signed-in resident's own KYC state.
 *
 * Read from `/v1/me`'s `gate`, because that is the ONLY thing a resident can read about their
 * own KYC — verified against production: `GET /v1/kyc/pending` and `GET /v1/guests/{id}` both
 * answer 403 "Only the owner or a manager may do this." The gate is not a consolation prize
 * though: `guest_access_state` (pg-backend `deps/gates.py`) returns the three KYC states
 * strictly BEFORE it will ever return RENT_UNPAID, so a gate of RENT_UNPAID — or null —
 * proves KYC is verified. It is the same fact, one layer up.
 *
 * Why this is a hook and not `guest?.kycStatus ?? 'NOT_SUBMITTED'` at each call site, which is
 * what the two guest screens did:
 *
 *   1. That default is the most alarming possible answer, and it was shown during loading. A
 *      verified resident opening their profile before `refreshAll()` had populated
 *      `loggedInGuest` was told they had not submitted anything — and handed an upload button
 *      that would create a SECOND pending submission on an already-verified account.
 *   2. `loggedInGuest` is store state that depends on a fetch having finished in the right
 *      order. `user.gate` is set the moment `/v1/me` resolves, which is before any screen can
 *      render. Fewer moving parts, no ordering to get wrong.
 *
 * 'UNKNOWN' is a real state and callers must render it as "checking", never as a prompt to
 * act. Silence beats a wrong instruction about someone's identity documents.
 */
import { useAuthStore } from "@/store/authStore";

export type ResidentKycStatus = "UNKNOWN" | "NOT_SUBMITTED" | "PENDING" | "REJECTED" | "VERIFIED";

const FROM_GATE: Record<string, ResidentKycStatus> = {
  KYC_REQUIRED: "NOT_SUBMITTED",
  KYC_PENDING: "PENDING",
  KYC_REJECTED: "REJECTED",
};

export function useKycStatus(): ResidentKycStatus {
  const user = useAuthStore((s) => s.user);
  if (!user) return "UNKNOWN";
  if (!user.gate) return "VERIFIED";
  return FROM_GATE[user.gate] ?? "VERIFIED";
}

/** True only when we positively know there is something for the resident to do. */
export function canSubmitKyc(status: ResidentKycStatus): boolean {
  return status === "NOT_SUBMITTED" || status === "REJECTED";
}
