/**
 * The app's header. One component, two variants, every screen.
 *
 * Before this there were three header components and eighteen hand-rolled copies alongside
 * them — a gradient hero pasted into seven screens, a flat bar pasted into seven grocery
 * screens, and four one-offs. They had drifted on corner radius, notch gap, row padding, title
 * size, subtitle opacity and chip diameter, none of which was ever decided.
 *
 * ── The two variants ────────────────────────────────────────────────────────────────────────
 *   root   — a tab root. Brand rule, optional eyebrow line, title, optional actions.
 *   back   — anything you can navigate out of. Back arrow replaces the rule, no eyebrow.
 * Pass `onBack` to get the second one. That is the whole decision.
 *
 * ── Why light, not the old navy gradient ────────────────────────────────────────────────────
 * The app renders edge-to-edge with `StatusBar style="dark"`, so the clock and battery draw in
 * dark ink. Against the old `#011C40` header that was dark-on-dark and effectively unreadable.
 * A light header is what that status bar style has always assumed.
 *
 * ── Where the brand lives ───────────────────────────────────────────────────────────────────
 * `Colors.primary` appears in this file in exactly one meaningful place: `styles.brandRule`.
 * The action chips take their tint from `Colors.surfaceElevated` and their icon colour from the
 * same token. There is no brand name or logo yet, so when one arrives the header follows it by
 * editing `Colors.primary` alone — nothing here needs to be touched, and no screen hardcodes it.
 */
import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Radii, Colors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

const TOP_GAP = 8;
const ROW_MIN_HEIGHT = 38;
const PAD_BOTTOM = 13;

/** Height below the safe-area inset, for anything that floats over a screen — today only
 *  `AlertOverlay`, which uses it as clearance.
 *
 *  This is the ONE-line height, and since the title/eyebrow may now wrap to two lines on a
 *  narrow screen or at a large font scale, it is a floor rather than an exact measure. The
 *  consequence is bounded and cosmetic: on those screens a toast can sit a few dp higher
 *  against the header than intended. Worth it — the alternative was the header truncating
 *  its own text on every phone narrow enough to need the second line. */
export const HEADER_BAND_HEIGHT = TOP_GAP + ROW_MIN_HEIGHT + PAD_BOTTOM + 1;

interface AppHeaderProps {
  title: string;
  /** Small muted line above the title — "Good morning, Nikhil". Root variant only. */
  eyebrow?: string;
  /** Small muted line below the title — "All your payments in one place". */
  subtitle?: string;
  /** Rendered right of the title, inside its tap target: the property-switcher chevron. */
  titleAdornment?: ReactNode;
  /** Makes the title itself a button — the owner's PG switcher. */
  onTitlePress?: () => void;
  /** Right-hand affordances. Use `HeaderChip` so every screen's buttons match. */
  actions?: ReactNode;
  /** Present ⇒ back variant: an arrow replaces the brand rule and the eyebrow is dropped. */
  onBack?: () => void;
  /** Replaces the brand rule with something of your own — the resident home's avatar. Ignored
   *  when `onBack` is given, because a screen you can leave needs its back button more. */
  leading?: ReactNode;
  testID?: string;
}

export function AppHeader({
  title, eyebrow, subtitle, titleAdornment, onTitlePress, actions, onBack, leading, testID,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  // All three of these were clamped to `numberOfLines={1}`, which on a narrow phone — or at
  // the 1.3x font scale `Txt` allows — cut the line off mid-word with an ellipsis: "Good
  // morning, Nikh…". The width available here is whatever the `actions` on the right do not
  // take, so the smaller the screen the sooner it bites, which is why it showed up on some
  // test phones and not others. Two lines instead of one: the text wraps and stays readable
  // where it used to truncate, and nothing changes at all on a screen wide enough for one
  // line, because a second line is only ever used when the first overflows.
  const titleBlock = (
    <View style={styles.titleCol}>
      {eyebrow && !onBack ? (
        <Txt variant="meta" color={Colors.textMuted} numberOfLines={2}>{eyebrow}</Txt>
      ) : null}
      <View style={styles.titleRow}>
        <Txt variant="screenTitle" color={Colors.textPrimary} numberOfLines={2} style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {titleAdornment}
      </View>
      {subtitle ? (
        <Txt variant="meta" color={Colors.textMuted} numberOfLines={2}>{subtitle}</Txt>
      ) : null}
    </View>
  );

  return (
    <View
      testID={testID}
      style={[styles.header, { paddingTop: insets.top + TOP_GAP }]}
    >
      {onBack ? (
        <AnimatedPress
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </AnimatedPress>
      ) : (
        leading ?? <View style={styles.brandRule} />
      )}

      {onTitlePress ? (
        <AnimatedPress
          accessibilityRole="button"
          accessibilityHint="Opens the property switcher"
          onPress={onTitlePress}
          style={styles.titleCol}
        >
          {titleBlock}
        </AnimatedPress>
      ) : titleBlock}

      {actions}
    </View>
  );
}

/**
 * The circular action button in the header's right-hand slot. It exists so the bell on one
 * screen is the same size as the bell on every other — that was 38px in three places and 36 in
 * a fourth before. 38 plus hitSlop clears the 48dp minimum target without looking like it does.
 */
export function HeaderChip({
  icon, onPress, label, badge = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  badge?: boolean;
}) {
  return (
    <AnimatedPress
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={onPress}
      style={styles.chip}
    >
      <Ionicons name={icon} size={18} color={Colors.primary} />
      {badge ? <View style={styles.badge} /> : null}
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingBottom: PAD_BOTTOM,
    minHeight: ROW_MIN_HEIGHT,
    backgroundColor: Colors.surface,
    // A flat bottom edge, deliberately: the old 24px bottom radius left the canvas showing
    // through at the corners, which read as a rendering seam rather than a shape.
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  // The single place the brand appears. Swap `Colors.primary` and the whole app follows.
  brandRule: { width: 3, height: 34, backgroundColor: Colors.primary },
  back: { width: 34, height: ROW_MIN_HEIGHT, alignItems: 'flex-start', justifyContent: 'center' },
  titleCol: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: ROW_MIN_HEIGHT },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: {
    width: 38, height: 38, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  badge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: Radii.pill,
    backgroundColor: Colors.danger,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
});
