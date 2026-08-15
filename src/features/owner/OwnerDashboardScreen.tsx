/**
 * OwnerDashboardScreen — PhonePe-style hub for the PG owner & manager.
 *
 * Cyber Mint migration:
 *   - Light mint canvas, white surfaces, slate-900 text, teal accents.
 *   - Bottom dock uses a clean light style (active tab = teal pill, inactive = slate text).
 *
 * Hub-and-Spoke navigation:
 *   The dashboard HUB is intentionally uncluttered — a hero financial card
 *   plus a 2×3 grid of action tiles plus a recent-action log. Every tile
 *   that needs more space than a tile can afford pushes a dedicated spoke
 *   screen via `pushScreen(...)`. This replaces the old monolithic scroll
 *   view that crammed P&L, procurement, roster, meals, tickets, and staff
 *   into the same tab.
 *
 * The bottom dock is preserved because the existing tab structure still
 * carries Residents / Payments / Staff / Services / Helpdesk — those tabs
 * already exist and would be expensive to rebuild. The Overview tab here
 * is the new light hub.
 */
import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { Card, Txt, Row, Col, Spacer, Btn, OutlinedBtn, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import { useMealSavings } from '@/features/meals/useMealSavings';
import { usePortfolioTeaser } from '@/features/properties/usePortfolio';
import type { AppScreen } from '@/types';

import { OwnerGuestsManagementTab } from '@/features/owner/tabs/OwnerGuestsManagementTab';
import { OwnerPaymentsTab } from '@/features/owner/tabs/OwnerPaymentsTab';
import { StaffManagementTab } from '@/features/owner/tabs/StaffManagementTab';
import { OwnerAnnouncementsTab } from '@/features/owner/tabs/OwnerAnnouncementsTab';
import { OwnerReviewsTab } from '@/features/owner/tabs/OwnerReviewsTab';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';

interface TabDef { label: string; icon: keyof any; }
const TABS: TabDef[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Guests', icon: 'people' },
  { label: 'Payments', icon: 'card' },
  { label: 'Staff', icon: 'ribbon' },
  { label: 'Notices', icon: 'megaphone' },
  { label: 'Reviews', icon: 'star' },
];

interface ActionTile {
  screen?: AppScreen;
  action?: 'NOTICES';
  label: string;
  desc: string;
  icon: keyof any;
  tint: string;
}

const OWNER_TILES: ActionTile[] = [
  { screen: 'PNL_ANALYTICS',       label: 'P&L Analytics',     desc: '3m / 6m / 1y', icon: 'stats-chart',  tint: '#0D9488' },
  { screen: 'PROCUREMENT_SCREEN',  label: 'Procurement',        desc: 'Approve orders', icon: 'cube',          tint: '#0F766E' },
  { screen: 'GROCERIES_SCREEN',    label: 'Groceries',          desc: 'Kitchen & PG supplies', icon: 'nutrition', tint: '#15803D' },
  { screen: 'UPI_SETTINGS',        label: 'UPI Settings',       desc: 'Rent collection handles', icon: 'card', tint: '#0284C7' },
  { screen: 'OWNER_SERVICES',      label: 'Services',           desc: 'Grocery & repairs', icon: 'storefront', tint: '#9333EA' },
];

const MANAGER_TILES: ActionTile[] = [
  { screen: 'BED_VISUALIZER',      label: 'Bed Layout',         desc: 'Floor → room → bed', icon: 'bed',            tint: '#0D9488' },
  { screen: 'TENANT_LIST',         label: 'Tenant Mgmt',        desc: 'KYC decisions', icon: 'people',           tint: '#0F766E' },
  { screen: 'PROCUREMENT_SCREEN',  label: 'Procurement',        desc: 'Store & cart', icon: 'cube',              tint: '#0284C7' },
  { screen: 'GROCERIES_SCREEN',    label: 'Groceries',          desc: 'Kitchen & PG supplies', icon: 'nutrition', tint: '#15803D' },
  { action: 'NOTICES',             label: 'Rent Reminders',     desc: 'WhatsApp / SMS', icon: 'notifications', tint: '#D97706' },
  { screen: 'UPI_SETTINGS',        label: 'UPI Settings',       desc: 'Rent collection handles', icon: 'card', tint: '#0284C7' },
  { screen: 'STAFF_ATTENDANCE',   label: 'Staff & Shifts',     desc: 'QR attendance', icon: 'time',            tint: '#10B981' },
  { screen: 'HOUSEKEEPING_DASHBOARD', label: 'Housekeeping',    desc: 'Daily queue', icon: 'sparkles',         tint: '#E11D48' },
  { screen: 'OWNER_SERVICES',      label: 'Services',           desc: 'Grocery & repairs', icon: 'storefront', tint: '#9333EA' },
];

export function OwnerDashboardScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [showNotificationCenter, setShowNotificationCenter] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManager = usePGowStore((s) => s.isManagerMode);
  const allPGs = usePGowStore((s) => s.allPGsState);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  const guests = usePGowStore((s) => s.currentGuests);
  const logout = usePGowStore((s) => s.logout);
  const pushScreen = usePGowStore((s) => s.pushScreen);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  // "This month" window for the meal-savings hero tile — the 1st of the
  // current month through today, in the same YYYY-MM-DD form the mock
  // backend's date-range filter compares against.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = now.toISOString().slice(0, 10);
  const { data: mealSavings } = useMealSavings(owner?.id ?? null, monthStart, monthEnd);
  const savedThisMonth = mealSavings?.total_saved ?? 0;
  const skippedPortions = mealSavings?.total_skipped_portions ?? 0;

  const overdueCount = guests.filter((g) => !g.isBillPaid).length;
  const recentFeed = roleNotifs.slice(0, 3);

  // Portfolio is an owner concept, not a manager one — a manager only ever holds the one
  // property they're assigned to. The hook itself already no-ops below 2 PGs, but the
  // `!isManager` check keeps that owner-only framing explicit here rather than incidental.
  const showPortfolio = !isManager && allPGs.length > 1;
  const { data: portfolio } = usePortfolioTeaser(showPortfolio ? allPGs : []);

  const tiles = isManager ? MANAGER_TILES : OWNER_TILES;

  const switchTab = (idx: number) => {
    if (idx === activeTab) return;
    hapticSelect();
    setActiveTab(idx);
  };

  const handleTilePress = (tile: ActionTile) => {
    hapticSelect();
    if (tile.action === 'NOTICES') {
      setActiveTab(4);
      return;
    }
    if (tile.screen) {
      pushScreen(tile.screen);
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ flex: 1, paddingBottom: 76 }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Tap the profile area for account-switcher-style actions — add /
                manage properties (owner only) and settings, same affordance
                as tapping your avatar in Google apps. */}
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

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
            </View>
          </View>
        </View>

        {/* ── Active tab content ───────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <Animated.View
            key={activeTab}
            entering={SlideInRight.duration(220).springify().damping(18).stiffness(220)}
            style={{ flex: 1 }}
          >
            {activeTab === 0 ? (
              // ── Overview = the new light HUB ─────────────────────────────
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
                {/* Portfolio teaser — one compact row, never the full breakdown. The
                    stat grid and per-property chart live on their own screen (PORTFOLIO)
                    so this hub's length never grows with how many PGs the owner has. */}
                {showPortfolio && (
                  <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => pushScreen('PORTFOLIO')}>
                    <View style={styles.teaserCard}>
                      <View style={{ flex: 1 }}>
                        <Txt size={10} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                          PORTFOLIO &middot; {allPGs.length} PROPERTIES
                        </Txt>
                        <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                          {portfolio ? `₹${Math.round(portfolio.totalCollected).toLocaleString('en-IN')} collected this cycle` : 'View totals across every property'}
                        </Txt>
                      </View>
                      <Row gap={2} align="center">
                        <Txt size={11} weight="800" color={Colors.primaryDark}>View all</Txt>
                        <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
                      </Row>
                    </View>
                  </AnimatedPress>
                )}

                {/* Hero financial card */}
                <View style={styles.heroCard}>
                  <Txt size={11} weight="700" color={'rgba(255,255,255,0.85)'} style={{ letterSpacing: 0.5 }}>SAVED THIS MONTH</Txt>
                  <Txt size={26} weight="900" color={Colors.textInverse} style={{ marginTop: 4 }}>
                    ₹{savedThisMonth.toLocaleString('en-IN')}
                  </Txt>
                  <Row gap={6} align="center" style={{ marginTop: 6 }}>
                    <Ionicons name="leaf" size={12} color={'rgba(255,255,255,0.85)'} />
                    <Txt size={11} color={'rgba(255,255,255,0.85)'}>{skippedPortions} portions skipped via broadcast</Txt>
                  </Row>
                  <Spacer size={10} />
                  <TouchableOpacity
                    onPress={() => { hapticSelect(); setShowOverdueModal(true); }}
                    style={styles.heroStat}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="alert-circle" size={12} color={'rgba(255,255,255,0.95)'} />
                    <Txt size={11} weight="800" color={Colors.textInverse} style={{ marginLeft: 4 }}>
                      {overdueCount} overdue ›
                    </Txt>
                  </TouchableOpacity>
                </View>

                <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 4 }}>QUICK ACTIONS</Txt>
                <View style={styles.tileGrid}>
                  {tiles.map((tile) => (
                    <AnimatedPress
                      key={tile.label}
                      scale={0.96}
                      hapticPattern="light"
                      onPress={() => handleTilePress(tile)}
                      style={{ width: '48%' }}
                    >
                      <Card
                        containerColor={Colors.surface}
                        borderRadius={Layout.borderRadiusCard}
                        borderWidth={1}
                        borderColor={Colors.borderSubtle}
                        padding={[14, 14]}
                      >
                        <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}1A` }]}>
                          <Ionicons name={tile.icon as any} size={20} color={tile.tint} />
                        </View>
                        <Txt size={13} weight="800" color={Colors.textPrimary} style={{ marginTop: 10 }}>{tile.label}</Txt>
                        <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>{tile.desc}</Txt>
                      </Card>
                    </AnimatedPress>
                  ))}
                </View>

                <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 6 }}>RECENT ACTIVITY</Txt>
                <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
                  {recentFeed.length === 0 ? (
                    <Row gap={8} align="center">
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Txt size={12} color={Colors.textMuted}>All caught up — no recent activity.</Txt>
                    </Row>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {recentFeed.map((n) => (
                        <Row key={n.id} gap={10} align="flex-start">
                          <View style={[styles.feedDot, {
                            backgroundColor:
                              (n.category ?? '').toUpperCase().includes('PAYMENT') ? Colors.success :
                              (n.category ?? '').toUpperCase().includes('KYC') ? Colors.warning :
                              (n.priority ?? '').toUpperCase() === 'HIGH' ? Colors.danger :
                              Colors.primary,
                          }]} />
                          <Col style={{ flex: 1 }}>
                            <Txt size={12} weight="700" color={Colors.textPrimary}>{n.title}</Txt>
                            <Txt size={10} color={Colors.textMuted}>{n.message}</Txt>
                          </Col>
                        </Row>
                      ))}
                    </View>
                  )}
                </Card>
              </ScrollView>
            ) : activeTab === 1 ? (
              <OwnerGuestsManagementTab />
            ) : activeTab === 2 ? (
              <OwnerPaymentsTab />
            ) : activeTab === 3 ? (
              <StaffManagementTab />
            ) : activeTab === 4 ? (
              <OwnerAnnouncementsTab />
            ) : (
              <OwnerReviewsTab />
            )}
          </Animated.View>
        </View>
      </View>

      {/* ── Sticky bottom dock ────────────────────────────────────────────── */}
      <View style={styles.dockWrap}>
        <View style={styles.dock}>
          {TABS.map((tab, idx) => {
            const isSelected = activeTab === idx;
            return (
              <AnimatedPress
                key={tab.label}
                scale={0.94}
                hapticPattern="light"
                onPress={() => switchTab(idx)}
                style={[
                  styles.dockBtn,
                  isSelected && {
                    backgroundColor: Colors.surface,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    elevation: 2,
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isSelected ? Colors.primaryDark : Colors.textMuted}
                />
                <Txt
                  size={10}
                  weight={isSelected ? '800' : '600'}
                  color={isSelected ? Colors.primaryDark : Colors.textMuted}
                  style={{ marginTop: 2 }}
                >
                  {tab.label}
                </Txt>
              </AnimatedPress>
            );
          })}
        </View>
      </View>

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
                    onPress={() => { setShowProfileMenu(false); pushScreen('MANAGE_PROPERTIES'); }}
                  >
                    <Ionicons name="business-outline" size={20} color={Colors.primary} />
                    <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginLeft: 10 }}>Manage Properties</Txt>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setShowProfileMenu(false); pushScreen('SETTINGS_SCREEN'); }}
              >
                <Ionicons name="settings-outline" size={20} color={Colors.primary} />
                <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginLeft: 10 }}>Settings</Txt>
              </TouchableOpacity>
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* ⚠️ Overdue Detail Breakdown Modal */}
      {showOverdueModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowOverdueModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOverdueModal(false)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={24}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '92%', maxHeight: '82%', zIndex: 2 }}
            >
              <Row justify="space-between" align="center">
                <Row gap={8} align="center">
                  <View style={[styles.modalIconBox, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="alert-circle" size={20} color="#D97706" />
                  </View>
                  <Col>
                    <Txt size={16} weight="900" color={Colors.textPrimary}>Pending Rent Dues</Txt>
                    <Txt size={11} color={Colors.textMuted}>{overdueCount} Unpaid Resident{overdueCount === 1 ? '' : 's'}</Txt>
                  </Col>
                </Row>
                <IconBtn onPress={() => setShowOverdueModal(false)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>

              <Spacer size={14} />

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {guests.filter((g) => !g.isBillPaid).length === 0 ? (
                  <Card containerColor="#F0FDF9" borderRadius={12} padding={[16, 16]} style={{ alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
                    <Txt size={13} weight="800" color="#166534" style={{ marginTop: 6 }}>All Rent Collected!</Txt>
                    <Txt size={11} color={Colors.textMuted}>Zero overdue residents in this property.</Txt>
                  </Card>
                ) : (
                  guests.filter((g) => !g.isBillPaid).map((g) => (
                    <Card
                      key={g.id}
                      containerColor="#FFFBEB"
                      borderRadius={14}
                      borderWidth={1}
                      borderColor="#FDE68A"
                      padding={[12, 12]}
                      style={{ marginBottom: 8 }}
                    >
                      <Row justify="space-between" align="center">
                        <Col style={{ flex: 1 }}>
                          <Row align="center" gap={6}>
                            <Txt size={13} weight="800" color={Colors.textPrimary}>{g.name}</Txt>
                            <View style={styles.roomPill}>
                              <Txt size={9} weight="800" color={Colors.primaryDark}>Room {g.roomNo}</Txt>
                            </View>
                          </Row>
                          <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>
                            Phone: {g.phone || 'N/A'} • Due since 1st
                          </Txt>
                        </Col>
                        <Col align="flex-end">
                          <Txt size={14} weight="900" color="#B45309">₹{Math.round(g.rentAmount || 6500)}</Txt>
                          <Row gap={6} style={{ marginTop: 4 }}>
                            {g.phone ? (
                              <IconBtn
                                onPress={() => Linking.openURL(`tel:${g.phone.replace(/\s+/g, '')}`)}
                                icon="call"
                                size={14}
                                tint={Colors.primary}
                                containerColor="#F0FDF9"
                              />
                            ) : null}
                          </Row>
                        </Col>
                      </Row>
                    </Card>
                  ))
                )}
              </ScrollView>

              <Spacer size={14} />

              <Row gap={8}>
                <Btn
                  onPress={async () => {
                    await usePGowStore.getState().dispatchAutomatedRentAlerts();
                    setShowOverdueModal(false);
                    usePGowStore.getState().set('activeAlert', {
                      title: '🔔 Reminders Dispatched',
                      description: `Sent payment notices to all ${overdueCount} overdue residents.`,
                      type: 'SUCCESS',
                      timestamp: Date.now(),
                    });
                  }}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={12}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textInverse}>⚡ Remind All Unpaid</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => { setShowOverdueModal(false); setActiveTab(1); }}
                  borderColor={Colors.borderSubtle}
                  textColor={Colors.textPrimary}
                  borderRadius={12}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textPrimary}>Open Ledger ›</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
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
  teaserCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadiusCard,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadiusCard,
    padding: 18,
    // Mint-glow shadow
    shadowColor: Layout.shadowHero.shadowColor as any,
    shadowOffset: Layout.shadowHero.shadowOffset as any,
    shadowOpacity: Layout.shadowHero.shadowOpacity,
    shadowRadius: Layout.shadowHero.shadowRadius,
    elevation: Layout.shadowHero.elevation,
  },
  heroStat: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  feedDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 4,
  },
  dockWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    shadowColor: Layout.shadowFloatingBar.shadowColor as any,
    shadowOffset: Layout.shadowFloatingBar.shadowOffset as any,
    shadowOpacity: Layout.shadowFloatingBar.shadowOpacity,
    shadowRadius: Layout.shadowFloatingBar.shadowRadius,
    elevation: Layout.shadowFloatingBar.elevation,
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16, padding: 4, gap: 2,
  },
  dockBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
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
  modalIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  roomPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: '#F0FDF9',
  },
});
