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
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';

export default function OwnerTabsLayout() {
  const [showNotificationCenter, setShowNotificationCenter] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);

  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManager = usePGowStore((s) => s.isManagerMode);
  const allPGs = usePGowStore((s) => s.allPGsState);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
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
              <AnimatedPress scale={0.85} hapticPattern="light" onPress={() => setShowNotificationCenter(isManager ? 'MANAGER' : 'OWNER')}>
                <View style={styles.bellBtn}>
                  <Ionicons name="notifications" size={18} color={Colors.primary} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>
              <AnimatedPress scale={0.85} hapticPattern="medium" onPress={() => { hapticSuccess(); logout(); }}>
                <View style={styles.bellBtn}>
                  <Ionicons name="exit" size={18} color={Colors.danger} />
                </View>
              </AnimatedPress>
            </>
          }
        >
          <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => setShowProfileMenu(true)} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.dot, { backgroundColor: isManager ? Colors.tertiary : Colors.primary }]} />
              <Txt size={16} weight="800" color={Colors.primaryDark} style={{ marginLeft: 6 }} numberOfLines={1}>
                {owner?.pgName ?? 'Select PG'}
              </Txt>
              {isManager && (
                <View style={styles.managerBadge}>
                  <Txt size={9} weight="900" color={Colors.tertiary}>MANAGER</Txt>
                </View>
              )}
              <Ionicons name="chevron-down" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
            <Txt size={11} weight="600" color={Colors.textMuted} style={{ marginLeft: 14, marginTop: 2 }}>
              {isManager
                ? `Manager: ${owner?.managerName ?? 'You'}`
                : `Owner: ${owner?.ownerName ?? 'You'} • ${allPGs.length} PG${allPGs.length === 1 ? '' : 's'}`}
            </Txt>
          </AnimatedPress>
        </TabHeader>

        {/* ── Active tab content ───────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <TabSlot />
        </View>
      </View>

      {/* ── Sticky bottom dock — see Dock/useDock in HeadlessDockTabButton.tsx ──── */}
      <Dock style={dockStyle}>
        <TabTrigger name="overview" href="/overview" asChild>
          <HeadlessDockTabButton icon="grid" label="Overview" />
        </TabTrigger>
        <TabTrigger name="guests" href="/guests" asChild>
          <HeadlessDockTabButton icon="people" label="Guests" />
        </TabTrigger>
        <TabTrigger name="payments" href="/payments" asChild>
          <HeadlessDockTabButton icon="card" label="Payments" />
        </TabTrigger>
        <TabTrigger name="staff" href="/staff" asChild>
          <HeadlessDockTabButton icon="ribbon" label="Staff" />
        </TabTrigger>
        <TabTrigger name="notices" href="/notices" asChild>
          <HeadlessDockTabButton icon="megaphone" label="Notices" />
        </TabTrigger>
        <TabTrigger name="reviews" href="/reviews" asChild>
          <HeadlessDockTabButton icon="star" label="Reviews" />
        </TabTrigger>
      </Dock>

      {/* Modals */}
      {showNotificationCenter && (
        <RoleNotificationsCenterSheet
          roleTitle={showNotificationCenter}
          onDismiss={() => setShowNotificationCenter(null)}
        />
      )}
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

  dot: { width: 8, height: 8, borderRadius: 4 },
  managerBadge: {
    marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
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
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 12,
  },
});
