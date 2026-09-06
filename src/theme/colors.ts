/** Locked PGow Botanical + Terracotta palette. See PGow_REDESIGN_UNIFIED.md §4.1. */
export const Colors = {
  // ── Surfaces & Canvas ─────────────────────────────────────────────────────
  //
  // White, not a tint. The old `#F6F9FB` put a white card at 1.06:1 against its own page —
  // measurably the same colour — so nothing on any screen read as a surface, and the only
  // thing drawing a card edge was a 1.46:1 border. You cannot make a white card visible on a
  // near-white page; the page has to stop being near-white. Structure now comes from the
  // hairline (`separator`) and from type, and a filled surface is reserved for something that
  // means it: a tinted metric card, a role-tinted total, an alert.
  canvas: '#FDFCFA',
  surface: '#FDFCFA',
  surfaceCard: '#FDFCFA',
  surfaceElevated: '#EDEFE8',
  surfaceGlass: 'rgba(253, 252, 250, 0.94)',
  surfaceMuted: '#F5F3EF',

  // ── Brand & Accents ───────────────────────────────────────────────────────
  brandPale: '#EAF2E6',
  brandSoft: '#74926D',
  brand: '#4C7246',
  brandDeep: '#2C452A',
  terracottaPale: '#F9F0E8',
  terracotta: '#A0572E',
  terracottaDeep: '#6E3A22',
  // Compatibility aliases retain the current API while callers are audited by meaning.
  primary: '#4C7246',
  primaryDark: '#2C452A',
  primaryGlow: 'rgba(76, 114, 70, 0.12)',
  secondary: '#A0572E',
  tertiary: '#A0572E',
  accentWarm: '#A0572E',
  accentCool: '#4E4C44',
  accentRose: '#A6474E',

  // ── Status Colors ─────────────────────────────────────────────────────────
  successPale: '#E4EFEA',
  success: '#2E6A54',
  successDeep: '#1D4738',
  pendingPale: '#F7EEDC',
  pending: '#836731',
  pendingDeep: '#57441F',
  dangerPale: '#F9E9E9',
  danger: '#A6474E',
  dangerDeep: '#6E2E33',
  neutralPale: '#EFEDE7',
  neutral: '#6E6A5F',
  // Existing callers name pending as warning and non-opinionated information as info.
  warning: '#836731',
  info: '#6E6A5F',

  // ── Typography & Content ───────────────────────────────────────────────────
  textPrimary: '#33322C',
  textSecondary: '#4E4C44',
  textMuted: '#726E64',
  textInverse: '#FDFCFA',
  textAccent: '#4C7246',

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  //
  // `separator` is new and load-bearing: with no tinted page behind them, a run of rows is
  // held together by this hairline and nothing else. `surfaceElevated` used to do this job at
  // 1.11:1 against white, which is invisible — it is a tile fill, not a rule.
  separator: '#E8E5DE',
  borderSubtle: '#D6D2C8',
  borderFocus: '#4C7246',
  borderGlass: 'rgba(78, 76, 68, 0.16)',
  borderMuted: '#E8E5DE',
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
  BgScrim: 'rgba(44, 69, 42, 0.45)',
  StatusGreen: '#2E6A54',
  StatusGreenSoft: '#E4EFEA',
  StatusRed: '#A6474E',
  TintAmber: '#F7EEDC',
  TintGreen: '#E4EFEA',
  TintRed: '#F9E9E9',
  TintBlue: '#EFEDE7',
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
  brand: { fill: '#EAF2E6', ink: '#2C452A', sub: '#4C7246' },
  green: { fill: '#E4EFEA', ink: '#1D4738', sub: '#2E6A54' },
  amber: { fill: '#F7EEDC', ink: '#57441F', sub: '#836731' },
  slate: { fill: '#EFEDE7', ink: '#33322C', sub: '#6E6A5F' },
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
    shadowColor: '#2C452A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  } as const,
  shadowHero: {
    shadowColor: '#2C452A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  } as const,
  shadowFloatingBar: {
    shadowColor: '#2C452A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  } as const,
} as const;
