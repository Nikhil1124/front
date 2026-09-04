import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import type { GuestEntity } from "../../types";
import { listPayments } from "../payments/usePayments";
import { useTokenLanding } from "../auth/useAuth";

export interface GuestMember {
  membership_id: string;
  user_id: string;
  pg_id: string;
  name: string;
  phone: string;
  email: string | null;
  room_no: string;
  // Decimal comes back as a JSON string ("8500.00"), never a number.
  // Nullable: the server reads the open rent_history row, and a resident whose rent period
  // has been closed has none.
  rent_amount: string | null;
  started_at: string;
  ended_at: string | null;
  // KYC fields from GuestResponse
  kyc_status?: string | null;
  kyc_reject_reason?: string | null;
  kyc_submitted_at?: string | null;
  kyc_decided_at?: string | null;
  kyc_front_url?: string | null;
  kyc_selfie_url?: string | null;
}

/** Money for display. One place, so the null case can't be handled in one screen and
 *  forgotten in the other — parseFloat(null) is NaN, which renders as "₹NaN". */
export const formatRent = (amount: string | null): string =>
  amount === null ? "—" : `₹${parseFloat(amount).toLocaleString("en-IN")}`;

export interface UpdateGuestPayload {
  name?: string;
  email?: string;
  room_no?: string;
  rent_amount?: number;
}

// ponytail: returns one page. Pass `cursor` from the previous page's next_cursor to add
// infinite scroll — a property here can hold ~1,000 residents.
export function listGuests(
  pgId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<Page<GuestMember>> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  return apiFetch<Page<GuestMember>>(`${API.GUESTS}?${q}`);
}

export function getGuest(membershipId: string): Promise<GuestMember> {
  return apiFetch<GuestMember>(API.GUEST(membershipId));
}

export function addGuest(
  pgId: string,
  params: {
    name: string;
    phone: string;
    password: string;
    room_no: string;
    rent_amount: number;
    email?: string;
  }
): Promise<GuestMember> {
  return apiFetch<GuestMember>(`${API.GUESTS}?pg_id=${pgId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateGuest(
  membershipId: string,
  params: UpdateGuestPayload
): Promise<GuestMember> {
  return apiFetch<GuestMember>(API.GUEST(membershipId), {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export function removeGuest(membershipId: string): Promise<GuestMember> {
  return apiFetch<GuestMember>(API.GUEST(membershipId), { method: "DELETE" });
}

export interface JoinPgParams {
  join_code: string;
  name: string;
  phone: string;
  password: string;
  room_no: string;
  email?: string;
}

export interface JoinPgResult {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
}

/**
 * Self-signup with the code from the lobby poster. The one guest call made without a token.
 *
 * Conspicuously absent: `rent_amount`. It is the owner's number, taken from the property's
 * `default_rent_amount`, and a property without one refuses the join rather than letting a
 * new resident name their own rent. The membership created here is still subject to the KYC
 * gate, so joining buys a waiting room, not access.
 */
export function joinPg(params: JoinPgParams): Promise<JoinPgResult> {
  return apiFetch<JoinPgResult>(API.GUESTS_JOIN, {
    method: "POST",
    body: JSON.stringify(params),
    // There is no session to recover — a failure here is this form's to show.
    unauthorized: "throw",
  });
}

/** POST /v1/guests/join — self-signup with the lobby code. No pgId to invalidate by: the
 *  caller has no session (and no active property) until this resolves. */
export function useJoinPgMutation() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: joinPg,
    onSuccess: land,
  });
}

export function useGuestsQuery(pgId?: string) {
  return useQuery<GuestEntity[]>({
    queryKey: qk.guests.list(pgId ?? ""),
    queryFn: async () => {
      if (!pgId) return [];
      // `map.toGuest(g, {})` used to be the whole of this, and `isBillPaid` defaults to false
      // when the caller supplies nothing — so EVERY resident on the roster read as "Rent
      // pending for this cycle" no matter what they had paid, and the owner's overdue count
      // and overdue total were simply the headcount and the rent roll.
      //
      // The guest record cannot carry it: whether this cycle is settled is a fact about the
      // payments table, and this is the one query that can afford to join them (the roster is
      // one page, not one request per resident).
      const period = map.currentPeriod();
      const [res, payments] = await Promise.all([
        listGuests(pgId, { limit: 200 }),
        // 100, not 200 — `/v1/payments` is the one list route capped at `le=100`. At 200
        // this 422'd on every call and `.catch(() => null)` swallowed it, so `settled` was
        // always empty and every resident on the roster read "Rent pending for this cycle",
        // which is the exact bug the comment below was written to prevent.
        // ponytail: one page, no period filter server-side — page on `next_cursor` if a
        // property ever exceeds 100 verified payments.
        listPayments(pgId, { status: "verified", limit: 100 }).catch(() => null),
      ]);
      const settled = new Set(
        (payments?.items ?? [])
          .filter((p) => p.purpose === "rent" && p.period === period)
          .map((p) => p.membership_id)
      );
      return res.items.map((g) =>
        map.toGuest(g, { isBillPaid: settled.has(g.membership_id) })
      );
    },
    enabled: !!pgId,
  });
}

export function useAddGuestMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof addGuest>[1]) => addGuest(pgId!, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.guests.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.guests.all(pgId) });
      }
    },
  });
}

export function useUpdateGuestMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, params }: { membershipId: string; params: UpdateGuestPayload }) =>
      updateGuest(membershipId, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.guests.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.guests.all(pgId) });
      }
    },
  });
}

export function useRemoveGuestMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => removeGuest(membershipId),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.guests.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.guests.all(pgId) });
      }
    },
  });
}

export function useGuests() {
  return { listGuests, getGuest, addGuest, updateGuest, removeGuest, joinPg };
}
