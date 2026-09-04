/**
 * 🌙 PGow "LUNA" Design System — palette.
 *
 * Ocean blue stays the brand; what changed is that every value is now measured rather than
 * chosen by eye. Three rules it holds to, and the reasons they exist here:
 *
 * 1. **Anything carrying white text clears 4.5:1.** The previous teal, green and cyan-warning
 *    fills sat at 2.5–2.6:1 — a white label on them was barely legible in daylight.
 * 2. **Status colours are different HUES, not different blues.** `warning` was `#54ACBF`,
 *    the exact same cyan as `secondary`, so "pay your rent" and "here's an accent" rendered
 *    identically. Amber now means caution, green means good, red means stop.
 * 3. **Body text is softened, not maximised.** `textPrimary` was 15.94:1 — near the maximum
 *    possible, and that near-black-on-near-white is a well-known source of eye strain over a
 *    long session. 12.5:1 is still crisp and considerably kinder.
 *
 * Ratios below are against `canvas` (#F6F9FB) for text, and against white for fills.
 * If you change a value here, re-check it — the three rules above are the contract.
 */
export const Colors = {
  // ── Surfaces & Canvas ─────────────────────────────────────────────────────
  canvas: '#F6F9FB',              // Light ice cyan canvas background
  surface: '#FFFFFF',             // Pure white cards & dialogs
  surfaceCard: '#FFFFFF',         // Card background
  surfaceElevated: '#EDF4F8',     // Soft highlighted ice tiles / active chips
  surfaceGlass: 'rgba(255, 255, 255, 0.94)', // Glassmorphism modals & floating bars
  surfaceMuted: '#F6F9FB',        // Secondary background for text fields & disabled states

  // ── Brand & Accents ───────────────────────────────────────────────────────
  primary: '#26658C',             // Deep Ocean Blue brand
  primaryDark: '#011C40',         // Obsidian Navy Blue for pressed states & headers
  primaryGlow: 'rgba(38, 101, 140, 0.14)', // Soft ocean shadow glow
  secondary: '#2F7F92',           // Cyan Teal for sub-headings & secondary chips
  tertiary: '#2F7F92',            // Cyan Teal Accent
  accentWarm: '#B45309',          // Cyan Teal Accent
  accentCool: '#3B6E9E',          // Cyan Teal
  accentRose: '#BE123C',          // Critical / Panic / Expired badges

  // ── Status Colors ─────────────────────────────────────────────────────────
  success: '#046C4E',             // Active / Paid / Vacant bed green
  warning: '#B45309',             // Pending / Due soon cyan teal
  danger: '#C81E1E',              // Overdue / Rejected / Panic red
  info: '#3B6E9E',                // Notice / Info ocean blue

  // ── Typography & Content ───────────────────────────────────────────────────
  textPrimary: '#1B3245',         // Obsidian Navy Blue text (High contrast)
  textSecondary: '#2C4A63',       // Deep Midnight Blue subtitle text
  textMuted: '#5A7387',           // Muted ocean caption text
  textInverse: '#FFFFFF',         // White text on primary buttons
  textAccent: '#26658C',          // Ocean blue text for links & active tab labels

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  borderSubtle: '#C9D8E2',        // Ice Cyan border
  borderFocus: '#26658C',         // 2px active input focus border
  borderGlass: 'rgba(44, 74, 99, 0.16)', // Glassmorphic borders
  borderMuted: '#D3E0E9',         // Divider lines

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
  StatusGreen: '#046C4E',
  StatusGreenSoft: '#D1FAE5',
  StatusRed: '#C81E1E',
  // Badge backgrounds — each verified ≥4.5:1 against its own status colour above.
  TintAmber: '#FEF3C7',
  TintGreen: '#D1FAE5',
  TintRed: '#FEE2E2',
  TintBlue: '#E6F1F7',
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
