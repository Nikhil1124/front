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
import { useDock } from '@/components/HeadlessDockTabButton';
import { TabHeader } from '@/components/TabHeader';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSuccess } from '@/utils/haptics';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';

interface DockBtnProps extends PressableProps {
  emoji: string;
  label: string;
  sub: string;
  isFocused?: boolean;
}

const StaffDockButton = forwardRef<RNView, DockBtnProps>(({ emoji, label, sub, isFocused, style, ...props }, ref) => (
  <Pressable
    ref={ref}
    style={[styles.dockBtn, { backgroundColor: isFocused ? Colors.primary : Colors.surfaceMuted }, style as any]}
    {...props}
  >
    <Txt size={11} weight="900" color={isFocused ? '#FFFFFF' : Colors.textPrimary}>{emoji} {label}</Txt>
    <Txt size={8} weight="700" color={isFocused ? '#CCFBF1' : Colors.textMuted}>{sub}</Txt>
  </Pressable>
));

export default function StaffTabsLayout() {
  const [showNotif, setShowNotif] = useState(false);

  const staff = usePGowStore((s) => s.loggedInStaff);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  const logout = usePGowStore((s) => s.logout);

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
          <View style={styles.chefIcon}><Txt size={24}>👨‍🍳</Txt></View>
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
          <Txt size={18} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 0.5 }}>CHEF DASHBOARD</Txt>
          <Txt size={11} color={Colors.textMuted}>Chef: {staff?.name ?? 'Ramesh Kumar'} (PG: {owner?.pgName ?? 'Co-Living'})</Txt>
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
      <TabList style={[dockStyle, styles.dock]}>
        <TabTrigger name="eaters" href="/eaters" asChild style={{ flex: 1 }}>
          <StaffDockButton emoji="📊" label="Eaters" sub="RSVP List" />
        </TabTrigger>
        <TabTrigger name="broadcast" href="/broadcast" asChild style={{ flex: 1 }}>
          <StaffDockButton emoji="📣" label="Menu" sub="Broadcast" />
        </TabTrigger>
        <TabTrigger name="kitchen" href="/kitchen" asChild style={{ flex: 1 }}>
          <StaffDockButton emoji="🍳" label="Kitchen" sub="Pantry" />
        </TabTrigger>
      </TabList>

      {showNotif && <RoleNotificationsCenterSheet roleTitle={staff?.role === 'Chef' ? 'CHEF' : 'MANAGER'} onDismiss={() => setShowNotif(false)} />}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  chefIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  // Geometry (flush flat bar, border, shadow, safe-area inset) comes from `useDock`; this
  // only adds the gap between this dock's three wider buttons.
  dock: { gap: 4 },
  dockBtn: { borderRadius: 12, padding: 6, alignItems: 'center', justifyContent: 'center' },
});
