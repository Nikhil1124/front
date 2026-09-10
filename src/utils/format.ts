/**
 * Time & formatting helpers ported from Kotlin MainActivity.kt helpers.
 */

/** "Good morning/afternoon/evening" from the device clock — was hardcoded to "Good morning"
 *  on the owner, chef, and maintenance dashboards regardless of when they were opened. */
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

export function formatTime12h(timestamp: number): string {
  const d = new Date(timestamp);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

/** Parse "HH:mm" 24h into {hour, minute}. */
export function parseTime(time: string): { hour: number; minute: number } {
  const parts = time.split(':');
  if (parts.length === 2) {
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      return { hour, minute };
    }
  }
  return { hour: 13, minute: 30 };
}

/**
 * "YYYY-MM-DD" in the device's local calendar day — NOT `toISOString().slice(0, 10)`,
 * which reports the UTC day. For IST (UTC+5:30), anything before 05:30 local time would
 * silently resolve to yesterday's date with the UTC form — wrong day for "today's shift"
 * lookups, attendance windows, etc.
 */
export function todayLocalISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatINR(amount: number, decimals: 0 | 2 = 0): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Toast callback type expected by ViewModel-style actions. */
export type ToastFn = (msg: string) => void;

/**
 * The short place label for a property, out of its full postal address.
 *
 * Indian addresses run most-specific to most-general — building, door number, landmark,
 * locality, town, state, PIN, country — so the first segments are the ones a reader already
 * knows (they are looking at that property's own screen) and the useful ones are at the end.
 * The owner header used to take `split(',').slice(0, 2)`, which on a real address rendered
 * "5 PGs • SS Geosynthetic Lining Company, Do.No:15-109": a company name and a door number,
 * labelled as a location, long enough to wrap and be clipped by the header band.
 *
 * Country and a bare PIN are dropped because they identify nothing at a glance, then the last
 * two remaining segments are the town and state. Returns '' for an unusable address rather
 * than inventing a city — the caller decides what to show when there is nothing to show.
 */
export function shortLocation(address?: string | null): string {
  if (!address) return '';
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^\d[\d\s-]*$/.test(p))      // a postcode on its own
    .filter((p) => p.toLowerCase() !== 'india');
  // The town, not the state: this sits behind a "5 PGs • " prefix in a header meta line, and
  // the state adds length without telling a reader anything they do not already know.
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[parts.length - 1] ?? '');
}
