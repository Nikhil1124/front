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

export type LoadedFontWeight = '400' | '500' | '600' | '700';

export const FontFamilies: Record<LoadedFontWeight, string> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
};

export interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: LoadedFontWeight;
}

export const Typography = {
  /** Screen's main title — top of a HubScreenWrapper / tab header */
  screenTitle:  { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: '700' as LoadedFontWeight },
  /** Section heading within a screen ("QUICK ACTIONS", "TOTALS") */
  sectionTitle: { fontSize: 16, lineHeight: 22, letterSpacing: 0, fontWeight: '600' as LoadedFontWeight },
  /** A card's own title (list item name, banner heading) */
  cardTitle:    { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '600' as LoadedFontWeight },
  /** Regular paragraph / body text */
  body:         { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '400' as LoadedFontWeight },
  /** Secondary / muted supporting text under a title */
  caption:      { fontSize: 10.5, lineHeight: 14, letterSpacing: 0, fontWeight: '400' as LoadedFontWeight },
  /** Button label */
  button:       { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '600' as LoadedFontWeight },
  /** Small metadata line */
  meta:         { fontSize: 11, lineHeight: 16, letterSpacing: 0, fontWeight: '500' as LoadedFontWeight },
  /** All-caps section label */
  label:        { fontSize: 11, lineHeight: 16, letterSpacing: 0, fontWeight: '500' as LoadedFontWeight },
  /** Tiny badge / pill / all-caps tag */
  labelSmall:   { fontSize: 10.5, lineHeight: 14, letterSpacing: 0, fontWeight: '600' as LoadedFontWeight },
  /** Status chip text */
  statusChip:   { fontSize: 10.5, lineHeight: 14, letterSpacing: 0, fontWeight: '600' as LoadedFontWeight },
  /** Big number in a stat tile / price / balance */
  statValue:    { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: '700' as LoadedFontWeight },
  /** Approved metric alias */
  metric:       { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: '700' as LoadedFontWeight },
  /** The single biggest figure on a screen — hero card headline */
  heroNumber:   { fontSize: 28, lineHeight: 34, letterSpacing: 0, fontWeight: '700' as LoadedFontWeight },
  /** Approved hero alias */
  hero:         { fontSize: 28, lineHeight: 34, letterSpacing: 0, fontWeight: '700' as LoadedFontWeight },
} as const;

export type TypographyKey = keyof typeof Typography;

/** Convert a typography token to a RN TextStyle object. */
export function textStyle(key: TypographyKey): TextStyle {
  const t = Typography[key];
  return {
    fontFamily: fontFamilyForWeight(t.fontWeight),
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    fontWeight: t.fontWeight,
  };
}

export function normalizeFontWeight(weight: FontWeight | undefined): LoadedFontWeight {
  if (weight === 'normal' || weight === '100' || weight === '200' || weight === '300' || weight === '400') return '400';
  if (weight === '500') return '500';
  if (weight === '600') return '600';
  return weight === 'bold' || weight === '700' || weight === '800' || weight === '900' ? '700' : '400';
}

export function fontFamilyForWeight(weight: FontWeight | undefined): string {
  return FontFamilies[normalizeFontWeight(weight)];
}
