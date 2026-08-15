/**
 * Typography tokens ported from Kotlin `ui/theme/Type.kt`.
 * Material 3 typography scale mapped to React Native TextStyle.
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
  displayLarge: { fontSize: 42, lineHeight: 48, letterSpacing: -1.5, fontWeight: '900' },
  headlineLarge: { fontSize: 30, lineHeight: 36, letterSpacing: -1.0, fontWeight: '800' },
  headlineMedium: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontWeight: '700' },
  titleLarge: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontWeight: '700' },
  titleMedium: { fontSize: 16, lineHeight: 22, letterSpacing: 0, fontWeight: '600' },
  bodyLarge: { fontSize: 15, lineHeight: 22, letterSpacing: 0.2, fontWeight: '400' },
  bodyMedium: { fontSize: 13, lineHeight: 18, letterSpacing: 0.2, fontWeight: '400' },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, fontWeight: '400' },
  labelLarge: { fontSize: 12, lineHeight: 16, letterSpacing: 1.0, fontWeight: '700' },
  labelMedium: { fontSize: 10, lineHeight: 14, letterSpacing: 1.5, fontWeight: '700' },
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
