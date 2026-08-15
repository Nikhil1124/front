/**
 * PortfolioScreen — cross-property totals for an owner running more than one PG.
 *
 * Reached only from the Overview hub's portfolio teaser card (see OwnerDashboardScreen),
 * never from the bottom dock. A manager only ever holds one property, so there is nothing
 * here for them to roll up — this screen isn't wired into their navigation at all.
 *
 * Deliberately does not duplicate the property switcher: that already lives in the header
 * (tap the PG name to open it). This screen is analytics only.
 */
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, Txt, Row, Spacer } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePortfolioDetail } from '@/features/properties/usePortfolio';

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function PortfolioScreen() {
  const allPGs = usePGowStore((s) => s.allPGsState);
  const { data, isLoading } = usePortfolioDetail(allPGs);

  return (
    <HubScreenWrapper
      title="Portfolio"
      subtitle={`${allPGs.length} propert${allPGs.length === 1 ? 'y' : 'ies'}`}
      icon="stats-chart"
    >
      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Txt size={12} color={Colors.textMuted} style={{ marginTop: 10 }}>
            Adding up every property&hellip;
          </Txt>
        </View>
      ) : (
        <>
          <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
            TOTALS
          </Txt>
          <View style={styles.statGrid}>
            <StatBox
              bg="#F0FDF9" tint={Colors.primaryDark}
              label="Beds occupied" value={`${data.totals.occupiedBeds}/${data.totals.totalBeds}`}
            />
            <StatBox
              bg="#ECFDF5" tint="#047857"
              label="Revenue collected" value={formatINR(data.totals.collected)}
            />
            <StatBox
              bg="#F0FDF9" tint={Colors.primaryDark}
              label="Total saved" value={formatINR(data.totals.saved)}
            />
            <StatBox
              bg="#FFFBEB" tint="#B45309"
              label="Pending dues" value={String(data.totals.pendingDues)}
            />
          </View>

          <Spacer size={20} />
          <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginBottom: 10 }}>
            REVENUE &amp; NET BY PROPERTY
          </Txt>
          <View style={{ gap: 10 }}>
            {data.byProperty.map((p) => {
              // Widest bar is the top earner, everyone else scales relative to it — the
              // comparison the owner opened this screen to make, not an absolute axis.
              const maxCollected = data.byProperty[0]?.collected || 1;
              const pct = Math.min(100, Math.round((p.collected / maxCollected) * 100));
              const margin = p.collected > 0 ? p.net / p.collected : 1;
              const thinMargin = margin < 0.4;
              return (
                <Card
                  key={p.pgId}
                  containerColor={Colors.surface}
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={Colors.borderSubtle}
                  padding={[12, 12]}
                >
                  <Row justify="space-between" align="center">
                    <Txt size={13} weight="800" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
                      {p.pgName}
                    </Txt>
                    <Txt size={13} weight="900" color={Colors.textPrimary}>{formatINR(p.collected)}</Txt>
                  </Row>
                  <Spacer size={6} />
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                  <Spacer size={4} />
                  <Txt size={11} weight="700" color={thinMargin ? Colors.warning : Colors.textMuted}>
                    Net {formatINR(p.net)}{thinMargin ? ' · thin margin' : ''}
                  </Txt>
                </Card>
              );
            })}
          </View>
        </>
      )}
    </HubScreenWrapper>
  );
}

function StatBox({ label, value, bg, tint }: { label: string; value: string; bg: string; tint: string }) {
  return (
    <View style={[styles.statBox, { backgroundColor: bg }]}>
      <Txt size={10} weight="700" color={tint}>{label}</Txt>
      <Txt size={17} weight="900" color={tint} style={{ marginTop: 2 }}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    flexBasis: '48%', flexGrow: 1, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
});
