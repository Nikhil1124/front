/**
 * Typography tokens — app-semantic scale.
 *
 * Every `<Txt variant="...">` in the app resolves to one of these tokens.
 * Keys are named after what ROLE the text plays on screen (screenTitle,
 * cardTitle, body, caption...) rather than abstract Material 3 names
 * (displayLarge, headlineMedium) — so a reader seeing `variant="cardTitle"`
 * six months from now knows exactly what it's for without looking up a table.
 *
 * fontSize values were corrected against actual usage, not just re-keyed from the old
 * Material 3 numbers: after the app-wide sweep to `variant=`, nearly every call site also
 * still carried its original explicit `size={N}`, which (correctly) overrides the variant —
 * and those explicit sizes were near-unanimous per role (e.g. 171 call sites all agreed
 * `caption` should render at 11, not the Material 3 scale's borrowed 12). That's the app's
 * real, established scale; the numbers below were moved to match it, not the other way
 * around, so the leftover per-site `size=` overrides could be safely deleted as pure no-ops
 * rather than becoming 285 individual, unreviewed size changes.
 */
import { TextStyle } from 'react-native';

export type FontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

export interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: FontWeight;
}

export const Typography = {
  /** Screen's main title — top of a HubScreenWrapper / tab header */
  screenTitle:  { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontWeight: '800' as FontWeight },
  /** Section heading within a screen ("QUICK ACTIONS", "TOTALS") */
  sectionTitle: { fontSize: 18, lineHeight: 24, letterSpacing: 0,    fontWeight: '700' as FontWeight },
  /** A card's own title (list item name, banner heading) */
  cardTitle:    { fontSize: 16, lineHeight: 22, letterSpacing: 0.1,  fontWeight: '700' as FontWeight },
  /** Regular paragraph / body text */
  body:         { fontSize: 14, lineHeight: 20, letterSpacing: 0.2,  fontWeight: '500' as FontWeight },
  /** Secondary / muted supporting text under a title */
  caption:      { fontSize: 12, lineHeight: 16, letterSpacing: 0.2,  fontWeight: '400' as FontWeight },
  /** All-caps section label (letter-spacing built for uppercase) */
  label:        { fontSize: 12, lineHeight: 16, letterSpacing: 1.0,  fontWeight: '700' as FontWeight },
  /** Tiny badge / pill / all-caps tag */
  labelSmall:   { fontSize: 10, lineHeight: 14, letterSpacing: 1.2,  fontWeight: '700' as FontWeight },
  /** Big number in a stat tile / price / balance */
  statValue:    { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontWeight: '700' as FontWeight },
  /** The single biggest figure on a screen — hero card headline */
  heroNumber:   { fontSize: 32, lineHeight: 38, letterSpacing: -1.0, fontWeight: '800' as FontWeight },
} as const;

export type TypographyKey = keyof typeof Typography;

/** Convert a typography token to a RN TextStyle object. */
export function textStyle(key: TypographyKey): TextStyle {
  const t = Typography[key];
  return {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    fontWeight: t.fontWeight,
  };
}
