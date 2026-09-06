export * from './colors';
export * from './typography';
export * from './motion';

import { Colors, Palette, DeckTints, Layout } from './colors';

/** Common spacing scale in dp (mirrors Compose dp units). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
} as const;

/**
 * Corner radii, named by ROLE — the same principle `Typography` already uses, and for the
 * same reason: `sm`/`md`/`lg`/`xl`/`xxl`/`big`/`huge`/`round`/`mega` told you a size but not
 * a purpose, so nobody could tell which one their card was supposed to use. The result was
 * 803 hardcoded radii spanning 14 distinct values (including 3, 19 and 22) against 55 uses of
 * the tokens themselves.
 *
 * Five values, each with one job. If a new shape does not fit one of these, the shape is
 * probably wrong — not the scale.
 */
export const Radii = {
  /** Badges, tags, status chips, progress bars — anything small and decorative. */
  badge: 6,
  /** Buttons, inputs, chips, tiles: anything you tap or type into. */
  control: 10,
  /** Cards, list rows, panels. The app's most common shape by a wide margin.
   *  18 rather than 14: the soft-depth direction groups rows into one shadowed section card,
   *  and at that size a 14 corner reads tight against the padding inside it. */
  card: 18,
  /** Bottom sheets, modals, full-bleed surfaces that meet a screen edge. */
  sheet: 22,
  /** Filled feature surfaces — the tinted metric cards in an analytics deck. Deliberately
   *  larger than `card`: these are the one thing on the screen allowed to be a filled block,
   *  and the generous corner is what separates them from the boxy card they replace. */
  feature: 24,
  /** Circles and capsules — avatars, icon buttons, pills. Preferred over `width / 2`,
   *  which silently stops being a circle the moment the size changes. */
  pill: 999,
} as const;

export { Colors, Palette, DeckTints, Layout };
