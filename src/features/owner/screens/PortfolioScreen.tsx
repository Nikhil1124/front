/**
 * PortfolioScreen — cross-property totals for an owner running more than one PG.
 *
 * Reached only from the Overview hub, never from the bottom dock. A manager only ever holds
 * one property, so there is nothing here for them to roll up — this screen isn't wired into
 * their navigation.
 *
 * Deliberately does not duplicate the property switcher: that already lives in the header
 * (tap the PG name to open it). This screen is analytics only — the property rows below have
 * no `onPress`, on purpose.
 */
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import {
  Txt, Spacer, ErrorState, ListRow, ListSectionHeader, MetricDeck, type DeckCardData,
} from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { usePortfolioDetail } from '@/features/properties/usePortfolio';
import { useResponsivePadding } from '@/utils/responsive';

function formatINR(n: number): string {
  if (n >= 100_000) {
    return `₹${(n / 100_000).toFixed(1)}L`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function PortfolioScreen() {
  const { data: allPGs = [], refetch, isRefetching } = usePropertiesEntitiesQuery();
  const { data, isLoading, error: portfolioError, refetch: refetchPortfolio } = usePortfolioDetail(allPGs);
  const sidePadding = useResponsivePadding();

  const deckCards: DeckCardData[] = data ? [
    {
      key: 'beds', tint: 'brand', label: 'Beds occupied',
      value: `${data.totals.occupiedBeds}/${data.totals.totalBeds}`,
      ...(data.totals.totalBeds > 0
        ? { delta: `${Math.round((data.totals.occupiedBeds / data.totals.totalBeds) * 100)}% filled` }
        : {}) },
    { key: 'revenue', tint: 'green', label: 'Revenue collected', value: formatINR(data.totals.collected) },
    {
      key: 'dues', tint: 'amber', label: 'Pending dues', value: String(data.totals.pendingDues),
      ...(data.totals.pendingDues > 0
        ? { delta: `resident${data.totals.pendingDues === 1 ? '' : 's'}`, deltaTone: 'down' as const }
        : { delta: 'All clear', deltaTone: 'up' as const }) },
    { key: 'saved', tint: 'slate', label: 'Total saved', value: formatINR(data.totals.saved) },
  ] : [];

  return (
    <HubScreenWrapper
      title="All properties"
      subtitle={`${allPGs.length} active PG propert${allPGs.length === 1 ? 'y' : 'ies'}`}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* `isLoading || !data` alone spun forever on a failed fetch: the query settles into an
          error state, `data` stays undefined, and the spinner never resolves — which reads as
          a hung app rather than a failure worth retrying. */}
      {portfolioError ? (
        <ErrorState
          error={portfolioError}
          title="Could not add up your properties"
          onRetry={refetchPortfolio}
          fill={false}
        />
      ) : isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 10 }}>
            Adding up every property&hellip;
          </Txt>
        </View>
      ) : (
        <>
          <MetricDeck cards={deckCards} sidePadding={sidePadding} testID="portfolio_deck" />

          <Spacer size={24} />

          <ListSectionHeader title="By property" count={data.byProperty.length} />
          {data.byProperty.map((p, i, arr) => {
            const margin = p.collected > 0 ? p.net / p.collected : 1;
            const thinMargin = margin < 0.4;
            return (
              <ListRow
                key={p.pgId}
                title={p.pgName}
                meta={`Net ${formatINR(p.net)}`}
                amount={formatINR(p.collected)}
                status={{ label: thinMargin ? 'Thin margin' : 'Healthy', tone: thinMargin ? 'warn' : 'ok' }}
                first={i === 0}
                last={i === arr.length - 1}
                testID={`portfolio_property_${p.pgId}`}
              />
            );
          })}
        </>
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
});
