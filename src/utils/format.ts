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
  try {
    const parts = time.split(':');
    if (parts.length === 2) {
      return { hour: parseInt(parts[0], 10) || 13, minute: parseInt(parts[1], 10) || 30 };
    }
  } catch (e) { /* noop */ }
  return { hour: 13, minute: 30 };
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

export function toast(msg: string): void {
  // Simple console-based fallback for non-toast environment.
  // Real toast rendering is handled by the AlertOverlay component listening to activeAlert.
  // Components can also call console.warn for diagnostic.
  // eslint-disable-next-line no-console
  console.log('[Toast]', msg);
}

/** Toast callback type expected by ViewModel-style actions. */
export type ToastFn = (msg: string) => void;
