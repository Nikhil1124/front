/**
 * The bottom navigation bar shared by every role.
 *
 * Play-Store-style, NOT a floating pill: one flat bar pinned flush to the bottom edge,
 * full width, with a hairline top border and an upward shadow separating it from the
 * scrolling content behind it.
 *
 * ── The three behaviours layered on top of that ─────────────────────────────────────────────
 *
 * 1. **Scroll-aware (C2).** At rest each tab is an icon over a label. Once the page is
 *    scrolled down the labels fold away and the bar shrinks to a row of icons, giving the
 *    content back ~17dp; scrolling back up brings them straight back. Labels are permanent in
 *    the state you first see — the Material 3 rule — they just get out of the way while you
 *    are reading. Screens opt in with one spread of `useDockScroll()`; a screen that doesn't
 *    simply keeps a full bar, which is why this is safe to add gradually.
 *
 * 2. **State-tinted tabs (C3).** A destination that owns a work queue paints its icon box by
 *    the state of that queue: amber with a count when something is waiting, pale green when
 *    the queue is empty, nothing at all when the destination has no queue. The count is a
 *    numeral, never colour alone, so the state survives a colour-blind reader and a
 *    screen-reader both (it is spoken as part of the tab's label).
 *
 * 3. **A context strip (C1).** One amber pill floating just above the bar naming the single
 *    most urgent thing waiting, app-wide, and taking you to it. Only ever one line, only ever
 *    when something is actually waiting — see `pickAlert` in navTabs.ts for which one wins.
 *
 * Which destinations a profile gets, and in which slot, lives in `src/data/navTabs.ts`.
 *
 * ── The exports ─────────────────────────────────────────────────────────────────────────────
 *
 * - `Dock` — a direct re-export of `TabList` from expo-router/ui. This preserves the exact
 *   reference identity `Tabs`'s `parseTriggersFromChildren` checks via `isTabList(child)`
 *   (`child.type === TabList`). A wrapper component was tried before and made every
 *   TabTrigger invisible to that check — `Tabs` then crashed with "Couldn't find any
 *   screens for the navigator". Only the *style* is shareable; the element itself must
 *   stay literal in each layout, hence the re-export plus `useDock()` below.
 * - `useDock(profile?)` — the bar's style, the matching content inset, the per-destination
 *   queue counts, and the context strip's content. A hook rather than a constant because all
 *   four depend on runtime state (safe-area inset, live queues).
 * - `DockAlert` — the context strip. A sibling of `Dock` inside `Tabs`, not a child: TabList's
 *   children are walked for triggers and it is laid out as a row, so the strip cannot live
 *   inside it.
 * - `HeadlessDockTabButton` — one tab's icon+label. Used as the child of a headless
 *   `<TabTrigger asChild>` — asChild clones it and injects `isFocused` plus the press
 *   handlers, which is why its props are a superset of PressableProps rather than a
 *   bespoke onPress.
 * - `useDockScroll()` — spread onto a screen's ScrollView/FlatList to drive (1).
 */
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import {
  View, Pressable, StyleSheet, type PressableProps, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabList } from 'expo-router/ui';
import { router, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';

import { Radii, Colors, DeckTints, Motion } from '@/theme';
import { NAV_PROFILES, pickAlert, type NavProfile, type SignalKey } from '@/data/navTabs';
import { isRequestOpen } from '@/data/mappers';
import { useAuthStore } from '@/store/authStore';
import { useAllPaymentsQuery, useRentDueQuery } from '@/features/payments/usePayments';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Txt } from '@/components/ui/Txt';

/** Same function reference as `TabList`, so `isTabList(child)` still passes. */
export { TabList as Dock };

/** The selected-tab highlight, as a fixed square. It wraps only the ICON — the label sits
 *  below it, outside — because a highlight that wrapped the label too would size itself to
 *  that label, making the box visibly wider on "Payments" than on "Staff". Every icon is
 *  the same 18px, so highlighting the icon alone is what makes the box identical on every
 *  tab. This is also how Play Store's own bottom bar does it. */
const ICON_BOX = 38;
const LABEL_HEIGHT = 14;
const LABEL_GAP = 3;
/** Icon box + label + the bar's own vertical padding. Excludes the safe-area inset, which
 *  `useDock` adds on top — together they are exactly how much room the bar occupies.
 *  This stays the FULL height even while the labels are folded away: the content inset is
 *  deliberately not animated, because reflowing a list underneath the thing you are scrolling
 *  is how a scroll-aware bar turns into a flicker loop. */
const BAR_CONTENT_HEIGHT = ICON_BOX + LABEL_GAP + LABEL_HEIGHT + 6;
/** Breathing room under the labels on a device with no gesture inset at all. */
const MIN_BOTTOM_PAD = 6;
const ALERT_HEIGHT = 38;
const ALERT_GAP = 8;

// ── Scroll-collapse state (C2) ──────────────────────────────────────────────────────────────
//
// UI state, so Zustand rather than React Query — the ADR's split. Global rather than context
// because the scroller and the bar are in different subtrees (a screen inside TabSlot, and
// TabList outside it) with no shared provider between them short of the root.
const useDockCollapse = create<{ collapsed: boolean; setCollapsed: (v: boolean) => void }>((set) => ({
  collapsed: false,
  setCollapsed: (collapsed) => set({ collapsed }),
}));

/** Below this the bar is always full: near the top of a page there is nothing to make room for. */
const COLLAPSE_FLOOR = 40;
/** Asymmetric on purpose. Collapsing needs a deliberate downward flick; coming back needs the
 *  smallest upward nudge, because reaching for the bar is the reason you scrolled up. */
const DOWN_THRESHOLD = 24;
const UP_THRESHOLD = 12;

/**
 * Spread onto the main scroller of a tab screen:
 *
 *     <ScrollView {...useDockScroll()}>
 *
 * Reads the store imperatively via `getState` rather than subscribing, so a screen that
 * scrolls does not re-render on every frame — only the bar does, and only when the boolean
 * actually flips.
 */
export function useDockScroll() {
  // The offset at which the last decision was taken, so the deltas below accumulate instead of
  // being measured against the previous frame — a slow drag would never clear the threshold.
  const anchor = useRef(0);
  return useMemo(
    () => ({
      scrollEventThrottle: 16,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const { collapsed, setCollapsed } = useDockCollapse.getState();
        if (y <= COLLAPSE_FLOOR) {
          anchor.current = y;
          if (collapsed) setCollapsed(false);
          return;
        }
        const dy = y - anchor.current;
        if (dy > DOWN_THRESHOLD) {
          anchor.current = y;
          if (!collapsed) setCollapsed(true);
        } else if (dy < -UP_THRESHOLD) {
          anchor.current = y;
          if (collapsed) setCollapsed(false);
        }
      },
    }),
    [],
  );
}

// ── Queue counts (C3 + C1) ──────────────────────────────────────────────────────────────────

/**
 * The live size of each destination's work queue.
 *
 * Every query here is one an owner/resident screen already runs, so this is a cache read in
 * practice rather than extra traffic. Passing `undefined` for the pgId disables a query
 * outright (each one is `enabled: !!pgId`), which is how the profiles that don't need a given
 * queue — and the profile-less docks in the groceries mini-app and the housekeeping dashboard
 * — avoid fetching anything at all.
 */
function useDockSignals(profile?: NavProfile): Partial<Record<SignalKey, number>> {
  const pgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const ownerPg = profile === 'owner' ? pgId : undefined;
  const residentPg = profile === 'resident' ? pgId : undefined;

  const { data: pendingPayments = [] } = useAllPaymentsQuery(ownerPg, 'pending');
  const { data: guests = [] } = useGuestsQuery(ownerPg);
  const { data: complaints = [] } = useComplaintsQuery(ownerPg);
  const { data: rentDue } = useRentDueQuery(residentPg);

  return useMemo(() => {
    if (profile === 'owner') {
      return {
        paymentsPending: pendingPayments.length,
        kycPending: guests.filter((g) => g.kycStatus === 'PENDING').length,
        // Feedback is excluded: it shares the requests table and this screen, but a five-star
        // review is not work sitting in a queue. Cancelled is excluded too — see
        // `isRequestOpen`, which exists because callers kept writing `!== 'Resolved'` and
        // counting cancelled tickets as open.
        complaintsOpen: complaints.filter((c) => c.type === 'COMPLAINT' && isRequestOpen(c.status)).length,
      };
    }
    if (profile === 'resident') {
      // Not a queue length — a resident has one rent cycle, so this is 1 or 0. `undefined`
      // while the query is still in flight, which reads as "no tint yet" rather than a
      // premature green.
      return { rentDue: rentDue ? (rentDue.is_paid ? 0 : 1) : undefined };
    }
    return {};
  }, [profile, pendingPayments, guests, complaints, rentDue]);
}

export function useDock(profile?: NavProfile) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const setCollapsed = useDockCollapse((s) => s.setCollapsed);
  const counts = useDockSignals(profile);

  // A fresh screen starts with its labels showing, whatever the last one was scrolled to.
  useEffect(() => { setCollapsed(false); }, [pathname, setCollapsed]);

  const alert = useMemo(() => {
    if (!profile) return null;
    const picked = pickAlert(profile, counts);
    if (!picked) return null;
    const dest = NAV_PROFILES[profile].find((d) => d.signal === picked.key);
    
    let href = dest?.href;
    if (href && picked.key === 'paymentsPending') {
      href = `${href}?tab=COLLECTIONS`;
    }
    
    return dest && href ? { text: picked.text, href } : null;
  }, [profile, counts]);

  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM_PAD);
  return {
    /** Spread onto `<Dock style={...}>`. */
    dockStyle: [styles.bar, { paddingBottom: bottomPad }],
    /** Bottom padding the scrolling content needs so neither the bar nor the strip covers its
     *  last row. */
    contentPaddingBottom: BAR_CONTENT_HEIGHT + bottomPad + (alert ? ALERT_HEIGHT + ALERT_GAP : 0),
    /** Per-destination queue sizes, keyed by `NavDest.signal`. */
    counts,
    /** Pass to `<DockAlert />`. Null when nothing is waiting. */
    alert,
  };
}

// ── The context strip (C1) ──────────────────────────────────────────────────────────────────

/**
 * Rendered as a sibling of `Dock`, directly inside `Tabs`. Floats clear of the bar rather than
 * butting against it, so it reads as a message about the app rather than a sixth tab.
 */
export function DockAlert({ alert }: { alert: { text: string; href: string } | null }) {
  const insets = useSafeAreaInsets();
  if (!alert) return null;
  const bottom = BAR_CONTENT_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_PAD) + ALERT_GAP;
  return (
    <AnimatedPress
      accessibilityRole="button"
      accessibilityLabel={`${alert.text}. Opens the screen that handles it.`}
      onPress={() => router.navigate(alert.href as Href)}
      style={[styles.alert, { bottom }]}
    >
      <Ionicons name="alert-circle" size={15} color={DeckTints.amber.ink} />
      <Txt variant="meta" color={DeckTints.amber.ink} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.alertText}>
        {alert.text}
      </Txt>
      <Ionicons name="chevron-forward" size={14} color={DeckTints.amber.sub} />
    </AnimatedPress>
  );
}

// ── One tab ─────────────────────────────────────────────────────────────────────────────────

interface Props extends PressableProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused?: boolean;
  /** Size of this destination's work queue. `undefined` means the destination has no queue —
   *  which is a different thing from an empty one, and is drawn differently. */
  pending?: number;
  activeTint?: string;
  inactiveTint?: string;
  activeBg?: string;
}

export const HeadlessDockTabButton = forwardRef<View, Props>(
  ({ icon, label, isFocused, pending, activeTint, inactiveTint, activeBg, style, ...props }, ref) => {
    const collapsed = useDockCollapse((s) => s.collapsed);
    const fold = useSharedValue(0);
    useEffect(() => {
      fold.value = withTiming(collapsed ? 1 : 0, { duration: Motion.timing.small });
    }, [collapsed, fold]);

    // Height as well as opacity: fading the label alone would leave the bar its full height
    // and give the content nothing back, which is the whole point of collapsing.
    const labelStyle = useAnimatedStyle(() => ({
      height: LABEL_HEIGHT * (1 - fold.value),
      marginTop: LABEL_GAP * (1 - fold.value),
      opacity: 1 - fold.value,
    }));

    const activeColor = activeTint ?? Colors.primaryDark;
    const inactiveColor = inactiveTint ?? Colors.textMuted;
    const waiting = pending !== undefined && pending > 0;

    // Focus wins over queue state: you are looking at the queue, so telling you it is full is
    // noise. The tint order below is the whole of C3.
    const boxStyle = isFocused
      ? { backgroundColor: activeBg ?? DeckTints.brand.fill }
      : { backgroundColor: 'transparent' };

    const iconColor = isFocused
      ? activeColor
      : waiting
        ? DeckTints.amber.ink
        : inactiveColor;

    return (
      // `styles.slot` goes LAST, after the injected style: `TabTrigger asChild` merges in
      // its own `flexDirection: 'row'` default, which would otherwise put the label beside
      // the icon instead of under it.
      // `tab` rather than `button`, and `selected` state: a screen reader should say
      // "Payments, 3 waiting, tab, 3 of 5, selected" rather than reading five identical
      // unlabelled rows — and the count is the only way the tint reaches a reader who cannot
      // see it.
      <Pressable
        ref={ref}
        accessibilityRole="tab"
        accessibilityLabel={waiting ? `${label}, ${pending} waiting` : label}
        accessibilityState={{ selected: !!isFocused }}
        style={[style as any, styles.slot]}
        {...props}
      >
        <View style={[styles.iconBox, boxStyle]}>
          <Ionicons name={icon} size={18} color={iconColor} />
          {waiting ? (
            <View style={styles.count}>
              <Txt variant="statusChip" color={Colors.textInverse} tabular style={styles.countText} maxFontSizeMultiplier={1.1}>
                {pending > 9 ? '9+' : pending}
              </Txt>
            </View>
          ) : null}
        </View>
        <Animated.View style={[styles.labelBox, labelStyle]}>
          <Txt
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            variant="statusChip"
            weight={isFocused ? '700' : '600'}
            style={[
              styles.label,
              { color: isFocused ? activeColor : inactiveColor },
            ]}
          >
            {label}
          </Txt>
        </Animated.View>
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
    borderTopWidth: 1, borderTopColor: Colors.separator,
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
    // Rounded square outline when active
    borderRadius: 14,
  },
  count: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: Radii.pill,
    backgroundColor: DeckTints.amber.ink,
    alignItems: 'center',
    justifyContent: 'center',
    // Against the bar, not the icon box, so the numeral stays legible when it overhangs onto
    // white.
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  countText: {
    textAlign: 'center',
  },
  labelBox: {
    // Clips the label as the box folds shut rather than letting it spill over the icon.
    overflow: 'hidden',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  alert: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: ALERT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.control,
    backgroundColor: DeckTints.amber.fill,
    borderWidth: 1,
    borderColor: DeckTints.amber.sub,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  alertText: {
    flex: 1,
  },
});
