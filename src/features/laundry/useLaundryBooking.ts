/**
 * Turning a laundry cart into a real ticket.
 *
 * Laundry is `kind: "laundry"` on the shared `requests` table — the same table complaints,
 * feedback, grocery and repair use. Everything specific to a laundry booking (the lines, the
 * slot, the pay mode) rides in `details`, which is what that JSONB column exists for.
 *
 * The lines carry their own `price`: an order must be billed at the rate it was quoted at, so
 * editing `LAUNDRY_SERVICES` later cannot silently reprice an order somebody already placed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/data/queryKeys';
import * as map from '@/data/mappers';
import { laundryListKey, submitComplaint, useLaundryRequestsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import type { GuestLaundryRequest, LaundryOrderLine } from '@/types';

import { LAUNDRY_SERVICES } from './store/useLaundryStore';

export interface LaundryBookingInput {
  pgId: string;
  cart: Record<string, number>;
  pickupDate: string;
  pickupTime: string;
  instructions: string;
  payMode: string;
}

/** Cart ids → the lines stored on the request. Unknown ids are dropped, not priced at zero. */
export function laundryCartLines(cart: Record<string, number>): LaundryOrderLine[] {
  return Object.entries(cart).flatMap(([id, qty]) => {
    const item = LAUNDRY_SERVICES.find((s) => s.id === id);
    if (!item || qty <= 0) return [];
    return [{ name: item.name, qty, price: item.price, unit: item.unit }];
  });
}

/**
 * A one-line summary for the ticket title, because every list in the owner and staff apps
 * shows `title` and nothing else: "Wash & Iron +2 more — 7 items".
 */
function laundryTitle(lines: LaundryOrderLine[]): string {
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const [first, ...rest] = lines;
  const head = rest.length > 0 ? `${first.name} +${rest.length} more` : first.name;
  return `${head} — ${totalQty} item${totalQty === 1 ? '' : 's'}`;
}

export function useSubmitLaundryBooking(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LaundryBookingInput) => {
      const lines = laundryCartLines(input.cart);
      if (lines.length === 0) throw new Error('Add at least one item before booking a pickup.');

      return submitComplaint({
        pg_id: input.pgId,
        kind: 'laundry',
        title: laundryTitle(lines),
        description: input.instructions.trim() || 'No special instructions.',
        // Summed from the lines, not recomputed from the rate card, so the amount charged
        // and the lines stored on the ticket can never disagree.
        amount: lines.reduce((sum, l) => sum + l.qty * l.price, 0),
        details: {
          // `service_type` / `weight_or_count` are what the existing mapper and the owner's
          // laundry list already read, so a booking from here looks identical to one made
          // from the hub sheet rather than being a second shape nothing else understands.
          service_type: lines.length === 1 ? lines[0].name : 'Mixed laundry',
          weight_or_count: `${lines.reduce((n, l) => n + l.qty, 0)} items`,
          pickup_preference: 'Room Doorstep Pickup',
          preferred_slot: input.pickupTime,
          pickup_date: input.pickupDate,
          payment_status: input.payMode,
          items: lines,
        },
      });
    },
    onSuccess: (created) => {
      if (!pgId) return;
      // The booking goes into the cached list before the refetch lands. Without this, the
      // confirmation screen — which looks the new order up by id in exactly this list —
      // renders "booking not found" for the fraction of a second between the redirect and
      // the refetch, on the one screen whose whole job is to say the booking worked.
      qc.setQueryData<GuestLaundryRequest[]>(laundryListKey(pgId), (prev) => [
        map.toLaundryRequest(created),
        ...(prev ?? []),
      ]);
      // Prefix key: covers the list, the detail and every kind-suffixed list under it.
      qc.invalidateQueries({ queryKey: qk.requests.all(pgId) });
    },
  });
}

/**
 * One booking, by id, out of the same cached list the Hub Services tab already renders.
 *
 * ponytail: no per-id endpoint call. `GET /v1/requests?kind=laundry` is already fetched and
 * cached for this PG, so the confirmation, tracking and details screens select out of it
 * rather than each opening their own request. `isLoading` is the list's, so a cold deep-link
 * into any of them still shows a spinner instead of "not found".
 */
export function useLaundryOrder(id?: string) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const query = useLaundryRequestsQuery(activePgId ?? undefined);
  return {
    ...query,
    order: id ? (query.data ?? []).find((r) => r.id === id) : undefined,
  };
}

/** This resident's laundry, newest first — the server returns every resident's for the PG. */
export function useMyLaundryOrders() {
  const activePgId = useAuthStore((s) => s.activePgId);
  // `raised_by` is a MEMBERSHIP id, not a user id — a person holding memberships in two
  // properties is two different raisers — so the comparison has to be against the membership
  // held in the active PG.
  const myMembershipId = useAuthStore(
    (s) => s.user?.memberships.find((m) => m.pg_id === s.activePgId)?.membership_id ?? null
  );
  const query = useLaundryRequestsQuery(activePgId ?? undefined);
  const mine = (query.data ?? [])
    .filter((r) => r.guestId === myMembershipId)
    .sort((a, b) => b.timestamp - a.timestamp);
  return {
    ...query,
    // "Delivered" and "Cancelled" are terminal; everything else is still being worked on.
    active: mine.filter((r) => r.status !== 'Delivered' && r.status !== 'Cancelled'),
    completed: mine.filter((r) => r.status === 'Delivered' || r.status === 'Cancelled'),
  };
}
