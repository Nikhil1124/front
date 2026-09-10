/**
 * Guest/Resident tabs shell — the shared chrome is just the transition wrapper around the
 * active tab and the pill dock at the bottom. Each screen (home.tsx, etc.) now renders its
 * own header, notification bell and inbox sheet — see that comment trail in git history.
 *
 * This file used to also own a header (avatar, greeting, notification bell) and a profile
 * photo dialog. Both were dead: the header was removed in a redesign pass and nothing in
 * this file ever set `showNotif`/`showProfilePhotoDialog` to true, so the notification sheet
 * and photo dialog could never actually open. The photo dialog was doubly broken underneath
 * — its "Take Photo" / "Choose from Gallery" / preset-avatar buttons wrote a literal
 * `sample:selfie_preset_N` string as the photo URI instead of opening a real picker, which
 * `uploadToPresignedUrl` (kyc/useKyc.ts) explicitly rejects. So even with a working trigger,
 * every tap would have failed. There is currently no reachable way to change a resident's
 * profile photo anywhere in the app — see KycUploadDialog.tsx for the real
 * expo-image-picker pattern to build that against when a real entry point is added.
 */
import { View, StyleSheet } from 'react-native';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Dock, DockAlert, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { centreOut, NAV_PROFILES } from '@/data/navTabs';
import { Colors } from '@/theme';

/**
 * The bar no longer lists home first — the frequency ranking puts the least-used destination
 * in the leftmost slot — and without this the navigator would take its initial route from
 * whichever trigger happens to come first, landing every session on Support instead of
 * home. `anchor` pins it, and also sorts home to the head of the navigator's own screen
 * list. Do not delete this when reordering the bar; that is exactly when it matters.
 */
export const unstable_settings = { anchor: 'home' };

export default function GuestTabsLayout() {
  const { dockStyle, contentPaddingBottom, counts, alert } = useDock('resident');

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        {/* ── Active tab content ─────────────────────────────────────────── */}
        {/* Tab-switch motion removed. Two reasons, and the second is the bigger one:
            the fade/rise read as lag on a tab tap (the new screen's first frame was
            deliberately withheld for 200ms), and `key={pathname}` forced React to unmount
            and rebuild the ENTIRE tab content tree on every switch just to retrigger the
            animation — throwing away each screen's mounted state and re-running its whole
            first render. Without the key, `TabSlot` swaps content without a remount. */}
        <View style={{ flex: 1 }}>
          <TabSlot />
        </View>
      </View>

      {/* Context strip — a sibling of Dock, never a child: TabList is a row and its children
          are walked for triggers. */}
      <DockAlert alert={alert} />

      {/* Sticky bottom dock. Slot order is computed from the frequency ranking in navTabs.ts,
          not written out here — `.map` is fine inside TabList because `Children.forEach`
          flattens arrays, which is what Tabs walks to find the triggers.
          `support` used to be a hidden trigger with no way to reach it from the bar; it is a
          real destination now, which is what fills the fifth slot. */}
      <Dock style={dockStyle}>
        {centreOut(NAV_PROFILES.resident).map((d) => (
          <TabTrigger key={d.name} name={d.name} href={d.href} asChild>
            <HeadlessDockTabButton
              icon={d.icon}
              label={d.label}
              pending={d.signal ? counts[d.signal] : undefined}
              activeTint={Colors.primary}
            />
          </TabTrigger>
        ))}
      </Dock>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas } });
