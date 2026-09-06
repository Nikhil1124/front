/**
 * PnLAnalyticsDetailScreen — Premium redesigned property-management financial dashboard.
 * Supports 3 Months, 6 Months, 1 Year, and Custom Range dynamically using real store data.
 * Pure flat design system: deep forest green (#176B3A) and off-white/canvas (#F7FAF7).
 */
import { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Row, Col, Spacer, MetricDeck, TrendChart, MetricRow, ListSectionHeader, type DeckCardData, type TrendChartPoint, type TrendChartSeries, AnimatedPress, Txt } from '@/components/ui';
import { RefreshControl } from 'react-native';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { usePnL } from '@/features/billing/usePnL';
import { useAllPaymentsQuery } from '@/features/payments/usePayments';
import { useAllExpensesQuery } from '@/features/expenses/useExpenses';
import { useResponsivePadding } from '@/utils/responsive';
import { Radii, Colors } from '@/theme';
import type { PnLInterval, PaymentEntity, ExpenseEntity } from '@/types';

const GREEN = Colors.primary;        // Deep Ocean Blue
const CHARCOAL = Colors.textPrimary; // Obsidian Navy
const MUTED = Colors.textMuted;      // Ocean Muted
const BORDER = Colors.borderSubtle;  // Ice Subtle Border
const WHITE = Colors.surface;
const RADIUS = 20;

type AnalyticsInterval = PnLInterval | 'custom';

const TABS = [
  { key: '3m' as const, label: '3 Months' },
  { key: '6m' as const, label: '6 Months' },
  { key: '1y' as const, label: '1 Year' },
  { key: 'custom' as const, label: 'Custom' },
];

import { useActiveProperty } from '@/features/properties/useProperties';

/** "YYYY-MM-DD", in local time. */
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The ranges an owner actually asks for.
 *
 * This used to be two `YYYY-MM-DD` text boxes with three preset chips underneath. The boxes
 * accepted any string — a typo produced an empty chart with no explanation — and every real
 * question ("how did last month go?") was already one of the chips. Ranges are computed on
 * render so they stay correct across midnight and month boundaries.
 */
const RANGE_PRESETS = [
  {
    label: 'This month',
    range: () => {
      const t = new Date();
      return { start: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), end: isoDay(t) };
    } },
  {
    label: 'Last month',
    range: () => {
      const t = new Date();
      return {
        start: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        end: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)) };
    } },
  {
    label: 'Last 30 days',
    range: () => {
      const t = new Date();
      const from = new Date(t);
      from.setDate(t.getDate() - 29);
      return { start: isoDay(from), end: isoDay(t) };
    } },
  {
    label: 'Last 90 days',
    range: () => {
      const t = new Date();
      const from = new Date(t);
      from.setDate(t.getDate() - 89);
      return { start: isoDay(from), end: isoDay(t) };
    } },
  {
    label: 'This year',
    range: () => {
      const t = new Date();
      return { start: isoDay(new Date(t.getFullYear(), 0, 1)), end: isoDay(t) };
    } },
] as const;

export function PnLAnalyticsDetailScreen() {
  const [interval, setInterval] = useState<AnalyticsInterval>('3m');
  // Three months back to today, computed fresh — not a fixed 2026 date that goes stale the
  // moment the calendar moves past it.
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return isoDay(d);
  });
  const [customEnd, setCustomEnd] = useState(() => isoDay(new Date()));

  // `loggedInOwner` (usePGowStore) is a snapshot taken at login and never refreshed —
  // switching properties (ManagePropertiesScreen) calls authStore.setActivePgId directly, so
  // that snapshot goes stale the moment someone switches. It never wrongly scoped a query
  // here (activePgId always won the `??`), but the subtitle below used to read
  // `owner?.pgName` and would show the PREVIOUS property's name after a switch.
  // useActiveProperty derives the same shape live from activePgId instead.
  const { activeEntity: owner, activePgId } = useActiveProperty();
  const pgId = activePgId;
  const sidePadding = useResponsivePadding();
  // Full history, not just the newest page — the category breakdown and period-over-period
  // comparison below sum this whole set, and capping it silently undercounted for any
  // property with more than a page of payments/expenses.
  const { data: allPaymentsState = [] } = useAllPaymentsQuery(pgId ?? undefined, 'verified');
  const { data: allExpensesState = [] } = useAllExpensesQuery(pgId ?? undefined);

  // Fetch standard intervals via React Query
  const {
    data: apiData,
    isLoading: isApiLoading,
    isError: isApiError,
    error: apiError,
    refetch: refetchPnl,
    isRefetching: isPnlRefetching } = usePnL(
    pgId,
    interval === 'custom' ? '3m' : interval
  );

  // ── Date Range Helper ────────────────────────────────────────────────────────
  const getIntervalRange = (key: AnalyticsInterval) => {
    const end = new Date();
    const start = new Date();
    if (key === '3m') {
      start.setMonth(start.getMonth() - 3);
    } else if (key === '6m') {
      start.setMonth(start.getMonth() - 6);
    } else if (key === '1y') {
      start.setFullYear(start.getFullYear() - 1);
    } else if (key === 'custom') {
      return {
        start: new Date(customStart),
        end: new Date(customEnd) };
    }
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const { start: startDate, end: endDate } = getIntervalRange(interval);
  const startMs = startDate.getTime() || 0;
  const endMs = endDate.getTime() || Date.now();

  // ── Dynamic calculations for Custom Range or Category Breakdown ──────────────
  const filteredPayments = allPaymentsState.filter(
    (p: PaymentEntity) => p.status === 'VERIFIED' && p.timestamp >= startMs && p.timestamp <= endMs
  );

  const filteredExpenses = allExpensesState.filter(
    (e: ExpenseEntity) => e.status === 'LOGGED' && e.dateLogged >= startMs && e.dateLogged <= endMs
  );

  // Group by calendar month for table/chart
  const getMonthKey = (dateMs: number) => {
    const d = new Date(dateMs);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return {
      key: `${year}-${month}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      date: new Date(year, d.getMonth(), 1) };
  };

  const calculatedMonthly = () => {
    const monthsMap: Record<
      string,
      { period: string; revenue: number; expenses: number; net: number; date: Date }
    > = {};

    filteredPayments.forEach((p: PaymentEntity) => {
      const { key, label, date } = getMonthKey(p.timestamp);
      if (!monthsMap[key]) {
        monthsMap[key] = { period: label, revenue: 0, expenses: 0, net: 0, date };
      }
      monthsMap[key].revenue += p.amount;
    });

    filteredExpenses.forEach((e: ExpenseEntity) => {
      const { key, label, date } = getMonthKey(e.dateLogged);
      if (!monthsMap[key]) {
        monthsMap[key] = { period: label, revenue: 0, expenses: 0, net: 0, date };
      }
      monthsMap[key].expenses += e.amount;
    });

    return Object.values(monthsMap)
      .map((m) => ({ ...m, net: m.revenue - m.expenses }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // ── Combined View Data based on Mode ─────────────────────────────────────────
  const isCustomMode = interval === 'custom';

  const revenueVal = isCustomMode
    ? filteredPayments.reduce((sum: number, p: PaymentEntity) => sum + p.amount, 0)
    : apiData?.totals?.revenue ?? 0;

  const expensesVal = isCustomMode
    ? filteredExpenses.reduce((sum: number, e: ExpenseEntity) => sum + e.amount, 0)
    : apiData?.totals?.expenses ?? 0;

  const netVal = revenueVal - expensesVal;

  const monthlyBreakdown = isCustomMode ? calculatedMonthly() : apiData?.monthly ?? [];

  // ── Previous Period Comparison Logic ─────────────────────────────────────────
  const computeComparison = () => {
    if (isCustomMode) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    }

    const duration = endMs - startMs;
    const prevStartMs = startMs - duration;
    const prevEndMs = startMs;

    // Filter historic payments and expenses
    const prevPayments = allPaymentsState.filter(
      (p: PaymentEntity) => p.status === 'VERIFIED' && p.timestamp >= prevStartMs && p.timestamp < prevEndMs
    );
    const prevExpenses = allExpensesState.filter(
      (e: ExpenseEntity) => e.status === 'LOGGED' && e.dateLogged >= prevStartMs && e.dateLogged < prevEndMs
    );

    const prevRev = prevPayments.reduce((sum: number, p: PaymentEntity) => sum + p.amount, 0);
    const prevExp = prevExpenses.reduce((sum: number, e: ExpenseEntity) => sum + e.amount, 0);
    const prevNet = prevRev - prevExp;

    // Verify if history is fully captured in local logs (oldest log starts before historic start)
    const oldestPaymentMs = allPaymentsState.length > 0
      ? Math.min(...allPaymentsState.map((p: PaymentEntity) => p.timestamp))
      : Date.now();
    const oldestExpenseMs = allExpensesState.length > 0
      ? Math.min(...allExpensesState.map((e: ExpenseEntity) => e.dateLogged))
      : Date.now();
    const oldestMs = Math.min(oldestPaymentMs, oldestExpenseMs);
    const isValid = oldestMs <= prevStartMs;

    if (!isValid) return null;

    // Margin moves in *points*, not percent-of-percent — "margin went from 31% to 34%" is a
    // 3-point move, not a 9.7% one, and reporting the latter would say something true but
    // unreadable.
    const prevMargin = prevRev > 0 ? (prevNet / prevRev) * 100 : null;
    const currentMargin = revenueVal > 0 ? (netVal / revenueVal) * 100 : null;

    return {
      revenue: prevRev > 0 ? ((revenueVal - prevRev) / prevRev) * 100 : null,
      expenses: prevExp > 0 ? ((expensesVal - prevExp) / prevExp) * 100 : null,
      net: prevNet !== 0 ? ((netVal - prevNet) / Math.abs(prevNet)) * 100 : null,
      marginPts: prevMargin !== null && currentMargin !== null ? currentMargin - prevMargin : null };
  };

  const compData = computeComparison();
  const marginVal = revenueVal > 0 ? (netVal / revenueVal) * 100 : 0;

  // ── Expense Categories Summation ─────────────────────────────────────────────
  const categoriesMap = {
    staff_salary: 0,
    groceries: 0,
    utilities: 0,
    maintenance: 0,
    internet: 0,
    other: 0 };

  const CATEGORY_LABELS = {
    staff_salary: 'Staff Salary',
    groceries: 'Groceries',
    utilities: 'Utilities',
    maintenance: 'Maintenance',
    internet: 'Internet',
    other: 'Other' };

  filteredExpenses.forEach((e: ExpenseEntity) => {
    const cat = e.category.toLowerCase().replace(' ', '_');
    if (cat in categoriesMap) {
      categoriesMap[cat as keyof typeof categoriesMap] += e.amount;
    } else {
      categoriesMap.other += e.amount;
    }
  });

  const categoriesList = Object.entries(categoriesMap).map(([key, amount]) => {
    const pct = expensesVal > 0 ? (amount / expensesVal) * 100 : 0;
    return {
      key,
      label: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] || key,
      amount,
      percentage: pct };
  });

  // ── Dynamic Insights Generation ──────────────────────────────────────────────
  const generateInsights = (): string[] => {
    const insights: string[] = [];
    if (revenueVal === 0 && expensesVal === 0) return [];

    // Profit Margin
    const margin = revenueVal > 0 ? (netVal / revenueVal) * 100 : 0;
    insights.push(`Average profit margin for this period stands at **${margin.toFixed(1)}%**.`);

    // Highest category
    const sortedCats = [...categoriesList].sort((a, b) => b.amount - a.amount);
    if (sortedCats[0] && sortedCats[0].amount > 0) {
      insights.push(
        `**${sortedCats[0].label}** is the highest expense driver, totaling **${formatMoney(sortedCats[0].amount)}** (**${sortedCats[0].percentage.toFixed(1)}%**).`
      );
    }

    // Monthly high/low
    if (monthlyBreakdown.length >= 2) {
      const sortedByRev = [...monthlyBreakdown].sort((a, b) => b.revenue - a.revenue);
      insights.push(
        `Highest revenue month was **${sortedByRev[0].period}** (**${formatMoney(sortedByRev[0].revenue)}**).`
      );

      const sortedByNet = [...monthlyBreakdown].sort((a, b) => b.net - a.net);
      insights.push(
        `Highest net profit was recorded in **${sortedByNet[0].period}** (**${formatMoney(sortedByNet[0].net)}**).`
      );
    }

    // Period over period change
    if (compData && compData.net !== null) {
      const isPos = compData.net > 0;
      insights.push(
        `Net profit is **${isPos ? 'up' : 'down'} by ${Math.abs(compData.net).toFixed(1)}%** compared to the previous period.`
      );
    }

    return insights;
  };

  const insights = generateInsights();

  // ── Format Helper for Dates ──────────────────────────────────────────────────
  function formatDateLabel(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (Number.isNaN(year) || Number.isNaN(monthIdx) || Number.isNaN(day)) return dateStr;
    const date = new Date(year, monthIdx, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }

  // ── Deck cards ────────────────────────────────────────────────────────────────
  // Net / Revenue / Expenses / Margin — the four numbers the KPI cards used to show
  // separately, now paged as one deck. Each card's tint is its own kind of number: brand for
  // the headline, green for money in, amber for money out, slate for a ratio.
  const deckCards: DeckCardData[] = [
    {
      key: 'net', tint: 'brand', label: 'Net profit', value: formatMoney(netVal),
      ...pctDelta(compData?.net ?? null) },
    {
      key: 'revenue', tint: 'green', label: 'Revenue', value: formatMoney(revenueVal),
      ...pctDelta(compData?.revenue ?? null) },
    {
      key: 'expenses', tint: 'amber', label: 'Expenses', value: formatMoney(expensesVal),
      ...pctDelta(compData?.expenses ?? null, /* invert */ true) },
    {
      key: 'margin', tint: 'slate', label: 'Margin', value: `${marginVal.toFixed(1)}%`,
      ...ptsDelta(compData?.marginPts ?? null) },
  ];

  // ── Chart data ────────────────────────────────────────────────────────────────
  // Revenue and expenses producing `period` in two different shapes — "2026-08" from the
  // server, "Aug 2026" from the client-computed custom-range fallback — was already true of
  // this screen before this pass; a 12-bar chart is where that stopped being hideable in a
  // table cell. One normalizer for both.
  const chartData: TrendChartPoint[] = monthlyBreakdown.map((row) => ({
    label: shortMonthLabel(row.period),
    values: { revenue: row.revenue, expenses: row.expenses } }));
  const chartSeries: TrendChartSeries[] = [
    { key: 'revenue', color: Colors.primary, label: 'Revenue' },
    { key: 'expenses', color: Colors.danger, label: 'Expenses' },
  ];

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <HubScreenWrapper
      refreshControl={<RefreshControl refreshing={isPnlRefetching} onRefresh={refetchPnl} />}
      title="P&L Analytics"
      subtitle={owner?.pgName ?? 'Property Financials'}
      icon="stats-chart"
    >
      {/* Period Selector Tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((t) => {
          const isSel = interval === t.key;
          return (
            <AnimatedPress accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
              key={t.key}
              style={[styles.tabButton, isSel && styles.tabButtonSel]}
              onPress={() => {
                setInterval(t.key);
              }}
              testID={`pnl_interval_${t.key}`}
            >
              <Txt maxFontSizeMultiplier={1.3} style={[styles.tabLabel, isSel && styles.tabLabelSel]}>{t.label}</Txt>
            </AnimatedPress>
          );
        })}
      </View>

      {/* Custom Range Picker */}
      {interval === 'custom' && (
        <View style={styles.customCard}>
          <Row justify="space-between" align="center">
            <Txt maxFontSizeMultiplier={1.3} style={styles.customTitle}>Custom range</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.customDateDisplay}>
              {formatDateLabel(customStart)} → {formatDateLabel(customEnd)}
            </Txt>
          </Row>
          <Spacer size={12} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {RANGE_PRESETS.map((preset) => {
              const p = { label: preset.label, ...preset.range() };
              const isSel = p.start === customStart && p.end === customEnd;
              return (
              <AnimatedPress accessibilityRole="button"
                key={p.label}
                accessibilityState={{ selected: isSel }}
                style={[styles.presetChip, isSel && styles.presetChipSel]}
                onPress={() => {
                  setCustomStart(p.start);
                  setCustomEnd(p.end);
                }}
              >
                <Txt maxFontSizeMultiplier={1.3} style={[styles.presetChipText, isSel && styles.presetChipTextSel]}>{p.label}</Txt>
              </AnimatedPress>
              );
            })}
          </Row>
        </View>
      )}

      <Spacer size={16} />

      {/* KPI Cards Row */}
      {isApiLoading && !isCustomMode ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={GREEN} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.loadingText}>Loading financials...</Txt>
        </View>
      ) : isApiError && !isCustomMode ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={24} color={Colors.danger} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.errorText}>
            {(apiError as Error)?.message ?? 'Failed to load P&L'}
          </Txt>
        </View>
      ) : revenueVal === 0 && expensesVal === 0 && monthlyBreakdown.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={40} color={MUTED} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.emptyTitle}>No financial data available</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.emptySub}>
            There is no recorded revenue or expense data for this period.
          </Txt>
        </View>
      ) : (
        <Col gap={20}>
          <MetricDeck cards={deckCards} sidePadding={sidePadding} testID="pnl_deck" />

          {/* Revenue vs expenses, month by month. Full-bleed — no card, no gridlines; the
              deck above already carries the exact figures. */}
          {chartData.length > 0 && (
            <TrendChart data={chartData} series={chartSeries} height={80} testID="pnl_chart" />
          )}

          {/* Where it went */}
          <View>
            <ListSectionHeader title="Where it went" count={categoriesList.filter((c) => c.amount > 0).length} />
            <View style={styles.rowGroup}>
              {categoriesList.filter((c) => c.amount > 0).map((c, i, arr) => (
                <MetricRow
                  key={c.key}
                  label={c.label}
                  meta={`${c.percentage.toFixed(0)}% of expenses`}
                  value={formatMoney(c.amount)}
                  last={i === arr.length - 1}
                  testID={`pnl_category_${c.key}`}
                />
              ))}
              {categoriesList.every((c) => c.amount === 0) && (
                <Txt maxFontSizeMultiplier={1.3} style={styles.insightEmptyText}>No expenses logged for this period.</Txt>
              )}
            </View>
          </View>

          {/* Dynamic Insights */}
          <View style={styles.sectionCard}>
            <Row gap={8} align="center">
              <Ionicons name="bulb" size={18} color={GREEN} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.insightHeaderTitle}>Dynamic Insights</Txt>
            </Row>
            <Spacer size={12} />
            {insights.length === 0 ? (
              <Txt maxFontSizeMultiplier={1.3} style={styles.insightEmptyText}>
                Not enough data to generate insights for this period.
              </Txt>
            ) : (
              <Col gap={8}>
                {insights.map((item, idx) => (
                  <View key={idx} style={styles.insightRow}>
                    <View style={styles.insightBullet} />
                    <Txt maxFontSizeMultiplier={1.3} style={styles.insightText}>
                      {item.split('**').map((chunk, i) => (
                        <Txt maxFontSizeMultiplier={1.3} key={i} style={i % 2 === 1 ? { fontWeight: '700' } : null}>
                          {chunk}
                        </Txt>
                      ))}
                    </Txt>
                  </View>
                ))}
              </Col>
            )}
          </View>
        </Col>
      )}

      <Spacer size={20} />
    </HubScreenWrapper>
  );
}

// ── Deck delta formatters ────────────────────────────────────────────────────
// `MetricDeck` wants a plain string plus an 'up' | 'down' | 'flat' tone, not the 5-tone
// `StatusTone` palette `MetricRow` uses — a deck card's own tint already carries most of the
// colour, the delta only ever needs to say "good" or "bad" against it.
function pctDelta(value: number | null, invert = false): { delta?: string; deltaTone?: 'up' | 'down' | 'flat' } {
  if (value === null || value === 0) return {};
  const isPos = value > 0;
  const good = invert ? !isPos : isPos;
  return { delta: `${isPos ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`, deltaTone: good ? 'up' : 'down' };
}

function ptsDelta(value: number | null): { delta?: string; deltaTone?: 'up' | 'down' | 'flat' } {
  if (value === null || Math.abs(value) < 0.05) return {};
  const isPos = value > 0;
  return { delta: `${isPos ? '↑' : '↓'} ${Math.abs(value).toFixed(1)} pts`, deltaTone: isPos ? 'up' : 'down' };
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `period` arrives in two different shapes from two different producers — "2026-08" from the
 * server (`toPnLData`), "Aug 2026" from this screen's own client-computed custom-range
 * fallback (`getMonthKey`) — a pre-existing mismatch the old table hid by printing whichever
 * string showed up. A chart with up to 12 bars is where that stops being hideable.
 */
function shortMonthLabel(period: string): string {
  const iso = period.match(/^(\d{4})-(\d{2})$/);
  if (iso) return MONTH_ABBR[parseInt(iso[2], 10) - 1] ?? period;
  const word = period.match(/^[A-Za-z]+/);
  return word ? word[0].slice(0, 3) : period.slice(0, 3);
}

// ── Format Money ─────────────────────────────────────────────────────────────
function formatMoney(n: number): string {
  if (!isFinite(n)) return '₹0';
  const prefix = n < 0 ? '-₹' : '₹';
  return `${prefix}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 3,
    height: 48,
    alignItems: 'center' },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS - 3 },
  tabButtonSel: {
    backgroundColor: GREEN },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CHARCOAL },
  tabLabelSel: {
    color: WHITE,
    fontWeight: '700' },

  // Custom Range
  customCard: {
    backgroundColor: WHITE,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginTop: 12 },
  customTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  customDateDisplay: { fontSize: 13, fontWeight: '700', color: GREEN },
  presetChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.control,
    backgroundColor: '#EEF2FF' },
  presetChipSel: { backgroundColor: GREEN },
  presetChipText: { fontSize: 12, fontWeight: '700', color: GREEN },
  presetChipTextSel: { color: Colors.textInverse },

  // Where it went — plain `MetricRow`s, grouped by the same hairline every row group in the
  // app now uses (see `Colors.separator` / `ListRow`).
  rowGroup: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.separator },

  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16 },

  // Insight
  insightHeaderTitle: { fontSize: 15, fontWeight: '700', color: GREEN },
  insightEmptyText: { fontSize: 12, color: MUTED },
  insightRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingRight: 10 },
  insightBullet: { width: 6, height: 6, borderRadius: Radii.pill, backgroundColor: GREEN, marginTop: 6 },
  insightText: { fontSize: 12, color: CHARCOAL, lineHeight: 18 },

  // States
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: Radii.sheet },
  loadingText: { fontSize: 13, color: MUTED },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: Radii.sheet },
  errorText: { fontSize: 13, color: Colors.danger, fontWeight: '600' },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: BORDER },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL, marginTop: 10 },
  emptySub: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 4 } });
