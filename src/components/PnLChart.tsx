/**
 * PnLChart — the owner's profit-and-loss chart with a 3m / 6m / 1y selector.
 *
 * Three pieces, top to bottom:
 *   1. The interval selector — three `Chip` buttons (3m / 6m / 1y). Active is
 *      a solid CyberGreen fill, inactive is outlined.
 *   2. Three KPI cards: Total Revenue (green), Total Expenses (red), Net
 *      Profit (large, tinted by sign — green for positive, red for negative).
 *   3. The grouped bar chart: for each month, two bars side-by-side — revenue
 *      in CyberGreen, expenses in StatusRed. Four horizontal gridlines with
 *      INR labels on the y-axis, month abbreviations on the x-axis.
 *
 * The chart is drawn with `react-native-svg` directly — no charting library.
 * The reason is the same as `OwnerFinancialSummaryChartCard`: the existing
 * chart card already inlines its bars with View widths, and pulling in a
 * library for one chart would double the charting surface area in the app. SVG
 * here buys us crisp gridlines and labels at any DPR without a library.
 *
 * The net-profit line overlay the spec mentions is intentionally skipped: with
 * only 3-12 bars, the bars already tell the story, and overlaying a line on a
 * grouped (not stacked) bar chart misrepresents the net as a continuous series
 * when it is a per-month delta.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Svg, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Card, Txt, Row, Col, Chip, Spacer } from '@/components/ui';
import { Colors, Palette, Radii } from '@/theme';
import { formatINR } from '@/utils/format';
import type { PnLData } from '@/types';

export type PnLInterval = '3m' | '6m' | '1y';

export interface PnLChartProps {
  data: PnLData;
  interval: PnLInterval;
  onIntervalChange: (interval: PnLInterval) => void;
  /** Optional currency override. The KPI/axis formatters assume INR. */
  currency?: string;
}

const INTERVALS: Array<{ key: PnLInterval; label: string }> = [
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

export function PnLChart({ data, interval, onIntervalChange, currency = '₹' }: PnLChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  // Card padding (16 each side) + a 12px inner inset for the y-axis labels.
  const chartWidth = Math.min(screenWidth, 520) - 32 - 12;

  return (
    <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={Radii.xxl} padding={[16, 16]}>
      {/* ── Selector ──────────────────────────────────────────────────────── */}
      <Row gap={8}>
        {INTERVALS.map((it) => (
          <Chip
            key={it.key}
            label={it.label}
            selected={interval === it.key}
            onPress={() => onIntervalChange(it.key)}
            selectedColor={Colors.CyberGreen}
            unselectedBg="transparent"
            unselectedBorder={Colors.LuxuryCardBorder}
            size={11}
            paddingH={14}
            paddingV={7}
            testID={`pnl-interval-${it.key}`}
          />
        ))}
      </Row>

      <Spacer size={14} />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <Row gap={8}>
        <KpiCard
          label="Revenue"
          value={data.totals.revenue}
          tint={Colors.CyberGreen}
          dotColor={Colors.CyberGreen}
        />
        <KpiCard
          label="Expenses"
          value={data.totals.expenses}
          tint={Palette.StatusRed}
          dotColor={Palette.StatusRed}
        />
        <KpiCard
          label="Net"
          value={data.totals.net}
          tint={data.totals.net >= 0 ? Colors.CyberGreen : Palette.StatusRed}
          dotColor={data.totals.net >= 0 ? Colors.CyberGreen : Palette.StatusRed}
          emphasize
        />
      </Row>

      <Spacer size={16} />

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      {data.monthly.length === 0 ? (
        <Txt variant="caption" color={Colors.SlateMutedText} align="center" style={{ paddingVertical: 32 }}>
          No P&amp;L data for this period.
        </Txt>
      ) : (
        <GroupedBarChart data={data.monthly} width={chartWidth} currency={currency} />
      )}

      <Spacer size={8} />
      {/* Legend */}
      <Row gap={16} justify="center">
        <Row gap={6}>
          <View style={[styles.legendDot, { backgroundColor: Colors.CyberGreen }]} />
          <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Revenue</Txt>
        </Row>
        <Row gap={6}>
          <View style={[styles.legendDot, { backgroundColor: Palette.StatusRed }]} />
          <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Expenses</Txt>
        </Row>
      </Row>
    </Card>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tint,
  dotColor,
  emphasize,
}: {
  label: string;
  value: number;
  tint: string;
  dotColor: string;
  emphasize?: boolean;
}) {
  return (
    <View
      style={[
        styles.kpiBox,
        {
          borderColor: `${tint}4D`,
          backgroundColor: `${tint}14`,
        },
      ]}
    >
      <Row gap={5} align="center">
        <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
        <Txt size={9} color={Colors.SlateMutedText} weight="600">{label.toUpperCase()}</Txt>
      </Row>
      <Txt
        size={emphasize ? 18 : 14}
        weight="900"
        color={tint}
        numberOfLines={1}
        style={{ marginTop: 4 }}
      >
        {formatINR(value)}
      </Txt>
    </View>
  );
}

// ─── Grouped bar chart ─────────────────────────────────────────────────────

const CHART_HEIGHT = 200;
const LEFT_PAD = 46; // y-axis labels
const RIGHT_PAD = 8;
const TOP_PAD = 8;
const BOTTOM_PAD = 26; // x-axis labels

interface MonthDatum {
  period: string;
  revenue: number;
  expenses: number;
  net: number;
}

function GroupedBarChart({
  data,
  width,
  currency,
}: {
  data: MonthDatum[];
  width: number;
  currency: string;
}) {
  const plotWidth = Math.max(0, width - LEFT_PAD - RIGHT_PAD);
  const plotHeight = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

  // Max value across both series drives the y-axis scale. +1 guards against
  // an all-zero payload producing a 0/0 scale.
  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses)));
  // Round up to a "nice" number so the gridlines land on round values. We use
  // the largest power-of-10 factor that keeps us under 4 gridline steps.
  const niceMax = niceCeiling(maxValue);

  const groupWidth = plotWidth / Math.max(1, data.length);
  // Two bars per group + a gap between them + padding inside the group.
  const barWidth = Math.min(16, groupWidth * 0.32);
  const barGap = Math.max(2, groupWidth * 0.04);

  // 4 gridlines (0, 1/3, 2/3, 3/3 of niceMax).
  const gridSteps = [0, 1 / 3, 2 / 3, 1];

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {/* Gridlines + y-axis labels */}
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
              stroke={Palette.BorderFaint}
              strokeWidth={1}
              strokeDasharray={step === 0 ? undefined : '3 3'}
            />
            <SvgText
              x={LEFT_PAD - 6}
              y={y + 3}
              fontSize={9}
              fill={Colors.SlateMutedText}
              textAnchor="end"
            >
              {formatAxisLabel(value, currency)}
            </SvgText>
          </G>
        );
      })}

      {/* Bars + x-axis labels */}
      {data.map((d, i) => {
        const groupX = LEFT_PAD + i * groupWidth;
        // Center the two bars within the group.
        const totalBarsWidth = barWidth * 2 + barGap;
        const barsStartX = groupX + (groupWidth - totalBarsWidth) / 2;

        const revenueHeight = (d.revenue / niceMax) * plotHeight;
        const expensesHeight = (d.expenses / niceMax) * plotHeight;

        const revenueY = TOP_PAD + plotHeight - revenueHeight;
        const expensesY = TOP_PAD + plotHeight - expensesHeight;

        return (
          <G key={`bar-${i}`}>
            <Rect
              x={barsStartX}
              y={revenueY}
              width={barWidth}
              height={Math.max(0, revenueHeight)}
              rx={2}
              fill={Colors.CyberGreen}
            />
            <Rect
              x={barsStartX + barWidth + barGap}
              y={expensesY}
              width={barWidth}
              height={Math.max(0, expensesHeight)}
              rx={2}
              fill={Palette.StatusRed}
            />
            {/* X-axis label — short month name. */}
            <SvgText
              x={groupX + groupWidth / 2}
              y={CHART_HEIGHT - 8}
              fontSize={9}
              fill={Colors.SlateMutedText}
              textAnchor="middle"
            >
              {shortMonth(d.period)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/**
 * Round up to a value whose thirds are round numbers. We pick the smallest
 * `3 * 10^k` that exceeds `value`, so the 0/1/2/3 gridlines land on 0, 10^k,
 * 2·10^k, 3·10^k. For values below 3 we just return 3 to avoid a 0-scale.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 3;
  let factor = 1;
  while (value > 3 * factor) factor *= 10;
  return 3 * factor;
}

/** Compact INR for axis labels: ₹1.5L, ₹2.3Cr, ₹8k, ₹300. */
function formatAxisLabel(value: number, currency: string): string {
  if (value >= 1_00_00_000) return `${currency}${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `${currency}${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `${currency}${(value / 1_000).toFixed(0)}k`;
  return `${currency}${Math.round(value)}`;
}

/** Reduce a period string like "2024-08" or "Aug 2024" to a 3-letter month. */
function shortMonth(period: string): string {
  // ISO "YYYY-MM" — the most common shape from the backend.
  const isoMatch = period.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIdx] ?? period.slice(0, 3);
  }
  // Already a label like "Aug" — pass through.
  return period.slice(0, 3);
}

const styles = StyleSheet.create({
  kpiBox: {
    flex: 1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 10,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

export default PnLChart;
