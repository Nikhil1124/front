/**
 * TrendChart — the one bar chart in this app.
 *
 * Replaces two independent SVG implementations that differed only in what they plotted —
 * `PnLChart`'s revenue/expense bars and `RSVPTrendsScreen`'s eating/skipped bars were the
 * same component, written twice, a hundred lines apart, with their own gridline and axis
 * code each.
 *
 * No gridlines, no y-axis: the old chart drew four dashed gridlines with a value label on
 * each, which the flat, white-ground direction doesn't want — the exact numbers already live
 * in the rows below the chart, so the chart's only job is to show the shape. One series draws
 * recency bars (every bar but the last is a pale tint of the same colour, the last is full
 * colour — the way a sparkline says "and now"); two series draws a grouped bar per point with
 * a legend underneath, for when both halves of a number matter equally (revenue vs expenses,
 * eating vs skipping).
 *
 * Self-measures via `onLayout` rather than assuming the screen width, so it works full-bleed
 * inside a deck card, a section, or anywhere else — no caller has to compute its own width.
 *
 * ── Scrub-to-inspect ─────────────────────────────────────────────────────────────────────────
 * Drag a finger across the bars and a small readout follows, snapping from bar to bar and
 * naming the exact value(s) under it — this is direct manipulation, so the readout's own
 * appear/move/disappear are springs, per the same rule the rest of this pass's motion work
 * follows (see AnimatedPress's doc comment for the longer version of that rule).
 *
 * The pan only activates after ~8px of clearly HORIZONTAL movement (`activeOffsetX` /
 * `failOffsetY` below) — this chart usually sits inside a vertically scrolling screen, and
 * without that threshold a touch that starts on the chart but is actually a scroll attempt
 * would get hijacked instead of falling through to the ScrollView beneath it. The threshold
 * is what makes a deliberate horizontal drag still feel instant while an accidental brush or
 * a vertical swipe passes straight through.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Svg, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Txt } from './Txt';
import { Colors, Radii } from '@/theme';
import { fontFamilyForWeight } from '@/theme/typography';

export interface TrendChartSeries {
  key: string;
  color: string;
  /** Shown in the legend when there is more than one series. Ignored for a single series —
   *  a lone series never draws a legend, the colour ramp already says "this is one thing". */
  label?: string;
}

export interface TrendChartPoint {
  /** Already-abbreviated x-axis label — "Sep", "Mon". This component does no date formatting;
   *  every screen's own calendar logic already produces one. */
  label: string;
  values: Record<string, number>;
}

export interface TrendChartProps {
  data: TrendChartPoint[];
  series: readonly TrendChartSeries[];
  /** Plot height in px, not counting the axis-label row below it. */
  height?: number;
  /** Formats a raw value for the scrub readout. Defaults to plain locale grouping — pass
   *  `formatINR` or similar for a chart whose values are currency. */
  formatValue?: (n: number) => string;
  testID?: string;
}

const AXIS_HEIGHT = 18;
const MAX_SINGLE_BAR_WIDTH = 28;
const MAX_GROUPED_BAR_WIDTH = 14;
const GROUP_GAP = 3;
const TOOLTIP_WIDTH = 104;
const TOOLTIP_GAP_ABOVE_BAR = 10;
const SNAP_SPRING = { duration: 260, dampingRatio: 0.85 } as const;

export function TrendChart({
  data, series, height = 72, formatValue = (n) => Math.round(n).toLocaleString('en-IN'), testID,
}: TrendChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const showLegend = series.length > 1;
  const groupWidth = data.length > 0 ? width / data.length : 0;

  // Tooltip motion: `visible` fades/scales it in and out, `tooltipX` is its centre, both
  // springs because both are driven by a finger, not by data changing on its own.
  const visible = useSharedValue(0);
  const tooltipX = useSharedValue(0);

  useEffect(() => {
    if (activeIndex == null || width === 0) return;
    tooltipX.value = withSpring(groupWidth * activeIndex + groupWidth / 2, SNAP_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, groupWidth]);

  const tooltipStyle = useAnimatedStyle(() => {
    const clampedCenter = Math.max(TOOLTIP_WIDTH / 2, Math.min(width - TOOLTIP_WIDTH / 2, tooltipX.value));
    return {
      opacity: visible.value,
      transform: [
        { translateX: clampedCenter - TOOLTIP_WIDTH / 2 },
        { scale: 0.85 + visible.value * 0.15 },
      ],
    };
  });

  const indexFromX = (x: number) => Math.max(0, Math.min(data.length - 1, Math.floor(x / Math.max(1, groupWidth))));

  const pan = Gesture.Pan()
    .enabled(data.length > 1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      visible.value = withSpring(1, SNAP_SPRING);
      runOnJS(setActiveIndex)(indexFromX(e.x));
    })
    .onUpdate((e) => {
      runOnJS(setActiveIndex)(indexFromX(e.x));
    })
    .onFinalize(() => {
      visible.value = withTiming(0, { duration: 150 });
      runOnJS(setActiveIndex)(null);
    });

  const activePoint = activeIndex != null ? data[activeIndex] : null;

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={onLayout} testID={testID}>
        {activePoint && (
          <Animated.View pointerEvents="none" style={[styles.tooltip, tooltipStyle]}>
            <Txt variant="caption" weight="600" color={Colors.surface} align="center">{activePoint.label}</Txt>
            {series.map((s) => (
              <View key={s.key} style={styles.tooltipRow}>
                {showLegend && <View style={[styles.tooltipDot, { backgroundColor: s.color }]} />}
                <Txt variant="meta" weight="600" color={Colors.surface} tabular>
                  {formatValue(activePoint.values[s.key] ?? 0)}
                </Txt>
              </View>
            ))}
          </Animated.View>
        )}
        {width > 0 && data.length > 0 && (
          <Svg width={width} height={height + AXIS_HEIGHT}>
            <Line x1={0} y1={height} x2={width} y2={height} stroke={Colors.separator} strokeWidth={1} />
            {data.map((point, i) => {
              const groupX = groupWidth * i;
              const isActive = activeIndex === i;
              const labelNode = (
                <SvgText
                  x={groupX + groupWidth / 2}
                  y={height + 13}
                  fontFamily={fontFamilyForWeight(isActive ? '600' : '400')}
                  fontSize={10.5}
                  fontWeight={isActive ? '600' : '400'}
                  fill={isActive ? Colors.textPrimary : Colors.textMuted}
                  textAnchor="middle"
                >
                  {point.label}
                </SvgText>
              );

              if (series.length <= 1) {
                const s = series[0];
                if (!s) return <G key={point.label + i}>{labelNode}</G>;
                const value = point.values[s.key] ?? 0;
                const barWidth = Math.min(MAX_SINGLE_BAR_WIDTH, groupWidth * 0.5);
                const barHeight = Math.max(2, (value / max) * (height - 4));
                const x = groupX + (groupWidth - barWidth) / 2;
                const isLast = i === data.length - 1;
                // Pale tint for "not yet now", full colour for the latest point — an ~20%
                // opacity suffix on the series colour, not a second token. Scrubbing onto an
                // earlier bar promotes it to full colour too, the same way isLast already
                // does — "the one you're looking at" and "the most recent one" are the same
                // kind of emphasis.
                const fill = isLast || isActive ? s.color : `${s.color}33`;
                return (
                  <G key={point.label + i}>
                    <Rect x={x} y={height - barHeight} width={barWidth} height={barHeight} rx={4} fill={fill} />
                    {labelNode}
                  </G>
                );
              }

              const barWidth = Math.min(
                MAX_GROUPED_BAR_WIDTH,
                (groupWidth - GROUP_GAP * (series.length + 1)) / series.length,
              );
              const totalBarsWidth = barWidth * series.length + GROUP_GAP * (series.length - 1);
              const startX = groupX + (groupWidth - totalBarsWidth) / 2;
              return (
                <G key={point.label + i}>
                  {series.map((s, si) => {
                    const value = point.values[s.key] ?? 0;
                    const barHeight = Math.max(2, (value / max) * (height - 4));
                    const x = startX + si * (barWidth + GROUP_GAP);
                    return (
                      <Rect
                        key={s.key} x={x} y={height - barHeight} width={barWidth} height={barHeight} rx={3}
                        fill={s.color}
                        opacity={activeIndex == null || isActive ? 1 : 0.45}
                      />
                    );
                  })}
                  {labelNode}
                </G>
              );
            })}
          </Svg>
        )}
        {showLegend && (
          <View style={styles.legend}>
            {series.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Txt variant="caption" color={Colors.textMuted}>{s.label ?? s.key}</Txt>
              </View>
            ))}
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: Radii.pill },
  tooltip: {
    // Pinned near the TOP of the plot area itself, not floated above the whole component —
    // this component is embedded in a different amount of whitespace on every screen that
    // uses it, and a negative offset large enough to clear one screen's heading would
    // overlap the next screen's. Sitting inside its own bounds costs an occasional pixel of
    // overlap with a very tall bar; escaping its bounds risked covering a sibling above it
    // on some caller, on every scrub, on every screen.
    position: 'absolute',
    top: TOOLTIP_GAP_ABOVE_BAR,
    width: TOOLTIP_WIDTH,
    left: 0,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radii.control,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
    zIndex: 10,
    elevation: 10,
  },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tooltipDot: { width: 6, height: 6, borderRadius: Radii.pill },
});
