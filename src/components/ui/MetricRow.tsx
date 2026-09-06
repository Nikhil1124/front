/**
 * MetricRow — `ListRow`'s sibling for a plain number.
 *
 * `ListRow`'s 36px tile means "this is a thing with an identity" — a person, a room, an
 * order. A metric doesn't have one: there's no avatar for "Margin". This is the row for that
 * case — title and an optional one-line reason on the left, the value and its delta (if any)
 * on the right, tabular numerals throughout, the same hairline (`Colors.separator`) as
 * everywhere else a run of rows is grouped. No tile, no status dot: tile means "a thing you
 * could tap into and see more of", no tile means "a number".
 */
import { View, StyleSheet } from 'react-native';

import { Txt } from './Txt';
import { AnimatedPress } from './AnimatedPress';
import { CountUp } from './CountUp';
import { Colors } from '@/theme';
import type { StatusTone } from './statusTone';

const DELTA_COLOR: Record<StatusTone, string> = {
  ok: Colors.success,
  warn: Colors.warning,
  danger: Colors.danger,
  info: Colors.primary,
  neutral: Colors.textMuted,
};

export interface MetricRowProps {
  label: string;
  /** One supporting line — what the figure means, or why it moved. */
  meta?: string;
  value: string;
  /** Optional, and only meaningful together with `format` — see `DeckCardData`'s identical
   *  pair in MetricDeck for the full reasoning. Omit either and `value` renders as plain text. */
  numericValue?: number;
  format?: (n: number) => string;
  /** Already-formatted, e.g. "↑ 9%" or "was ₹1,19,400". Tone picks its colour. */
  delta?: { label: string; tone: StatusTone };
  onPress?: () => void;
  /** Omit the trailing hairline — the last row in a group. */
  last?: boolean;
  testID?: string;
}

export function MetricRow({ label, meta, value, numericValue, format, delta, onPress, last, testID }: MetricRowProps) {
  const body = (
    <View style={[styles.row, !last && styles.divider]}>
      <View style={styles.col}>
        <Txt variant="cardTitle" color={Colors.textPrimary} numberOfLines={1}>{label}</Txt>
        {meta ? <Txt variant="meta" color={Colors.textMuted} numberOfLines={1} style={styles.meta}>{meta}</Txt> : null}
      </View>
      <View style={styles.right}>
        {numericValue !== undefined && format ? (
          <CountUp value={numericValue} format={format} variant="body" weight="600" color={Colors.textPrimary} />
        ) : (
          <Txt variant="body" weight="600" color={Colors.textPrimary} tabular>{value}</Txt>
        )}
        {delta ? (
          <Txt variant="meta" weight="600" color={DELTA_COLOR[delta.tone]} tabular style={styles.meta}>
            {delta.label}
          </Txt>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <AnimatedPress
      onPress={onPress}
      testID={testID}
      accessibilityLabel={[label, value, delta?.label].filter(Boolean).join(', ')}
    >
      {body}
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  col: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  meta: { marginTop: 2 },
});
