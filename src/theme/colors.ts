/**
 * 🌿 PGow "Cyber Mint" Design System — Variant 8
 *
 * Replaces the legacy obsidian dark theme (`#060D10`) with an ultra-clean,
 * airy, high-contrast light mint palette inspired by PhonePe / Cred / Airbnb.
 *
 * Migration strategy:
 *   - The CANONICAL new tokens (canvas, surface, primary, textPrimary, …) are
 *     exported as top-level `Colors.*` keys and match the spec verbatim.
 *   - The LEGACY token names (`LuxuryPureBlack`, `CyberGreen`, `IvoryWhiteText`,
 *     `SlateMutedText`, `LuxurySurfaceDark`, `LuxuryCardBorder`, …) are kept
 *     as DEPRECATED ALIASES that map to the closest mint equivalent. This lets
 *     every existing screen pick up the new look without a rewrite — the old
 *     names were used pervasively, and re-pointing them at mint values is the
 *     single highest-leverage change in the whole migration.
 *   - The `Palette` collection below preserves a few status / accent hexes the
 *     app still reaches for directly, also reminted where appropriate.
 */
export const Colors = {
  // ── Surfaces & Canvas ─────────────────────────────────────────────────────
  canvas: '#F0FDF9',              // Refreshing mint canvas (was #060D10)
  surface: '#FFFFFF',             // Pure white cards & dialogs
  surfaceCard: '#FFFFFF',         // Card background
  surfaceElevated: '#E6FAF5',     // Soft highlighted tiles / active chips
  surfaceGlass: 'rgba(255, 255, 255, 0.92)', // Glassmorphism modals & floating bars
  surfaceMuted: '#F8FAFC',        // Secondary background for text fields & disabled states

  // ── Brand & Accents ───────────────────────────────────────────────────────
  primary: '#0D9488',             // Crisp Emerald Teal (PhonePe / Medical / Hostel Trust)
  primaryDark: '#0F766E',         // Darker teal for pressed states & headers
  primaryGlow: 'rgba(13, 148, 136, 0.18)', // Soft mint shadow glow
  secondary: '#0F766E',           // Deep Teal for sub-headings
  tertiary: '#D97706',            // Amber Accent (Alerts, Overdue dues, Urgent notices)
  accentWarm: '#D97706',          // Warm Amber
  accentCool: '#0D9488',          // Cool Mint Emerald
  accentRose: '#E11D48',          // Critical / Panic / Expired badges

  // ── Status Colors ─────────────────────────────────────────────────────────
  success: '#10B981',             // Active / Paid / Vacant bed green
  warning: '#F59E0B',             // Pending / Due soon amber
  danger: '#EF4444',              // Overdue / Rejected / Panic red
  info: '#0284C7',                // Notice / Info blue

  // ── Typography & Content ───────────────────────────────────────────────────
  textPrimary: '#0F172A',         // Slate 900 (High contrast, razor-sharp readability)
  textSecondary: '#334155',       // Slate 700 for subtitles & field labels
  textMuted: '#64748B',           // Slate 500 for captions & timestamps
  textInverse: '#FFFFFF',         // White text on primary buttons
  textAccent: '#0D9488',          // Teal text for links & active tab labels

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  borderSubtle: '#CCFBF1',        // Soft mint border (1px default on cards)
  borderFocus: '#0D9488',         // 2px active input focus border
  borderGlass: 'rgba(13, 148, 136, 0.15)', // Glassmorphic borders
  borderMuted: '#E2E8F0',         // Divider lines

  // ── Gradients ─────────────────────────────────────────────────────────────
  heroGradientStart: '#0D9488',   // Top header & key banner gradient
  heroGradientEnd: '#14B8A6',
  cardGradientStart: '#FFFFFF',
  cardGradientEnd: '#F0FDF9',
  alertGradientStart: '#FFFBEB',
  alertGradientEnd: '#FEF3C7',
  panicGradientStart: '#EF4444',
  panicGradientEnd: '#DC2626',

  // ──────────────────────────────────────────────────────────────────────────
  // DEPRECATED LEGACY ALIASES — kept so existing call-sites compile and
  // automatically inherit the new mint look. Do NOT use in new code; reach
  // for the canonical token above instead. The mapping is intentionally
  // biased toward "what would a screen that used this token visually want
  // once we are on a light canvas?" rather than a literal 1:1 hue match.
  // ──────────────────────────────────────────────────────────────────────────
  // 60% Dominant Color Token (was obsidian black) — now the mint canvas.
  LuxuryPureBlack: '#F0FDF9',
  // 30% Structural Secondary (was elevated dark glass) — now pure white surface.
  LuxurySurfaceDark: '#FFFFFF',
  // Card border (was dark teal) — now the soft mint border.
  LuxuryCardBorder: '#CCFBF1',
  // Muted slate text (was slate on dark) — now slate-500 (muted caption).
  SlateMutedText: '#64748B',
  // Ivory white text (was near-white on dark) — now slate-900 (high-contrast body).
  IvoryWhiteText: '#0F172A',
  // CyberGreen accent (was neon mint) — now the canonical primary teal.
  CyberGreen: '#0D9488',
  // CyberPurple (was deep teal) — now primaryDark (slightly darker teal).
  CyberPurple: '#0F766E',
  // CyberPink (was bright cyan-mint) — collapses onto primary teal so chips
  // and outlines don't fight the new single-accent system.
  CyberPink: '#0D9488',
  // CyberAmber (was orange) — now the warm amber accent.
  CyberAmber: '#D97706',

  // Compatibility aliases from the old Theme export block — all repointed
  // at mint equivalents so any code that reads `Colors.Teal40` etc. keeps
  // working without a hunt-and-replace.
  Teal80: '#0D9488',
  TealSecondary80: '#0F766E',
  Gold80: '#D97706',
  Teal40: '#0F766E',
  TealSecondary40: '#0F766E',
  Gold40: '#B45309',
  SlateDarkBackground: '#F0FDF9',
  SlateDarkSurface: '#FFFFFF',
  LightCreamBackground: '#F0FDF9',
  LightCreamSurface: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof Colors;

/**
 * Extra palette — preserved for direct hex access in legacy screens. Every
 * value has been re-pointed at the mint / slate / amber palette so the app
 * looks coherent after the migration.
 */
export const Palette = {
  // Status colors — verbatim from the new spec, reused widely.
  StatusGreen: '#10B981',
  StatusGreenSoft: '#34D399',
  StatusRed: '#EF4444',
  StatusAmber: '#F59E0B',
  StatusAmberDeep: '#D97706',
  StatusPink: '#E11D48',
  StatusCyan: '#0D9488',
  StatusBlue: '#0284C7',
  StatusPurple: '#0F766E',
  StatusGold: '#D97706',
  StatusOrange: '#D97706',

  // Functional gradients — repointed at mint hero / panic gradients.
  GradientStart: '#0D9488',
  GradientEnd: '#14B8A6',

  // Surfaces — collapsed onto the new white / mint / muted-slate scale.
  SurfaceDeepNavy: '#FFFFFF',
  SurfaceInkDark: '#F8FAFC',
  SurfaceDarkCard: '#FFFFFF',
  SurfacePanel: '#F0FDF9',
  SurfaceInk: '#F8FAFC',
  SurfaceInkAlt: '#E6FAF5',
  SurfaceInkDeep: '#E6FAF5',
  SurfaceMagenta: '#FFFBEB',
  SurfaceViolet: '#E6FAF5',
  SurfaceTeal: '#E6FAF5',
  SurfaceVioletDeep: '#E6FAF5',
  SurfaceVioletBright: '#E6FAF5',
  SurfaceInkMagenta: '#FFFBEB',
  SurfaceInkAmber: '#FFFBEB',
  SurfaceInkBrown: '#FEF3C7',
  SurfaceInkCyan: '#E6FAF5',
  SurfaceInkGreen: '#E6FAF5',
  SurfaceInkPink: '#FFFBEB',
  SurfaceInkPurple: '#E6FAF5',

  // Background variants — all light, all mint-tinted or white.
  BgCard: '#FFFFFF',
  BgPaper: '#F0FDF9',
  BgTerminal: '#F0FDF9',
  BgScrim: 'rgba(15, 23, 42, 0.55)', // modal scrim — slate-900 / 55% (was near-black)

  // Text tints — slate scale.
  TextMuted: '#64748B',
  TextMid: '#334155',
  TextFaint: '#0D9488',

  // Border variants — mint / slate hairlines.
  BorderFaint: '#CCFBF1',
  BorderMid: '#E2E8F0',
  BorderStrong: '#0D9488',
  BorderPurpleSoft: '#CCFBF1',
  BorderAmberSoft: '#FEF3C7',
} as const;

export const Theme = {
  colors: Colors,
  palette: Palette,
  // Material colorScheme equivalent — repointed at the mint system.
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

// ─────────────────────────────────────────────────────────────────────────────
// Layout tokens — Variant 8 spec. Cards & buttons share a uniform corner
// radius scale, and shadows use the soft mint glow rather than the old
// high-contrast dark elevation.
// ─────────────────────────────────────────────────────────────────────────────
export const Layout = {
  borderRadiusCard: 14,
  borderRadiusButton: 10,
  borderRadiusChip: 20,
  shadowCard: {
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  shadowHero: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
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
