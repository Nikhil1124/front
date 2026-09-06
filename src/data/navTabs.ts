/**
 * What goes in the bottom bar, per profile, and in what order.
 *
 * ── Why the order is computed, not typed out ────────────────────────────────────────────────
 * A bottom bar is held one-handed. The centre of the bar is the easiest place for either
 * thumb to reach; the two outer slots are the hardest (a right thumb has to stretch across the
 * whole phone for slot 1, a left thumb for slot 5). So the destinations are listed here in
 * FREQUENCY order — most-visited first — and `centreOut` maps that ranking onto the physical
 * slots: rank 1 lands in the middle, ranks 2 and 3 flank it, ranks 4 and 5 take the ends.
 *
 * Listing them by rank rather than by position is the point. If a destination gets busier,
 * you move it up this array and the layout follows; nobody has to work out which index the
 * middle is.
 *
 * ── Why five, and not more ──────────────────────────────────────────────────────────────────
 * Both Material 3 and Apple's HIG cap a bottom bar at five, for the same reason: past five the
 * targets fall below the 48dp minimum on a 360dp phone and the labels start truncating. Every
 * profile below is at or under that cap using routes that already exist — nothing here invents
 * a screen. Owner has seven routes; `reviews` and `notices` are the two that lose, and they
 * stay reachable (notices from the header bell, reviews from Overview).
 *
 * ── The rankings ────────────────────────────────────────────────────────────────────────────
 * Derived from what each role actually opens the app to do, not from what looks tidy:
 *
 *   owner     Overview is the landing screen and the thing they check between other jobs.
 *             Payments is the business — rent chasing and verification is a daily loop that
 *             spikes at month start. Residents is next: check-ins, KYC decisions, bed moves.
 *             Complaints is a daily triage but a smaller queue. Staff is edited weekly at most.
 *   resident  Home is the landing. Meals is opened several times a DAY (today's menu, RSVP) —
 *             it beats Payments, which is a once-a-month errand plus reminders. Support is why
 *             a resident opens the app when something is wrong. Profile is a one-time KYC
 *             upload and then almost never again, so it takes an end slot.
 *   chef      Menu is the job: the app fires three alarms a day telling the chef to post a
 *             meal and chase RSVPs (see broadcast.tsx's CHEF_ALARM_ROWS). Eaters is the
 *             headcount check before each service. Kitchen is prep state and groceries.
 *   delivery  Route is the shift. History is the record of it. Profile is rarely touched.
 *
 * This module stays free of runtime imports so `logic.check.ts` can reach it under plain node.
 */
import type { Ionicons } from '@expo/vector-icons';

export type NavProfile = 'owner' | 'resident' | 'chef' | 'delivery';

/**
 * A work queue a destination owns. The bar tints a tab by the state of its queue — see
 * `HeadlessDockTabButton` — so a signal only exists where the app can actually count
 * something real. `chef` and `delivery` have none: nothing in the staff data model is a
 * countable "waiting for you" pile today, and a tinted tab that means nothing is worse than
 * an untinted one.
 */
export type SignalKey = 'paymentsPending' | 'kycPending' | 'complaintsOpen' | 'rentDue';

export interface NavDest {
  /** TabTrigger `name`. Must match the route file inside the `(tabs)` group. */
  name: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Kept to one short word: five labels share a 360dp screen, so ~11 characters is the
   *  budget before the middle tab starts truncating. */
  label: string;
  signal?: SignalKey;
}

/** Ranked most-frequent FIRST. Physical order comes from `centreOut`, never from this array. */
export const NAV_PROFILES: Record<NavProfile, readonly NavDest[]> = {
  owner: [
    { name: 'overview', href: '/overview', icon: 'grid-outline', label: 'Overview' },
    { name: 'payments', href: '/payments', icon: 'card-outline', label: 'Payments', signal: 'paymentsPending' },
    { name: 'guests', href: '/guests', icon: 'people-outline', label: 'Residents', signal: 'kycPending' },
    { name: 'complaints', href: '/complaints', icon: 'alert-circle-outline', label: 'Requests', signal: 'complaintsOpen' },
    { name: 'staff', href: '/staff', icon: 'briefcase-outline', label: 'Staff' },
  ],
  resident: [
    { name: 'home', href: '/home', icon: 'home-outline', label: 'Home' },
    { name: 'meals', href: '/meals', icon: 'restaurant-outline', label: 'Meals' },
    { name: 'guest-payments', href: '/guest-payments', icon: 'card-outline', label: 'Payments', signal: 'rentDue' },
    { name: 'support', href: '/support', icon: 'help-buoy-outline', label: 'Support' },
    { name: 'profile', href: '/profile', icon: 'person-outline', label: 'Profile' },
  ],
  // Chef and delivery agent share the same three route files with different jobs behind them,
  // which is why they are two profiles and not one: the ranking genuinely differs.
  chef: [
    { name: 'broadcast', href: '/broadcast', icon: 'megaphone-outline', label: 'Menu' },
    { name: 'eaters', href: '/eaters', icon: 'people-outline', label: 'Eaters' },
    { name: 'kitchen', href: '/kitchen', icon: 'restaurant-outline', label: 'Kitchen' },
  ],
  delivery: [
    { name: 'eaters', href: '/eaters', icon: 'map-outline', label: 'Route' },
    { name: 'broadcast', href: '/broadcast', icon: 'time-outline', label: 'History' },
    { name: 'kitchen', href: '/kitchen', icon: 'person-outline', label: 'Profile' },
  ],
};

/**
 * Frequency ranking → physical slots. Rank 1 takes the centre, then each next rank alternates
 * outward (left, right, left, right), so the hardest-to-reach ends get the least-used tabs.
 *
 *     [1, 2, 3, 4, 5]  ->  [4, 2, 1, 3, 5]
 *
 * Left before right on each pair, so the bar still reads in the order a left-to-right reader
 * expects when scanned rather than reached for. Even-length lists have no true centre; rank 1
 * lands just right of the middle, which is the better of the two for a right thumb.
 */
export function centreOut<T>(ranked: readonly T[]): T[] {
  const slots: T[] = [];
  ranked.forEach((item, rank) => {
    if (rank === 0) slots.push(item);
    else if (rank % 2 === 1) slots.unshift(item);
    else slots.push(item);
  });
  return slots;
}

/**
 * Which signal the context strip above the bar speaks for, when several are non-zero.
 *
 * Ordered by what it COSTS to leave the queue sitting, which is not the same as how big the
 * queue is: unverified money is a resident who has paid and is being treated as if they have
 * not, and that outranks any number of open complaints.
 */
export const ALERT_ORDER: Record<NavProfile, readonly SignalKey[]> = {
  owner: ['paymentsPending', 'kycPending', 'complaintsOpen'],
  resident: ['rentDue'],
  chef: [],
  delivery: [],
};

export function alertText(key: SignalKey, n: number): string {
  const s = n === 1 ? '' : 's';
  switch (key) {
    case 'paymentsPending': return `${n} payment${s} waiting to be verified`;
    case 'kycPending': return `${n} ID${s} waiting for your approval`;
    case 'complaintsOpen': return `${n} request${s} still open`;
    // Not a count — the resident has one rent cycle, not a queue of them.
    case 'rentDue': return 'Rent for this month is unpaid';
  }
}

/** The one thing the strip says, or null when nothing is waiting. */
export function pickAlert(
  profile: NavProfile,
  counts: Partial<Record<SignalKey, number>>,
): { key: SignalKey; count: number; text: string } | null {
  for (const key of ALERT_ORDER[profile]) {
    const count = counts[key] ?? 0;
    if (count > 0) return { key, count, text: alertText(key, count) };
  }
  return null;
}
