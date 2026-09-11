/**
 * Opening a place in the device's maps app.
 *
 * A universal Google Maps search URL rather than a `geo:` intent or an app-specific scheme:
 * it resolves in whatever the user actually has — the Maps app when installed, the browser
 * otherwise — and needs no per-platform branching or extra permission.
 *
 * Lived inside `(staff)/(tabs)/eaters.tsx` as a local function while the delivery agent was
 * its only caller. A laundry provider needs exactly the same thing for exactly the same
 * reason — they are handed an address and have to get there — so it moved here rather than
 * being typed a second time.
 */
import { Linking } from 'react-native';

import { toastNow } from '@/hooks/useToast';

export function openInMaps(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) {
    toastNow('warning', 'No address on this job', 'Nothing to navigate to yet.');
    return;
  }
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
  Linking.openURL(url).catch(() => {
    toastNow('error', 'Could not open Maps', 'No maps app is available on this device.');
  });
}
