/**
 * Owner/Manager tabs shell — the chrome shared by every tab: the header (PG switcher,
 * notification bell, logout), the profile menu popover, and the pill dock at the bottom.
 * Tab-specific state (e.g. the Overview tab's overdue-rent modal) lives in that tab's own
 * route file, not here.
 */
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { TabHeader } from '@/components/TabHeader';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSuccess } from '@/utils/haptics';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';

export default function OwnerTabsLayout() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const setActivePgId = useAuthStore((s) => s.setActivePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = useIsManagerMode();
  const logout = usePGowStore((s) => s.logout);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const { dockStyle, contentPaddingBottom } = useDock();

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <TabHeader
          actions={
            <>
              {/* Pushes to the shared /notifications route (app/notifications/index.tsx),
                  which renders OwnerAnnouncementsTab for owner/manager — same rich screen
                  (broadcast composer, approvals, folded-in Reviews), reached the reliable
                  way. This used to push straight to '/notices' (the tab route), but once
                  that tab's TabTrigger was removed from the dock, expo-router/ui's Tabs
                  navigator no longer had it in its route table (that table is built from
                  declared TabTriggers, not the file system) — the push silently went
                  nowhere. A root-level Stack route like /notifications doesn't have that
                  problem: it's reachable regardless of which Tabs navigator is active. */}
              <AnimatedPress scale={0.85} hapticPattern="light" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                onPress={() => router.push({ pathname: '/notifications', params: { role: isManager ? 'MANAGER' : 'OWNER' } })}>
                <View style={styles.headerIconBtn}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>
              <AnimatedPress scale={0.85} hapticPattern="medium" accessibilityLabel="Log out"
                onPress={() => { hapticSuccess(); logout(); }}>
                <View style={styles.headerIconBtn}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                </View>
              </AnimatedPress>
            </>
          }
        >
          <AnimatedPress scale={0.98} hapticPattern="light" accessibilityLabel="Property menu and switcher"
            onPress={() => setShowProfileMenu(true)} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Building icon */}
              <View style={styles.buildingIcon}>
                <Ionicons name="business" size={18} color={Colors.primary} />
              </View>
              <View style={{ marginLeft: 10 }}>
                {/* PG name + chevron */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.dot, { backgroundColor: isManager ? Colors.tertiary : Colors.primary }]} />
                  <Txt size={17} weight="700" color={Colors.textPrimary} numberOfLines={1}>
                    {owner?.pgName ?? 'Select PG'}
                  </Txt>
                  {isManager && (
                    <View style={styles.managerBadge}>
                      <Txt size={9} weight="900" color={Colors.tertiary}>MANAGER</Txt>
                    </View>
                  )}
                  <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
                </View>
                {/* Sub label */}
                <Txt size={11} weight="500" color={Colors.textMuted} style={{ marginTop: 1 }}>
                  {isManager
                    ? `Manager: ${owner?.managerName ?? 'You'}`
                    : `Owner: ${owner?.ownerName ?? 'You'} · ${allPGs.length} PG${allPGs.length === 1 ? '' : 's'}`}
                </Txt>
              </View>
            </View>
          </AnimatedPress>
        </TabHeader>

        {/* ── Active tab content ───────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <TabSlot />
        </View>
      </View>

      {/* ── Sticky bottom dock — see Dock/useDock in HeadlessDockTabButton.tsx ──── */}
      <Dock style={dockStyle}>
        {/* Overview sits in the middle — the natural thumb-reach spot — with the rest split
            evenly left and right, same layout convention as the guest dock. Notifications
            has no dock slot of its own: the header bell already opens it (see onPress
            above), so a second entry point here was redundant. Reviews (ratings + staff
            performance) folded into Notifications as a sub-tab, same reasoning. */}
        <TabTrigger name="guests" href="/guests" asChild>
          <HeadlessDockTabButton icon="people" label="Guests" />
        </TabTrigger>
        <TabTrigger name="payments" href="/payments" asChild>
          <HeadlessDockTabButton icon="card" label="Payments" />
        </TabTrigger>
        <TabTrigger name="overview" href="/overview" asChild>
          <HeadlessDockTabButton icon="grid" label="Overview" />
        </TabTrigger>
        <TabTrigger name="staff" href="/staff" asChild>
          <HeadlessDockTabButton icon="ribbon" label="Staff" />
        </TabTrigger>
        <TabTrigger name="complaints" href="/complaints" asChild>
          <HeadlessDockTabButton icon="alert-circle" label="Complaints" />
        </TabTrigger>
      </Dock>

      {/* Modals */}
      {showAddPgModal && (
        <AddPgPropertyDialog
          onDismiss={() => setShowAddPgModal(false)}
        />
      )}

      {/* Profile menu — account-switcher-style popover off the header */}
      {showProfileMenu && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowProfileMenu(false)}>
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[8, 8]}
              style={{ width: '80%', maxWidth: 320 }}
            >
              <View style={{ padding: 10 }}>
                <Txt size={14} weight="900" color={Colors.textPrimary} numberOfLines={1}>{owner?.pgName ?? 'Select PG'}</Txt>
                <Txt size={11} color={Colors.textMuted} numberOfLines={1}>
                  {isManager ? `Manager: ${owner?.managerName ?? 'You'}` : `Owner: ${owner?.ownerName ?? 'You'}`}
                </Txt>
              </View>
              <View style={styles.menuDivider} />

              {/* The header renders a chevron-down next to the property name, which reads as
                  "tap to switch". Until now this popover had no property list behind it, so
                  the affordance was a lie and switching was only possible three taps deeper
                  in Manage Properties. */}
              {allPGs.length > 1 && (
                <>
                  <Txt size={10} weight="800" color={Colors.textMuted} style={styles.menuSectionLabel}>
                    SWITCH PROPERTY
                  </Txt>
                  {allPGs.map((pg) => {
                    const active = pg.id === activePgId;
                    return (
                      <TouchableOpacity
                        key={pg.id}
                        style={styles.menuRow}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch to ${pg.pgName}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setShowProfileMenu(false);
                          if (!active) setActivePgId(pg.id);
                        }}
                      >
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={active ? Colors.primary : Colors.textMuted}
                        />
                        <Txt
                          size={13}
                          weight={active ? '800' : '600'}
                          color={active ? Colors.textPrimary : Colors.textSecondary}
                          numberOfLines={1}
                          style={{ marginLeft: 10, flex: 1 }}
                        >
                          {pg.pgName}
                        </Txt>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={styles.menuDivider} />
                </>
              )}

              {!isManager && (
                <>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => { setShowProfileMenu(false); setShowAddPgModal(true); }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginLeft: 10 }}>Add Property</Txt>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => { setShowProfileMenu(false); router.push('/manage-properties'); }}
                  >
                    <Ionicons name="business-outline" size={20} color={Colors.primary} />
                    <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginLeft: 10 }}>Manage Properties</Txt>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setShowProfileMenu(false); router.push('/settings'); }}
              >
                <Ionicons name="settings-outline" size={20} color={Colors.primary} />
                <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginLeft: 10 }}>Settings</Txt>
              </TouchableOpacity>
            </Card>
          </Pressable>
        </Modal>
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  dot: { width: 7, height: 7, borderRadius: 3.5 },
  buildingIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EAF5EE',
    alignItems: 'center', justifyContent: 'center',
  },
  managerBadge: {
    marginLeft: 5, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDivider: {
    height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 4,
  },
  menuSectionLabel: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2, letterSpacing: 0.5 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 12,
  },
});
