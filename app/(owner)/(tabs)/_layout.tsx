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
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/theme';

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';

// ── Redesign Theme Colors ───────────────────────────────────────────────────
const PRIMARY = Colors.primary;
const BG = Colors.canvas;
const CHARCOAL = Colors.textPrimary;
const MUTED = Colors.textMuted;
const BORDER = Colors.borderSubtle;
const WHITE = Colors.surface;
const DANGER = Colors.danger;

export default function OwnerTabsLayout() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);



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
  const isPaymentsActive = pathname === '/payments';

  return (
    <Tabs style={styles.root}>
      {/* ── Main Layout Wrapper ── */}
      <View style={{ flex: 1, backgroundColor: BG, paddingBottom: 68 + insets.bottom }}>
        {/* ── Personalized LUNA Gradient Header (Replicating Resident Design) ───── */}
        {isOverviewActive ? (
          <LinearGradient
            colors={['#011C40', '#023859']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}
          >
            <View style={styles.hWave1} />
            <View style={styles.hWave2} />
            <Row justify="space-between" align="center" style={{ width: '100%' }}>
              {/* Left Avatar + User Greeting & Property swapper */}
              <Row gap={12} align="center" style={{ flex: 1 }}>
                {/* Owner Avatar Frame */}
                <View style={styles.avatarFrame}>
                  <Txt size={18}>🤵</Txt>
                </View>
                
                <Col style={{ flex: 1 }}>
                  <Txt size={12} weight="600" color="rgba(255, 255, 255, 0.78)">{greeting}</Txt>
                  <Spacer size={2} />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { hapticSelect(); setShowProfileMenu(true); }}
                    style={styles.propertySelectRow}
                  >
                    <Txt size={17} weight="900" color="#FFFFFF" numberOfLines={1}>
                      {owner?.pgName ?? 'Select PG'}
                    </Txt>
                    <Ionicons name="chevron-down" size={14} color="#A7EBF2" />
                    {isManager && (
                      <View style={styles.managerBadge}>
                        <Txt size={8} weight="900" color="#011C40">MANAGER</Txt>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Spacer size={1} />
                  <Txt size={11} color="rgba(255, 255, 255, 0.75)">{subLabel}</Txt>
                </Col>
              </Row>

              {/* Right Action Icons */}
              <Row gap={8} align="center">
                <AnimatedPress scale={0.88} hapticPattern="light" onPress={() => { hapticSelect(); router.push('/notices'); }}>
                  <View style={styles.headerActionBtn}>
                    <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                    {unreadCount > 0 && <View style={styles.unreadDot} />}
                  </View>
                </AnimatedPress>

                <AnimatedPress scale={0.88} hapticPattern="light" onPress={() => router.push('/settings')}>
                  <View style={styles.headerActionBtn}>
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                  </View>
                </AnimatedPress>
              </Row>
            </Row>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['#011C40', '#023859']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerContainer, { paddingTop: insets.top + 10, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }]}
          >
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => { hapticSelect(); router.push('/overview'); }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Txt size={20} weight="900" color="#FFFFFF">
              {pathname === '/guests' ? 'Residents Directory' :
               pathname === '/payments' ? 'Payments & Revenue' :
               pathname === '/staff' ? 'Staff Management' :
               pathname === '/complaints' ? 'Complaints & Requests' :
               pathname === '/notices' ? 'Notifications' :
               pathname === '/reviews' ? 'Reviews & Feedback' : 'Details'}
            </Txt>
          </LinearGradient>
        )}
        {/* ── Active Tab Content View Slot ────────────────────────────────────── */}
        <View
          key={pathname}
          style={{ flex: 1 }}
        >
          <TabSlot />
        </View>
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



        {/* Center Action 3: Elevated Floating Plus */}
        <View style={styles.plusBtnContainer}>
          <TouchableOpacity
            style={styles.floatingPlusBtn}
            activeOpacity={0.85}
            onPress={() => { hapticSuccess(); setShowAddOptions(true); }}

          >
            <Ionicons name="add" size={28} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Tab 4: Payments */}
        <TabTrigger name="payments" href="/payments" asChild>
          <TouchableOpacity style={styles.dockItem} activeOpacity={0.8}>
            <Ionicons name="card" size={20} color={isPaymentsActive ? PRIMARY : MUTED} />
            <Txt size={10} weight={isPaymentsActive ? '800' : '600'} color={isPaymentsActive ? PRIMARY : MUTED} style={styles.dockText}>
              Payments
            </Txt>
          </TouchableOpacity>
        </TabTrigger>


        {/* Hidden triggers to register all tab routes in the navigator */}
        <TabTrigger name="guests" href="/guests" style={{ display: 'none' }} />
        <TabTrigger name="staff" href="/staff" style={{ display: 'none' }} />
        <TabTrigger name="notices" href="/notices" style={{ display: 'none' }} />
        <TabTrigger name="reviews" href="/reviews" style={{ display: 'none' }} />
      </TabList>

      {/* ── PG Swapper Popover Menu ─────────────────────────────────────────── */}
      {showProfileMenu && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowProfileMenu(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowProfileMenu(false)} />
            <View style={styles.swapperMenuCard}>
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
            </View>
          </View>
        </Modal>
      )}



      {/* Property Addition Overlays */}
      {showAddPgModal && (
        <AddPgPropertyDialog
          onDismiss={() => setShowAddPgModal(false)}
        />
      )}

      {/* ── Add Options Sheet Menu ─────────────────────────────────────────── */}
      {showAddOptions && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowAddOptions(false)}>
          <View style={styles.moreMenuBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddOptions(false)} />
            <View style={styles.moreMenuSheet}>
              <View style={styles.sheetHandle} />
              <Txt size={16} weight="900" color={CHARCOAL} style={{ marginBottom: 16, textAlign: 'center' }}>Quick Creation</Txt>
              
              <Row justify="space-evenly" align="center" style={{ marginVertical: 10 }}>
                {/* Add Resident */}
                <TouchableOpacity
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    hapticSelect();
                    setTimeout(() => router.navigate('/guests'), 150);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: '#ECFDF5' }]}><Ionicons name="person-add-outline" size={22} color="#10B981" /></View>
                  <Txt size={12} weight="800" color={CHARCOAL} style={{ marginTop: 8 }}>Resident</Txt>
                </TouchableOpacity>

                {/* Add Staff */}
                <TouchableOpacity
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    hapticSelect();
                    setTimeout(() => router.navigate('/staff'), 150);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: '#EEF2FF' }]}><Ionicons name="ribbon-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="800" color={CHARCOAL} style={{ marginTop: 8 }}>Staff</Txt>
                </TouchableOpacity>

                {/* Add Property */}
                <TouchableOpacity
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    hapticSelect();
                    setShowAddPgModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: '#FEF3C7' }]}><Ionicons name="business-outline" size={22} color="#F59E0B" /></View>
                  <Txt size={12} weight="800" color={CHARCOAL} style={{ marginTop: 8 }}>Property</Txt>
                </TouchableOpacity>
              </Row>

              <Spacer size={8} />
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setShowAddOptions(false)}>
                <Txt size={13} weight="800" color={MUTED} align="center">Cancel</Txt>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // LUNA Gradient Header (Matching Resident Design)
  headerContainer: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  hWave1: { position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  hWave2: { position: 'absolute', bottom: 10, right: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  avatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertySelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  managerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#A7EBF2',
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
  addOptionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  sheetCancelBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
  },
});

