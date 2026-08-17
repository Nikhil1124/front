/**
 * Owner/Manager "Overview" tab — the light hub: portfolio teaser, hero savings card,
 * quick-action tile grid, recent activity. Every tile that needs more room than a tile can
 * afford pushes its own dedicated screen instead of cramming into this scroll.
 */
import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer, Btn, OutlinedBtn, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect } from '@/utils/haptics';
import { useMealSavings } from '@/features/meals/useMealSavings';
import { usePortfolioTeaser } from '@/features/properties/usePortfolio';
import type { AppScreen } from '@/types';

interface ActionTile {
  screen?: AppScreen;
  action?: 'NOTICES';
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}

// Procurement dropped from both tile lists — OWNER_SERVICES already carries a "Procurement"
// entry point (see OwnerServicesTab), so this was a duplicate destination, not a second
// feature. Staff & Shifts (attendance) dropped too: the backend has no attendance endpoints
// yet, so the tile was a dead end.
const OWNER_TILES: ActionTile[] = [
  { screen: 'PNL_ANALYTICS',       label: 'P&L Analytics',     desc: '3m / 6m / 1y', icon: 'stats-chart',  tint: '#0D9488' },
  { screen: 'GROCERIES_SCREEN',    label: 'Groceries',          desc: 'Kitchen & PG supplies', icon: 'nutrition', tint: '#15803D' },
  { screen: 'UPI_SETTINGS',        label: 'UPI Settings',       desc: 'Rent collection handles', icon: 'card', tint: '#0284C7' },
  { screen: 'OWNER_SERVICES',      label: 'Services',           desc: 'Grocery & repairs', icon: 'storefront', tint: '#9333EA' },
];

const MANAGER_TILES: ActionTile[] = [
  { screen: 'BED_VISUALIZER',      label: 'Bed Layout',         desc: 'Floor → room → bed', icon: 'bed',            tint: '#0D9488' },
  { screen: 'TENANT_LIST',         label: 'Tenant Mgmt',        desc: 'KYC decisions', icon: 'people',           tint: '#0F766E' },
  { screen: 'GROCERIES_SCREEN',    label: 'Groceries',          desc: 'Kitchen & PG supplies', icon: 'nutrition', tint: '#15803D' },
  { action: 'NOTICES',             label: 'Rent Reminders',     desc: 'WhatsApp / SMS', icon: 'notifications', tint: '#D97706' },
  { screen: 'UPI_SETTINGS',        label: 'UPI Settings',       desc: 'Rent collection handles', icon: 'card', tint: '#0284C7' },
  { screen: 'HOUSEKEEPING_DASHBOARD', label: 'Housekeeping',    desc: 'Daily queue', icon: 'sparkles',         tint: '#E11D48' },
  { screen: 'OWNER_SERVICES',      label: 'Services',           desc: 'Grocery & repairs', icon: 'storefront', tint: '#9333EA' },
];

/** AppScreen values (old screenStack) → their new route paths. Every screen this tile grid
 *  can still reach has a route by this point in the migration. */
const SCREEN_ROUTES: Partial<Record<AppScreen, string>> = {
  PNL_ANALYTICS: '/pnl-analytics',
  GROCERIES_SCREEN: '/groceries',
  UPI_SETTINGS: '/upi-settings',
  OWNER_SERVICES: '/services',
  BED_VISUALIZER: '/bed-visualizer',
  TENANT_LIST: '/tenant-list',
  HOUSEKEEPING_DASHBOARD: '/housekeeping',
};

export default function OwnerOverviewTab() {
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManager = usePGowStore((s) => s.isManagerMode);
  const allPGs = usePGowStore((s) => s.allPGsState);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  const guests = usePGowStore((s) => s.currentGuests);

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

  const handleTilePress = (tile: ActionTile) => {
    hapticSelect();
    if (tile.action === 'NOTICES') {
      router.push('/notices');
      return;
    }
    const route = tile.screen ? SCREEN_ROUTES[tile.screen] : undefined;
    if (route) router.push(route as any);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        {/* Portfolio teaser — one compact row, never the full breakdown. The
            stat grid and per-property chart live on their own screen (PORTFOLIO)
            so this hub's length never grows with how many PGs the owner has. */}
        {showPortfolio && (
          <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => router.push('/portfolio')}>
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
                  <Ionicons name={tile.icon} size={20} color={tile.tint} />
                </View>
                <Txt size={13} weight="800" color={Colors.textPrimary} style={{ marginTop: 10 }}>{tile.label}</Txt>
                <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }}>{tile.desc}</Txt>
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
                    <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{n.message}</Txt>
                  </Col>
                </Row>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

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
                          <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }}>
                            Phone: {g.phone || 'N/A'} • Due since 1st
                          </Txt>
                        </Col>
                        <Col align="flex-end">
                          <Txt size={14} weight="900" color="#B45309">
                            {g.rentAmount ? `₹${Math.round(g.rentAmount)}` : '—'}
                          </Txt>
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
                  onPress={() => { setShowOverdueModal(false); router.push('/guests'); }}
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
    </>
  );
}

const styles = StyleSheet.create({
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
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
