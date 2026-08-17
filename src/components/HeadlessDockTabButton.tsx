/**
 * The bottom navigation bar shared by Owner, Guest and the groceries mini-app.
 *
 * Play-Store-style, NOT a floating pill: one flat bar pinned flush to the bottom edge,
 * full width, with a hairline top border and an upward shadow separating it from the
 * scrolling content behind it. The selected tab is the only thing that floats — its
 * icon+label sit on a small tinted card that lifts on selection.
 *
 * Three exports:
 *
 * - `Dock` — a direct re-export of `TabList` from expo-router/ui. This preserves the exact
 *   reference identity `Tabs`'s `parseTriggersFromChildren` checks via `isTabList(child)`
 *   (`child.type === TabList`). A wrapper component was tried before and made every
 *   TabTrigger invisible to that check — `Tabs` then crashed with "Couldn't find any
 *   screens for the navigator". Only the *style* is shareable; the element itself must
 *   stay literal in each layout, hence the re-export plus `useDock()` below.
 * - `useDock()` — the bar's style and the matching content inset, both safe-area aware.
 *   A hook rather than a constant because the bottom inset is only known at runtime, and
 *   a flush bar would otherwise sit under the gesture bar / home indicator.
 * - `HeadlessDockTabButton` — one tab's icon+label. Used as the child of a headless
 *   `<TabTrigger asChild>` — asChild clones it and injects `isFocused` plus the press
 *   handlers, which is why its props are a superset of PressableProps rather than a
 *   bespoke onPress.
 */
import { forwardRef } from 'react';
import { View, Pressable, StyleSheet, type PressableProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabList } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/ui';
import { Colors } from '@/theme';

/** Same function reference as `TabList`, so `isTabList(child)` still passes. */
export { TabList as Dock };

/** The selected-tab highlight, as a fixed square. It wraps only the ICON — the label sits
 *  below it, outside — because a highlight that wrapped the label too would size itself to
 *  that label, making the box visibly wider on "Payments" than on "Staff". Every icon is
 *  the same 18px, so highlighting the icon alone is what makes the box identical on every
 *  tab. This is also how Play Store's own bottom bar does it. */
const ICON_BOX = 38;
/** Icon box + label + the bar's own vertical padding. Excludes the safe-area inset, which
 *  `useDock` adds on top — together they are exactly how much room the bar occupies. */
const BAR_CONTENT_HEIGHT = ICON_BOX + 3 + 14 + 6;
/** Breathing room under the labels on a device with no gesture inset at all. */
const MIN_BOTTOM_PAD = 6;

export function useDock() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM_PAD);
  return {
    /** Spread onto `<Dock style={...}>`. */
    dockStyle: [styles.bar, { paddingBottom: bottomPad }],
    /** Bottom padding the scrolling content needs so the bar never covers its last row. */
    contentPaddingBottom: BAR_CONTENT_HEIGHT + bottomPad,
  };
}

interface Props extends PressableProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused?: boolean;
}

export const HeadlessDockTabButton = forwardRef<View, Props>(
  ({ icon, label, isFocused, style, ...props }, ref) => {
    const progress = useDerivedValue(
      () => withTiming(isFocused ? 1 : 0, { duration: 200 }),
      [isFocused]
    );

    // The icon lives INSIDE this box rather than beside it: on Android a sibling with
    // elevation draws above its neighbours regardless of tree order, which would put the
    // highlight on top of the icon. As its parent it can never do that. The label is a
    // sibling, but sits below with no overlap, so elevation ordering cannot affect it.
    // Only colour, shadow and a 2px lift animate — the box is a fixed square either way,
    // so selecting a tab never reflows the row.
    const boxStyle = useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        // From the bar's own colour, so an unselected box is invisible against it —
        // no alpha, so the fade never washes through a grey midpoint.
        [Colors.surface, Colors.surfaceElevated]
      ),
      shadowOpacity: 0.16 * progress.value,
      elevation: 3 * progress.value,
      transform: [{ translateY: -2 * progress.value }],
    }));

    return (
      // `styles.slot` goes LAST, after the injected style: `TabTrigger asChild` merges in
      // its own `flexDirection: 'row'` default, which would otherwise put the label beside
      // the icon instead of under it.
      <Pressable ref={ref} style={[style as any, styles.slot]} {...props}>
        <Animated.View style={[styles.iconBox, boxStyle]}>
          <Ionicons name={icon} size={18} color={isFocused ? Colors.primaryDark : Colors.textMuted} />
        </Animated.View>
        <Txt
          size={10}
          weight={isFocused ? '800' : '600'}
          color={isFocused ? Colors.primaryDark : Colors.textMuted}
          align="center"
          numberOfLines={1}
          style={{ marginTop: 3 }}
        >
          {label}
        </Txt>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    paddingTop: 6,
    paddingHorizontal: 4,
    // Upward, so the bar reads as sitting above the content rather than under it.
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  slot: {
    flex: 1,
    // Explicit, not relying on the RN default — TabTrigger's own style sets `row`, and this
    // has to beat it for the label to sit under the icon.
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  iconBox: {
    // Explicit width AND height, not derived from content — this is what guarantees the
    // highlight is the identical square on every tab.
    width: ICON_BOX,
    height: ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    // Squared-off, not a pill.
    borderRadius: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});
