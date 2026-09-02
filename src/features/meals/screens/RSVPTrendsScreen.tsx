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
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Svg, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Card, Txt, Row, Chip, Spacer, LoadingState, ErrorState } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useRSVPTrends } from '@/features/meals/useRSVPTrends';
import type { MealRSVPTrendDay } from '@/features/meals/useMeals';

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
        <Card containerColor={Colors.surface} borderRadius={Radii.xxl} padding={[24, 24]}>
          <Txt variant="body" color={Colors.textMuted} align="center">
            No RSVP responses in the last 7 days yet.
          </Txt>
        </Card>
      ) : (
        <>
          {complianceRate !== null && (
            <>
              <Row gap={8}>
                <StatTile label="Eating" value={totalEating} tint={Colors.success} />
                <StatTile label="Skipping" value={totalSkipped} tint={Colors.tertiary} />
                <StatTile label="Compliance" value={`${complianceRate}%`} tint={Colors.primary} />
              </Row>
              <Spacer size={16} />
            </>
          )}
          <Card containerColor={Colors.surface} borderRadius={Radii.xxl} padding={[16, 16]}>
            <TrendChart data={chartData} />
            <Spacer size={10} />
            <Row gap={16} justify="center">
              <Row gap={6}>
                <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                <Txt variant="labelSmall" color={Colors.textMuted}>Eating</Txt>
              </Row>
              <Row gap={6}>
                <View style={[styles.dot, { backgroundColor: Colors.tertiary }]} />
                <Txt variant="labelSmall" color={Colors.textMuted}>Skipping</Txt>
              </Row>
            </Row>
          </Card>
        </>
      )}
    </HubScreenWrapper>
  );
}

function StatTile({ label, value, tint }: { label: string; value: number | string; tint: string }) {
  return (
    <View style={[styles.statTile, { borderColor: `${tint}4D`, backgroundColor: `${tint}14` }]}>
      <Txt size={9} weight="700" color={Colors.textMuted}>{label.toUpperCase()}</Txt>
      <Txt size={16} weight="900" color={tint} style={{ marginTop: 2 }}>{value}</Txt>
    </View>
  );
}

// ─── Chart ───────────────────────────────────────────────────────────────────
// Same grouped-bar-chart technique as PnLChart (react-native-svg directly, no charting
// library) — plotting integer portions instead of currency.

const CHART_HEIGHT = 180;
const LEFT_PAD = 30;
const RIGHT_PAD = 8;
const TOP_PAD = 8;
const BOTTOM_PAD = 24;

function TrendChart({ data }: { data: DayTotal[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, 520) - 32 - 12;
  const plotWidth = Math.max(0, width - LEFT_PAD - RIGHT_PAD);
  const plotHeight = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.eating, d.skipped)));
  const niceMax = niceCeiling(maxValue);

  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(16, groupWidth * 0.32);
  const barGap = Math.max(2, groupWidth * 0.04);
  const gridSteps = [0, 1 / 3, 2 / 3, 1];

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {gridSteps.map((step, i) => {
        const value = niceMax * step;
        const y = TOP_PAD + plotHeight * (1 - step);
        return (
          <G key={`grid-${i}`}>
            <Line
              x1={LEFT_PAD}
              y1={y}
              x2={LEFT_PAD + plotWidth}
              y2={y}
              stroke={Colors.borderSubtle}
              strokeWidth={1}
              strokeDasharray={step === 0 ? undefined : '3 3'}
            />
            <SvgText x={LEFT_PAD - 6} y={y + 3} fontSize={9} fill={Colors.textMuted} textAnchor="end">
              {Math.round(value)}
            </SvgText>
          </G>
        );
      })}

      {data.map((d, i) => {
        const groupX = LEFT_PAD + i * groupWidth;
        const totalBarsWidth = barWidth * 2 + barGap;
        const barsStartX = groupX + (groupWidth - totalBarsWidth) / 2;

        const eatingHeight = (d.eating / niceMax) * plotHeight;
        const skippedHeight = (d.skipped / niceMax) * plotHeight;

        return (
          <G key={`bar-${i}`}>
            <Rect
              x={barsStartX}
              y={TOP_PAD + plotHeight - eatingHeight}
              width={barWidth}
              height={Math.max(0, eatingHeight)}
              rx={2}
              fill={Colors.success}
            />
            <Rect
              x={barsStartX + barWidth + barGap}
              y={TOP_PAD + plotHeight - skippedHeight}
              width={barWidth}
              height={Math.max(0, skippedHeight)}
              rx={2}
              fill={Colors.tertiary}
            />
            <SvgText x={groupX + groupWidth / 2} y={CHART_HEIGHT - 6} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
              {shortWeekday(d.date)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function niceCeiling(value: number): number {
  if (value <= 0) return 3;
  let factor = 1;
  while (value > 3 * factor) factor *= 10;
  return 3 * factor;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-08-25" → "Mon". Parsed as UTC-midnight explicitly — `new Date("2026-08-25")` is
 *  already UTC in JS, but spelling it out avoids ever depending on that being remembered. */
function shortWeekday(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return WEEKDAYS[d.getUTCDay()] ?? isoDay.slice(5);
}

const styles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  statTile: { flex: 1, borderRadius: Radii.lg, borderWidth: 1, padding: 10, alignItems: 'center' },
});
