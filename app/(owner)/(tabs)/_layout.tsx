/**
 * Owner/Manager tabs shell — premium Indigo redesign.
 * Personalized header (avatar, dynamic greeting, property swapper, notifications, settings)
 * and custom floating bottom navigation bar with "+" action and More overlay sheet.
 * All existing functionality and data bindings preserved.
 */
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';

// ── Redesign Theme Colors ───────────────────────────────────────────────────
const PRIMARY = '#5B45E8';      // Premium Indigo / Violet
const BG = '#F7F8FC';           // Very light cool gray
const CHARCOAL = '#15171A';     // Main text
const MUTED = '#6B7280';        // Secondary text
const BORDER = '#E5E7EB';       // Light gray border
const WHITE = '#FFFFFF';
const DANGER = '#EF4444';       // Error/logout red

export default function OwnerTabsLayout() {
  const [showNotificationCenter, setShowNotificationCenter] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = usePGowStore((s) => s.isManagerMode);
  const logout = usePGowStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Dynamic names
  const ownerName = owner?.ownerName || user?.name || 'Owner';
  const greeting = `Good morning, ${ownerName.split(' ')[0]} 👋`;
  const location = owner?.address ? owner.address.split(',').slice(0, 2).join(',') : 'Bengaluru';
  const subLabel = `${allPGs.length} PG${allPGs.length === 1 ? '' : 's'} • ${location}`;

  // Paths
  const isOverviewActive = pathname === '/overview';
  const isGuestsActive = pathname === '/guests';

  return (
    <Tabs style={styles.root}>
      {/* ── Main Layout Wrapper ── */}
      <View style={{ flex: 1, backgroundColor: BG, paddingBottom: 68 + insets.bottom }}>
        {/* ── Personalized Redesigned Header ───────────────────────────────────── */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
          <Row justify="space-between" align="center">
            {/* Left Avatar + User Greeting & Property swapper */}
            <Row gap={12} align="center" style={{ flex: 1 }}>
              {/* Owner Avatar Frame */}
              <View style={styles.avatarFrame}>
                <Txt size={18}>🤵</Txt>
              </View>
              
              <Col style={{ flex: 1 }}>
                <Txt size={12} weight="600" color={MUTED}>{greeting}</Txt>
                <Spacer size={2} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { hapticSelect(); setShowProfileMenu(true); }}
                  style={styles.propertySelectRow}
                >
                  <Txt size={16} weight="800" color={CHARCOAL} numberOfLines={1}>
                    {owner?.pgName ?? 'Select PG'}
                  </Txt>
                  <Ionicons name="chevron-down" size={13} color={MUTED} />
                  {isManager && (
                    <View style={styles.managerBadge}>
                      <Txt size={8} weight="900" color={PRIMARY}>MANAGER</Txt>
                    </View>
                  )}
                </TouchableOpacity>
                <Spacer size={1} />
                <Txt size={11} color={MUTED}>{subLabel}</Txt>
              </Col>
            </Row>

            {/* Right Action Icons */}
            <Row gap={8} align="center">
              <AnimatedPress scale={0.88} hapticPattern="light" onPress={() => setShowNotificationCenter(isManager ? 'MANAGER' : 'OWNER')}>
                <View style={styles.headerActionBtn}>
                  <Ionicons name="notifications-outline" size={20} color={CHARCOAL} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>

              <AnimatedPress scale={0.88} hapticPattern="light" onPress={() => router.push('/settings')}>
                <View style={styles.headerActionBtn}>
                  <Ionicons name="settings-outline" size={20} color={CHARCOAL} />
                </View>
              </AnimatedPress>
            </Row>
          </Row>
        </View>

        {/* ── Active Tab Content View Slot ────────────────────────────────────── */}
        <Animated.View
          key={pathname}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flex: 1 }}
        >
          <TabSlot />
        </Animated.View>
      </View>

      {/* ── Custom Floating Bottom Navigation Bar ──────────────────────────────
          TabList must be a direct child of Tabs, and cannot be nested within an
          ordinary View so that Expo Router can locate triggers and discover screens.
      ───────────────────────────────────────────────────────────────────────── */}
      <TabList style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 12) }]}>
        {/* Tab 1: Overview */}
        <TabTrigger name="overview" href="/overview" asChild>
          <TouchableOpacity style={styles.dockItem} activeOpacity={0.8}>
            <Ionicons name="grid" size={20} color={isOverviewActive ? PRIMARY : MUTED} />
            <Txt size={10} weight={isOverviewActive ? '800' : '600'} color={isOverviewActive ? PRIMARY : MUTED} style={styles.dockText}>
              Overview
            </Txt>
          </TouchableOpacity>
        </TabTrigger>

        {/* Action 2: Properties */}
        <TouchableOpacity
          style={styles.dockItem}
          activeOpacity={0.8}
          onPress={() => { hapticSelect(); router.push('/manage-properties'); }}
        >
          <Ionicons name="business" size={20} color={MUTED} />
          <Txt size={10} weight="600" color={MUTED} style={styles.dockText}>
            Properties
          </Txt>
        </TouchableOpacity>

        {/* Center Action 3: Elevated Floating Plus */}
        <View style={styles.plusBtnContainer}>
          <TouchableOpacity
            style={styles.floatingPlusBtn}
            activeOpacity={0.85}
            onPress={() => { hapticSuccess(); setShowAddPgModal(true); }}
          >
            <Ionicons name="add" size={28} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Tab 4: Residents */}
        <TabTrigger name="guests" href="/guests" asChild>
          <TouchableOpacity style={styles.dockItem} activeOpacity={0.8}>
            <Ionicons name="people" size={20} color={isGuestsActive ? PRIMARY : MUTED} />
            <Txt size={10} weight={isGuestsActive ? '800' : '600'} color={isGuestsActive ? PRIMARY : MUTED} style={styles.dockText}>
              Residents
            </Txt>
          </TouchableOpacity>
        </TabTrigger>

        {/* Action 5: More Menu */}
        <TouchableOpacity
          style={styles.dockItem}
          activeOpacity={0.8}
          onPress={() => { hapticSelect(); setShowMoreMenu(true); }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={MUTED} />
          <Txt size={10} weight="600" color={MUTED} style={styles.dockText}>
            More
          </Txt>
        </TouchableOpacity>

        {/* Hidden triggers to register all tab routes in the navigator */}
        <TabTrigger name="payments" href="/payments" style={{ display: 'none' }} />
        <TabTrigger name="staff" href="/staff" style={{ display: 'none' }} />
        <TabTrigger name="notices" href="/notices" style={{ display: 'none' }} />
        <TabTrigger name="reviews" href="/reviews" style={{ display: 'none' }} />
      </TabList>

      {/* ── PG Swapper Popover Menu ─────────────────────────────────────────── */}
      {showProfileMenu && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowProfileMenu(false)}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowProfileMenu(false)} />
            <Animated.View entering={FadeIn.duration(200).delay(40)} exiting={FadeOut.duration(120)} style={styles.swapperMenuCard}>
              <Card
                containerColor={WHITE}
                borderRadius={22}
                borderWidth={1}
                borderColor={BORDER}
                padding={[8, 8]}
                style={{ width: '100%' }}
              >
                <View style={{ padding: 12 }}>
                  <Txt size={15} weight="900" color={CHARCOAL}>{owner?.pgName ?? 'Select PG'}</Txt>
                  <Txt size={11} color={MUTED} style={{ marginTop: 2 }}>
                    {isManager ? `Manager: ${owner?.managerName ?? 'You'}` : `Owner: ${owner?.ownerName ?? 'You'}`}
                  </Txt>
                </View>
                <View style={styles.menuDivider} />
                
                {/* List all properties to allow swapper mechanism */}
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {allPGs.map((pg) => {
                    const isCurrent = pg.id === activePgId;
                    return (
                      <TouchableOpacity
                        key={pg.id}
                        style={[styles.menuRow, isCurrent && styles.menuRowActive]}
                        onPress={async () => {
                          hapticSuccess();
                          setShowProfileMenu(false);
                          await usePGowStore.getState().switchActivePG(pg);
                        }}
                      >
                        <Ionicons name="business" size={18} color={isCurrent ? PRIMARY : MUTED} />
                        <Txt size={13} weight={isCurrent ? '800' : '600'} color={isCurrent ? PRIMARY : CHARCOAL} style={{ marginLeft: 10, flex: 1 }}>
                          {pg.pgName}
                        </Txt>
                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                
                <View style={styles.menuDivider} />

                {!isManager && (
                  <>
                    <TouchableOpacity
                      style={styles.menuRow}
                      onPress={() => { setShowProfileMenu(false); setShowAddPgModal(true); }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                      <Txt size={13} weight="700" color={CHARCOAL} style={{ marginLeft: 10 }}>Add Property</Txt>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.menuRow}
                      onPress={() => { setShowProfileMenu(false); router.push('/manage-properties'); }}
                    >
                      <Ionicons name="settings-outline" size={18} color={PRIMARY} />
                      <Txt size={13} weight="700" color={CHARCOAL} style={{ marginLeft: 10 }}>Manage Properties</Txt>
                    </TouchableOpacity>
                  </>
                )}
              </Card>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

      {/* ── More Navigation Sheet Menu ───────────────────────────────────────── */}
      {showMoreMenu && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowMoreMenu(false)}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.moreMenuBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMoreMenu(false)} />
            <Animated.View entering={FadeIn.duration(200).delay(40)} exiting={FadeOut.duration(120)} style={styles.moreMenuSheet}>
              <View style={styles.sheetHandle} />
              <Txt size={16} weight="900" color={CHARCOAL} style={{ marginBottom: 16 }}>More Operations</Txt>
              
              <View style={styles.moreGrid}>
                {/* Payments */}
                <TouchableOpacity
                  style={styles.moreGridItem}
                  onPress={() => { setShowMoreMenu(false); router.push('/payments'); }}
                >
                  <View style={styles.moreIconBox}><Ionicons name="card-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL}>Payments</Txt>
                </TouchableOpacity>

                {/* Staff */}
                <TouchableOpacity
                  style={styles.moreGridItem}
                  onPress={() => { setShowMoreMenu(false); router.push('/staff'); }}
                >
                  <View style={styles.moreIconBox}><Ionicons name="ribbon-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL}>Staff</Txt>
                </TouchableOpacity>

                {/* Notices */}
                <TouchableOpacity
                  style={styles.moreGridItem}
                  onPress={() => { setShowMoreMenu(false); router.push('/notices'); }}
                >
                  <View style={styles.moreIconBox}><Ionicons name="megaphone-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL}>Notices</Txt>
                </TouchableOpacity>

                {/* Reviews */}
                <TouchableOpacity
                  style={styles.moreGridItem}
                  onPress={() => { setShowMoreMenu(false); router.push('/reviews'); }}
                >
                  <View style={styles.moreIconBox}><Ionicons name="star-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL}>Reviews</Txt>
                </TouchableOpacity>
              </View>

              <View style={[styles.menuDivider, { marginVertical: 18 }]} />

              <Row gap={12}>
                <TouchableOpacity
                  style={[styles.moreActionBtn, { flex: 1, backgroundColor: PRIMARY }]}
                  onPress={() => { setShowMoreMenu(false); router.push('/settings'); }}
                >
                  <Ionicons name="settings-outline" size={16} color={WHITE} />
                  <Txt size={13} weight="800" color={WHITE} style={{ marginLeft: 6 }}>Settings</Txt>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moreActionBtn, { flex: 1, backgroundColor: '#FEF2F2', borderColor: '#FEE2E2', borderWidth: 1 }]}
                  onPress={() => { setShowMoreMenu(false); hapticSuccess(); logout(); router.replace('/'); }}
                >
                  <Ionicons name="log-out-outline" size={16} color={DANGER} />
                  <Txt size={13} weight="800" color={DANGER} style={{ marginLeft: 6 }}>Logout</Txt>
                </TouchableOpacity>
              </Row>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

      {/* Notifications & Property Addition Overlays */}
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Redesigned Header
  headerContainer: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  avatarFrame: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertySelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  managerBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DANGER,
  },

  // Custom Floating Dock styled directly onto TabList
  floatingDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    height: 62,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  dockText: {
    marginTop: 2,
    fontSize: 9,
  },
  plusBtnContainer: {
    width: 64,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingPlusBtn: {
    position: 'absolute',
    top: -20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  // Modals Backdrops
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 23, 26, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapperMenuCard: {
    width: '84%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  menuRowActive: {
    backgroundColor: '#EEF2FF',
  },

  // More Menu Bottom Sheet
  moreMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 23, 26, 0.45)',
    justifyContent: 'flex-end',
  },
  moreMenuSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  moreGridItem: {
    width: '22%',
    alignItems: 'center',
    gap: 8,
  },
  moreIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreActionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
