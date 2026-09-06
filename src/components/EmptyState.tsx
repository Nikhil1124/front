/**
 * EmptyState — a consistent "this list is empty" placeholder used across all
 * dashboard tabs. Icon + title + optional subtitle, centred in a card.
 *
 * Every list on the dashboards (meals, complaints, expenses, guests, payments)
 * has at least three reasons to be empty: nothing created yet, all filtered
 * out, or the API returned 0. Showing a friendly icon + caption stops the
 * user from wondering if the screen is still loading.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingState, ErrorState } from '@/components/ui/Spinner';
import { Radii, Colors } from '@/theme';
import { Card, Spacer, Txt } from '@/components/ui';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  accent?: string;
  /**
   * The three reasons a list renders nothing are NOT interchangeable, and this component
   * used to say "nothing here" for all of them. A query in flight and a query that 403'd
   * both produced the same confident empty copy — and since the query client deliberately
   * does not retry a 4xx, a permissions failure sat there looking like an answer. Passing
   * the query's own flags through lets one component tell the three apart.
   */
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export function EmptyState({
  icon = 'information-circle',
  title,
  subtitle,
  accent = Colors.textMuted,
  loading = false,
  error,
  onRetry }: EmptyStateProps) {
  return (
    <Card
      containerColor={Colors.surface}
      borderRadius={Radii.card}
      borderWidth={1}
      borderColor={Colors.borderSubtle}
      padding={[32, 24]}
    >
      {loading ? (
        <LoadingState fill={false} label="Loading…" />
      ) : error ? (
        <ErrorState fill={false} error={error} title="Could not load this" onRetry={onRetry} />
      ) : (
        <View style={styles.inner}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
            <Ionicons name={icon} size={36} color={accent} />
          </View>
          <Spacer size={12} />
          <Txt variant="cardTitle" color={Colors.textPrimary} align="center">
            {title}
          </Txt>
          {subtitle ? (
            <>
              <Spacer size={6} />
              <Txt variant="caption" color={Colors.textMuted} align="center" style={{ lineHeight: 17 }}>
                {subtitle}
              </Txt>
            </>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center' } });

export default EmptyState;
