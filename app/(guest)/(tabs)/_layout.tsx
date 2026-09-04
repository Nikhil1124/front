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
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { Colors } from '@/theme';
import Animated from 'react-native-reanimated';
import { tabEntering, tabExiting } from '@/theme';

export default function GuestTabsLayout() {
  const pathname = usePathname();
  const { dockStyle, contentPaddingBottom } = useDock();

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        {/* ── Active tab content ─────────────────────────────────────────── */}
        <Animated.View
          key={pathname}
          entering={tabEntering}
          exiting={tabExiting}
          style={{ flex: 1 }}
        >
          <TabSlot />
        </Animated.View>
      </View>

      {/* Sticky bottom dock — see Dock/useDock in HeadlessDockTabButton.tsx */}
      <Dock style={dockStyle}>
        <TabTrigger name="home" href="/home" asChild>
          <HeadlessDockTabButton icon="home-outline" label="Home" activeTint={Colors.primary} activeBg={Colors.surfaceElevated} />
        </TabTrigger>
        <TabTrigger name="meals" href="/meals" asChild>
          <HeadlessDockTabButton icon="restaurant-outline" label="Meals" activeTint={Colors.primary} activeBg={Colors.surfaceElevated} />
        </TabTrigger>
        <TabTrigger name="guest-payments" href="/guest-payments" asChild>
          <HeadlessDockTabButton icon="card-outline" label="Payments" activeTint={Colors.primary} activeBg={Colors.surfaceElevated} />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <HeadlessDockTabButton icon="person-outline" label="Profile" activeTint={Colors.primary} activeBg={Colors.surfaceElevated} />
        </TabTrigger>

        {/* Hidden trigger to register support route in the tabs navigator */}
        <TabTrigger name="support" href="/support" style={{ display: 'none' }} />
      </Dock>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
});
