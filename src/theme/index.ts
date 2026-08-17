export * from './colors';
export * from './typography';

import { Colors, Palette, Theme, Layout } from './colors';

/** Common spacing scale in dp (mirrors Compose dp units). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Common radii. */
export const Radii = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14, // aligned to Layout.borderRadiusCard for backward compat
  big: 18,
  huge: 20,
  round: 24,
  mega: 28,
  pill: 999,
} as const;

export { Colors, Palette, Theme, Layout };
