/**
 * SLV Premium PG — Redesigned Color Palette & Typography
 */

// ─── Color System ─────────────────────────────────────────
export const AppColors = {
  // Primary brand green
  primary: '#15803D',
  primaryDark: '#166534',
  primaryLight: '#F0FDF4',   // very light green

  // Additional Greens
  deepGreen: '#166534',
  freshGreen: '#22C55E',
  softGreen: '#DCFCE7',
  veryLightGreen: '#F0FDF4',

  // Background & Surfaces
  background: '#F7F9F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F0FDF4',

  // Text colors
  textPrimary: '#17201A',
  textSecondary: '#647067',
  textMuted: '#98A39B',
  textOnPrimary: '#FFFFFF',

  // Borders & Dividers
  border: '#E4E9E5',
  divider: '#E4E9E5',

  // Accent & Semantic colors
  success: '#15803D',
  warning: '#F59E0B',
  error: '#E53935',
  errorLight: '#FEF2F2',
  info: '#2563EB',
  infoLight: '#EFF6FF',

  orange: '#F97316',
  softOrange: '#FFF7ED',
  red: '#E53935',
  softRed: '#FEF2F2',
  blue: '#2563EB',
  softBlue: '#EFF6FF',
  rating: '#F59E0B',

  // Cart / CTA (Updated to Brand Green)
  ctaYellow: '#15803D',
  ctaYellowDark: '#166534',

  // Tab bar
  tabActive: '#15803D',
  tabInactive: '#647067',

  // Misc
  starGold: '#F59E0B',
  freeDeliveryGreen: '#15803D',
  badge: '#E53935',
  badgeText: '#FFFFFF',
  overlay: 'rgba(23, 32, 26, 0.4)',
} as const;

// ─── Typography (Inter Font Family) ───────────────────────
export const AppFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

// ─── Font Sizes ───────────────────────────────────────────
export const FontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 18,
  xl: 20,
  xxl: 24,
  hero: 28,
} as const;

// ─── Spacing ─────────────────────────────────────────────
export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ─── Border Radius ────────────────────────────────────────
export const AppRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
} as const;

// ─── Shadows ─────────────────────────────────────────────
export const AppShadow = {
  card: {
    shadowColor: '#17201A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  modal: {
    shadowColor: '#17201A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
