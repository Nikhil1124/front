/**
 * 🌿 PGow "Cyber Indigo" Design System — Indigo Redesign
 *
 * Replaces the mint green theme with an ultra-clean,
 * premium Indigo/violet palette.
 */
export const Colors = {
  // ── Surfaces & Canvas ─────────────────────────────────────────────────────
  canvas: '#F7F8FC',              // Light cool background
  surface: '#FFFFFF',             // Pure white cards & dialogs
  surfaceCard: '#FFFFFF',         // Card background
  surfaceElevated: '#EEF2FF',     // Soft highlighted tiles / active indigo chips
  surfaceGlass: 'rgba(255, 255, 255, 0.94)', // Glassmorphism modals & floating bars
  surfaceMuted: '#F3F4F6',        // Secondary background for text fields & disabled states

  // ── Brand & Accents ───────────────────────────────────────────────────────
  primary: '#5B45E8',             // Premium Indigo brand
  primaryDark: '#4338CA',         // Darker indigo for pressed states & headers
  primaryGlow: 'rgba(91, 69, 232, 0.12)', // Soft indigo shadow glow
  secondary: '#4F46E5',           // Deep Indigo for sub-headings
  tertiary: '#D97706',            // Amber Accent (Alerts, Overdue dues)
  accentWarm: '#D97706',          // Warm Amber
  accentCool: '#5B45E8',          // Cool Indigo
  accentRose: '#E11D48',          // Critical / Panic / Expired badges

  // ── Status Colors ─────────────────────────────────────────────────────────
  success: '#10B981',             // Active / Paid / Vacant bed green
  warning: '#F59E0B',             // Pending / Due soon amber
  danger: '#EF4444',              // Overdue / Rejected / Panic red
  info: '#0284C7',                // Notice / Info blue

  // ── Typography & Content ───────────────────────────────────────────────────
  textPrimary: '#15171A',         // Deep charcoal text (High contrast)
  textSecondary: '#4B5563',       // Subtitle gray text
  textMuted: '#6B7280',           // Muted caption text
  textInverse: '#FFFFFF',         // White text on primary buttons
  textAccent: '#5B45E8',          // Indigo text for links & active tab labels

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  borderSubtle: '#E5E7EB',        // Soft gray border (1px default on cards)
  borderFocus: '#5B45E8',         // 2px active input focus border
  borderGlass: 'rgba(91, 69, 232, 0.1)', // Glassmorphic borders
  borderMuted: '#E5E7EB',         // Divider lines

  // ── Gradients ─────────────────────────────────────────────────────────────
  heroGradientStart: '#5B45E8',   // Top header & key banner gradient
  heroGradientEnd: '#8B5CF6',     // Violet end
  cardGradientStart: '#FFFFFF',
  cardGradientEnd: '#F7F8FC',
  alertGradientStart: '#FFFBEB',
  alertGradientEnd: '#FEF3C7',
  panicGradientStart: '#EF4444',
  panicGradientEnd: '#DC2626',

  // ── Legacy Aliases ────────────────────────────────────────────────────────
  LuxuryPureBlack: '#F7F8FC',
  LuxurySurfaceDark: '#FFFFFF',
  LuxuryCardBorder: '#E5E7EB',
  SlateMutedText: '#6B7280',
  IvoryWhiteText: '#15171A',
  CyberGreen: '#5B45E8',
  CyberPurple: '#4338CA',
  CyberPink: '#5B45E8',
  CyberAmber: '#D97706',

  Teal80: '#5B45E8',
  TealSecondary80: '#4338CA',
  Gold80: '#D97706',
  Teal40: '#4338CA',
  TealSecondary40: '#4338CA',
  Gold40: '#B45309',
  SlateDarkBackground: '#F7F8FC',
  SlateDarkSurface: '#FFFFFF',
  LightCreamBackground: '#F7F8FC',
  LightCreamSurface: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof Colors;

export const Palette = {
  // Status colors
  StatusGreen: '#10B981',
  StatusGreenSoft: '#34D399',
  StatusRed: '#EF4444',
  StatusAmber: '#F59E0B',
  StatusAmberDeep: '#D97706',
  StatusPink: '#E11D48',
  StatusCyan: '#5B45E8',
  StatusBlue: '#0284C7',
  StatusPurple: '#4338CA',
  StatusGold: '#D97706',
  StatusOrange: '#D97706',

  // Functional gradients
  GradientStart: '#5B45E8',
  GradientEnd: '#8B5CF6',

  // Surfaces
  SurfaceDeepNavy: '#FFFFFF',
  SurfaceInkDark: '#F3F4F6',
  SurfaceDarkCard: '#FFFFFF',
  SurfacePanel: '#F7F8FC',
  SurfaceInk: '#F3F4F6',
  SurfaceInkAlt: '#EEF2FF',
  SurfaceInkDeep: '#EEF2FF',
  SurfaceMagenta: '#FFFBEB',
  SurfaceViolet: '#EEF2FF',
  SurfaceTeal: '#EEF2FF',
  SurfaceVioletDeep: '#EEF2FF',
  SurfaceVioletBright: '#EEF2FF',
  SurfaceInkMagenta: '#FFFBEB',
  SurfaceInkAmber: '#FFFBEB',
  SurfaceInkBrown: '#FEF3C7',
  SurfaceInkCyan: '#EEF2FF',
  SurfaceInkGreen: '#EEF2FF',
  SurfaceInkPink: '#FFFBEB',
  SurfaceInkPurple: '#EEF2FF',

  // Background variants
  BgCard: '#FFFFFF',
  BgPaper: '#F7F8FC',
  BgTerminal: '#F7F8FC',
  BgScrim: 'rgba(21, 23, 26, 0.45)', // modal scrim

  // Text tints
  TextMuted: '#6B7280',
  TextMid: '#4B5563',
  TextFaint: '#5B45E8',

  // Border variants
  BorderFaint: '#E5E7EB',
  BorderMid: '#E5E7EB',
  BorderStrong: '#5B45E8',
  BorderPurpleSoft: '#EEF2FF',
  BorderAmberSoft: '#FEF3C7',
} as const;

export const Theme = {
  colors: Colors,
  palette: Palette,
  primary: Colors.primary,
  secondary: Colors.secondary,
  tertiary: Colors.tertiary,
  background: Colors.canvas,
  surface: Colors.surface,
  onPrimary: Colors.textInverse,
  onSecondary: Colors.textInverse,
  onBackground: Colors.textPrimary,
  onSurface: Colors.textPrimary,
  surfaceVariant: Colors.surfaceMuted,
  onSurfaceVariant: Colors.textSecondary,
  primaryContainer: Colors.surfaceElevated,
  onPrimaryContainer: Colors.primaryDark,
  secondaryContainer: Colors.surfaceMuted,
  onSecondaryContainer: Colors.textPrimary,
  tertiaryContainer: Colors.surfaceElevated,
  onTertiaryContainer: Colors.tertiary,
  error: Colors.danger,
  onError: Colors.textInverse,
} as const;

export type ThemeType = typeof Theme;

export const Layout = {
  borderRadiusCard: 22,
  borderRadiusButton: 12,
  borderRadiusChip: 20,
  shadowCard: {
    shadowColor: '#5B45E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  shadowHero: {
    shadowColor: '#5B45E8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  } as const,
  shadowFloatingBar: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  } as const,
} as const;
