import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { Colors } from '@/theme';
import { Typography, type TypographyKey } from '@/theme/typography';
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
  const resolvedSize = size ?? base?.fontSize ?? 13;
  const resolvedWeight = (weight ?? base?.fontWeight ?? '400') as RNFontWeight;
  const resolvedLineHeight = lineHeight ?? base?.lineHeight ?? resolvedSize * 1.35;
  const resolvedLetterSpacing = letterSpacing ?? base?.letterSpacing ?? 0;
  return (
    <Text
      style={[{
        fontSize: resolvedSize,
        fontWeight: resolvedWeight,
        color,
        textAlign: align,
        lineHeight: resolvedLineHeight,
        letterSpacing: resolvedLetterSpacing,
      }, tabular && styles.tabular, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </Text>
  );
}

const styles = { tabular: { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } };
