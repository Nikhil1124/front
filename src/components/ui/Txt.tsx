import React from 'react';
import { StyleSheet, Text, TextStyle, StyleProp } from 'react-native';
import { Colors } from '@/theme';
import { Typography, fontFamilyForWeight, normalizeFontWeight, type TypographyKey } from '@/theme/typography';
import type { FontWeight } from '@/theme/typography';

type RNFontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export interface TxtProps {
  children: React.ReactNode;
  /** Named scale token (see theme/typography.ts) — sets size/weight/lineHeight/letterSpacing
   *  together. Individual props below still override a single field when passed. */
  variant?: TypographyKey;
  size?: number;
  weight?: FontWeight;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  /** Raise for text that must stay legible at any system font size and sits in a container
   *  that can grow with it. Lower (or 1) only for text inside genuinely fixed chrome. */
  maxFontSizeMultiplier?: number;
  /** Fixed-width digits. Without this, "₹1,42,300" and "₹86,400" sit on different optical
   *  grids — every proportional digit has its own width, so a column of rupee figures never
   *  lines up. Set on any number that appears in a list, a row, or beside another number. */
  tabular?: boolean;
}

/**
 * Caps how far the OS font-size setting can stretch text: 1.3x, not unlimited.
 *
 * The app has ~170 fixed-height containers holding text — 56px fields, 40px chips, the tab
 * dock. Android and iOS both let a user set text to 200%+ for accessibility, and at that
 * scale those containers clip their own labels: buttons read "Confir…", stat tiles lose their
 * numbers. Turning scaling off entirely (`allowFontScaling={false}`) would "fix" the layout by
 * ignoring an accessibility setting outright, which is worse. A cap keeps the app usable for
 * someone who needs bigger text without shattering the layout — the standard compromise.
 *
 * Per-call override exists for the two ends: prose that should scale further, and fixed chrome
 * that cannot scale at all.
 */
const DEFAULT_MAX_FONT_SCALE = 1.3;

export function Txt({
  children, variant, size, weight, color = Colors.textPrimary,
  align = 'left', lineHeight, letterSpacing, style, numberOfLines, ellipsizeMode,
  maxFontSizeMultiplier = DEFAULT_MAX_FONT_SCALE, tabular = false,
}: TxtProps) {
  const base = variant ? Typography[variant] : null;
  // The four weights are four separate FAMILIES (Plus Jakarta ships one file per weight), so
  // `fontWeight` alone does nothing on Android — the family has to be chosen to match, which
  // is why the trailing style object below re-asserts both after the caller's `style`.
  //
  // That override used to read the weight from the `weight` prop and the variant only, so a
  // `style` carrying `fontWeight: '700'` had it thrown away and rendered Regular: 331 call
  // sites across the app were passing a StyleSheet entry that way, and every one of them was
  // silently un-bolded. A weight named in `style` is a request like any other, so it counts
  // here — precedence is the explicit prop, then the style, then the variant, then 400.
  const flat = style ? (StyleSheet.flatten(style) as TextStyle) : undefined;
  const resolvedSize = size ?? base?.fontSize ?? 13;
  const requestedWeight =
    weight ?? (flat?.fontWeight as FontWeight | undefined) ?? base?.fontWeight ?? '400';
  const resolvedWeight = normalizeFontWeight(requestedWeight) as RNFontWeight;
  const resolvedLineHeight = lineHeight ?? base?.lineHeight ?? resolvedSize * 1.35;
  const resolvedLetterSpacing = letterSpacing ?? base?.letterSpacing ?? 0;
  return (
    <Text
      style={[{
        fontFamily: fontFamilyForWeight(requestedWeight),
        fontSize: resolvedSize,
        fontWeight: resolvedWeight,
        color,
        textAlign: align,
        lineHeight: resolvedLineHeight,
        letterSpacing: resolvedLetterSpacing,
      }, style, tabular && styles.tabular, {
        // A caller that names a real family of its own keeps it; otherwise the family has to
        // match the weight or the weight does not happen at all.
        fontFamily: flat?.fontFamily ?? fontFamilyForWeight(requestedWeight),
        fontWeight: resolvedWeight,
      }]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </Text>
  );
}

const styles = { tabular: { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } };
