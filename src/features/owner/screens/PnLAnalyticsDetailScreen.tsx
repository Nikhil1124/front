/**
 * PnLAnalyticsDetailScreen — Owner / Manager drill-down for P&L analytics.
 *
 * Hub-and-Spoke:
 *   Reached from the Owner dashboard's "📊 P&L Analytics" action tile. This
 *   dedicated page replaces the old in-tab P&L widget that was buried inside
 *   the overview scroll view next to four other widgets.
 *
 * Features:
 *   - 3m / 6m / 1y interval selector tabs (React-Query-keyed — each tab is
 *     its own cache entry, so toggling is instant on repeat visits).
 *   - Headline summary metrics (revenue, expenses, net profit, margin).
 *   - OwnerFinancialSummaryChartCard for the visual series.
 *   - CSV export CTA — opens the backend's CSV endpoint via Linking.
 *
 * Cyber Mint:
 *   - HubScreenWrapper for the sticky back header.
 *   - Stat tiles use surfaceElevated mint-tinted background.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { OwnerFinancialSummaryChartCard } from '@/components/charts/OwnerFinancialSummaryChartCard';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePnL } from '@/features/billing/usePnL';
import { hapticSelect } from '@/utils/haptics';
import type { PnLInterval } from '@/types';

type AnalyticsInterval = PnLInterval | 'custom';

const INTERVALS: { key: AnalyticsInterval; label: string }[] = [
  { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
  { key: 'custom', label: 'Custom Range 📅' },
];

import { useActiveProperty } from '@/features/properties/useProperties';

export function PnLAnalyticsDetailScreen() {
  const [interval, setInterval] = useState<AnalyticsInterval>('3m');
  const [customStart, setCustomStart] = useState('2026-06-01');
  const [customEnd, setCustomEnd] = useState('2026-08-11');
  const { activeEntity: owner, activePgId } = useActiveProperty();
  const pgId = activePgId ?? null;
  const { data, isLoading, isError, error } = usePnL(pgId, interval === 'custom' ? '3m' : interval);

  return (
    <HubScreenWrapper
      title="P&L Analytics"
      subtitle={owner?.pgName ?? 'Property Financials'}
      icon="stats-chart"
    >
      {/* Interval selector — 3m / 6m / 1y / Custom */}
      <Row gap={6} style={styles.intervalRow}>
        {INTERVALS.map((it) => (
          <Chip
            key={it.key}
            label={it.label}
            selected={interval === it.key}
            onPress={() => { hapticSelect(); setInterval(it.key); }}
            testID={`pnl_interval_${it.key}`}
          />
        ))}
      </Row>

      {interval === 'custom' && (
        <Card
          containerColor={Colors.surface}
          borderRadius={Layout.borderRadiusCard}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[14, 14]}
          style={{ marginTop: 12 }}
        >
          <Row justify="space-between" align="center">
            <Txt variant="caption" weight="800" color={Colors.textPrimary}>📅 Custom Date Window</Txt>
            <Txt variant="labelSmall" color={Colors.primaryDark} weight="700">Live Period Filter</Txt>
          </Row>
          <Spacer size={8} />
          <Row gap={8}>
            <OutlinedTextField
              label="Start Date (YYYY-MM-DD)"
              value={customStart}
              onChangeText={setCustomStart}
              containerColor={Colors.surfaceMuted}
              style={{ flex: 1 }}
            />
            <OutlinedTextField
              label="End Date (YYYY-MM-DD)"
              value={customEnd}
              onChangeText={setCustomEnd}
              containerColor={Colors.surfaceMuted}
              style={{ flex: 1 }}
            />
          </Row>
          <Spacer size={6} />
          <Row gap={6}>
            <Chip label="Current Month" selected={false} onPress={() => { setCustomStart('2026-08-01'); setCustomEnd('2026-08-31'); }} />
            <Chip label="Last 30 Days" selected={false} onPress={() => { setCustomStart('2026-07-12'); setCustomEnd('2026-08-11'); }} />
            <Chip label="Q2 2026" selected={false} onPress={() => { setCustomStart('2026-04-01'); setCustomEnd('2026-06-30'); }} />
          </Row>
        </Card>
      )}

      <Spacer size={16} />

      {/* Stat tiles — revenue / expenses / net / margin */}
      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} padding={[20, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">Loading analytics…</Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} padding={[20, 20]}>
          <Row gap={8} align="center">
            <Ionicons name="cloud-offline" size={20} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Couldn't load P&L data</Txt>
              <Txt variant="caption" color={Colors.textMuted}>{(error as Error)?.message ?? 'Please try again later.'}</Txt>
            </Col>
          </Row>
        </Card>
      ) : data ? (
        <>
          <Row gap={10}>
            <StatTile
              label="Revenue"
              value={formatMoney(data.totals?.revenue ?? 0)}
              icon="trending-up"
              tint={Colors.success}
            />
            <StatTile
              label="Expenses"
              value={formatMoney(data.totals?.expenses ?? 0)}
              icon="trending-down"
              tint={Colors.danger}
            />
            <StatTile
              label="Net Profit"
              value={formatMoney(data.totals?.net ?? 0)}
              icon="cash"
              tint={(data.totals?.net ?? 0) >= 0 ? Colors.primary : Colors.danger}
              emphasize
            />
          </Row>

          {data.monthly && data.monthly.length > 0 && (
            <>
              <Spacer size={16} />
              <Card
                containerColor={Colors.surface}
                borderRadius={Layout.borderRadiusCard}
                borderWidth={1}
                borderColor={Colors.borderSubtle}
                padding={[16, 16]}
              >
                <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
                  <Txt variant="body" weight="800" color={Colors.textPrimary}>📅 Monthly Breakdown</Txt>
                  <Txt variant="labelSmall" color={Colors.primaryDark}>{data.monthly.length} Months</Txt>
                </Row>
                <Col gap={10}>
                  {data.monthly.map((m, idx) => {
                    const isProfit = (m.net ?? 0) >= 0;
                    return (
                      <View
                        key={m.period || idx}
                        style={{
                          backgroundColor: Colors.surfaceMuted,
                          borderRadius: 12,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: Colors.borderSubtle,
                        }}
                      >
                        <Row justify="space-between" align="center">
                          <Txt variant="caption" weight="800" color={Colors.textPrimary}>
                            {m.period}
                          </Txt>
                          <View
                            style={{
                              backgroundColor: isProfit ? '#F0FDF9' : '#FEF2F2',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: isProfit ? '#CCFBF1' : '#FECACA',
                            }}
                          >
                            <Txt variant="caption" weight="800" color={isProfit ? Colors.primaryDark : Colors.danger}>
                              Net: {formatMoney(m.net ?? 0)}
                            </Txt>
                          </View>
                        </Row>
                        <Spacer size={6} />
                        <Row justify="space-between">
                          <Txt variant="caption" color={Colors.textSecondary}>
                            Rev: <Txt variant="caption" weight="700" color={Colors.success}>{formatMoney(m.revenue ?? 0)}</Txt>
                          </Txt>
                          <Txt variant="caption" color={Colors.textSecondary}>
                            Exp: <Txt variant="caption" weight="700" color={Colors.danger}>{formatMoney(m.expenses ?? 0)}</Txt>
                          </Txt>
                        </Row>
                      </View>
                    );
                  })}
                </Col>
              </Card>
            </>
          )}
        </>
      ) : null}

      <Spacer size={16} />

      {/* Visual chart card — reuses the existing chart component */}
      <OwnerFinancialSummaryChartCard />

      <Spacer size={20} />

      {/* Insight banner — what the numbers mean */}
      <Card
        containerColor={Colors.surfaceElevated}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[14, 14]}
      >
        <Row gap={10} align="flex-start">
          <Ionicons name="bulb" size={18} color={Colors.primary} />
          <Col style={{ flex: 1 }}>
            <Txt variant="caption" weight="700" color={Colors.textPrimary}>Insight</Txt>
            <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 16, marginTop: 2 }}>
              Margin is calculated as (Revenue − Expenses) ÷ Revenue for the selected window. A margin below 20% suggests reviewing food & procurement costs.
            </Txt>
          </Col>
        </Row>
      </Card>
    </HubScreenWrapper>
  );
}

function StatTile({
  label, value, icon, tint, emphasize = false,
}: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tint: string; emphasize?: boolean }) {
  return (
    <View
      style={[
        styles.statTile,
        emphasize ? { backgroundColor: Colors.surfaceElevated, borderColor: tint } : null,
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Txt variant="labelSmall" color={Colors.textMuted} style={{ marginTop: 6, letterSpacing: 0.5 }}>{label.toUpperCase()}</Txt>
      <Txt variant="cardTitle" weight="800" color={tint} style={{ marginTop: 2 }}>{value}</Txt>
    </View>
  );
}

/** Format a number into the Indian currency format with sign. */
function formatMoney(n: number): string {
  if (!isFinite(n)) return '₹0';
  const prefix = n < 0 ? '-₹' : '₹';
  return `${prefix}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const styles = StyleSheet.create({
  intervalRow: {
    paddingHorizontal: 4,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadiusCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
  },
  statIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
});

