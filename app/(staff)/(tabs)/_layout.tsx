/**
 * Chef/kitchen-staff tabs shell — header (chef name, notification bell, logout) and the
 * 3-tab bottom dock, shared with every other role.
 *
 * Chef and delivery agent are two profiles over the same three route files, because the
 * ranking genuinely differs: a chef's day revolves around posting the menu (the app fires
 * three alarms a day about it), a delivery agent's around the route. `centreOut` therefore
 * puts a different tab in the middle for each. See src/data/navTabs.ts.
 */
import { View, StyleSheet } from 'react-native';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Row } from '@/components/ui';
import { Radii, Colors } from '@/theme';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { centreOut, NAV_PROFILES } from '@/data/navTabs';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { router, usePathname } from 'expo-router';

import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';

/**
 * Without this the navigator takes its initial route from whichever trigger happens to be
 * first, and the frequency ranking deliberately puts the LEAST-used destination in the
 * leftmost slot — for a delivery agent that is History, which is no way to open a shift.
 *
 * The anchor has to be one static name, but the two staff profiles rank differently, so it is
 * the route rather than the label that is pinned: `eaters` opens a chef on Eaters and a
 * delivery agent on Route, which is the right first screen for both. Do not delete this when
 * reordering the bar — reordering is exactly when it matters.
 */
export const unstable_settings = { anchor: 'eaters' };

export default function StaffTabsLayout() {
  const pathname = usePathname();

  const staff = usePGowStore((s) => s.loggedInStaff);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const logout = usePGowStore((s) => s.logout);
  const activeRole = useAuthStore((s) => s.activeRole);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  // No profile argument: neither staff role has a countable "waiting for you" queue in the
  // data model today, so there is nothing honest to tint a tab or a context strip with.
  const { dockStyle, contentPaddingBottom } = useDock();
  const destinations = centreOut(NAV_PROFILES[activeRole === 'delivery_agent' ? 'delivery' : 'chef']);

  return (
    <Tabs style={styles.root}>
      {/* Header — its own surface, separate from the scrollable body below,
          so it reads as fixed chrome rather than the first card in the list.
          Hide on the broadcast (Menu) tab to allow for a custom personal header. */}
      {pathname !== '/broadcast' && (
        <AppHeader
          title={activeRole === 'delivery_agent' ? 'Delivery Dashboard' : 'Chef Dashboard'}
          subtitle={activeRole === 'delivery_agent'
            ? `${staff?.name ?? 'Delivery Agent'} · Delivery Agent`
            : `Chef: ${staff?.name ?? 'Staff'}`}
          leading={
            <View style={styles.chefIcon}>
              <Ionicons name={activeRole === 'delivery_agent' ? 'bicycle' : 'restaurant'} size={20} color={Colors.primary} />
            </View>
          }
          actions={
            <Row gap={8}>
              <HeaderChip icon="notifications" label="Notifications" badge={unreadCount > 0} onPress={() => router.push('/notifications')} />
              <HeaderChip icon="exit" label="Log out" onPress={() => { logout(); }} />
            </Row>
          }
        />
      )}

      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
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

      {/* TabList must be a direct child of Tabs, and everything between it and the TabTriggers
          must be a Fragment or an array — never a View. Tabs discovers screens by walking its
          own children for TabList/TabTrigger with `Children.forEach`, which flattens arrays
          (so `.map` is fine) but does not recurse into an ordinary View (confirmed by reading
          expo-router/ui's Tabs.js). That is also why the dock is one layer rather than the
          two it used to be — the styles are merged onto TabList directly. */}
      <Dock style={dockStyle}>
        {destinations.map((d) => (
          <TabTrigger key={d.name} name={d.name} href={d.href} asChild>
            <HeadlessDockTabButton icon={d.icon} label={d.label} />
          </TabTrigger>
        ))}
      </Dock>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  chefIcon: { width: 46, height: 46, borderRadius: Radii.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' } });
