/**
 * PnLChart (chart-slot wrapper) — fetches the P&L payload via `usePnL` and
 * delegates rendering to the real `PnLChart` at `@/components/PnLChart`.
 *
 * Why two files: the spec (Task 7) places the presentational chart at
 * `src/components/PnLChart.tsx` with `{ data, interval, onIntervalChange }`
 * props, so it is reusable in tests and previews. Task 8's screens import from
 * `@/components/charts/PnLChart` with `{ interval, onIntervalChange }` (the
 * data fetched internally). This file bridges the two: same import path Task 8
 * already uses, same prop contract Task 8 already calls, but the rendering is
 * the polished SVG chart from Task 7.
 *
 * If you are adding a NEW screen, prefer importing the presentational chart
 * directly:
 *
 *     import { PnLChart } from '@/components/PnLChart';
 *
 * and fetch the data yourself. This wrapper exists only so the existing
 * `AdminDashboardTab` import keeps working without a rewrite.
 */
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Palette } from '@/theme';
import { Card, Txt } from '@/components/ui';
import { PnLChart as PnLChartPresentational } from '@/components/PnLChart';
import { usePnL } from '@/features/billing/usePnL';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import type { PnLInterval } from '@/types';

export interface PnLChartProps {
  interval: PnLInterval;
  onIntervalChange: (interval: PnLInterval) => void;
}

export function PnLChart({ interval, onIntervalChange }: PnLChartProps) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const pgId = activePgId ?? owner?.id ?? null;
  const { data, isLoading, isError } = usePnL(pgId, interval);

  if (isLoading) {
    return (
      <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={20} padding={[24, 18]}>
        <View style={styles.state}>
          <ActivityIndicator color={Colors.CyberGreen} />
          <Txt size={11} color={Colors.SlateMutedText}>Loading P&amp;L…</Txt>
        </View>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={20} padding={[24, 18]}>
        <View style={styles.state}>
          <Txt size={11} color={Palette.StatusRed}>Couldn't load P&amp;L. Pull to refresh.</Txt>
        </View>
      </Card>
    );
  }

  return (
    <PnLChartPresentational
      data={data ?? { monthly: [], totals: { revenue: 0, expenses: 0, net: 0 } }}
      interval={interval}
      onIntervalChange={onIntervalChange}
    />
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
});

export default PnLChart;
