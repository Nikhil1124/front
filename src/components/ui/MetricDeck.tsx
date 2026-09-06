/**
 * MetricDeck — the swipeable strip of tinted metric cards at the top of an analytics screen.
 *
 * Cards page horizontally with the next one peeking in from the right edge, and a dot row
 * tracks which is active. Built on a plain horizontal `ScrollView` with `snapToInterval`
 * rather than `react-native-pager-view` (already a dependency, but unused anywhere in this
 * app): a native pager's pages are each the full pager width by design, so getting a
 * neighbour to peek in needs custom offset math against a fairly fragile API. A snapping
 * ScrollView is one continuous strip — the next card's edge is just there, in the same
 * pattern this app already uses for every other horizontal picker (`FilterSheet`, the staff
 * search chips). Reaches for the fancier tool only when the simple one can't do it, and here
 * it can.
 *
 * Each card is a `DeckTints` role — brand / green / amber / slate — so revenue, expenses, net
 * and margin read as four different kinds of number, not four copies of the same white box.
 */
import { useState } from 'react';
import {
  View, StyleSheet, ScrollView, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';

import { Txt } from './Txt';
import { CountUp } from './CountUp';
import { Colors, DeckTints, Radii, type DeckTint } from '@/theme';

export interface DeckCardData {
  key: string;
  tint: DeckTint;
  label: string;
  value: string;
  /** Both optional, and only meaningful together: when a screen has the raw number behind
   *  `value` to hand, passing it here makes the card count up from its previous figure
   *  instead of snapping straight to the new one on refresh. Omit either and the card just
   *  renders the plain `value` string, exactly as before — this is additive, not a
   *  replacement, because not every card has a clean number underneath it (a card can read
   *  "3 PGs • Bengaluru", which has nothing to count). */
  numericValue?: number;
  format?: (n: number) => string;
  /** Already formatted, e.g. "↑ 18% on ₹1,19,400". */
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
}

export interface MetricDeckProps {
  cards: readonly DeckCardData[];
  /** Matches the screen's own horizontal padding, so the card width lines up with everything
   *  below it. */
  sidePadding?: number;
  testID?: string;
}

const GAP = 10;
const PEEK = 28;
const CARD_HEIGHT = 108;

export function MetricDeck({ cards, sidePadding = 16, testID }: MetricDeckProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(120, screenWidth - sidePadding * 2 - PEEK);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP));
    const clamped = Math.max(0, Math.min(cards.length - 1, next));
    if (clamped !== page) setPage(clamped);
  };

  if (cards.length === 0) return null;

  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + GAP}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ gap: GAP }}
      >
        {cards.map((c) => {
          const t = DeckTints[c.tint];
          return (
            <View key={c.key} style={[styles.card, { width: cardWidth, backgroundColor: t.fill }]}>
              <Txt size={10.5} color={t.sub}>{c.label}</Txt>
              {c.numericValue !== undefined && c.format ? (
                <CountUp
                  value={c.numericValue}
                  format={c.format}
                  size={27}
                  weight="700"
                  color={t.ink}
                  numberOfLines={1}
                  style={styles.value}
                />
              ) : (
                <Txt size={27} weight="700" color={t.ink} tabular numberOfLines={1} style={styles.value}>
                  {c.value}
                </Txt>
              )}
              {c.delta ? (
                <Txt size={11} weight="600" color={deltaColor(c.deltaTone, t.sub)} tabular numberOfLines={1} style={styles.delta}>
                  {c.delta}
                </Txt>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {cards.length > 1 && (
        <View style={styles.dots}>
          {cards.map((c, i) => (
            <View key={c.key} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

function deltaColor(tone: DeckCardData['deltaTone'], sub: string): string {
  if (tone === 'up') return Colors.success;
  if (tone === 'down') return Colors.danger;
  return sub;
}

const styles = StyleSheet.create({
  card: { height: CARD_HEIGHT, borderRadius: Radii.feature, padding: 16 },
  value: { marginTop: 3, letterSpacing: -0.5 },
  delta: { marginTop: 4 },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: Radii.pill, backgroundColor: Colors.separator },
  dotOn: { width: 16, backgroundColor: Colors.primary },
});
