/**
 * 🌙 PGow Official "LUNA" Design System — STRICT Color Palette
 *
 * STRICT Hex Codes:
 *   - #011C40 : Obsidian Navy Blue (Primary Dark, Headers, Main High-Contrast Text)
 *   - #023859 : Deep Midnight Blue (Header End, Subtitle Text)
 *   - #26658C : Deep Ocean Blue (Primary Brand, Main CTA Buttons, Focus Borders)
 *   - #54ACBF : Cyan Teal (Brand Accents, Secondary Buttons, Active Chips)
 *   - #A7EBF2 : Soft Ice Cyan (Active Highlights, Soft Badges, Ice Chips)
 *   - #F4F9FB : Light Ice Canvas (Clean App Background)
 *   - #FFFFFF : Pure White (Card Surfaces & Floating Bars)
 *
 * ZERO cream colors permitted. STRICT LUNA palette enforcement.
 */
export const Colors = {
  // ── Surfaces & Canvas ─────────────────────────────────────────────────────
  canvas: '#F4F9FB',              // Light ice cyan canvas background
  surface: '#FFFFFF',             // Pure white cards & dialogs
  surfaceCard: '#FFFFFF',         // Card background
  surfaceElevated: '#EBF7FA',     // Soft highlighted ice tiles / active chips
  surfaceGlass: 'rgba(255, 255, 255, 0.94)', // Glassmorphism modals & floating bars
  surfaceMuted: '#F4F9FB',        // Secondary background for text fields & disabled states

  // ── Brand & Accents ───────────────────────────────────────────────────────
  primary: '#26658C',             // Deep Ocean Blue brand
  primaryDark: '#011C40',         // Obsidian Navy Blue for pressed states & headers
  primaryGlow: 'rgba(38, 101, 140, 0.14)', // Soft ocean shadow glow
  secondary: '#54ACBF',           // Cyan Teal for sub-headings & secondary chips
  tertiary: '#54ACBF',            // Cyan Teal Accent
  accentWarm: '#54ACBF',          // Cyan Teal Accent
  accentCool: '#54ACBF',          // Cyan Teal
  accentRose: '#E11D48',          // Critical / Panic / Expired badges

  // ── Status Colors ─────────────────────────────────────────────────────────
  success: '#10B981',             // Active / Paid / Vacant bed green
  warning: '#54ACBF',             // Pending / Due soon cyan teal
  danger: '#EF4444',              // Overdue / Rejected / Panic red
  info: '#26658C',                // Notice / Info ocean blue

  // ── Typography & Content ───────────────────────────────────────────────────
  textPrimary: '#011C40',         // Obsidian Navy Blue text (High contrast)
  textSecondary: '#023859',       // Deep Midnight Blue subtitle text
  textMuted: '#26658C',           // Muted ocean caption text
  textInverse: '#FFFFFF',         // White text on primary buttons
  textAccent: '#26658C',          // Ocean blue text for links & active tab labels

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  borderSubtle: '#CBEFF4',        // Ice Cyan border
  borderFocus: '#26658C',         // 2px active input focus border
  borderGlass: 'rgba(84, 172, 191, 0.18)', // Glassmorphic borders
  borderMuted: '#CBEFF4',         // Divider lines

  // ── Gradients ─────────────────────────────────────────────────────────────
  heroGradientStart: '#011C40',   // Top header gradient (Obsidian Navy)
  heroGradientEnd: '#023859',     // Deep Midnight Blue end
  cardGradientStart: '#FFFFFF',
  cardGradientEnd: '#F4F9FB',
  alertGradientStart: '#EBF7FA',
  alertGradientEnd: '#CBEFF4',
  panicGradientStart: '#EF4444',
  panicGradientEnd: '#DC2626',
} as const;

export type ColorToken = keyof typeof Colors;

/**
 * Palette — a minimal set of values that have no direct Colors.* semantic equivalent.
 *
 * Only add to this object if the value genuinely has no semantic home in Colors:
 *   - BgScrim: a modal dim overlay, not a surface or canvas
 *   - Status colors with distinct semantic meaning beyond Colors.success / Colors.danger
 *
 * Do NOT re-add removed legacy aliases (Luxury*, Cyber*, Slate*, res*) — those were
 * migrated to their proper Colors.* equivalents and must not return.
 */
export const Palette = {
  // Modal background scrim — no semantic Colors.* equivalent
  BgScrim: 'rgba(1, 28, 64, 0.45)',

  // Gradient pair used in AlertOverlay & panic screens
  GradientStart: '#011C40',
  GradientEnd: '#023859',

  // Distinct status variants not covered by Colors.success / Colors.danger
  StatusGreen: '#10B981',
  StatusGreenSoft: '#A7EBF2',
  StatusRed: '#EF4444',
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
  borderRadiusCard: 20,
  borderRadiusButton: 12,
  borderRadiusChip: 20,
  shadowCard: {
    shadowColor: '#011C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  shadowHero: {
    shadowColor: '#011C40',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  } as const,
  shadowFloatingBar: {
    shadowColor: '#011C40',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  } as const,
} as const;
