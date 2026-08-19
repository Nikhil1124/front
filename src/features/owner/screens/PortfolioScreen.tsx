/**
 * PortfolioScreen — cross-property totals for an owner running more than one PG.
 *
 * Reached only from the Overview hub's portfolio teaser card (see OwnerOverviewTab),
 * never from the bottom dock. A manager only ever holds one property, so there is
 * nothing here for them to roll up — this screen isn't wired into their navigation.
 *
 * This is a dedicated analytics / comparison view — NOT another variation of the
 * Overview dashboard. Everything lives inside a single primary container:
 *   (1) TOTALS — 2×2 grid of beds, revenue, saved, pending dues
 *   (2) REVENUE & NET BY PROPERTY — stacked performance rows with proportional bars
 *
 * Deliberately does not duplicate the property switcher: that already lives in the
 * header (tap the PG name to open it). This screen is analytics only.
 */
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Txt, Row, Spacer } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { usePortfolioDetail } from '@/features/properties/usePortfolio';

function formatINR(n: number): string {
  if (n >= 100_000) {
    return `₹${(n / 100_000).toFixed(1)}L`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function PortfolioScreen() {
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data, isLoading } = usePortfolioDetail(allPGs);

  return (
    <HubScreenWrapper
      title="All properties"
      subtitle={`${allPGs.length} active PG propert${allPGs.length === 1 ? 'y' : 'ies'}`}
    >
      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 10 }}>
            Adding up every property&hellip;
          </Txt>
        </View>
      ) : (
        /* ── Single primary portfolio container ── */
        <View style={styles.container}>
          {/* ── TOTALS section ── */}
          <Txt
            size={11}
            weight="800"
            color={Colors.textMuted}
            style={{ letterSpacing: 0.8 }}
          >
            TOTALS
          </Txt>
          <Spacer size={10} />
          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Txt size={10} weight="600" color={Colors.textMuted}>
                Beds occupied
              </Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                {data.totals.occupiedBeds}/{data.totals.totalBeds}
              </Txt>
            </View>
            <View style={styles.statBox}>
              <Txt size={10} weight="600" color={Colors.textMuted}>
                Revenue collected
              </Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                {formatINR(data.totals.collected)}
              </Txt>
            </View>
            <View style={styles.statBox}>
              <Txt size={10} weight="600" color={Colors.textMuted}>
                Total saved
              </Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                {formatINR(data.totals.saved)}
              </Txt>
            </View>
            <View style={styles.statBox}>
              <Txt size={10} weight="600" color={Colors.textMuted}>
                Pending dues
              </Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                {String(data.totals.pendingDues)}
              </Txt>
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={styles.sectionDivider} />

          {/* ── REVENUE & NET BY PROPERTY section ── */}
          <Txt
            size={11}
            weight="800"
            color={Colors.textMuted}
            style={{ letterSpacing: 0.8 }}
          >
            REVENUE &amp; NET BY PROPERTY
          </Txt>
          <Spacer size={12} />

          <View style={{ gap: 14 }}>
            {data.byProperty.map((p) => {
              const maxCollected = data.byProperty[0]?.collected || 1;
              const pct = Math.max(8, Math.round((p.collected / maxCollected) * 100));
              const margin = p.collected > 0 ? p.net / p.collected : 1;
              const thinMargin = margin < 0.4;

              return (
                <View key={p.pgId} style={styles.propertyRow}>
                  <Row justify="space-between" align="center">
                    <Txt
                      size={13}
                      weight="700"
                      color={Colors.textPrimary}
                      numberOfLines={1}
                      style={{ flex: 1, marginRight: 8 }}
                    >
                      {p.pgName}
                    </Txt>
                    <Txt variant="body" weight="800" color={Colors.primaryDark}>
                      {formatINR(p.collected)}
                    </Txt>
                  </Row>

                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>

                  <Txt
                    size={11}
                    weight="600"
                    color={thinMargin ? Colors.warning : Colors.textMuted}
                  >
                    Net {formatINR(p.net)}{thinMargin ? ' · thin margin' : ''}
                  </Txt>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  /* ── Primary portfolio container ── */
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 18,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  /* ── TOTALS 2×2 grid ── */
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 18,
  },
  /* ── Property revenue rows ── */
  propertyRow: {
    gap: 4,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
