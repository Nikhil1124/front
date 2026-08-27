/**
 * Time & formatting helpers ported from Kotlin MainActivity.kt helpers.
 */

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

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

export function formatLongDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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

/** Format hour+minute to "HH:mm" 24h. */
export function formatTime24h(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/** Convert 24h hour to 12h display hour. */
export function to12h(hour: number): number {
  if (hour === 0) return 12;
  if (hour > 12) return hour - 12;
  return hour;
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Toast callback type expected by ViewModel-style actions. */
export type ToastFn = (msg: string) => void;
