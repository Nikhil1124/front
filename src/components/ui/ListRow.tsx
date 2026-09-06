/**
 * ListRow — the row every list in this app is made of.
 *
 * The List archetype, as one component: identity tile, a title, one meta line, and a
 * right-hand column carrying an optional amount over a status. Residents, complaints,
 * payments, staff and orders are all this shape; before it they were five different cards
 * with their own borders, paddings, pill styles and nested icon buttons.
 *
 * ── Grouping ────────────────────────────────────────────────────────────────────────────
 * Rows are drawn on white and a run of them reads as one card because only the ends are
 * rounded (`first`/`last`) and the hairline between them is inset past the tile. There is
 * deliberately no shadow: a section inside a virtualised list has no single container to hang
 * one on, and a shadow per row is per-view overdraw on Android — the exact thing that stutters
 * a long list. White on the tinted canvas does the separating instead. Standalone cards, where
 * there are one or two per screen, keep the shadow.
 *
 * ── No actions inside the row ───────────────────────────────────────────────────────────
 * There is no slot for a button, on purpose. The row is one tap target that opens a detail
 * surface, and that surface is where Edit and Delete belong. Rows here used to carry two icon
 * buttons inside an already-tappable card, which is both a nested-touchable hazard and a
 * competing target the size of a fingertip.
 */
import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { Colors, Radii } from '@/theme';

/** Up to two initials, for the identity tile. */
export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

interface ListRowProps {
  title: string;
  /** The single supporting line. Room, date, category — one fact, not three. */
  meta?: string;
  /** Two initials, or a node (an icon) for rows that are not about a person. */
  leading?: ReactNode;
  /** Right-hand emphasis above the status — a rent amount, an order total. */
  amount?: string;
  status?: { label: string; tone: StatusTone };
  onPress?: () => void;
  first?: boolean;
  last?: boolean;
  testID?: string;
}

export function ListRow({
  title, meta, leading, amount, status, onPress, first, last, testID,
}: ListRowProps) {
  const body = (
    <>
      <View style={styles.tile}>
        {typeof leading === 'string' || leading == null ? (
          <Txt variant="meta" weight="700" color={Colors.primary}>
            {typeof leading === 'string' ? leading : initialsOf(title)}
          </Txt>
        ) : leading}
      </View>

      <View style={styles.col}>
        <Txt variant="cardTitle" color={Colors.textPrimary} numberOfLines={1}>{title}</Txt>
        {meta ? <Txt variant="meta" color={Colors.textMuted} numberOfLines={1}>{meta}</Txt> : null}
      </View>

      {(amount || status) && (
        <View style={styles.right}>
          {amount ? <Txt variant="body" weight="600" color={Colors.textPrimary} tabular>{amount}</Txt> : null}
          {status ? <StatusChip variant="dot" label={status.label} tone={status.tone} /> : null}
        </View>
      )}
    </>
  );

  const rowStyle = [styles.row, first && styles.first, last && styles.last];

  return (
    <>
      {onPress ? (
        <AnimatedPress
          scale={0.99}
          onPress={onPress}
          testID={testID}
          accessibilityLabel={[title, meta, status?.label].filter(Boolean).join(', ')}
          style={rowStyle}
        >
          {body}
        </AnimatedPress>
      ) : (
        <View style={rowStyle} testID={testID}>{body}</View>
      )}
      {!last && <View style={styles.sep} />}
    </>
  );
}

/** The small heading over a run of rows. Renders the count so "40" is answerable at a glance. */
export function ListSectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <Txt variant="meta" color={Colors.textMuted} tabular style={styles.cap}>
      {title.toUpperCase()}{count == null ? '' : ` · ${count}`}
    </Txt>
  );
}

const styles = StyleSheet.create({
  cap: { marginTop: 16, marginBottom: 7, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
    // Clears the 48dp minimum target with the 36px tile centred inside it.
    minHeight: 56,
  },
  // The page is white now, so a white row no longer separates itself from it. A run of rows
  // is bounded by a full-width rule top and bottom; the rounded ends are kept for the cases
  // where a caller does place a group on a tint.
  first: {
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  last: {
    borderBottomLeftRadius: Radii.card,
    borderBottomRightRadius: Radii.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  // Inset past the tile so the eye follows the text column rather than the full width.
  sep: { height: 1, backgroundColor: Colors.separator, marginLeft: 57 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
});
