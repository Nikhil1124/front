/**
 * Chef/kitchen-staff tabs shell — header (chef name, notification bell, logout) and the
 * 3-tab bottom dock (Eaters/Menu/Kitchen). This dock's visual (two-line label, filled
 * background on the active tab) is distinct enough from the Owner/Guest dock that it isn't
 * built from the shared HeadlessDockTabButton — a bespoke button local to this one layout.
 */
import { forwardRef, useState } from 'react';
import { View, StyleSheet, type View as RNView, type PressableProps, Pressable } from 'react-native';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Col } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { TabHeader } from '@/components/TabHeader';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { hapticSuccess } from '@/utils/haptics';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';



import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';

export default function StaffTabsLayout() {
  const [showNotif, setShowNotif] = useState(false);

  const staff = usePGowStore((s) => s.loggedInStaff);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const logout = usePGowStore((s) => s.logout);
  const activeRole = useAuthStore((s) => s.activeRole);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  // Shares the flat-bar geometry and safe-area inset with the other roles' docks; only the
  // buttons inside stay bespoke (two-line labels, filled active state).
  const { dockStyle, contentPaddingBottom } = useDock();

  return (
    <Tabs style={styles.root}>
      {/* Header — its own surface, separate from the scrollable body below,
          so it reads as fixed chrome rather than the first card in the list. */}
      <TabHeader
        leading={
          <View style={styles.chefIcon}><Ionicons name="restaurant" size={24} color={Colors.primary} /></View>
        }
        actions={
          <>
            <AnimatedPress scale={0.85} hapticPattern="light" onPress={() => setShowNotif(true)}>
              <View style={styles.bellBtn}>
                <Ionicons name="notifications" size={20} color={Colors.primary} />
                {unreadCount > 0 && <View style={styles.unreadDot} />}
              </View>
            </AnimatedPress>
            <AnimatedPress scale={0.85} hapticPattern="medium" onPress={() => { hapticSuccess(); logout(); }}>
              <View style={styles.bellBtn}>
                <Ionicons name="exit" size={20} color={Colors.danger} />
              </View>
            </AnimatedPress>
          </>
        }
      >
        <Col style={{ marginLeft: 12 }}>
          <Txt size={18} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 0.5 }}>
            CHEF DASHBOARD
          </Txt>
          <Txt size={11} color={Colors.textMuted}>
            Chef: {staff?.name ?? 'Name unavailable'}
          </Txt>
        </Col>
      </TabHeader>

      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        <TabSlot />
      </View>

      {/* TabList must be a direct child of Tabs, and everything inside it up to the
          TabTriggers must be Fragments, not Views — Tabs discovers screens by walking its
          own children for TabList/TabTrigger and does not recurse into an ordinary View
          (confirmed by reading expo-router/ui's Tabs.js). So the previous two-layer dock
          (translucent outer strip + white inner pill) is one layer here too, same as the
          Owner/Guest tabs — dockWrap and dock are merged onto TabList directly. */}
      <Dock style={dockStyle}>
        <TabTrigger name="eaters" href="/eaters" asChild>
          <HeadlessDockTabButton icon="people" label="Eaters" />
        </TabTrigger>
        <TabTrigger name="broadcast" href="/broadcast" asChild>
          <HeadlessDockTabButton icon="megaphone" label="Menu" />
        </TabTrigger>
        <TabTrigger name="kitchen" href="/kitchen" asChild>
          <HeadlessDockTabButton icon="restaurant" label="Kitchen" />
        </TabTrigger>
      </Dock>

      {showNotif && <RoleNotificationsCenterSheet roleTitle={activeRole === 'chef' ? 'CHEF' : 'MANAGER'} onDismiss={() => setShowNotif(false)} />}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  chefIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
});
