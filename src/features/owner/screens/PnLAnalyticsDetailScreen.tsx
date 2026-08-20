/**
 * PnLAnalyticsDetailScreen — Premium redesigned property-management financial dashboard.
 * Supports 3 Months, 6 Months, 1 Year, and Custom Range dynamically using real store data.
 * Pure flat design system: deep forest green (#176B3A) and off-white/canvas (#F7FAF7).
 */
import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Row, Col, Spacer } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { PnLChart as PnLChartPresentational } from '@/components/PnLChart';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePnL } from '@/features/billing/usePnL';
import { usePaymentsQuery } from '@/features/payments/usePayments';
import { useExpensesQuery } from '@/features/expenses/useExpenses';
import { hapticSelect } from '@/utils/haptics';
import type { PnLInterval } from '@/types';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#68736C';
const BORDER = '#E6EFEA';
const WHITE = '#FFFFFF';
const RADIUS = 16;

type AnalyticsInterval = PnLInterval | 'custom';

const TABS = [
  { key: '3m' as const, label: '3 Months' },
  { key: '6m' as const, label: '6 Months' },
  { key: '1y' as const, label: '1 Year' },
  { key: 'custom' as const, label: 'Custom Range 📅' },
];

export function PnLAnalyticsDetailScreen() {
  const [interval, setInterval] = useState<AnalyticsInterval>('3m');
  const [customStart, setCustomStart] = useState('2026-06-01');
  const [customEnd, setCustomEnd] = useState('2026-08-19');

  const owner = usePGowStore((s) => s.loggedInOwner);
  const activePgId = useAuthStore((s) => s.activePgId);
  const pgId = activePgId ?? owner?.id ?? null;

  // Only used for the custom-range branch below — the standard 3m/6m/1y intervals come from
  // usePnL's server-aggregated totals instead.
  const { data: allPaymentsState = [] } = usePaymentsQuery(pgId ?? undefined);
  const { data: allExpensesState = [] } = useExpensesQuery(pgId ?? undefined);

  // Fetch standard intervals via React Query
  const { data: apiData, isLoading: isApiLoading, isError: isApiError, error: apiError } = usePnL(
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
        end: new Date(customEnd),
      };
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
    (p) => p.status === 'VERIFIED' && p.timestamp >= startMs && p.timestamp <= endMs
  );

  const filteredExpenses = allExpensesState.filter(
    (e) => e.status === 'LOGGED' && e.dateLogged >= startMs && e.dateLogged <= endMs
  );

  // Group by calendar month for table/chart
  const getMonthKey = (dateMs: number) => {
    const d = new Date(dateMs);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return {
      key: `${year}-${month}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      date: new Date(year, d.getMonth(), 1),
    };
  };

  const calculatedMonthly = () => {
    const monthsMap: Record<
      string,
      { period: string; revenue: number; expenses: number; net: number; date: Date }
    > = {};

    filteredPayments.forEach((p) => {
      const { key, label, date } = getMonthKey(p.timestamp);
      if (!monthsMap[key]) {
        monthsMap[key] = { period: label, revenue: 0, expenses: 0, net: 0, date };
      }
      monthsMap[key].revenue += p.amount;
    });

    filteredExpenses.forEach((e) => {
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
    ? filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    : apiData?.totals?.revenue ?? 0;

  const expensesVal = isCustomMode
    ? filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
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
      (p) => p.status === 'VERIFIED' && p.timestamp >= prevStartMs && p.timestamp < prevEndMs
    );
    const prevExpenses = allExpensesState.filter(
      (e) => e.status === 'LOGGED' && e.dateLogged >= prevStartMs && e.dateLogged < prevEndMs
    );

    const prevRev = prevPayments.reduce((sum, p) => sum + p.amount, 0);
    const prevExp = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
    const prevNet = prevRev - prevExp;

    // Verify if history is fully captured in local logs (oldest log starts before historic start)
    const oldestPaymentMs = allPaymentsState.length > 0
      ? Math.min(...allPaymentsState.map((p) => p.timestamp))
      : Date.now();
    const oldestExpenseMs = allExpensesState.length > 0
      ? Math.min(...allExpensesState.map((e) => e.dateLogged))
      : Date.now();
    const oldestMs = Math.min(oldestPaymentMs, oldestExpenseMs);
    const isValid = oldestMs <= prevStartMs;

    if (!isValid) return null;

    return {
      revenue: prevRev > 0 ? ((revenueVal - prevRev) / prevRev) * 100 : null,
      expenses: prevExp > 0 ? ((expensesVal - prevExp) / prevExp) * 100 : null,
      net: prevNet !== 0 ? ((netVal - prevNet) / Math.abs(prevNet)) * 100 : null,
    };
  };

  const compData = computeComparison();

  // ── Expense Categories Summation ─────────────────────────────────────────────
  const categoriesMap = {
    staff_salary: 0,
    groceries: 0,
    utilities: 0,
    maintenance: 0,
    internet: 0,
    other: 0,
  };

  const CATEGORY_LABELS = {
    staff_salary: 'Staff Salary',
    groceries: 'Groceries',
    utilities: 'Utilities',
    maintenance: 'Maintenance',
    internet: 'Internet',
    other: 'Other',
  };

  filteredExpenses.forEach((e) => {
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
      percentage: pct,
    };
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

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <HubScreenWrapper
      title="P&L Analytics"
      subtitle={owner?.pgName ?? 'Property Financials'}
      icon="stats-chart"
    >
      {/* Period Selector Tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((t) => {
          const isSel = interval === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabButton, isSel && styles.tabButtonSel]}
              onPress={() => {
                hapticSelect();
                setInterval(t.key);
              }}
              activeOpacity={0.7}
              testID={`pnl_interval_${t.key}`}
            >
              <Text style={[styles.tabLabel, isSel && styles.tabLabelSel]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Range Picker */}
      {interval === 'custom' && (
        <View style={styles.customCard}>
          <Row justify="space-between" align="center">
            <Text style={styles.customTitle}>📅 Custom Date Range</Text>
            <Text style={styles.customDateDisplay}>
              {formatDateLabel(customStart)} → {formatDateLabel(customEnd)}
            </Text>
          </Row>
          <Spacer size={12} />
          <Row gap={12}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.dateInput}
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9EB09E"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.dateInput}
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9EB09E"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </Row>
          <Spacer size={10} />
          <Row gap={6}>
            {[
              { label: 'Current Month', start: '2026-08-01', end: '2026-08-31' },
              { label: 'Last 30 Days', start: '2026-07-20', end: '2026-08-19' },
              { label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30' },
            ].map((p) => (
              <TouchableOpacity
                key={p.label}
                style={styles.presetChip}
                onPress={() => {
                  setCustomStart(p.start);
                  setCustomEnd(p.end);
                }}
              >
                <Text style={styles.presetChipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </Row>
        </View>
      )}

      <Spacer size={16} />

      {/* KPI Cards Row */}
      {isApiLoading && !isCustomMode ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={GREEN} />
          <Text style={styles.loadingText}>Loading financials...</Text>
        </View>
      ) : isApiError && !isCustomMode ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={24} color="#B91C1C" />
          <Text style={styles.errorText}>
            {(apiError as Error)?.message ?? 'Failed to load P&L'}
          </Text>
        </View>
      ) : revenueVal === 0 && expensesVal === 0 && monthlyBreakdown.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={40} color={MUTED} />
          <Text style={styles.emptyTitle}>No financial data available</Text>
          <Text style={styles.emptySub}>
            There is no recorded revenue or expense data for this period.
          </Text>
        </View>
      ) : (
        <Col gap={16}>
          {/* KPI Summary Block */}
          <Row gap={10}>
            <View style={styles.kpiCard}>
              <Row gap={4} align="center">
                <Ionicons name="trending-up" size={14} color={GREEN} />
                <Text style={styles.kpiLabel}>REVENUE</Text>
              </Row>
              <Text style={[styles.kpiValue, { color: GREEN }]}>{formatMoney(revenueVal)}</Text>
              {compData && <ComparisonBadge value={compData.revenue} />}
            </View>

            <View style={styles.kpiCard}>
              <Row gap={4} align="center">
                <Ionicons name="trending-down" size={14} color="#B91C1C" />
                <Text style={styles.kpiLabel}>EXPENSES</Text>
              </Row>
              <Text style={[styles.kpiValue, { color: '#B91C1C' }]}>
                {formatMoney(expensesVal)}
              </Text>
              {compData && <ComparisonBadge value={compData.expenses} isExpense />}
            </View>

            <View style={styles.kpiCard}>
              <Row gap={4} align="center">
                <Ionicons name="cash" size={14} color={netVal >= 0 ? GREEN : '#B91C1C'} />
                <Text style={styles.kpiLabel}>NET PROFIT</Text>
              </Row>
              <Text style={[styles.kpiValue, { color: netVal >= 0 ? GREEN : '#B91C1C' }]}>
                {formatMoney(netVal)}
              </Text>
              {compData && <ComparisonBadge value={compData.net} />}
            </View>
          </Row>

          {/* 1 Year Compact Chart (only on standard 1y mode) */}
          {interval === '1y' && (
            <PnLChartPresentational
              data={apiData ?? { monthly: [], totals: { revenue: 0, expenses: 0, net: 0 } }}
              interval="1y"
              onIntervalChange={() => {}}
            />
          )}

          {/* Monthly Breakdown Table */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>📅 Monthly Breakdown</Text>
            <Spacer size={12} />
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 1.5 }]}>Month</Text>
                <Text style={[styles.thCell, styles.thRight]}>Revenue</Text>
                <Text style={[styles.thCell, styles.thRight]}>Expenses</Text>
                <Text style={[styles.thCell, styles.thRight]}>Net Profit</Text>
              </View>
              {monthlyBreakdown.map((row, idx) => (
                <View key={row.period || idx} style={styles.tableRow}>
                  <Text style={[styles.tdCell, { flex: 1.5, fontWeight: '700' }]}>
                    {row.period}
                  </Text>
                  <Text style={[styles.tdCell, styles.tdRight, { color: GREEN }]}>
                    {formatMoney(row.revenue)}
                  </Text>
                  <Text style={[styles.tdCell, styles.tdRight, { color: '#B91C1C' }]}>
                    {formatMoney(row.expenses)}
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      styles.tdRight,
                      { color: row.net >= 0 ? GREEN : '#B91C1C', fontWeight: '800' },
                    ]}
                  >
                    {formatMoney(row.net)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* P&L Summary (Category Breakdown) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>📊 P&L Summary</Text>
            <Spacer size={12} />
            <Row justify="space-between" style={styles.pnlSummaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Collected</Text>
                <Text style={[styles.summaryVal, { color: GREEN }]}>{formatMoney(revenueVal)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View>
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text style={[styles.summaryVal, { color: '#B91C1C' }]}>
                  {formatMoney(expensesVal)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View>
                <Text style={styles.summaryLabel}>Net Profit</Text>
                <Text style={[styles.summaryVal, { color: netVal >= 0 ? GREEN : '#B91C1C' }]}>
                  {formatMoney(netVal)}
                </Text>
              </View>
            </Row>

            <Spacer size={20} />
            <Text style={styles.subSectionTitle}>Expense Categories</Text>
            <Spacer size={10} />
            <Col gap={8}>
              {categoriesList.map((c) => (
                <View key={c.key} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{c.label}</Text>
                  <Row gap={8} align="center">
                    <Text style={styles.categoryAmount}>{formatMoney(c.amount)}</Text>
                    <View style={styles.categoryPercentagePill}>
                      <Text style={styles.categoryPercentageText}>{c.percentage.toFixed(1)}%</Text>
                    </View>
                  </Row>
                </View>
              ))}
            </Col>
          </View>

          {/* Dynamic Insights */}
          <View style={[styles.sectionCard, { backgroundColor: '#F0FDF4', borderColor: '#C6E8D4' }]}>
            <Row gap={8} align="center">
              <Ionicons name="bulb" size={18} color={GREEN} />
              <Text style={styles.insightHeaderTitle}>Dynamic Insights</Text>
            </Row>
            <Spacer size={12} />
            {insights.length === 0 ? (
              <Text style={styles.insightEmptyText}>
                Not enough data to generate insights for this period.
              </Text>
            ) : (
              <Col gap={8}>
                {insights.map((item, idx) => (
                  <View key={idx} style={styles.insightRow}>
                    <View style={styles.insightBullet} />
                    <Text style={styles.insightText}>
                      {item.split('**').map((chunk, i) => (
                        <Text key={i} style={i % 2 === 1 ? { fontWeight: '700' } : null}>
                          {chunk}
                        </Text>
                      ))}
                    </Text>
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

// ── Comparison Badge Component ───────────────────────────────────────────────
function ComparisonBadge({ value, isExpense = false }: { value: number | null; isExpense?: boolean }) {
  if (value === null || value === 0) return null;
  const isPos = value > 0;
  const formatted = `${isPos ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`;
  const isGood = isExpense ? !isPos : isPos;
  const color = isGood ? GREEN : '#9F1239';

  return (
    <Text style={[styles.compText, { color }]}>
      {formatted} <Text style={{ color: MUTED }}>vs prev</Text>
    </Text>
  );
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
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS - 3,
  },
  tabButtonSel: {
    backgroundColor: GREEN,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CHARCOAL,
  },
  tabLabelSel: {
    color: WHITE,
    fontWeight: '800',
  },

  // Custom Range
  customCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginTop: 12,
  },
  customTitle: { fontSize: 13, fontWeight: '800', color: CHARCOAL },
  customDateDisplay: { fontSize: 13, fontWeight: '700', color: GREEN },
  inputLabel: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 5 },
  dateInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    paddingHorizontal: 12,
    fontSize: 13,
    color: CHARCOAL,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EAF5EE',
  },
  presetChipText: { fontSize: 11, fontWeight: '700', color: GREEN },

  // KPI
  kpiCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: MUTED, letterSpacing: 0.5 },
  kpiValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  compText: { fontSize: 10, fontWeight: '700', marginTop: 4 },

  // Table
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  tableWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  thCell: { fontSize: 11, fontWeight: '700', color: MUTED },
  thRight: { flex: 1, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tdCell: { fontSize: 12, color: CHARCOAL },
  tdRight: { flex: 1, textAlign: 'right' },

  // Category
  subSectionTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  categoryLabel: { fontSize: 13, color: CHARCOAL },
  categoryAmount: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  categoryPercentagePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  categoryPercentageText: { fontSize: 11, fontWeight: '600', color: MUTED },

  // P&L summary row
  pnlSummaryRow: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 2 },
  summaryVal: { fontSize: 14, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: BORDER },

  // Insight
  insightHeaderTitle: { fontSize: 15, fontWeight: '700', color: GREEN },
  insightEmptyText: { fontSize: 12, color: MUTED },
  insightRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingRight: 10 },
  insightBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginTop: 6 },
  insightText: { fontSize: 12, color: CHARCOAL, lineHeight: 18 },

  // States
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: 20,
  },
  loadingText: { fontSize: 13, color: MUTED },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: 20,
  },
  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600' },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL, marginTop: 10 },
  emptySub: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 4 },
});
