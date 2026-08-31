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
}

export function Txt({
  children, variant, size, weight, color = Colors.textPrimary,
  align = 'left', lineHeight, letterSpacing, style, numberOfLines, ellipsizeMode,
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
      }, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {children}
    </Text>
  );
}
