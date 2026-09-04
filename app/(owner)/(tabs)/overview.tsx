/**
 * Redesigned PGow Owner Overview Dashboard — Premium Redesign.
 * Integrates an Indigo-violet theme, building hero card, key metric grid,
 * quick action tiles, interactive Svg charts (Area & Donut), recent requests,
 * activity timeline, and overdue modals.
 * All existing dynamic data bindings and navigation actions are preserved.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Text,
  Image,
  ImageBackground,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card, Txt, Row, Col, Spacer, Btn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
function AnimatedNumber({ value, duration = 500, decimals = 0 }: { value: number; duration?: number; decimals?: number }) {
  if (decimals > 0) {
    return <>{value.toFixed(decimals)}</>;
  }
  return <>{Math.round(value).toLocaleString('en-IN')}</>;
}

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
import { usePropertyLayout } from '@/features/property/usePropertyLayout';
import { todayLocalISO, formatTimeAgo, formatINR } from '@/utils/format';
import { BookRepairDialog } from '@/components/dialogs/HubDialogs';
import { useResponsivePadding } from '@/utils/responsive';

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

const CHART_HEIGHT = 100;       // Balanced 100px chart height for carousel tile

interface QuickActionItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color: string;
  bgColor: string;
}

export default function OwnerOverviewTab() {
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showBookRepair, setShowBookRepair] = useState(false);
  const [pnlInterval, setPnlInterval] = useState<'3m' | '6m' | '1y'>('3m');
  const isQuickActionsExpanded = usePGowStore((s) => s.isQuickActionsExpanded);
  const responsivePadding = useResponsivePadding();

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [], refetch: refetchPGs, error: pgsError } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [], refetch: refetchNotifs } = useRoleNotificationsQuery(activePgId ?? undefined);
  const {
    data: guests = [],
    refetch: refetchGuests,
    error: guestsError,
    isLoading: guestsLoading,
  } = useGuestsQuery(activePgId ?? undefined);
  const { data: complaints = [], refetch: refetchComplaints } = useComplaintsQuery(activePgId ?? undefined);


  const carouselRef = useRef<ScrollView>(null);
  const activeCarouselIndex = useRef(0);

  const user = useAuthStore((s) => s.user);
  const hasNoMemberships = !user || (user.memberships.length === 0);

  useEffect(() => {
    if (hasNoMemberships) return;
    const interval = setInterval(() => {
      const itemWidth = Dimensions.get("window").width - (responsivePadding * 2) + 16;
      if (activeCarouselIndex.current === 3) {
        carouselRef.current?.scrollTo({ x: 0, animated: false });
        activeCarouselIndex.current = 1;
        setTimeout(() => {
          carouselRef.current?.scrollTo({ x: itemWidth, animated: true });
        }, 50);
      } else {
        activeCarouselIndex.current += 1;
        carouselRef.current?.scrollTo({ x: activeCarouselIndex.current * itemWidth, animated: true });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [hasNoMemberships, responsivePadding]);

  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  // Derived, not a login-time snapshot — see useIsManagerMode.
  const isManager = useIsManagerMode();

  // Dynamic calculations
  const occupiedCount = guests.length;
  const capacity = owner?.totalBeds ?? 60;
  const availableCount = Math.max(0, capacity - occupiedCount);
  const occupancyPercent = capacity > 0 ? Math.round((occupiedCount / capacity) * 100) : 85;

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
      monthEnd: todayLocalISO(now),
    };
  }, []);
  const { data: savingsData } = useMealSavings(activePgId, monthStart, monthEnd);

  // Property's real bed layout — same hook BedVisualizerScreen uses — so the maintenance
  // count on the hero card is a real number, not a placeholder that never changes.
  const { data: layout } = usePropertyLayout(activePgId);

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
  const maintenanceBedsCount = useMemo(
    () =>
      (layout?.floors ?? [])
        .flatMap((f) => f.rooms)
        .flatMap((r) => r.beds)
        .filter((b) => b.status === 'maintenance').length,
    [layout]
  );

  // No fallback numbers here on purpose: an owner with a genuinely quiet mess (nobody has
  // skipped a meal this month) must see 0, not an invented ₹1,750 that looks like real
  // revenue they never earned.
  const totalSkippedPortions = savingsData?.total_skipped_portions ?? 0;
  const totalSavedAmount = savingsData?.total_saved ?? 0;
  const costPerPlate = savingsData?.cost_per_plate ?? 0;

  // Quick Action Grid Items — Cool LUNA Design System Icons
  const quickActions = useMemo(() => {
    const top4: QuickActionItem[] = [
      { label: 'Groceries', icon: 'basket', color: Colors.primary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/groceries'); } },
      { label: 'Procurement', icon: 'cube', color: Colors.secondary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/procurement'); } },
      { label: 'Services', icon: 'sparkles', color: Colors.textSecondary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/services'); } },
      { label: 'Residents', icon: 'people', color: Colors.primary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/guests'); } },
    ];

    const rest: QuickActionItem[] = [
      { label: 'Add Room', icon: 'bed', color: Colors.secondary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/bed-visualizer'); } },
      { label: 'Ads', icon: 'rocket', color: Colors.primary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/manage-ad'); } },
      { label: 'Complaints', icon: 'alert-circle', color: '#DC2626', bgColor: '#FEF2F2', onPress: () => { router.navigate('/complaints'); } },
      { label: 'Food RSVP', icon: 'fast-food', color: Colors.textSecondary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/rsvp-trends'); } },
      { label: 'Managers', icon: 'ribbon', color: Colors.primary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/manager-provisioning'); } },
      { label: 'Portfolio', icon: 'stats-chart', color: Colors.secondary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/portfolio'); } },
      { label: 'Reviews', icon: 'star', color: '#D97706', bgColor: '#FEF3C7', onPress: () => { router.navigate('/reviews'); } },
      { label: 'Settings', icon: 'options', color: Colors.primaryDark, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/settings'); } },
      { label: 'Staff', icon: 'id-card', color: Colors.primary, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/staff'); } },
      { label: 'Technicians', icon: 'construct', color: Colors.secondary, bgColor: Colors.surfaceElevated, onPress: () => { setShowBookRepair(true); } },
      { label: 'UPI Setup', icon: 'qr-code', color: Colors.primaryDark, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/upi-settings'); } },
    ];

    if (!isManager) {
      rest.push({ label: 'Add Property', icon: 'business', color: Colors.primaryDark, bgColor: Colors.surfaceElevated, onPress: () => { router.navigate('/manage-properties'); } });
    }

    rest.sort((a, b) => a.label.localeCompare(b.label));

    return [...top4, ...rest];
  }, [isManager]);

  // Split into rows of 5 for the horizontal-scroll grid (handles any list length)
  const quickActionRows = useMemo(() => {
    const rows: QuickActionItem[][] = [];
    for (let i = 0; i < quickActions.length; i += 5) rows.push(quickActions.slice(i, i + 5));
    return rows;
  }, [quickActions]);

  // Revenue Overview Area Chart Data Mapping
  const chartWidth = Dimensions.get('window').width - 72; // Padding inset
  const areaData = useMemo(() => {
    if (pnlData?.monthly && pnlData.monthly.length > 0) {
      return pnlData.monthly.map(m => ({ label: m.period.slice(5, 7) || m.period, val: m.revenue }));
    }
    // No real data yet — empty, not an invented ₹4.8L trend that never happened. The chart
    // below already renders nothing sensible for zero points, so this is the honest answer.
    return [];
  }, [pnlData]);

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

  const maxVal = Math.max(...areaData.map(d => d.val), 1) * 1.15;
  const minVal = Math.min(...areaData.map(d => d.val), 0) * 0.85;

  const points = useMemo(() => {
    return areaData.map((d, i) => {
      const x = (i / (areaData.length - 1)) * chartWidth;
      const y = CHART_HEIGHT - ((d.val - minVal) / (maxVal - minVal)) * CHART_HEIGHT;
      return { x, y };
    });
  }, [areaData, chartWidth, minVal, maxVal]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    return `${pathD} L ${chartWidth} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
  }, [points, pathD, chartWidth]);

  // Donut Chart calculations. No fallback counts: a property with zero complaints is good
  // news, not a reason to draw 22 invented tickets on the owner's own dashboard.
  const totalTickets = complaints.length;
  const urgentCount = complaints.filter(c => c.status === 'Open').length;
  const progressCount = complaints.filter(c => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;

  const donutRadius = 32;
  const donutCircum = 2 * Math.PI * donutRadius; // ~201
  // Guard the empty-property case — dividing by a zero totalTickets would draw every slice
  // as NaN% instead of the plain, uncoloured ring the empty state already handles below.
  const urgentPct = totalTickets > 0 ? urgentCount / totalTickets : 0;
  const progressPct = totalTickets > 0 ? progressCount / totalTickets : 0;
  const resolvedPct = totalTickets > 0 ? resolvedCount / totalTickets : 0;

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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Some data could not be loaded. Tap to retry."
            onPress={handleRefresh}
            activeOpacity={0.8}
            style={styles.loadFailedBanner}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
            <Text maxFontSizeMultiplier={1.3} style={styles.loadFailedText} numberOfLines={2}>
              Some figures below couldn&apos;t be loaded, so they may read as zero. Tap to retry.
            </Text>
            <Ionicons name="refresh" size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}

        {hasNoMemberships ? (
          <Card
            containerColor={WHITE}
            borderRadius={22}
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
              borderRadius={14}
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
            {/* ── Dashboard Carousel ─────────────────────────────────────── */}
            <ScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={Dimensions.get("window").width - (responsivePadding * 2) + 16}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: responsivePadding, gap: 16, alignItems: 'stretch' }}
              style={{ marginHorizontal: -responsivePadding }}
            >
              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>
                {/* ── 1. Property Hero Card ─────────────────────────────────────── */}
                <Card
                  containerColor={WHITE}
                  borderRadius={22}
                  borderWidth={0}
                  padding={[0, 0]}
                  style={[styles.heroCardShadow, { flex: 1 }]}
                >
                  <View style={styles.heroFlexRow}>
                    {/* Left side building image */}
                    <View style={styles.heroImageContainer}>
                      <Image
                        source={require('../../../assets/bangalore_pg_building.png')}
                        style={styles.heroImage}
                        resizeMode="cover"
                      />
                    </View>

                    {/* Right side stats panel with subtle gradient */}
                    <View style={styles.heroStatsPanel}>
                      <Row justify="space-between" align="center">
                        <Text maxFontSizeMultiplier={1.3} style={styles.heroLabel}>Occupancy</Text>
                      </Row>

                      <Text maxFontSizeMultiplier={1.3} style={styles.heroPercentText}><AnimatedNumber value={occupancyPercent} />%</Text>
                      <Text maxFontSizeMultiplier={1.3} style={styles.heroStatusText}>Excellent occupancy</Text>

                      {/* Custom Progress Bar */}
                      <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${occupancyPercent}%` }]} />
                      </View>

                      <View style={styles.heroSummaryContainer}>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: PRIMARY }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={occupiedCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Occupied</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: SUCCESS }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={availableCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Available</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: WARNING }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={maintenanceBedsCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Maintenance</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>

              </View>
              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>
                {/* ── 4. Revenue Overview Card ────────────────────────────────────── */}
                <Card
                  containerColor={WHITE}
                  borderRadius={22}
                  borderWidth={0}
                  padding={[18, 18]}
                  style={[styles.cardShadow, { flex: 1 }]}
                >
                  <Row justify="space-between" align="center">
                    <Col>
                      <Text maxFontSizeMultiplier={1.3} style={styles.chartTitle}>Revenue Overview</Text>
                      <Spacer size={4} />
                      <Row align="center" gap={6}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.chartAmountText}>{formatINR(revenueTotal)}</Text>
                        {revenueGrowthPct !== null && (
                          <View style={[styles.growthBadge, revenueGrowthPct < 0 && { backgroundColor: '#FEF2F2' }]}>
                            <Text maxFontSizeMultiplier={1.3} style={[styles.growthBadgeText, revenueGrowthPct < 0 && { color: DANGER }]}>
                              {revenueGrowthPct >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowthPct).toFixed(1)}%
                            </Text>
                          </View>
                        )}
                      </Row>
                      <Text maxFontSizeMultiplier={1.3} style={styles.chartSubtext}>vs last month</Text>
                    </Col>

                    {/* Interval Selector */}
                    <Row gap={4} style={styles.intervalRow}>
                      {(['3m', '6m', '1y'] as const).map(i => (
                        <TouchableOpacity accessibilityRole="button"
                          key={i}
                          style={[styles.intervalBtn, pnlInterval === i && styles.intervalBtnActive]}
                          onPress={() => { setPnlInterval(i); }}
                        >
                          <Text maxFontSizeMultiplier={1.3} style={[styles.intervalBtnText, pnlInterval === i && styles.intervalBtnTextActive]}>
                            {i.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </Row>
                  </Row>

                  <Spacer size={16} />

                  {/* Svg area line chart */}
                  <View style={styles.svgContainer}>
                    <Svg width={chartWidth} height={CHART_HEIGHT}>
                      <Defs>
                        <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor={PRIMARY} stopOpacity="0.25" />
                          <Stop offset="100%" stopColor={PRIMARY} stopOpacity="0.0" />
                        </LinearGradient>
                      </Defs>

                      {/* Grid Lines */}
                      <Path d={`M 0 ${CHART_HEIGHT * 0.3} L ${chartWidth} ${CHART_HEIGHT * 0.3}`} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
                      <Path d={`M 0 ${CHART_HEIGHT * 0.65} L ${chartWidth} ${CHART_HEIGHT * 0.65}`} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />

                      {/* Gradient Area Fill */}
                      <Path d={areaD} fill="url(#areaGradient)" opacity={1} />

                      {/* Smooth Line Path */}
                      <Path
                        d={pathD}
                        fill="none"
                        stroke={PRIMARY}
                        strokeWidth="3"
                        strokeDasharray={chartWidth}
                        strokeDashoffset={0}
                      />

                      {/* Chart Dots */}
                      {points.map((p, idx) => (
                        <Circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          fill={PRIMARY}
                          stroke={WHITE}
                          strokeWidth="2"
                          opacity={1}
                          r={4}
                        />
                      ))}
                    </Svg>
                  </View>

                  <Row justify="space-between" style={{ marginTop: 8 }}>
                    {areaData.map((d, i) => (
                      <Text maxFontSizeMultiplier={1.3} key={i} style={styles.xAxisLabel}>{d.label}</Text>
                    ))}
                  </Row>
                </Card>

              </View>
              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>
                {/* ── Food Savings Analytics Card ────────────────────────────────── */}
                <Card
                  containerColor={WHITE}
                  borderRadius={22}
                  borderWidth={0}
                  padding={[0, 0]}
                  style={[styles.heroCardShadow, { flex: 1 }]}
                >
                  <View style={styles.heroFlexRow}>
                    {/* Left side cover image */}
                    <View style={styles.heroImageContainer}>
                      <Image
                        source={require('../../../assets/food_savings_banner.png')}
                        style={styles.heroImage}
                        resizeMode="cover"
                      />
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
                      <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(1,28,64,0.85)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
                        <Row gap={4} align="center">
                          <Ionicons name="fast-food" size={10} color="#FFF" />
                          <Txt size={8} weight="900" color="#FFF">FOOD SAVINGS</Txt>
                        </Row>
                      </View>
                    </View>

                    {/* Right side text & stats panel */}
                    <View style={styles.heroStatsPanel}>
                      <View>
                        <Txt size={13} weight="900" color={Colors.textPrimary} numberOfLines={1}>Food Savings & Waste</Txt>
                        <Txt size={9} color={Colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>Portions saved from resident skips</Txt>
                      </View>

                      <Row justify="space-between" align="center" style={{ backgroundColor: Colors.canvas, paddingHorizontal: 6, paddingVertical: 8, borderRadius: 10, marginVertical: 4, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                        <Col align="center" style={{ flex: 1 }}>
                          <Txt size={8} weight="700" color={Colors.textMuted}>PORTIONS</Txt>
                          <Txt size={13} weight="900" color={Colors.primary} style={{ marginTop: 1 }}>
                            <AnimatedNumber value={totalSkippedPortions} />
                          </Txt>
                        </Col>
                        <View style={{ width: 1, height: 18, backgroundColor: Colors.borderSubtle }} />
                        <Col align="center" style={{ flex: 1 }}>
                          <Txt size={8} weight="700" color={Colors.textMuted}>SAVED</Txt>
                          <Txt size={13} weight="900" color={Colors.success} style={{ marginTop: 1 }}>
                            ₹<AnimatedNumber value={totalSavedAmount} />
                          </Txt>
                        </Col>
                        <View style={{ width: 1, height: 18, backgroundColor: Colors.borderSubtle }} />
                        <Col align="center" style={{ flex: 1 }}>
                          <Txt size={8} weight="700" color={Colors.textMuted}>PLATE</Txt>
                          <Txt size={13} weight="900" color={Colors.textPrimary} style={{ marginTop: 1 }}>
                            ₹<AnimatedNumber value={costPerPlate} />
                          </Txt>
                        </Col>
                      </Row>

                      <Row justify="space-between" align="center">
                        <Txt size={9} weight="700" color={Colors.textMuted}>Today's Skips</Txt>
                        <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Txt size={8} weight="900" color={Colors.success}>ACTIVE SAVINGS</Txt>
                        </View>
                      </Row>
                    </View>
                  </View>
                </Card>

              </View>
              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>
                {/* ── 1. Property Hero Card (Duplicate for loop) ─────────────────────────────────────── */}
                <Card
                  containerColor={WHITE}
                  borderRadius={22}
                  borderWidth={0}
                  padding={[0, 0]}
                  style={[styles.heroCardShadow, { flex: 1 }]}
                >
                  <View style={styles.heroFlexRow}>
                    {/* Left side building image */}
                    <View style={styles.heroImageContainer}>
                      <Image
                        source={require('../../../assets/bangalore_pg_building.png')}
                        style={styles.heroImage}
                        resizeMode="cover"
                      />
                    </View>

                    {/* Right side stats panel with subtle gradient */}
                    <View style={styles.heroStatsPanel}>
                      <Row justify="space-between" align="center">
                        <Text maxFontSizeMultiplier={1.3} style={styles.heroLabel}>Occupancy</Text>
                      </Row>

                      <Text maxFontSizeMultiplier={1.3} style={styles.heroPercentText}><AnimatedNumber value={occupancyPercent} />%</Text>
                      <Text maxFontSizeMultiplier={1.3} style={styles.heroStatusText}>Excellent occupancy</Text>

                      {/* Custom Progress Bar */}
                      <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${occupancyPercent}%` }]} />
                      </View>

                      <View style={styles.heroSummaryContainer}>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: PRIMARY }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={occupiedCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Occupied</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: SUCCESS }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={availableCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Available</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <View style={[styles.summaryDot, { backgroundColor: WARNING }]} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}><AnimatedNumber value={maintenanceBedsCount} /></Text>
                          <Text maxFontSizeMultiplier={1.3} style={styles.summaryLabel}>Maintenance</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>

              </View>
            </ScrollView>

            <Spacer size={24} />

            {/* ── 2. Key Metrics Grid ────────────────────────────────────────── */}
            <View style={styles.metricsGrid}>
              {/* Properties Card */}
              <AnimatedPress scale={0.96} onPress={() => { router.push('/manage-properties'); }} style={{ flex: 1, minWidth: 150 }}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIconCircle, { backgroundColor: Colors.surfaceElevated, borderColor: Colors.borderSubtle, borderWidth: 1 }]}>
                    <Ionicons name="business" size={18} color={Colors.primaryDark} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Row justify="space-between" align="center">
                      <Text maxFontSizeMultiplier={1.3} style={styles.metricValue}><AnimatedNumber value={allPGs.length} /></Text>
                      <View style={styles.metricBadgePrimary}><Text maxFontSizeMultiplier={1.3} style={styles.metricBadgeTextPrimary}>ACTIVE</Text></View>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.metricTitle}>Properties</Text>
                  </Col>
                </View>
              </AnimatedPress>

              {/* Residents Card */}
              <AnimatedPress scale={0.96} onPress={() => { router.push('/guests'); }} style={{ flex: 1, minWidth: 150 }}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIconCircle, { backgroundColor: Colors.surfaceElevated, borderColor: Colors.borderSubtle, borderWidth: 1 }]}>
                    <Ionicons name="people" size={18} color={Colors.primary} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={1.3} style={styles.metricValue}><AnimatedNumber value={guests.length} /></Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.metricTitle}>Residents</Text>
                  </Col>
                </View>
              </AnimatedPress>

              {/* Revenue Card */}
              <AnimatedPress scale={0.96} onPress={() => { router.push('/pnl-analytics'); }} style={{ flex: 1, minWidth: 150 }}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIconCircle, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1 }]}>
                    <Ionicons name="wallet" size={18} color="#D97706" />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Row justify="space-between" align="center">
                      <Text maxFontSizeMultiplier={1.3} style={styles.metricValue} numberOfLines={1}>
                        ₹<AnimatedNumber value={revenueTotal / 1000} decimals={1} />k
                      </Text>
                      <View style={styles.metricBadgeWarning}><Text maxFontSizeMultiplier={1.3} style={styles.metricBadgeTextWarning}>CYC</Text></View>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.metricTitle} numberOfLines={1}>Revenue (Cycle)</Text>
                  </Col>
                </View>
              </AnimatedPress>

              {/* Pending Issues Card */}
              <AnimatedPress scale={0.96} onPress={() => { router.push({ pathname: '/services', params: { tab: 'BOOKINGS' } }); }} style={{ flex: 1, minWidth: 150 }}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIconCircle, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 }]}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Row justify="space-between" align="center">
                      <Text maxFontSizeMultiplier={1.3} style={styles.metricValue}><AnimatedNumber value={openRequests} /></Text>
                      {openRequests > 0 ? (
                        <View style={styles.metricBadgeDanger}><Text maxFontSizeMultiplier={1.3} style={styles.metricBadgeTextDanger}>OPEN</Text></View>
                      ) : (
                        <View style={styles.metricBadgeSuccess}><Text maxFontSizeMultiplier={1.3} style={styles.metricBadgeTextSuccess}>CLEAR</Text></View>
                      )}
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.metricTitle}>Pending Issues</Text>
                  </Col>
                </View>
              </AnimatedPress>
            </View>


            <Spacer size={24} />

            {/* ── 3. Quick Actions ───────────────────────────────────────────── */}
            <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
              <Row gap={6} align="center">
                <Ionicons name="flash" size={16} color={Colors.primary} />
                <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Quick Actions</Text>
              </Row>
              <TouchableOpacity accessibilityRole="button"
                activeOpacity={0.7}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  usePGowStore.getState().set('isQuickActionsExpanded', !isQuickActionsExpanded);
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Row align="center" gap={4}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.viewAllText}>{isQuickActionsExpanded ? 'Show less' : 'View all'}</Text>
                  <Ionicons name={isQuickActionsExpanded ? "chevron-up" : "chevron-down"} size={16} color={PRIMARY} />
                </Row>
              </TouchableOpacity>
            </Row>

            <View style={[styles.actionsBox, { paddingHorizontal: 14, paddingVertical: 18 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
                {(isQuickActionsExpanded ? quickActions : quickActions.slice(0, 4)).map(act => (
                  <AnimatedPress key={act.label} scale={0.92} onPress={act.onPress} style={{ width: '22%', alignItems: 'center' }}>
                    <View style={{ alignItems: 'center', gap: 6, width: '100%' }}>
                      <View style={[styles.actionIconCircle, { backgroundColor: act.bgColor, borderColor: Colors.borderSubtle, borderWidth: 1 }]}>
                        <Ionicons name={act.icon} size={22} color={act.color} />
                      </View>
                      <Text maxFontSizeMultiplier={1.3} style={styles.actionLabel} numberOfLines={1}>{act.label}</Text>
                    </View>
                  </AnimatedPress>
                ))}
              </View>
            </View>


            <Spacer size={24} />


            {/* ── 5. Maintenance Overview Card ────────────────────────────────── */}
            <Card
              containerColor={WHITE}
              borderRadius={22}
              borderWidth={0}
              padding={[18, 18]}
              style={styles.cardShadow}
            >
              <Text maxFontSizeMultiplier={1.3} style={styles.chartTitle}>Maintenance Overview</Text>
              <Spacer size={16} />

              <Row align="center" justify="space-between">
                {/* Donut Chart drawn in Svg */}
                <View style={styles.donutBox}>
                  <Svg width={80} height={80} viewBox="0 0 80 80">
                    <Circle cx="40" cy="40" r={donutRadius} fill="none" stroke="#F3F4F6" strokeWidth="8" />

                    {/* Resolved Slice (Green) */}
                    <Circle
                      cx="40" cy="40" r={donutRadius} fill="none" stroke={SUCCESS} strokeWidth="8"
                      strokeDasharray={donutCircum}
                      strokeDashoffset={donutCircum * (1 - resolvedPct)}
                      rotation={-90}
                      originX={40}
                      originY={40}
                    />

                    {/* In Progress Slice (Amber) */}
                    <Circle
                      cx="40" cy="40" r={donutRadius} fill="none" stroke={WARNING} strokeWidth="8"
                      strokeDasharray={donutCircum}
                      strokeDashoffset={donutCircum * (1 - progressPct)}
                      rotation={(resolvedPct * 360) - 90}
                      originX={40}
                      originY={40}
                    />

                    {/* Urgent Slice (Red) */}
                    <Circle
                      cx="40" cy="40" r={donutRadius} fill="none" stroke={DANGER} strokeWidth="8"
                      strokeDasharray={donutCircum}
                      strokeDashoffset={donutCircum * (1 - urgentPct)}
                      rotation={((resolvedPct + progressPct) * 360) - 90}
                      originX={40}
                      originY={40}
                    />
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text maxFontSizeMultiplier={1.3} style={styles.donutCenterValue}><AnimatedNumber value={totalTickets} /></Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.donutCenterLabel}>Total</Text>
                  </View>
                </View>

                {/* Donut Legend */}
                <Col gap={8} style={{ flex: 1, marginLeft: 24 }}>
                  <Row align="center" justify="space-between">
                    <Row gap={6} align="center">
                      <View style={[styles.legendDot, { backgroundColor: DANGER }]} />
                      <Text maxFontSizeMultiplier={1.3} style={styles.legendText}>Urgent</Text>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.legendCount}><AnimatedNumber value={urgentCount} /></Text>
                  </Row>

                  <Row align="center" justify="space-between">
                    <Row gap={6} align="center">
                      <View style={[styles.legendDot, { backgroundColor: WARNING }]} />
                      <Text maxFontSizeMultiplier={1.3} style={styles.legendText}>In Progress</Text>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.legendCount}><AnimatedNumber value={progressCount} /></Text>
                  </Row>

                  <Row align="center" justify="space-between">
                    <Row gap={6} align="center">
                      <View style={[styles.legendDot, { backgroundColor: SUCCESS }]} />
                      <Text maxFontSizeMultiplier={1.3} style={styles.legendText}>Resolved</Text>
                    </Row>
                    <Text maxFontSizeMultiplier={1.3} style={styles.legendCount}><AnimatedNumber value={resolvedCount} /></Text>
                  </Row>
                </Col>
              </Row>

              <Spacer size={16} />
              <View style={styles.dividerLine} />
              <Spacer size={12} />

              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => router.push({ pathname: '/services', params: { tab: 'BOOKINGS' } })}>
                <Row align="center" justify="center" gap={4}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.viewAllRequestsText}>View All Requests</Text>
                  <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
                </Row>
              </TouchableOpacity>
            </Card>

            <Spacer size={24} />

            {/* ── 6. Recent Requests List ────────────────────────────────────── */}
            <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
              <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Recent Requests</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => router.push('/complaints')}>
                <Text maxFontSizeMultiplier={1.3} style={styles.viewAllText}>View all →</Text>
              </TouchableOpacity>
            </Row>

            <Card
              containerColor={WHITE}
              borderRadius={22}
              borderWidth={0}
              padding={[8, 16]}
              style={styles.cardShadow}
            >
              {recentRequests.length === 0 ? (
                <View style={styles.emptyRequestsBox}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={SUCCESS} />
                  <Text maxFontSizeMultiplier={1.3} style={styles.emptyRequestsText}>All requests resolved!</Text>
                </View>
              ) : (
                recentRequests.map((req, index) => (
                  <View key={req.id}>
                    <TouchableOpacity accessibilityRole="button"
                      activeOpacity={0.75}
                      onPress={() => router.push('/complaints')}
                      style={styles.requestRow}
                    >
                      <Row gap={12} align="center" style={{ flex: 1 }}>
                        <View style={styles.requestIconBox}>
                          <Ionicons name={req.icon} size={20} color={PRIMARY} />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <Text maxFontSizeMultiplier={1.3} style={styles.requestTitle}>{req.title}</Text>
                          <Spacer size={2} />
                          <Text maxFontSizeMultiplier={1.3} style={styles.requestMeta}>Room {req.roomNo} • {req.guestName}</Text>
                        </Col>
                      </Row>

                      <Col align="flex-end">
                        <View style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              req.status === 'Open' ? '#FEF2F2' :
                                req.status === 'In Progress' ? '#FEF3C7' : '#ECFDF5',
                          }
                        ]}>
                          <Text maxFontSizeMultiplier={1.3} style={[
                            styles.statusBadgeText,
                            {
                              color:
                                req.status === 'Open' ? DANGER :
                                  req.status === 'In Progress' ? WARNING : SUCCESS,
                            }
                          ]}>
                            {req.status}
                          </Text>
                        </View>
                        <Spacer size={4} />
                        <Text maxFontSizeMultiplier={1.3} style={styles.requestTime}>{formatTimeAgo(req.timestamp)}</Text>
                      </Col>
                    </TouchableOpacity>
                    {index < recentRequests.length - 1 && <View style={styles.dividerLine} />}
                  </View>
                ))
              )}
            </Card>

            <Spacer size={24} />

            {/* ── 7. Recent Activity Timeline ────────────────────────────────── */}
            <Text maxFontSizeMultiplier={1.3} style={[styles.sectionHeading, styles.sectionHeaderRow]}>Recent Activity</Text>

            <Card
              containerColor={WHITE}
              borderRadius={22}
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

            <Spacer size={24} />

            {/* ── 8. Important Notices ────────────────────────────────────────── */}
            <Row justify="space-between" align="center" style={styles.sectionHeaderRow}>
              <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Important Notices</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => router.push('/notices')}>
                <Text maxFontSizeMultiplier={1.3} style={styles.viewAllText}>View all →</Text>
              </TouchableOpacity>
            </Row>

            {/* Featured rent reminder card */}
            <Card
              containerColor="#EEF2FF"
              borderRadius={22}
              borderWidth={0}
              padding={[20, 20]}
              style={styles.noticeHeroCard}
            >
              <TouchableOpacity accessibilityRole="button"
                disabled={overdueCount === 0}
                onPress={() => setShowOverdueModal(true)}
                activeOpacity={0.7}
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
                        ? `${overdueCount} resident${overdueCount === 1 ? '' : 's'} with pending dues — tap to review.`
                        : 'No outstanding residents right now.'}
                    </Text>
                  </Col>
                  {overdueCount > 0 && <Ionicons name="chevron-forward" size={18} color={MUTED} />}
                </Row>
              </TouchableOpacity>

              <Spacer size={16} />

              <TouchableOpacity accessibilityRole="button"
                style={[styles.remindBtn, overdueCount === 0 && { opacity: 0.5 }]}
                activeOpacity={0.8}
                disabled={overdueCount === 0}
                onPress={async () => {
                  try {
                    const result = await sendRentRemindersMutation.mutateAsync();
                    usePGowStore.getState().set('activeAlert', {
                      ...rentReminderAlert(result),
                      type: 'PAYMENT',
                      timestamp: Date.now(),
                    });
                  } catch (err) {
                    usePGowStore.getState().set('activeAlert', {
                      title: '❌ REMINDERS NOT SENT',
                      description: err instanceof Error ? err.message : 'Nothing was sent. Try again.',
                      type: 'PAYMENT',
                      timestamp: Date.now(),
                    });
                  }
                }}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.remindBtnText}>Send Reminder</Text>
              </TouchableOpacity>
            </Card>

            <Spacer size={12} />

            {/* Quick notices list */}
            <Card
              containerColor={WHITE}
              borderRadius={18}
              borderWidth={0}
              padding={[16, 16]}
              style={styles.cardShadow}
            >
              <Row align="center" gap={12} style={{ paddingBottom: 12 }}>
                <View style={styles.noticeBulletDot} />
                <Text maxFontSizeMultiplier={1.3} style={styles.quickNoticeText}>
                  {overdueCount > 0
                    ? `${overdueCount} resident${overdueCount === 1 ? '' : 's'} with pending dues.`
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

            {/* Pad bottom for floating bar safety */}
            <View style={{ height: 110 }} />
          </>
        )}
      </ScrollView>

      {/* ── Overdue Detail Modal ──────────────────────────────────────────── */}
      {showOverdueModal && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowOverdueModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setShowOverdueModal(false)} />
            <View style={styles.modalCard}>
              <Row justify="space-between" align="center">
                <Row gap={10} align="center">
                  <View style={styles.modalIconBox}>
                    <Ionicons name="alert-circle" size={20} color={WARNING} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={1.3} style={styles.modalTitle}>Pending Rent Dues</Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.modalSub}>
                      {overdueCount} Unpaid Resident{overdueCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Row>
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setShowOverdueModal(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={MUTED} />
                </TouchableOpacity>
              </Row>

              <View style={styles.menuDivider} />

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
                          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Call" accessibilityRole="button"
                            onPress={() => Linking.openURL(`tel:${g.phone.replace(/\s+/g, '')}`)}
                            style={styles.callBtn}
                          >
                            <Ionicons name="call" size={13} color={PRIMARY} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.menuDivider} />
              <Row gap={10}>
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.modalPrimaryBtn, { flex: 1 }]}
                  onPress={async () => {
                    try {
                      const result = await sendRentRemindersMutation.mutateAsync();
                      setShowOverdueModal(false);
                      usePGowStore.getState().set('activeAlert', {
                        ...rentReminderAlert(result),
                        type: 'PAYMENT',
                        timestamp: Date.now(),
                      });
                    } catch (err) {
                      usePGowStore.getState().set('activeAlert', {
                        title: '❌ REMINDERS NOT SENT',
                        description: err instanceof Error ? err.message : 'Nothing was sent. Try again.',
                        type: 'PAYMENT',
                        timestamp: Date.now(),
                      });
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.modalPrimaryBtnText}>⚡ Remind All Unpaid</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.modalSecondaryBtn, { flex: 1 }]}
                  onPress={() => { setShowOverdueModal(false); router.push('/guests'); }}
                  activeOpacity={0.8}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.modalSecondaryBtnText}>Open Ledger ›</Text>
                </TouchableOpacity>
              </Row>
            </View>
          </View>
        </Modal>
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
  scroll: { paddingTop: 16, paddingBottom: 40 },
  firstLoadBox: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  firstLoadText: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  loadFailedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
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
    elevation: 3,
  },
  tileIconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  noMembershipTitle: { fontSize: 20, fontWeight: '900', color: CHARCOAL },
  noMembershipDesc: { color: MUTED, fontSize: 13, lineHeight: 18 },
  btnText: { fontSize: 14, fontWeight: '800', color: WHITE },

  // 1. Property Hero Card
  heroCardShadow: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  heroFlexRow: {
    flexDirection: 'row',
    flex: 1,
    minHeight: 130,
  },
  heroImageContainer: {
    width: '40%',
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroStatsPanel: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: WHITE,
  },
  heroLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: '#EEF2FF',
  },
  trendBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: PRIMARY,
  },
  heroPercentText: {
    fontSize: 20,
    fontWeight: '900',
    color: CHARCOAL,
    lineHeight: 24,
  },
  heroStatusText: {
    fontSize: 11,
    color: SUCCESS,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  heroSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '800',
    color: CHARCOAL,
  },
  summaryLabel: {
    fontSize: 9,
    color: MUTED,
  },

  // 2. Key Metrics
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '100%',
    height: 72,
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  metricIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: CHARCOAL,
  },
  metricTitle: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
    marginTop: 1,
  },
  metricBadgePrimary: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  metricBadgeTextPrimary: { fontSize: 8, fontWeight: '900', color: Colors.primaryDark },
  metricBadgeSuccess: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: '#ECFDF5' },
  metricBadgeTextSuccess: { fontSize: 8, fontWeight: '900', color: SUCCESS },
  metricBadgeWarning: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: '#FEF3C7' },
  metricBadgeTextWarning: { fontSize: 8, fontWeight: '900', color: '#D97706' },
  metricBadgeDanger: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: '#FEF2F2' },
  metricBadgeTextDanger: { fontSize: 8, fontWeight: '900', color: DANGER },

  // 3. Quick Actions
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: CHARCOAL,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  actionsBox: {
    backgroundColor: WHITE,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  actionsScroll: {
    paddingRight: 10,
  },
  actionItem: {
    width: 68,
    alignItems: 'center',
    gap: 4,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: CHARCOAL,
    textAlign: 'center',
  },

  // Charts General
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: CHARCOAL,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // 4. Revenue Chart
  chartAmountText: {
    fontSize: 24,
    fontWeight: '900',
    color: CHARCOAL,
  },
  growthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
  },
  growthBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: SUCCESS,
  },
  chartSubtext: {
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
  },
  intervalRow: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
  },
  intervalBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  intervalBtnActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  intervalBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: MUTED,
  },
  intervalBtnTextActive: {
    color: PRIMARY,
  },
  svgContainer: {
    marginTop: 10,
    height: CHART_HEIGHT,
  },
  xAxisLabel: {
    fontSize: 9,
    color: MUTED,
    fontWeight: '700',
  },

  // 5. Maintenance Donut Chart
  donutBox: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutCenterValue: {
    fontSize: 18,
    fontWeight: '900',
    color: CHARCOAL,
  },
  donutCenterLabel: {
    fontSize: 8,
    color: MUTED,
    fontWeight: '700',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: CHARCOAL,
    fontWeight: '600',
  },
  legendCount: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '800',
  },
  dividerLine: {
    height: 1,
    backgroundColor: BORDER,
  },
  viewAllRequestsText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },

  // 6. Recent Requests
  emptyRequestsBox: {
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyRequestsText: {
    fontSize: 12,
    fontWeight: '800',
    color: SUCCESS,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  requestIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: CHARCOAL,
  },
  requestMeta: {
    fontSize: 11,
    color: MUTED,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  requestTime: {
    fontSize: 9,
    color: MUTED,
  },

  // 7. Recent Activity Timeline
  timelineEmptyDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: BORDER,
  },
  timelineEmptyTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  timelineEmptySub: { fontSize: 11, color: MUTED },
  timelineVerticalLine: {
    position: 'absolute',
    left: 12,
    top: 10,
    bottom: 10,
    width: 1.5,
    backgroundColor: BORDER,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: WHITE,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: CHARCOAL,
  },
  timelineTime: {
    fontSize: 10,
    color: MUTED,
  },
  timelineDesc: {
    fontSize: 11,
    color: MUTED,
  },

  // 8. Important Notices
  noticeHeroCard: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  noticeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeHeroTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: CHARCOAL,
  },
  noticeHeroDesc: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 15,
  },
  remindBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: WHITE,
  },
  noticeBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  quickNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHARCOAL,
    flex: 1,
  },

  // Overdue Modal Dialog
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 23, 26, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: CHARCOAL },
  modalSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  allPaidBox: {
    alignItems: 'center', padding: 24,
    backgroundColor: '#ECFDF5', borderRadius: 14, marginBottom: 8,
  },
  allPaidTitle: { fontSize: 14, fontWeight: '800', color: SUCCESS, marginTop: 8 },
  allPaidSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  overdueGuestName: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  overdueGuestSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  overdueAmount: { fontSize: 15, fontWeight: '800', color: WARNING },
  callBtn: {
    marginTop: 4, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  roomPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: '#EEF2FF',
  },
  roomPillText: { fontSize: 10, fontWeight: '700', color: PRIMARY },
  modalPrimaryBtn: {
    height: 46, backgroundColor: PRIMARY,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  modalPrimaryBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
  modalSecondaryBtn: {
    height: 46,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  modalSecondaryBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  // Food Savings Styles
  savingsMetricGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  savingsMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  savingsDivider: {
    width: 1,
    height: 32,
    backgroundColor: BORDER,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SUCCESS,
  },
});
