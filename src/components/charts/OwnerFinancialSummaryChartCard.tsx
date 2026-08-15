/**
 * OwnerFinancialSummaryChartCard — the cycle-in-progress P&L, from `GET /v1/expenses/summary`.
 *
 * The original Kotlin version plotted a 6-month trend, but that data was mock: the backend
 * has no per-month history endpoint, only a summary for one cycle at a time. Rather than fake
 * five of six bars, this shows the one real number the API can answer for — collected,
 * spent, net, and the real category split — and nothing it can't.
 */
import { View, StyleSheet } from 'react-native';
import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

const collectionsColor = Colors.CyberGreen;
const expensesColor = Colors.CyberPink;
const netLineColor = '#00E5FF';

const CATEGORY_LABEL: Record<string, string> = {
  staff_salary: 'Staff Salary',
  groceries: 'Groceries',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  internet: 'Internet',
  other: 'Other',
};

export function OwnerFinancialSummaryChartCard() {
  const collected = usePGowStore((s) => s.cycleCollected);
  const spent = usePGowStore((s) => s.cycleSpent);
  const net = usePGowStore((s) => s.cycleNet);
  const byCategory = usePGowStore((s) => s.cycleExpensesByCategory);

  const profitMarginPct = collected > 0 ? (net / collected) * 100 : 0;
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.amount));

  return (
    <Card
      containerColor={Colors.surface}
      borderRadius={24}
      borderWidth={1}
      borderColor={Colors.borderSubtle}
      padding={[18, 18]}
    >
      <Row gap={8} align="center">
        <View style={[styles.tag, { backgroundColor: '#F0FDF9' }]}>
          <Txt size={9} weight="900" color={Colors.primaryDark}>THIS CYCLE</Txt>
        </View>
        <Txt size={11} weight="900" color={Colors.textPrimary} style={{ letterSpacing: 1 }}>P&amp;L SUMMARY</Txt>
      </Row>
      <Txt size={13} weight="800" color={Colors.textPrimary} style={{ marginTop: 4 }}>Verified collections vs. logged expenses</Txt>

      <Spacer size={14} />
      <Row gap={8}>
        <View style={[styles.kpiBox, { backgroundColor: '#F0FDF9', borderColor: '#CCFBF1' }]}>
          <Row gap={4} align="center"><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Txt size={9} weight="700" color={Colors.primaryDark}>Collected</Txt></Row>
          <Txt size={14} weight="900" color={Colors.primaryDark} style={{ marginTop: 2 }}>₹{Math.round(collected).toLocaleString('en-IN')}</Txt>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' }]}>
          <Row gap={4} align="center"><View style={[styles.legendDot, { backgroundColor: Colors.accentRose }]} /><Txt size={9} weight="700" color="#B91C1C">Spent</Txt></Row>
          <Txt size={14} weight="900" color="#B91C1C" style={{ marginTop: 2 }}>₹{Math.round(spent).toLocaleString('en-IN')}</Txt>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: '#F0F9FF', borderColor: '#E0F2FE' }]}>
          <Row gap={4} align="center"><View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} /><Txt size={9} weight="700" color="#0369A1">Net</Txt></Row>
          <Txt size={14} weight="900" color={net >= 0 ? '#0369A1' : '#B91C1C'} style={{ marginTop: 2 }}>₹{Math.round(net).toLocaleString('en-IN')}</Txt>
          <Txt size={8} weight="800" color="#0369A1">{profitMarginPct.toFixed(1)}% margin</Txt>
        </View>
      </Row>

      <Spacer size={16} />
      {byCategory.length === 0 ? (
        <Txt size={11} color={Colors.textMuted}>No expenses logged this cycle yet.</Txt>
      ) : (
        <Col style={{ gap: 8 }}>
          {byCategory.map((c) => (
            <Row key={c.category} align="center" gap={8}>
              <Txt size={10} weight="700" color={Colors.textSecondary} style={{ width: 78 }}>{CATEGORY_LABEL[c.category] ?? c.category}</Txt>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.amount / maxCategory) * 100}%` }]} />
              </View>
              <Txt size={10} weight="800" color={Colors.textPrimary} style={{ width: 64, textAlign: 'right' }}>
                ₹{Math.round(c.amount).toLocaleString('en-IN')}
              </Txt>
            </Row>
          ))}
        </Col>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  kpiBox: {
    flex: 1, borderRadius: 12,
    borderWidth: 1, padding: 10,
  },
  barTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: '#E2E8F0', overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: 4,
    backgroundColor: Colors.accentRose,
  },
});
