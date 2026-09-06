/**
 * RSVPTrendsScreen — eating vs. skipping per day, last 7 days.
 *
 * Reachable from both the owner dashboard and the chef's kitchen tab (two thin route
 * wrappers around this one component — see app/(owner)/rsvp-trends.tsx and
 * app/(staff)/rsvp-trends.tsx) since both need the same portion-planning read, gated
 * server-side by `require_staff` rather than owner/manager-only.
 *
 * Deliberately analytics only — no wastage prediction. The prototype's version simulated a
 * "cook 60% less next week" forecast off a fixed multiplier; that's a guess dressed up as a
 * number, not something this screen claims.
 */
import { useMemo, useState } from 'react';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useResponsivePadding } from '@/utils/responsive';
import { useRSVPTrends } from '@/features/meals/useRSVPTrends';
import type { MealRSVPTrendDay } from '@/features/meals/useMeals';
import { Card, Chip, ErrorState, LoadingState, MetricDeck, Row, Spacer, TrendChart, Txt, type DeckCardData, type TrendChartPoint, type TrendChartSeries } from '@/components/ui';

type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner';

const FILTERS: { key: MealFilter; label: string }[] = [
  { key: 'all', label: 'All Meals' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DayTotal {
  date: string;
  eating: number;
  skipped: number;
}

export function RSVPTrendsScreen() {
  const pgId = useAuthStore((s) => s.activePgId);
  const [filter, setFilter] = useState<MealFilter>('all');
  const sidePadding = useResponsivePadding();

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6); // last 7 days, inclusive of today
    return { startDate: isoDate(start), endDate: isoDate(end) };
  }, []);

  const { data, isLoading, isError, error, refetch } = useRSVPTrends(pgId, startDate, endDate);

  const chartData: DayTotal[] = useMemo(() => {
    const rows: MealRSVPTrendDay[] = (data?.daily ?? []).filter(
      (d) => filter === 'all' || d.meal_type === filter
    );
    const byDate = new Map<string, DayTotal>();
    for (const r of rows) {
      const entry = byDate.get(r.date) ?? { date: r.date, eating: 0, skipped: 0 };
      entry.eating += r.eating_portions;
      entry.skipped += r.skipped_portions;
      byDate.set(r.date, entry);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, filter]);

  const totalEating = chartData.reduce((sum, d) => sum + d.eating, 0);
  const totalSkipped = chartData.reduce((sum, d) => sum + d.skipped, 0);
  const complianceRate =
    totalEating + totalSkipped > 0
      ? Math.round((totalEating / (totalEating + totalSkipped)) * 100)
      : null;

  // Compliance leads (it's the synthesis of the other two), eating is the "good" inflow,
  // skipping is the number worth a second look — same three deck roles P&L uses.
  const deckCards: DeckCardData[] = [
    { key: 'compliance', tint: 'brand', label: 'Compliance', value: complianceRate !== null ? `${complianceRate}%` : '—' },
    { key: 'eating', tint: 'green', label: 'Eating', value: String(totalEating) },
    { key: 'skipping', tint: 'amber', label: 'Skipping', value: String(totalSkipped) },
  ];
  const trendPoints: TrendChartPoint[] = chartData.map((d) => ({
    label: shortWeekday(d.date),
    values: { eating: d.eating, skipped: d.skipped } }));
  const trendSeries: TrendChartSeries[] = [
    { key: 'eating', color: Colors.success, label: 'Eating' },
    { key: 'skipped', color: Colors.tertiary, label: 'Skipping' },
  ];

  return (
    <HubScreenWrapper title="RSVP Trends" subtitle="Last 7 days · portion planning">
      <Row gap={8}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            size={11}
          />
        ))}
      </Row>

      <Spacer size={16} />

      {isLoading ? (
        <LoadingState fill={false} label="Loading RSVP trends…" />
      ) : isError ? (
        <ErrorState error={error} title="Could not load RSVP trends" onRetry={refetch} fill={false} />
      ) : chartData.length === 0 ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[24, 24]}>
          <Txt variant="body" color={Colors.textMuted} align="center">
            No RSVP responses in the last 7 days yet.
          </Txt>
        </Card>
      ) : (
        <>
          <MetricDeck cards={deckCards} sidePadding={sidePadding} testID="rsvp_deck" />
          <Spacer size={20} />
          <TrendChart data={trendPoints} series={trendSeries} height={72} testID="rsvp_chart" />
        </>
      )}
    </HubScreenWrapper>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-08-25" → "Mon". Parsed as UTC-midnight explicitly — `new Date("2026-08-25")` is
 *  already UTC in JS, but spelling it out avoids ever depending on that being remembered. */
function shortWeekday(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return WEEKDAYS[d.getUTCDay()] ?? isoDay.slice(5);
}
