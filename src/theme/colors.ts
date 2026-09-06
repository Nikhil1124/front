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
  //
  // White, not a tint. The old `#F6F9FB` put a white card at 1.06:1 against its own page —
  // measurably the same colour — so nothing on any screen read as a surface, and the only
  // thing drawing a card edge was a 1.46:1 border. You cannot make a white card visible on a
  // near-white page; the page has to stop being near-white. Structure now comes from the
  // hairline (`separator`) and from type, and a filled surface is reserved for something that
  // means it: a tinted metric card, a role-tinted total, an alert.
  canvas: '#FFFFFF',              // The page. Nothing is painted on top of it "for free".
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
  //
  // `separator` is new and load-bearing: with no tinted page behind them, a run of rows is
  // held together by this hairline and nothing else. `surfaceElevated` used to do this job at
  // 1.11:1 against white, which is invisible — it is a tile fill, not a rule.
  separator: '#E1E7EC',           // 1.25:1 on white — row rules and group edges
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

/**
 * DeckTints — the filled metric cards in the analytics deck.
 *
 * Each is a verified triplet, because a tinted surface needs an ink of its own hue: generic
 * near-black on an amber fill looks like a mistake, and `textMuted` on any of them misses AA.
 * Ratios are ink-on-fill and sub-on-fill respectively:
 *
 *     brand  13.77 / 5.69      green   9.67 / 6.00
 *     amber   8.00 / 5.68      slate  15.06 / 5.05
 *
 * `slate` is the inactive card. It is a tint rather than white so that an inactive card still
 * reads as a card on the white page — white-on-white is the bug this whole pass exists to fix.
 */
export const DeckTints = {
  brand: { fill: '#DCEAF2', ink: '#011C40', sub: '#3A5D75' },
  green: { fill: '#D8EDE3', ink: '#03402C', sub: '#2E5F4C' },
  amber: { fill: '#F7E8CE', ink: '#6B3705', sub: '#7A5227' },
  slate: { fill: '#EDEFF2', ink: '#0F1B2A', sub: '#55677A' },
} as const;

export type DeckTint = keyof typeof DeckTints;



// `Theme` — a Material-Design-shaped alias object (`primaryContainer`, `onSurfaceVariant`,
// `error`/`onError`…) sitting beside `Colors` and never once imported anywhere in the app —
// lived here until this pass. It predates `Colors`' own semantic naming (`textPrimary`,
// `surfaceElevated`, `danger`) and nothing in the app ever adopted its Material vocabulary;
// every screen already reaches for `Colors.*` directly. Same failure shape as the `Layout`
// radius fields removed above: a second, unused name for values `Colors` already owns.

export const Layout = {
  // `borderRadiusCard` (20), `borderRadiusButton` (12) and `borderRadiusChip` (20) lived here
  // until this pass — a second, uncoordinated radius scale sitting beside `Radii`, and the
  // one `Card`/`Btn`/`OutlinedBtn`/`Chip`/`Pill` actually defaulted to. `Radii` was built
  // specifically to replace scales like this one; these three just never got the memo, so
  // every screen using a bare `<Card>` was silently 2px rounder than one that passed
  // `borderRadius={Radii.card}` explicitly. Removed rather than pointed at `Radii` and kept,
  // because a second name for the same five values is exactly the trap `Radii` exists to
  // close — see `src/data/tokens.check.ts`.
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
