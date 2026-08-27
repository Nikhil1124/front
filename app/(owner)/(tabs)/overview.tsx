/**
 * Owner/Manager "Overview" tab — premium redesign.
 * Compact header · green hero savings card · 2-col quick-action grid ·
 * property overview strip · recent activity. All existing functionality preserved.
 */
import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Text,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Row, Col, Spacer, Btn, OutlinedBtn, IconBtn, LoadingState, ErrorState } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect } from '@/utils/haptics';
import { useMealSavings } from '@/features/meals/useMealSavings';
import { usePortfolioTeaser } from '@/features/properties/usePortfolio';
import type { AppScreen } from '@/types';
import { todayLocalISO } from '@/utils/format';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GREEN    = '#176B3A';
const BG       = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED    = '#68736C';
const BORDER   = '#DDE8DE';
const WHITE    = '#FFFFFF';

interface ActionTile {
  screen?: AppScreen;
  action?: 'NOTICES';
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Restricted by the SERVER, not by preference — see the note on ACTION_TILES. */
  ownerOnly?: boolean;
}

/**
 * One list for owners and managers.
 *
 * There used to be two, and the split followed no permission the server actually enforces:
 * managers got Bed Layout, Tenant Mgmt and Rent Reminders while owners did not, and owners
 * got P&L while managers did not. Checked against the backend — `pnl`, `billing`,
 * `procurement`, guests, staff and requests are ALL `require_manage`, which means owner *and*
 * manager. So an owner could not reach their own bed layout, and a manager could not see the
 * P&L for the property they run, for no reason but this array.
 *
 * `ownerOnly` marks the few things the server really does restrict: UPI accounts are
 * `has_role_at(pg_id, OWNER)` server-side, so showing that tile to a manager would hand them
 * a 404 rather than a feature.
 */
const ACTION_TILES: ActionTile[] = [
  { screen: 'PNL_ANALYTICS',    label: 'P&L Analytics',  desc: '3m / 6m / 1y',               icon: 'stats-chart-outline' },
  { screen: 'BED_VISUALIZER',   label: 'Bed Layout',     desc: 'Floor → room → bed',         icon: 'bed-outline' },
  { screen: 'TENANT_LIST',      label: 'Tenant Mgmt',    desc: 'KYC decisions',              icon: 'people-outline' },
  { screen: 'GROCERIES_SCREEN', label: 'Groceries',      desc: 'Kitchen & PG supplies',      icon: 'nutrition-outline' },
  { screen: 'PROCUREMENT_SCREEN', label: 'Procurement',    desc: 'Stock requests & approvals', icon: 'cube-outline' },
  { action: 'NOTICES',          label: 'Rent Reminders', desc: 'WhatsApp / SMS',             icon: 'notifications-outline' },
  { screen: 'OWNER_SERVICES',   label: 'Services',       desc: 'Groceries & repairs',        icon: 'storefront-outline' },
  { screen: 'UPI_SETTINGS',     label: 'UPI Settings',   desc: 'Rent collection & payments', icon: 'card-outline', ownerOnly: true },
];

const SCREEN_ROUTES: Partial<Record<AppScreen, string>> = {
  PNL_ANALYTICS:    '/pnl-analytics',
  GROCERIES_SCREEN: '/groceries',
  UPI_SETTINGS:     '/upi-settings',
  OWNER_SERVICES:   '/services',
  BED_VISUALIZER:   '/bed-visualizer',
  TENANT_LIST:      '/tenant-list',
  PROCUREMENT_SCREEN: '/procurement',
};

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { isRequestOpen } from '@/data/mappers';

export default function OwnerOverviewTab() {
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [], isLoading: feedLoading, error: feedError, refetch: refetchFeed } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { data: complaints = [] } = useComplaintsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = useIsManagerMode();
  const user = useAuthStore((s) => s.user);
  const hasNoMemberships = !user || (user.memberships.length === 0);

  const now        = new Date();
  // `todayLocalISO`, not `toISOString().slice(0, 10)`. The latter converts local midnight to
  // UTC first, so east of Greenwich the 1st of the month comes out as the last day of the
  // PREVIOUS month (IST: 2026-08-01 → "2026-07-31"), quietly folding a day that belongs to
  // last month into this month's savings — and monthEnd lost a day before 05:30 IST too.
  const monthStart = todayLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd   = todayLocalISO(now);
  const { data: mealSavings } = useMealSavings(owner?.id ?? null, monthStart, monthEnd);
  const savedThisMonth   = mealSavings?.total_saved ?? 0;
  const skippedPortions  = mealSavings?.total_skipped_portions ?? 0;

  const overdueCount  = guests.filter(g => !g.isBillPaid).length;
  const overdueAmount = guests
    .filter(g => !g.isBillPaid)
    .reduce((s, g) => s + (g.rentAmount ?? 0), 0);
  const openRequests  = complaints.filter(c => isRequestOpen(c.status)).length;
  // Was `guests.length` rendered as "—/{totalBeds}": an em-dash numerator that was never
  // computed, over a denominator that counted residents rather than beds. The property
  // carries its own bed count.
  const occupiedBeds  = guests.length;
  const totalBeds     = owner?.totalBeds ?? 0;
  const recentFeed    = roleNotifs.slice(0, 3);

  const showPortfolio = !isManager && allPGs.length > 1;
  const { data: portfolio } = usePortfolioTeaser(showPortfolio ? allPGs : []);
  const tiles = isManager ? ACTION_TILES.filter((t) => !t.ownerOnly) : ACTION_TILES;

  const handleTilePress = (tile: ActionTile) => {
    hapticSelect();
    if (tile.action === 'NOTICES') { router.push('/notices'); return; }
    const route = tile.screen ? SCREEN_ROUTES[tile.screen] : undefined;
    if (route) router.push(route as any);
  };

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {hasNoMemberships ? (
          <Card
            containerColor={WHITE}
            borderRadius={20}
            borderWidth={1}
            borderColor={BORDER}
            padding={[24, 20]}
            style={{
              shadowColor: GREEN,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
              marginTop: 16
            }}
          >
            <View style={styles.tileIconBox}>
              <Ionicons name="business" size={24} color={GREEN} />
            </View>
            <Spacer size={16} />
            <Text style={{ fontSize: 20, fontWeight: '900', color: CHARCOAL }}>Get Started</Text>
            <Spacer size={8} />
            <Text style={{ color: MUTED, fontSize: 14, lineHeight: 20 }}>
              Welcome to PGow! You haven't added any PG properties to your account yet. Add your first property to start managing staff, rooms, and payments.
            </Text>
            <Spacer size={20} />
            <Btn
              onPress={() => { hapticSelect(); router.push('/manage-properties'); }}
              containerColor={GREEN}
              textColor={WHITE}
              borderRadius={12}
              height={48}
            >
              <Row align="center" gap={6}>
                <Ionicons name="add-circle" size={18} color={WHITE} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: WHITE }}>Add First Property</Text>
              </Row>
            </Btn>
          </Card>
        ) : (
          <>
            {/* ── Portfolio teaser (multi-PG owners only) ───────────────────── */}
            {showPortfolio && (
              <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => router.push('/portfolio')}>
                <View style={styles.teaserCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teaserLabel}>
                      PORTFOLIO · {allPGs.length} PROPERTIES
                    </Text>
                    <Text style={styles.teaserValue}>
                      {portfolio
                        ? `₹${Math.round(portfolio.totalCollected).toLocaleString('en-IN')} collected this cycle`
                        : 'View totals across every property'}
                    </Text>
                  </View>
                  <Row gap={2} align="center">
                    <Text style={styles.teaserLink}>View all</Text>
                    <Ionicons name="chevron-forward" size={13} color={GREEN} />
                  </Row>
                </View>
              </AnimatedPress>
            )}

            {/* ── Hero: Saved This Month ────────────────────────────────────── */}
            <View style={styles.heroCard}>
              {/* Top row: label + wallet icon */}
              <Row justify="space-between" align="center">
                <Text style={styles.heroLabel}>SAVED THIS MONTH</Text>
                <View style={styles.heroIconCircle}>
                  <Ionicons name="wallet" size={20} color={WHITE} />
                </View>
              </Row>

              {/* Big number */}
              <Text style={styles.heroAmount}>
                ₹{savedThisMonth.toLocaleString('en-IN')}
              </Text>

              {/* Portions skipped */}
              <Row gap={5} align="center" style={{ marginTop: 6 }}>
                <Ionicons name="leaf" size={13} color="rgba(255,255,255,0.80)" />
                <Text style={styles.heroSub}>
                  {skippedPortions} portions skipped via broadcast
                </Text>
              </Row>

              {/* Divider */}
              <View style={styles.heroDivider} />

              {/* Overdue pill */}
              <TouchableOpacity
                style={styles.overduePill}
                onPress={() => { hapticSelect(); setShowOverdueModal(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={13} color={WHITE} />
                <Text style={styles.overdueText}>{overdueCount} overdue ›</Text>
              </TouchableOpacity>
            </View>

            {/* ── Quick Actions ─────────────────────────────────────────────── */}
            <Row justify="space-between" align="center" style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Row gap={2} align="center">
                  <Text style={styles.viewAll}>View all</Text>
                  <Ionicons name="chevron-forward" size={13} color={GREEN} />
                </Row>
              </TouchableOpacity>
            </Row>

            <View style={styles.tileGrid}>
              {tiles.map(tile => (
                <AnimatedPress
                  key={tile.label}
                  scale={0.96}
                  hapticPattern="light"
                  onPress={() => handleTilePress(tile)}
                  style={styles.tileWrap}
                >
                  <View style={styles.tileCard}>
                    {/* Icon */}
                    <View style={styles.tileIconBox}>
                      <Ionicons name={tile.icon} size={22} color={GREEN} />
                    </View>
                    {/* Text */}
                    <View style={{ flex: 1, marginTop: 12 }}>
                      <Text style={styles.tileLabel}>{tile.label}</Text>
                      <Text style={styles.tileDesc}>{tile.desc}</Text>
                    </View>
                    {/* Arrow */}
                    <View style={styles.tileArrow}>
                      <Ionicons name="chevron-forward" size={14} color={GREEN} />
                    </View>
                  </View>
                </AnimatedPress>
              ))}
            </View>

            {/* ── Property Overview ─────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Property Overview</Text>
            <View style={styles.overviewStrip}>
              {/* Occupancy */}
              <View style={styles.overviewCell}>
                <Ionicons name="bed-outline" size={18} color={GREEN} />
                <Text style={styles.overviewValue}>{totalBeds > 0 ? `${occupiedBeds}/${totalBeds}` : occupiedBeds}</Text>
                <Text style={styles.overviewLabel}>Occupancy</Text>
                <Text style={styles.overviewSub}>beds</Text>
              </View>
              <View style={styles.overviewDivider} />
              {/* Pending Payments */}
              <View style={styles.overviewCell}>
                <Ionicons name="cash-outline" size={18} color={GREEN} />
                <Text style={styles.overviewValue}>
                  ₹{overdueAmount > 0 ? Math.round(overdueAmount).toLocaleString('en-IN') : '0'}
                </Text>
                <Text style={styles.overviewLabel}>Pending</Text>
                <Text style={styles.overviewSub}>payments</Text>
              </View>
              <View style={styles.overviewDivider} />
              {/* Open Requests */}
              <View style={styles.overviewCell}>
                <Ionicons name="alert-circle-outline" size={18} color={GREEN} />
                <Text style={styles.overviewValue}>{openRequests}</Text>
                <Text style={styles.overviewLabel}>Open</Text>
                <Text style={styles.overviewSub}>requests</Text>
              </View>
            </View>

            {/* ── Recent Activity ───────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Recent Activity</Text>
            <View style={styles.activityCard}>
              {feedLoading ? (
                <LoadingState label="Loading activity…" fill={false} />
              ) : feedError ? (
                <ErrorState error={feedError} title="Could not load recent activity" onRetry={refetchFeed} fill={false} />
              ) : recentFeed.length === 0 ? (
                <Row gap={10} align="center">
                  <View style={styles.activityCheckCircle}>
                    <Ionicons name="checkmark" size={14} color={GREEN} />
                  </View>
                  <View>
                    <Text style={styles.activityEmpty}>All caught up!</Text>
                    <Text style={styles.activityEmptySub}>No recent activity to show.</Text>
                  </View>
                </Row>
              ) : (
                <View style={{ gap: 12 }}>
                  {recentFeed.map((n, i) => (
                    <View key={n.id}>
                      <Row gap={10} align="flex-start">
                        <View style={[styles.feedDot, {
                          backgroundColor:
                            (n.category ?? '').toUpperCase().includes('PAYMENT') ? Colors.success :
                            (n.category ?? '').toUpperCase().includes('KYC') ? Colors.warning :
                            (n.priority ?? '').toUpperCase() === 'HIGH' ? Colors.danger :
                            GREEN,
                        }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.feedTitle}>{n.title}</Text>
                          <Text style={styles.feedSub}>{n.message}</Text>
                        </View>
                      </Row>
                      {i < recentFeed.length - 1 && <View style={styles.feedDivider} />}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>

      {/* ── Overdue Detail Modal ──────────────────────────────────────────── */}
      {showOverdueModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowOverdueModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOverdueModal(false)} />
            <View style={styles.modalCard}>
              <Row justify="space-between" align="center">
                <Row gap={10} align="center">
                  <View style={styles.modalIconBox}>
                    <Ionicons name="alert-circle" size={20} color="#D97706" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Pending Rent Dues</Text>
                    <Text style={styles.modalSub}>
                      {overdueCount} Unpaid Resident{overdueCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Row>
                <TouchableOpacity onPress={() => setShowOverdueModal(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={MUTED} />
                </TouchableOpacity>
              </Row>

              <View style={styles.modalDivider} />

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                {guests.filter(g => !g.isBillPaid).length === 0 ? (
                  <View style={styles.allPaidBox}>
                    <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
                    <Text style={styles.allPaidTitle}>All Rent Collected!</Text>
                    <Text style={styles.allPaidSub}>Zero overdue residents in this property.</Text>
                  </View>
                ) : (
                  guests.filter(g => !g.isBillPaid).map(g => (
                    <View key={g.id} style={styles.overdueRow}>
                      <View style={{ flex: 1 }}>
                        <Row gap={8} align="center">
                          <Text style={styles.overdueGuestName}>{g.name}</Text>
                          <View style={styles.roomPill}>
                            <Text style={styles.roomPillText}>Room {g.roomNo}</Text>
                          </View>
                        </Row>
                        <Text style={styles.overdueGuestSub}>
                          {g.phone || 'No phone'} · Due since 1st
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.overdueAmount}>
                          {g.rentAmount ? `₹${Math.round(g.rentAmount)}` : '—'}
                        </Text>
                        {g.phone && (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${g.phone.replace(/\s+/g, '')}`)}
                            style={styles.callBtn}
                          >
                            <Ionicons name="call" size={13} color={GREEN} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.modalDivider} />
              <Row gap={10}>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, { flex: 1 }]}
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
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalPrimaryBtnText}>⚡ Remind All Unpaid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, { flex: 1 }]}
                  onPress={() => { setShowOverdueModal(false); router.push('/guests'); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSecondaryBtnText}>Open Ledger ›</Text>
                </TouchableOpacity>
              </Row>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 0 },

  // Portfolio teaser
  teaserCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 14,
  },
  teaserLabel: { fontSize: 10, fontWeight: '700', color: MUTED, letterSpacing: 0.6, marginBottom: 2 },
  teaserValue: { fontSize: 13, fontWeight: '600', color: CHARCOAL },
  teaserLink:  { fontSize: 12, fontWeight: '700', color: GREEN },

  // Hero card
  heroCard: {
    backgroundColor: GREEN,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  heroLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.6,
  },
  heroIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAmount: {
    fontSize: 42, fontWeight: '900', color: WHITE,
    letterSpacing: -1, marginTop: 4,
  },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.80)' },
  heroDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 14,
  },
  overduePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
  },
  overdueText: { fontSize: 13, fontWeight: '800', color: WHITE },

  // Section headers
  sectionHeader: { marginBottom: 12 },
  sectionTitle:  { fontSize: 17, fontWeight: '700', color: CHARCOAL },
  viewAll:       { fontSize: 13, fontWeight: '700', color: GREEN },

  // Tile grid
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginBottom: 24,
  },
  tileWrap: { width: '48%' },
  tileCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    minHeight: 130,
  },
  tileIconBox: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: '#EAF5EE',
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginBottom: 2 },
  tileDesc:  { fontSize: 12, color: MUTED },
  tileArrow: {
    position: 'absolute', bottom: 14, right: 14,
  },

  // Property overview strip
  overviewStrip: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    paddingVertical: 16,
    marginBottom: 24,
  },
  overviewCell: {
    flex: 1, alignItems: 'center',
  },
  overviewDivider: {
    width: 1, backgroundColor: BORDER,
  },
  overviewValue: { fontSize: 20, fontWeight: '800', color: CHARCOAL, marginTop: 8 },
  overviewLabel: { fontSize: 12, fontWeight: '600', color: MUTED, marginTop: 2 },
  overviewSub:   { fontSize: 11, color: MUTED },

  // Activity card
  activityCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  activityCheckCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#EAF5EE',
    alignItems: 'center', justifyContent: 'center',
  },
  activityEmpty:    { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  activityEmptySub: { fontSize: 12, color: MUTED, marginTop: 1 },
  feedDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  feedTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  feedSub:   { fontSize: 12, color: MUTED, marginTop: 1 },
  feedDivider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.50)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    width: '92%', maxHeight: '84%',
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 20,
    zIndex: 2,
  },
  modalIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: CHARCOAL },
  modalSub:   { fontSize: 12, color: MUTED },
  modalDivider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F2F5F2',
    alignItems: 'center', justifyContent: 'center',
  },
  allPaidBox: {
    alignItems: 'center', padding: 24,
    backgroundColor: '#F0FDF4', borderRadius: 14, marginBottom: 8,
  },
  allPaidTitle: { fontSize: 14, fontWeight: '800', color: '#166534', marginTop: 8 },
  allPaidSub:   { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  overdueGuestName: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  overdueGuestSub:  { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueAmount: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  callBtn: {
    marginTop: 4, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EAF5EE', alignItems: 'center', justifyContent: 'center',
  },
  roomPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: '#EAF5EE',
  },
  roomPillText: { fontSize: 10, fontWeight: '700', color: GREEN },
  modalPrimaryBtn: {
    height: 46, backgroundColor: GREEN,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  modalPrimaryBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
  modalSecondaryBtn: {
    height: 46,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  modalSecondaryBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
});
