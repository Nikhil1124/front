/**
 * Shared UI primitives for the PGow app.
 * Lightweight wrappers around View/Text/TouchableOpacity that match the
 * Compose Card / Button / OutlinedTextField styling.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, Radii, Layout } from '@/theme';
import type { FontWeight } from '@/theme/typography';

type RNFontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

// Allow any string icon name to bypass TS strict glyph-map checking.
type IconName = string | keyof typeof Ionicons.glyphMap;

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  padding?: number | [number, number] | [number, number, number, number];
  elevation?: number;
  onPress?: () => void;
  testID?: string;
}

export function Card({
  children, style, containerColor = Colors.surface, borderRadius = Layout.borderRadiusCard,
  borderColor = Colors.borderSubtle, borderWidth = 1, padding, onPress, testID,
}: CardProps) {
  const paddingStyle: ViewStyle = (() => {
    if (padding == null) return {};
    if (typeof padding === 'number') return { padding };
    if (padding.length === 2) return { paddingHorizontal: padding[0], paddingVertical: padding[1] };
    return {
      paddingTop: padding[0], paddingRight: padding[1],
      paddingBottom: padding[2], paddingLeft: padding[3],
    };
  })();
  const cardStyle: ViewStyle = {
    backgroundColor: containerColor,
    borderRadius,
    borderWidth,
    borderColor,
    overflow: 'hidden',
    // Mint-glow card shadow — soft, never the heavy dark elevation of the
    // old theme. Spread onto a ViewStyle (RN accepts these on View).
    shadowColor: Layout.shadowCard.shadowColor as any,
    shadowOffset: Layout.shadowCard.shadowOffset as any,
    shadowOpacity: Layout.shadowCard.shadowOpacity,
    shadowRadius: Layout.shadowCard.shadowRadius,
    elevation: Layout.shadowCard.elevation,
    ...paddingStyle,
  };
  if (onPress) {
    return (
      <TouchableOpacity testID={testID} activeOpacity={0.92} onPress={onPress} style={[cardStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View testID={testID} style={[cardStyle, style]}>{children}</View>;
}

export interface TxtProps {
  children: React.ReactNode;
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
  children, size = 13, weight = '400', color = Colors.textPrimary,
  align = 'left', lineHeight, letterSpacing, style, numberOfLines, ellipsizeMode,
}: TxtProps) {
  return (
    <Text
      style={[{
        fontSize: size,
        fontWeight: weight as RNFontWeight,
        color,
        textAlign: align,
        lineHeight: lineHeight ?? size * 1.35,
        letterSpacing: letterSpacing ?? 0,
      }, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {children}
    </Text>
  );
}

export interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  containerColor?: string;
  textColor?: string;
  borderRadius?: number;
  height?: number;
  width?: DimensionValue;
  borderWidth?: number;
  borderColor?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Btn({
  children, onPress, containerColor = Colors.primary, textColor = Colors.textInverse,
  borderRadius = Layout.borderRadiusButton, height = 44, width, borderWidth, borderColor, disabled, loading,
  style, contentStyle, testID,
}: ButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        {
          backgroundColor: containerColor,
          borderRadius,
          height,
          width,
          borderWidth: borderWidth ?? 0,
          borderColor: borderColor ?? 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, contentStyle]}>
          {children}
        </View>
      )}
    </TouchableOpacity>
  );
}

export interface OutlinedButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  borderColor?: string;
  textColor?: string;
  borderRadius?: number;
  height?: number;
  width?: DimensionValue;
  borderWidth?: number;
  containerColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function OutlinedBtn({
  children, onPress, borderColor = Colors.primary,
  textColor = Colors.primary,
  borderRadius = Layout.borderRadiusButton, height = 44, width, borderWidth = 1.5,
  containerColor = 'transparent', disabled, style, testID,
}: OutlinedButtonProps & { textColor?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          backgroundColor: containerColor,
          borderRadius,
          height,
          width,
          borderWidth,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

export interface IconBtnProps {
  onPress: () => void;
  icon: IconName | React.ReactNode;
  size?: number;
  tint?: string;
  containerColor?: string;
  borderRadius?: number;
  padding?: number;
  disabled?: boolean;
  testID?: string;
}

export function IconBtn({
  onPress, icon, size = 20, tint = Colors.textPrimary,
  containerColor = 'transparent', borderRadius = 999, padding = 8, disabled, testID,
  hitSlop,
}: IconBtnProps & { hitSlop?: { top: number; bottom: number; left: number; right: number } }) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop ?? { top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        backgroundColor: containerColor, borderRadius, padding,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {typeof icon === 'string' ? (
        <Ionicons name={icon as any} size={size} color={tint} />
      ) : (icon)}
    </TouchableOpacity>
  );
}

export interface SpacerProps {
  size?: number;
  horizontal?: boolean;
}

export function Spacer({ size = 8, horizontal = false }: SpacerProps) {
  return <View style={horizontal ? { width: size } : { height: size }} />;
}

export interface DividerProps {
  color?: string;
  thickness?: number;
  vertical?: boolean;
  length?: DimensionValue;
}

export function Divider({ color = Colors.borderMuted, thickness = 1, vertical = false, length }: DividerProps) {
  return (
    <View
      style={vertical
        ? { width: thickness, height: length ?? '100%', backgroundColor: color }
        : { height: thickness, width: length ?? '100%', backgroundColor: color }}
    />
  );
}

export interface PillProps {
  label: string;
  color?: string;
  bg?: string;
  borderColor?: string;
  borderWidth?: number;
  size?: number;
  weight?: FontWeight;
  paddingH?: number;
  paddingV?: number;
  borderRadius?: number;
}

export function Pill({
  label, color = Colors.primary, bg = `${color}26`, borderColor = 'transparent',
  borderWidth = 0, size = 10, weight = '700', paddingH = 10, paddingV = 4, borderRadius = Layout.borderRadiusChip,
}: PillProps) {
  return (
    <View style={{
      backgroundColor: bg, borderRadius, paddingHorizontal: paddingH, paddingVertical: paddingV,
      borderWidth, borderColor, alignSelf: 'flex-start',
    }}>
      <Txt size={size} weight={weight} color={color}>{label}</Txt>
    </View>
  );
}

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectedColor?: string;
  unselectedBg?: string;
  unselectedBorder?: string;
  labelColor?: string;
  weight?: FontWeight;
  size?: number;
  paddingH?: number;
  paddingV?: number;
  testID?: string;
}

export function Chip({
  label, selected, onPress, selectedColor = Colors.primary,
  unselectedBg = Colors.surfaceMuted, unselectedBorder = Colors.borderMuted,
  labelColor, weight = '700', size = 11, paddingH = 12, paddingV = 6, testID,
}: ChipProps) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: selected ? selectedColor : unselectedBg,
        borderRadius: Layout.borderRadiusChip,
        paddingHorizontal: paddingH, paddingVertical: paddingV,
        borderWidth: selected ? 0 : 1,
        borderColor: selected ? selectedColor : unselectedBorder,
      }}
    >
      <Txt
        size={size}
        weight={weight}
        color={selected ? Colors.textInverse : (labelColor ?? Colors.textSecondary)}
      >
        {label}
      </Txt>
    </TouchableOpacity>
  );
}

export interface RowProps {
  children: React.ReactNode;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function Row({ children, align = 'center', justify = 'flex-start', gap = 0, style }: RowProps) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: align, justifyContent: justify,
      gap: gap > 0 ? gap : undefined,
    }, style]}>
      {children}
    </View>
  );
}

export interface ColProps {
  children: React.ReactNode;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function Col({ children, align = 'stretch', justify = 'flex-start', gap = 0, style }: ColProps) {
  return (
    <View style={[{
      flexDirection: 'column', alignItems: align, justifyContent: justify,
      gap: gap > 0 ? gap : undefined,
    }, style]}>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  fillMaxWidth: { width: '100%' },
  fillMaxSize: { flex: 1 },
});
