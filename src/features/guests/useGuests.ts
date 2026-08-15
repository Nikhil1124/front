import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

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

export function useGuests() {
  return { listGuests, getGuest, addGuest, updateGuest, removeGuest, joinPg };
}
