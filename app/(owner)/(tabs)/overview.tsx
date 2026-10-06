/**
 * Owner Overview Dashboard.
 *
 * The dashboard carousel — an auto-scrolling ScrollView cycling Property Hero / Revenue /
 * Food Savings every 4 seconds, with the first card duplicated at the end to fake an
 * infinite loop — is gone. It hid the revenue trend and the food-savings number behind a
 * timer no one asked for, on the one screen where "show everything, hide nothing behind a
 * gesture" matters most: this is a triage screen, opened to see what needs attention, not a
 * carousel to sit and watch. Replaced by `MetricDeck` (still swipeable, but only when the
 * owner swipes) and a full-bleed `TrendChart`. The maintenance donut is gone too — a split
 * bar plus its own rows, same reasoning as the maintenance section on `TenantListScreen`.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Text,
  Image
} from 'react-native';

// UIManager.setLayoutAnimationEnabledExperimental is a no-op in New Architecture
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card, Row, Col, Spacer, Btn, toneFor, ListRow, ListSectionHeader, MetricRow, Sheet,
  MetricDeck, TrendChart, type DeckCardData, type TrendChartPoint, type TrendChartSeries,
} from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Palette, Radii, Motion } from '@/theme';
import { periodToMonthYear } from '@/data/mappers';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useSendRentRemindersMutation, type RentReminderResult } from '@/features/payments/usePayments';

/** Three numbers, because "0 sent" alone cannot tell an owner whether everybody paid or
 *  everybody was already reminded an hour ago. */
function rentReminderAlert(result: RentReminderResult) {
  const description =
    result.reminded > 0
      ? `${result.reminded} resident(s) reminded.`
      + (result.already_paid ? ` ${result.already_paid} already paid.` : '')
      + (result.on_cooldown ? ` ${result.on_cooldown} reminded recently.` : '')
      : result.on_cooldown > 0
        ? `Everyone who owes rent was already reminded in the last day — nothing sent.`
        : "Every resident has cleared this month's rent. Nothing to send.";
  return { title: result.reminded > 0 ? '📤 REMINDERS SENT' : '✅ NOTHING TO SEND', description };
}
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { usePnL } from '@/features/billing/usePnL';
import { useMealSavings } from '@/features/meals/useMealSavings';
import { todayLocalISO, formatTimeAgo, formatINR } from '@/utils/format';
import { BookRepairDialog } from '@/components/dialogs/HubDialogs';
import { useResponsivePadding } from '@/utils/responsive';
import { useDockScroll } from '@/components/HeadlessDockTabButton';

// ── Redesign Theme Colors ───────────────────────────────────────────────────
const PRIMARY = Colors.primary;
const SECONDARY_BG = Colors.surfaceElevated;
const BG = Colors.canvas;
const CHARCOAL = Colors.textPrimary;
const MUTED = Colors.textMuted;
const BORDER = Colors.borderSubtle;
const WHITE = Colors.surface;

// Status colors
const SUCCESS = Colors.success;
const WARNING = Colors.warning;
const DANGER = Colors.danger;

/** Matches what `String(n)` produced before, so only the motion changed, not the text. */
const countFormat = (n: number) => String(Math.round(n));

/**
 * One coloured span of the maintenance proportion bar.
 *
 * A plain `<View style={{ flex: n }}>` does not animate — flex changes land in a single frame
 * — so the whole bar used to jump on every refresh while the deck above it counted smoothly.
 * `flexGrow` is animatable through Reanimated, which is the one thing needed to make the
 * split move rather than cut.
 */
function SplitSegment({ value, color }: { value: number; color: string }) {
  const grow = useSharedValue(Math.max(value, 0.0001));
  useEffect(() => {
    grow.value = withTiming(Math.max(value, 0.0001), { duration: Motion.timing.chart });
  }, [value, grow]);
  const style = useAnimatedStyle(() => ({ flexGrow: grow.value, flexBasis: 0 }));
  return <Animated.View style={[{ backgroundColor: color }, style]} />;
}

interface QuickActionItem {
  label: string;
  image?: any; // e.g., require('@/assets/images/icon.png')
  onPress: () => void;
  color: string;
}

export default function OwnerOverviewTab() {
  const dockScroll = useDockScroll();
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showBookRepair, setShowBookRepair] = useState(false);
  const [showAllActionsSheet, setShowAllActionsSheet] = useState(false);
  // Fixed at 3 months — the interval selector this fed lived on the dashboard's own Revenue
  // Overview card, which is gone; P&L Analytics one tap away is the dedicated place to look
  // at 6m/1y, with its own selector.
  const pnlInterval = '3m';
  const responsivePadding = useResponsivePadding();

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [], refetch: refetchPGs, error: pgsError } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [], refetch: refetchNotifs } = useRoleNotificationsQuery(activePgId ?? undefined);
  const {
    data: guests = [],
    refetch: refetchGuests,
    error: guestsError,
    isLoading: guestsLoading } = useGuestsQuery(activePgId ?? undefined);
  const { data: complaints = [], refetch: refetchComplaints } = useComplaintsQuery(activePgId ?? undefined);


  const user = useAuthStore((s) => s.user);
  const hasNoMemberships = !user || (user.memberships.length === 0);

  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  // Derived, not a login-time snapshot — see useIsManagerMode.
  const isManager = useIsManagerMode();

  // Dynamic calculations
  const occupiedCount = guests.length;
  // `?? 60` and a `: 85` occupancy fallback used to sit here. Both printed a confident,
  // specific, invented number on the dashboard whenever the property's real bed count
  // hadn't loaded — 85% occupancy for a PG nobody had measured. Unknown capacity now
  // reads as 0/— rather than as a plausible-looking figure.
  const capacity = owner?.totalBeds ?? 0;
  const availableCount = Math.max(0, capacity - occupiedCount);
  const occupancyPercent = capacity > 0 ? Math.round((occupiedCount / capacity) * 100) : 0;

  const overdueCount = guests.filter(g => !g.isBillPaid).length;
  const overdueAmount = guests
    .filter(g => !g.isBillPaid)
    .reduce((s, g) => s + (g.rentAmount ?? 0), 0);
  const openRequests = complaints.filter(c => c.status !== 'Resolved').length;
  const recentFeed = roleNotifs.slice(0, 4);

  // Fetch P&L data
  const { data: pnlData } = usePnL(activePgId, pnlInterval);
  const sendRentRemindersMutation = useSendRentRemindersMutation(activePgId ?? undefined);

  // Fetch Food Savings data
  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date();
    return {
      monthStart: todayLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      monthEnd: todayLocalISO(now)
    };
  }, []);
  const { data: savingsData } = useMealSavings(activePgId, monthStart, monthEnd);

  // A dashboard is the first thing anyone pulls down on, and this one had no way to refresh
  // short of leaving the tab and coming back. Refetches the four queries the tiles are
  // actually built from; the derived ones (P&L, savings, layout) follow their own keys.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([refetchPGs(), refetchNotifs(), refetchGuests(), refetchComplaints()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchPGs, refetchNotifs, refetchGuests, refetchComplaints]);

  // The tiles default to 0 on a failed fetch, which reads as "you have no residents and no
  // revenue" rather than "this didn't load" — the banner below is what tells them apart.
  const coreLoadFailed = !!(pgsError || guestsError);
  // First load only — `isLoading` is false on every refetch, so the tiles keep their last
  // values during a pull-to-refresh instead of flashing back to a spinner.
  const showFirstLoad = guestsLoading && guests.length === 0 && !coreLoadFailed;

  // No fallback numbers here on purpose: an owner with a genuinely quiet mess (nobody has
  // skipped a meal this month) must see 0, not an invented ₹1,750 that looks like real
  // revenue they never earned.
  const totalSkippedPortions = savingsData?.total_skipped_portions ?? 0;
  const totalSavedAmount = savingsData?.total_saved ?? 0;
  const costPerPlate = savingsData?.cost_per_plate ?? 0;

  // Quick Action Grid Items — Cool LUNA Design System Icons
  const allQuickActions = useMemo(() => {
    // All items for the bottom sheet (Groceries, Services, Procurement are in the main grid, but we keep them here or omit them. Usually omit them from "All" if they are already visible, but user said "containing all the remainng actions" so we omit the main 3).
    const remaining: QuickActionItem[] = [
      { label: 'Residents', image: require('../../../assets/Quick Actions/Owner/08_residents.png'), color: Colors.primary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/guests'); } },
      { label: 'Add Room', image: require('../../../assets/Quick Actions/Owner/02_add_room.png'), color: Colors.secondary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/bed-visualizer'); } },
      { label: 'Ads', image: require('../../../assets/Quick Actions/Owner/03_ads.png'), color: Colors.primary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/manage-ad'); } },
      { label: 'Complaints', image: require('../../../assets/Quick Actions/Owner/04_complaints.png'), color: Colors.danger, onPress: () => { setShowAllActionsSheet(false); router.navigate('/complaints'); } },
      { label: 'Food RSVP', image: require('../../../assets/Quick Actions/Owner/05_food_rsvp.png'), color: Colors.textSecondary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/rsvp-trends'); } },
      { label: 'Managers', image: require('../../../assets/Quick Actions/Owner/06_managers.png'), color: Colors.primary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/manager-provisioning'); } },
      { label: 'Portfolio', image: require('../../../assets/Quick Actions/Owner/07_portfolio.png'), color: Colors.secondary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/portfolio'); } },
      { label: 'Reviews', image: require('../../../assets/Quick Actions/Owner/09_reviews.png'), color: Colors.warning, onPress: () => { setShowAllActionsSheet(false); router.navigate('/reviews'); } },
      { label: 'Settings', image: require('../../../assets/Quick Actions/Owner/10_settings.png'), color: Colors.primaryDark, onPress: () => { setShowAllActionsSheet(false); router.navigate('/settings'); } },
      { label: 'Staff', image: require('../../../assets/Quick Actions/Owner/11_staff.png'), color: Colors.primary, onPress: () => { setShowAllActionsSheet(false); router.navigate('/staff'); } },
      { label: 'Technicians', image: require('../../../assets/Quick Actions/Owner/13_add_more.png'), color: Colors.secondary, onPress: () => { setShowAllActionsSheet(false); setShowBookRepair(true); } },
      { label: 'UPI Setup', image: require('../../../assets/Quick Actions/Owner/12_upi_setup.png'), color: Colors.primaryDark, onPress: () => { setShowAllActionsSheet(false); router.navigate('/upi-settings'); } },
    ];

    if (!isManager) {
      remaining.push({ label: 'Add Property', image: require('../../../assets/Quick Actions/Owner/01_add_property.png'), color: Colors.primaryDark, onPress: () => { setShowAllActionsSheet(false); router.navigate('/manage-properties'); } });
    }

    remaining.sort((a, b) => a.label.localeCompare(b.label));

    return remaining;
  }, [isManager]);

  // Revenue by month, for the trend chart — self-measuring, so no chart-width math lives
  // here any more (the old area chart computed its own SVG path by hand).
  const monthlyRevenuePoints: TrendChartPoint[] = useMemo(
    () => (pnlData?.monthly ?? []).map((m) => ({
      label: periodToMonthYear(m.period).split(' ')[0],
      values: { revenue: m.revenue }
    })),
    [pnlData],
  );

  // The revenue figure and its month-over-month change, both real: the fixed "₹4,82,000 ↑
  // 12.4%" this card used to show never moved no matter what the property actually earned.
  const revenueTotal = pnlData?.totals.revenue ?? 0;
  const revenueGrowthPct = useMemo(() => {
    const m = pnlData?.monthly;
    if (!m || m.length < 2) return null;
    const prev = m[m.length - 2].revenue;
    const curr = m[m.length - 1].revenue;
    if (prev <= 0) return null;
    return ((curr - prev) / prev) * 100;
  }, [pnlData]);

  const revenueSeries: TrendChartSeries[] = [{ key: 'revenue', color: Colors.primary }];

  // Collected / residents / outstanding / open — the four numbers the old 2×2 grid and the
  // carousel's revenue slide showed separately. Same four roles the analytics screens use:
  // brand for the headline, green for money in, amber for a number worth a second look, slate
  // for a plain count.
  // `numericValue`/`format` alongside `value`: this is the app's landing screen and the one
  // most often pulled-to-refresh, so it's where a card counting up to its new figure instead
  // of snapping actually gets seen. `value` stays as the fallback for reduce-motion / SSR-ish
  // first paint — see CountUp and DeckCardData's own comments for why both are passed.
  const deckCards: DeckCardData[] = [
    {
      key: 'collected', tint: 'brand', label: 'Collected this cycle', value: formatINR(revenueTotal),
      numericValue: revenueTotal, format: formatINR,
      ...(revenueGrowthPct !== null && Math.abs(revenueGrowthPct) >= 0.5
        ? { delta: `${revenueGrowthPct >= 0 ? '↑' : '↓'} ${Math.abs(revenueGrowthPct).toFixed(1)}%`, deltaTone: (revenueGrowthPct >= 0 ? 'up' : 'down') as 'up' | 'down' }
        : {})
    },
    {
      key: 'residents', tint: 'green', label: 'Residents', value: String(occupiedCount),
      numericValue: occupiedCount, format: (n) => String(Math.round(n)),
      delta: `${occupancyPercent}% of ${capacity} beds`
    },
    {
      key: 'outstanding', tint: 'amber', label: 'Outstanding', value: formatINR(overdueAmount),
      numericValue: overdueAmount, format: formatINR,
      ...(overdueCount > 0 ? { delta: `${overdueCount} resident${overdueCount === 1 ? '' : 's'}`, deltaTone: 'down' as const } : {})
    },
    {
      key: 'requests', tint: 'slate', label: 'Open requests', value: String(openRequests),
      numericValue: openRequests, format: (n) => String(Math.round(n)),
      ...(openRequests > 0 ? { delta: 'Needs attention', deltaTone: 'down' as const } : { delta: 'All clear', deltaTone: 'up' as const })
    },
  ];

  // Donut Chart calculations. No fallback counts: a property with zero complaints is good
  // news, not a reason to draw 22 invented tickets on the owner's own dashboard.
  const totalTickets = complaints.length;
  const urgentCount = complaints.filter(c => c.status === 'Open').length;
  const progressCount = complaints.filter(c => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;


  // Recent Requests with categories mapping
  const recentRequests = useMemo(() => {
    return complaints.slice(0, 3).map(c => {
      let icon: keyof typeof Ionicons.glyphMap = 'construct-outline';
      if (c.title.toLowerCase().includes('ac') || c.title.toLowerCase().includes('cool')) icon = 'snow-outline';
      else if (c.title.toLowerCase().includes('light') || c.title.toLowerCase().includes('fuse')) icon = 'bulb-outline';
      else if (c.title.toLowerCase().includes('water') || c.title.toLowerCase().includes('leak')) icon = 'water-outline';
      return { ...c, icon };
    });
  }, [complaints]);



  return (
    <>
      <ScrollView
        {...dockScroll}
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: responsivePadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        canCancelContentTouches
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />
        }
      >
        {showFirstLoad && (
          <View style={styles.firstLoadBox}>
            <ActivityIndicator color={PRIMARY} />
            <Text maxFontSizeMultiplier={1.3} style={styles.firstLoadText}>Loading your dashboard…</Text>
          </View>
        )}

        {coreLoadFailed && (
          <AnimatedPress
            accessibilityRole="button"
            accessibilityLabel="Some data could not be loaded. Tap to retry."
            onPress={handleRefresh}
            style={styles.loadFailedBanner}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
            <Text maxFontSizeMultiplier={1.3} style={styles.loadFailedText} numberOfLines={2}>
              Some figures below couldn&apos;t be loaded, so they may read as zero. Tap to retry.
            </Text>
            <Ionicons name="refresh" size={16} color={Colors.danger} />
          </AnimatedPress>
        )}

        {hasNoMemberships ? (
          <Card
            containerColor={WHITE}
            borderRadius={Radii.sheet}
            borderWidth={0}
            padding={[24, 20]}
            style={styles.cardShadow}
          >
            <View style={[styles.tileIconBox, { backgroundColor: SECONDARY_BG }]}>
              <Ionicons name="business" size={24} color={PRIMARY} />
            </View>
            <Spacer size={16} />
            <Text maxFontSizeMultiplier={1.3} style={styles.noMembershipTitle}>Get Started</Text>
            <Spacer size={8} />
            <Text maxFontSizeMultiplier={1.3} style={styles.noMembershipDesc}>
              Welcome to PGow! Add your first PG property to start managing staff, rooms, and payments.
            </Text>
            <Spacer size={20} />
            <Btn
              onPress={() => { router.push('/manage-properties'); }}
              containerColor={PRIMARY}
              textColor={WHITE}
              borderRadius={Radii.card}
              height={48}
            >
              <Row align="center" gap={6}>
                <Ionicons name="add-circle" size={18} color={WHITE} />
                <Text maxFontSizeMultiplier={1.3} style={styles.btnText}>Add First Property</Text>
              </Row>
            </Btn>
          </Card>
        ) : (
          <>
            {/* ── Collected this cycle · residents · outstanding · open requests ── */}
            <MetricDeck cards={deckCards} sidePadding={responsivePadding} testID="overview_deck" />

            <Spacer size={20} />

            {monthlyRevenuePoints.length > 0 && (
              <>
                <ListSectionHeader title="Revenue, month by month" />
                <TrendChart data={monthlyRevenuePoints} series={revenueSeries} height={72} testID="overview_revenue_chart" />
                <Spacer size={20} />
              </>
            )}

            {/* Food savings — was a whole carousel slide with its own building photo, for
                three numbers. One row, same numbers, no picture of a plate standing in for
                data it isn't. */}
            <ListRow
              leading={<Ionicons name="fast-food-outline" size={17} color={Colors.primary} />}
              title="Food savings this month"
              meta={`${totalSkippedPortions} portion${totalSkippedPortions === 1 ? '' : 's'} skipped · ₹${costPerPlate} a plate`}
              amount={formatINR(totalSavedAmount)}
              onPress={() => router.push('/rsvp-trends')}
              first
              last
              testID="overview_food_savings"
            />

            <Spacer size={24} />


            {/* ── 3. Quick Actions ───────────────────────────────────────────── */}
            {(() => {
              // TODO: Add your custom image assets here for the main Bento Grid
              const servicesImage = require('../../../assets/Quick Actions/Owner/services.png');
              const procurementImage = require('../../../assets/Quick Actions/Owner/procurment.png');
              const groceriesImage = require('../../../assets/Quick Actions/Owner/grocery.png');
              const allServicesImage = require('../../../assets/Quick Actions/Owner/View all.png');

              return (
                <>
                  <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
                    <Row gap={6} align="center">
                      <Ionicons name="flash" size={16} color={Colors.primary} />
                      <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Quick Actions</Text>
                    </Row>
                  </Row>

                  <View style={styles.bentoGrid}>
                    {/* Left Column (2 Short Tiles) */}
                    <View style={styles.bentoCol}>
                      <AnimatedPress accessibilityRole="button" scale={0.96} onPress={() => router.navigate('/services')}
                        style={[styles.bentoTile, { backgroundColor: Palette.TintBlue, borderColor: Palette.TintBlue }]}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.bentoTileTitle}>Services</Text>
                        {servicesImage && <Image source={servicesImage} style={styles.bentoTileImageBg} />}
                      </AnimatedPress>

                      <AnimatedPress accessibilityRole="button" scale={0.96} onPress={() => router.navigate('/procurement')}
                        style={[styles.bentoTile, { backgroundColor: Palette.TintAmber, borderColor: Palette.TintAmber }]}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.bentoTileTitle}>Procurement</Text>
                        {procurementImage && <Image source={procurementImage} style={styles.bentoTileImageBg} />}
                      </AnimatedPress>
                    </View>

                    {/* Right Column (1 Tall Tile, 1 Short Tile) */}
                    <View style={styles.bentoCol}>
                      <AnimatedPress accessibilityRole="button" scale={0.96} onPress={() => router.navigate('/groceries')}
                        style={[styles.bentoTile, styles.bentoTileTall, { backgroundColor: Palette.TintGreen, borderColor: Palette.TintGreen }]}>
                        <View style={styles.bentoBadge}>
                          <Ionicons name="pricetag" size={10} color={SUCCESS} />
                          <Text maxFontSizeMultiplier={1.2} style={styles.bentoBadgeText}>Offers</Text>
                        </View>
                        <Text maxFontSizeMultiplier={1.3} style={styles.bentoTileTitleGroceries}>Groceries</Text>
                        <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4, width: '90%', zIndex: 10, lineHeight: 18 }}>
                          Your Daily Needs, Just a Tap Away.
                        </Text>
                        {groceriesImage && <Image source={groceriesImage} style={styles.bentoTileImageBg} />}
                        <View style={styles.bentoTileMask} />
                      </AnimatedPress>

                      <AnimatedPress accessibilityRole="button" scale={0.96} onPress={() => setShowAllActionsSheet(true)}
                        style={[styles.bentoTile, { backgroundColor: Colors.surfaceElevated }]}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.bentoTileTitleAll}>All Services</Text>
                        {allServicesImage && <Image source={allServicesImage} style={styles.bentoTileImageCorner} />}
                      </AnimatedPress>
                    </View>
                  </View>
                </>
              );
            })()}


            <Spacer size={24} />


            {/* ── Maintenance ── */}
            <ListSectionHeader title="Maintenance" count={totalTickets} />
            {totalTickets > 0 && (
              <>
                <View style={styles.splitBar}>
                  <SplitSegment value={resolvedCount} color={SUCCESS} />
                  <SplitSegment value={progressCount} color={WARNING} />
                  <SplitSegment value={urgentCount} color={DANGER} />
                </View>
                <Spacer size={12} />
              </>
            )}
            <View style={styles.rowGroup}>
              <MetricRow label="Resolved" value={String(resolvedCount)} numericValue={resolvedCount} format={countFormat} testID="overview_maint_resolved" />
              <MetricRow label="In progress" value={String(progressCount)} numericValue={progressCount} format={countFormat} testID="overview_maint_progress" />
              <MetricRow
                label="Open"
                value={String(urgentCount)}
                numericValue={urgentCount}
                format={countFormat}
                delta={urgentCount > 0 ? { label: 'Needs attention', tone: 'danger' } : undefined}
                onPress={() => router.push({ pathname: '/services', params: { tab: 'BOOKINGS' } })}
                last
                testID="overview_maint_open"
              />
            </View>

            <Spacer size={24} />

            {/* ── Recent requests ── */}
            <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
              <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Recent requests</Text>
              <AnimatedPress accessibilityRole="button" onPress={() => router.push('/complaints')}>
                <Text maxFontSizeMultiplier={1.3} style={styles.viewAllText}>View all →</Text>
              </AnimatedPress>
            </Row>

            {recentRequests.length === 0 ? (
              <View style={styles.emptyRequestsBox}>
                <Ionicons name="checkmark-circle-outline" size={28} color={SUCCESS} />
                <Text maxFontSizeMultiplier={1.3} style={styles.emptyRequestsText}>All requests resolved!</Text>
              </View>
            ) : (
              // `ListRow` bounds its own group via `first`/`last` — no wrapping border needed
              // here the way `MetricRow` above needs `rowGroup` (it has no boundary of its own).
              recentRequests.map((req, index) => (
                <ListRow
                  key={req.id}
                  leading={<Ionicons name={req.icon} size={17} color={Colors.primary} />}
                  title={req.title}
                  meta={`Room ${req.roomNo} · ${req.guestName}`}
                  status={{ label: req.status, tone: toneFor(req.status) }}
                  onPress={() => router.push('/complaints')}
                  first={index === 0}
                  last={index === recentRequests.length - 1}
                  testID={`overview_request_${req.id}`}
                />
              ))
            )}

            <Spacer size={24} />


            {/* ── 7. Recent Activity Timeline ────────────────────────────────── */}
            <Text maxFontSizeMultiplier={1.3} style={[styles.sectionHeading, styles.sectionHeaderRow]}>Recent Activity</Text>

            <Card
              containerColor={WHITE}
              borderRadius={Radii.sheet}
              borderWidth={0}
              padding={[16, 16]}
              style={styles.cardShadow}
            >
              {recentFeed.length === 0 ? (
                <Row gap={10} align="center">
                  <View style={styles.timelineEmptyDot} />
                  <Col>
                    <Text maxFontSizeMultiplier={1.3} style={styles.timelineEmptyTitle}>No recent activity</Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.timelineEmptySub}>Everything is clean and silent.</Text>
                  </Col>
                </Row>
              ) : (
                <View style={{ position: 'relative' }}>
                  {/* Vertical line indicator */}
                  <View style={styles.timelineVerticalLine} />

                  <Col gap={16}>
                    {recentFeed.map((feed) => {
                      const isPayment = (feed.category ?? '').toUpperCase().includes('PAYMENT');
                      const isKyc = (feed.category ?? '').toUpperCase().includes('KYC');
                      const isHigh = (feed.priority ?? '').toUpperCase() === 'HIGH';

                      let dotColor: string = PRIMARY;
                      let iconName: keyof typeof Ionicons.glyphMap = 'notifications';
                      if (isPayment) {
                        dotColor = SUCCESS;
                        iconName = 'wallet-outline';
                      } else if (isKyc) {
                        dotColor = WARNING;
                        iconName = 'shield-checkmark-outline';
                      } else if (isHigh) {
                        dotColor = DANGER;
                        iconName = 'alert-outline';
                      }

                      return (
                        <Row key={feed.id} gap={16} align="flex-start">
                          <View style={[styles.timelineNode, { backgroundColor: dotColor }]}>
                            <Ionicons name={iconName} size={13} color={WHITE} />
                          </View>
                          <Col style={{ flex: 1 }}>
                            <Row justify="space-between" align="center">
                              <Text maxFontSizeMultiplier={1.3} style={styles.timelineTitle}>{feed.title}</Text>
                              <Text maxFontSizeMultiplier={1.3} style={styles.timelineTime}>{formatTimeAgo(feed.timestamp)}</Text>
                            </Row>
                            <Spacer size={2} />
                            <Text maxFontSizeMultiplier={1.3} style={styles.timelineDesc}>{feed.message}</Text>
                          </Col>
                        </Row>
                      );
                    })}
                  </Col>
                </View>
              )}
            </Card>

            {/* ── 8. Important Notices ────────────────────────────────────────── */}
            <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
              <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Important Notices</Text>
              <AnimatedPress accessibilityRole="button" onPress={() => router.push('/notifications')}>
                <Text maxFontSizeMultiplier={1.3} style={styles.viewAllText}>View all →</Text>
              </AnimatedPress>
            </Row>

            {/* Featured rent reminder card */}
            <Card
              containerColor={Palette.TintBlue}
              borderRadius={Radii.sheet}
              borderWidth={0}
              padding={[20, 20]}
              style={styles.noticeHeroCard}
            >
              <AnimatedPress accessibilityRole="button"
                disabled={overdueCount === 0}
                onPress={() => setShowOverdueModal(true)}
              >
                <Row gap={14} align="center">
                  <View style={styles.noticeIconBox}>
                    <Ionicons name="notifications" size={24} color={PRIMARY} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={1.3} style={styles.noticeHeroTitle}>Rent collection reminder</Text>
                    <Spacer size={4} />
                    <Text maxFontSizeMultiplier={1.3} style={styles.noticeHeroDesc}>
                      {overdueCount > 0
                        ? `${overdueCount} resident${overdueCount === 1 ? '' : 's'} · ${formatINR(overdueAmount)} outstanding — tap to review.`
                        : 'No outstanding residents right now.'}
                    </Text>
                  </Col>
                  {overdueCount > 0 && <Ionicons name="chevron-forward" size={18} color={MUTED} />}
                </Row>
              </AnimatedPress>

              <Spacer size={16} />

              <AnimatedPress accessibilityRole="button"
                style={[styles.remindBtn, overdueCount === 0 && { opacity: 0.5 }]}
                disabled={overdueCount === 0}
                onPress={async () => {
                  try {
                    const result = await sendRentRemindersMutation.mutateAsync();
                    usePGowStore.getState().set('activeAlert', {
                      ...rentReminderAlert(result),
                      type: 'PAYMENT',
                      timestamp: Date.now()
                    });
                  } catch (err) {
                    usePGowStore.getState().set('activeAlert', {
                      title: '❌ REMINDERS NOT SENT',
                      description: err instanceof Error ? err.message : 'Nothing was sent. Try again.',
                      type: 'PAYMENT',
                      timestamp: Date.now()
                    });
                  }
                }}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.remindBtnText}>Send Reminder</Text>
              </AnimatedPress>
            </Card>

            <Spacer size={12} />

            {/* Quick notices list */}
            <Card
              containerColor={WHITE}
              borderRadius={Radii.card}
              borderWidth={0}
              padding={[16, 16]}
              style={styles.cardShadow}
            >
              <Row align="center" gap={12} style={{ paddingBottom: 12 }}>
                <View style={styles.noticeBulletDot} />
                <Text maxFontSizeMultiplier={1.3} style={styles.quickNoticeText}>
                  {overdueCount > 0
                    ? `${overdueCount} resident${overdueCount === 1 ? '' : 's'} · ${formatINR(overdueAmount)} outstanding.`
                    : 'No pending dues from verified residents.'}
                </Text>
              </Row>
              <View style={styles.dividerLine} />
              <Row align="center" gap={12} style={{ paddingTop: 12 }}>
                <View style={styles.noticeBulletDot} />
                <Text maxFontSizeMultiplier={1.3} style={styles.quickNoticeText}>
                  {availableCount} room{availableCount === 1 ? '' : 's'} vacant across your properties.
                </Text>
              </Row>
            </Card>

            {/* ── PGow Brand Footer ── */}
            <View style={styles.footerBrand}>
              <Ionicons name="leaf" size={28} color={PRIMARY} />
              <Text maxFontSizeMultiplier={1.3} style={styles.footerBrandTitle}>PGow Owner</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.footerBrandSub}>Smart Management • Effortless Growth</Text>
            </View>

          </>
        )}
      </ScrollView>

      {/* ── Overdue Detail Sheet ──────────────────────────────────────────── */}
      {showOverdueModal && (
        <Sheet
          visible={showOverdueModal}
          title="Pending Rent Dues"
          subtitle={`${overdueCount} Unpaid Resident${overdueCount === 1 ? '' : 's'}`}
          icon="alert-circle"
          accent={WARNING}
          onDismiss={() => setShowOverdueModal(false)}
          testID="owner-overdue-sheet"
          footer={
            <Row gap={10}>
              <AnimatedPress accessibilityRole="button"
                style={[styles.modalPrimaryBtn, { flex: 1 }]}
                onPress={async () => {
                  try {
                    const result = await sendRentRemindersMutation.mutateAsync();
                    setShowOverdueModal(false);
                    usePGowStore.getState().set('activeAlert', {
                      ...rentReminderAlert(result),
                      type: 'PAYMENT',
                      timestamp: Date.now()
                    });
                  } catch (err) {
                    usePGowStore.getState().set('activeAlert', {
                      title: '❌ REMINDERS NOT SENT',
                      description: err instanceof Error ? err.message : 'Nothing was sent. Try again.',
                      type: 'PAYMENT',
                      timestamp: Date.now()
                    });
                  }
                }}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.modalPrimaryBtnText}>⚡ Remind All Unpaid</Text>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button"
                style={[styles.modalSecondaryBtn, { flex: 1 }]}
                onPress={() => { setShowOverdueModal(false); router.push('/guests'); }}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.modalSecondaryBtnText}>Open Ledger ›</Text>
              </AnimatedPress>
            </Row>
          }
        >
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
            {guests.filter(g => !g.isBillPaid).length === 0 ? (
              <View style={styles.allPaidBox}>
                <Ionicons name="checkmark-circle" size={32} color={SUCCESS} />
                <Text maxFontSizeMultiplier={1.3} style={styles.allPaidTitle}>All Rent Collected!</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.allPaidSub}>Zero overdue residents in this property.</Text>
              </View>
            ) : (
              guests.filter(g => !g.isBillPaid).map(g => (
                <View key={g.id} style={styles.overdueRow}>
                  <View style={{ flex: 1 }}>
                    <Row gap={8} align="center">
                      <Text maxFontSizeMultiplier={1.3} style={styles.overdueGuestName}>{g.name}</Text>
                      <View style={styles.roomPill}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.roomPillText}>Room {g.roomNo}</Text>
                      </View>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.overdueGuestSub}>
                      {g.phone || 'No phone'} · Due since 1st
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text maxFontSizeMultiplier={1.3} style={styles.overdueAmount}>
                      {g.rentAmount ? `₹${Math.round(g.rentAmount)}` : '—'}
                    </Text>
                    {g.phone && (
                      <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Call" accessibilityRole="button"
                        onPress={() => Linking.openURL(`tel:${g.phone.replace(/\s+/g, '')}`)}
                        style={styles.callBtn}
                      >
                        <Ionicons name="call" size={13} color={PRIMARY} />
                      </AnimatedPress>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Sheet>
      )}

      {/* ── All Actions Sheet ─────────────────────────────────────────────── */}
      {showAllActionsSheet && (
        <Sheet
          visible={showAllActionsSheet}
          title="All Services"
          subtitle="Manage your entire portfolio from here."
          icon="grid"
          accent={PRIMARY}
          size="auto"
          onDismiss={() => setShowAllActionsSheet(false)}
          testID="owner-all-actions-sheet"
        >
          <View style={[styles.actionsBox, { paddingHorizontal: 14, paddingVertical: 18 }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 24 }}>
              {allQuickActions.map(act => (
                <AnimatedPress key={act.label} scale={0.92} onPress={act.onPress} style={{ width: '25%', alignItems: 'center' }}>
                  <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
                    <View style={styles.sheetTileBox}>
                      {act.image ? (
                        <Image source={act.image} style={styles.sheetTileImage} />
                      ) : null}
                    </View>
                    <Text maxFontSizeMultiplier={1.3} style={styles.sheetTileLabel} numberOfLines={2}>{act.label}</Text>
                  </View>
                </AnimatedPress>
              ))}
            </View>
          </View>
        </Sheet>
      )}

      {showBookRepair && (
        <BookRepairDialog
          onDismiss={() => setShowBookRepair(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  // 110, and nothing else. This screen used to carry `paddingBottom: 40` here AND a
  // `<View style={{ height: 110 }} />` spacer at the end of the content — 150px of empty
  // white below the last notices card, against the 100-120 every other tab screen uses for
  // the same floating-dock clearance. One source of bottom spacing, matching the convention.
  scroll: { paddingTop: 16, paddingBottom: 110 },
  splitBar: { flexDirection: 'row', height: 9, borderRadius: Radii.badge, overflow: 'hidden' },
  // `MetricRow` has no boundary of its own the way `ListRow` does (see the comment beside its
  // one other use) — this is what bounds a run of them.
  rowGroup: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.separator },
  firstLoadBox: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  firstLoadText: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  loadFailedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.TintRed,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  loadFailedText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: Colors.danger, lineHeight: 17 },

  // Get Started / empty state cards
  cardShadow: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3
  },
  tileIconBox: {
    width: 46, height: 46, borderRadius: Radii.card,
    alignItems: 'center', justifyContent: 'center'
  },
  noMembershipTitle: { fontSize: 20, fontWeight: '700', color: CHARCOAL },
  noMembershipDesc: { color: MUTED, fontSize: 13, lineHeight: 18 },
  btnText: { fontSize: 14, fontWeight: '700', color: WHITE },

  // 1. Property Hero Card

  // 2. Key Metrics

  // 3. Quick Actions
  sectionHeaderRow: {
    marginBottom: 10
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: CHARCOAL
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY
  },
  actionsBox: {
    paddingVertical: 18,
    paddingHorizontal: 14
  },
  sheetTileBox: {
    width: 62,
    height: 62,
    // `card`, not `control`: at 62px the tile is a surface holding artwork rather than
    // something you type into, and 18 is the nearest token to the 16 this was drawn at.
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetTileImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sheetTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CHARCOAL,
    textAlign: 'center',
    lineHeight: 14
  },

  // Bento Grid Quick Actions
  bentoGrid: {
    flexDirection: 'row',
    gap: 12
  },
  bentoCol: {
    flex: 1,
    gap: 12
  },
  bentoTile: {
    flex: 1,
    borderRadius: Radii.sheet,
    padding: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 120,
    justifyContent: 'flex-start'
  },
  bentoTileTall: {
    flex: 2,
    minHeight: 180
  },
  bentoTileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    width: '70%',
    lineHeight: 22
  },
  bentoTileTitleGroceries: {
    fontSize: 22,
    fontWeight: '800',
    color: CHARCOAL,
    marginTop: 4,
    lineHeight: 28
  },
  bentoTileTitleAll: {
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    width: '60%',
    lineHeight: 22,
    marginTop: 8
  },
  bentoTileImageBg: {
    position: 'absolute',
    bottom: -47,
    right: -25,
    width: 200,
    height: 200,
    resizeMode: 'contain',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  bentoTileImageCorner: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 120,
    height: 120,
    resizeMode: 'contain',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  bentoBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: WHITE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    shadowColor: SUCCESS,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  bentoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SUCCESS
  },

  // Charts General

  // 4. Revenue Chart

  // 5. Maintenance Donut Chart
  dividerLine: {
    height: 1,
    backgroundColor: BORDER
  },

  // 6. Recent Requests
  emptyRequestsBox: {
    padding: 18,
    alignItems: 'center',
    gap: 8
  },
  emptyRequestsText: {
    fontSize: 12,
    fontWeight: '700',
    color: SUCCESS
  },

  // 7. Recent Activity Timeline
  timelineEmptyDot: {
    width: 10, height: 10, borderRadius: Radii.pill, backgroundColor: BORDER
  },
  timelineEmptyTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  timelineEmptySub: { fontSize: 11, color: MUTED },
  timelineVerticalLine: {
    position: 'absolute',
    left: 12,
    top: 10,
    bottom: 10,
    width: 1.5,
    backgroundColor: BORDER
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: WHITE
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CHARCOAL
  },
  timelineTime: {
    fontSize: 10,
    color: MUTED
  },
  timelineDesc: {
    fontSize: 11,
    color: MUTED
  },

  // 8. Important Notices
  noticeHeroCard: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  noticeIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radii.card,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  noticeHeroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHARCOAL
  },
  noticeHeroDesc: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 15
  },
  remindBtn: {
    height: 40,
    borderRadius: Radii.control,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center'
  },
  remindBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: WHITE
  },
  noticeBulletDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.pill,
    backgroundColor: PRIMARY
  },
  quickNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHARCOAL,
    flex: 1
  },

  // Overdue Modal Dialog
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 23, 26, 0.45)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCard: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: WHITE,
    borderRadius: Radii.sheet,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.card,
    backgroundColor: Palette.TintAmber,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  modalSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  closeBtn: {
    width: 32, height: 32, borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center'
  },
  allPaidBox: {
    alignItems: 'center', padding: 24,
    backgroundColor: Palette.TintGreen, borderRadius: Radii.card, marginBottom: 8
  },
  allPaidTitle: { fontSize: 14, fontWeight: '700', color: SUCCESS, marginTop: 8 },
  allPaidSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER
  },
  overdueGuestName: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  overdueGuestSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueAmount: { fontSize: 15, fontWeight: '700', color: WARNING },
  callBtn: {
    marginTop: 4, width: 28, height: 28, borderRadius: Radii.pill,
    backgroundColor: Palette.TintBlue, alignItems: 'center', justifyContent: 'center'
  },
  roomPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radii.badge, backgroundColor: Palette.TintBlue
  },
  roomPillText: { fontSize: 10, fontWeight: '700', color: PRIMARY },
  modalPrimaryBtn: {
    height: 46, backgroundColor: PRIMARY,
    borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center'
  },
  modalPrimaryBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },
  modalSecondaryBtn: {
    height: 46,
    borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER
  },
  modalSecondaryBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  // Food Savings Styles
  footerBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 0,
    opacity: 0.6,
  },
  footerBrandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  footerBrandSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    fontWeight: '600',
  },
  bentoTileMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 5,
  },
});
