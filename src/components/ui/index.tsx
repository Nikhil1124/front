/**
 * Shared UI primitives for the PGow app.
 * Lightweight wrappers around View/Text/TouchableOpacity that match the
 * Compose Card / Button / OutlinedTextField styling.
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  StyleProp,
  DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout, Radii } from '@/theme';
import type { FontWeight } from '@/theme/typography';
import { Txt, type TxtProps } from './Txt';
import { AnimatedPress } from './AnimatedPress';

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
  children, style, containerColor = Colors.surface, borderRadius = Radii.card,
  borderColor = Colors.borderSubtle, borderWidth = 1, padding, onPress, testID }: CardProps) {
  const paddingStyle: ViewStyle = (() => {
    if (padding == null) return {};
    if (typeof padding === 'number') return { padding };
    if (padding.length === 2) return { paddingHorizontal: padding[0], paddingVertical: padding[1] };
    return {
      paddingTop: padding[0], paddingRight: padding[1],
      paddingBottom: padding[2], paddingLeft: padding[3] };
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
    ...paddingStyle };
  if (onPress) {
    return (
      <AnimatedPress accessibilityRole="button" testID={testID} onPress={onPress} style={[cardStyle, style]}>
        {children}
      </AnimatedPress>
    );
  }
  return <View testID={testID} style={[cardStyle, style]}>{children}</View>;
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
  borderRadius = Radii.control, height = 44, width, borderWidth, borderColor, disabled, loading,
  style, contentStyle, testID }: ButtonProps) {
  return (
    <AnimatedPress
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      // `disabled` alone leaves a loading button announced as tappable-but-disabled with no
      // hint that work is in flight; `busy` is what a screen reader uses to say "wait".
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        {
          backgroundColor: containerColor,
          borderRadius,
          minHeight: height,
          width,
          borderWidth: borderWidth ?? 0,
          borderColor: borderColor ?? 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1 },
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
    </AnimatedPress>
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
  borderRadius = Radii.control, height = 44, width, borderWidth = 1.5,
  containerColor = 'transparent', disabled, style, testID }: OutlinedButtonProps & { textColor?: string }) {
  return (
    <AnimatedPress
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          backgroundColor: containerColor,
          borderRadius,
          minHeight: height,
          width,
          borderWidth,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {children}
    </AnimatedPress>
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
  /** Required for icon-only buttons to be usable with a screen reader — there's no
   *  visible text label to announce otherwise. */
  accessibilityLabel?: string;
}

export function IconBtn({
  onPress, icon, size = 20, tint = Colors.textPrimary,
  containerColor = 'transparent', borderRadius = 999, padding = 8, disabled, testID,
  accessibilityLabel, hitSlop }: IconBtnProps & { hitSlop?: { top: number; bottom: number; left: number; right: number } }) {
  return (
    <AnimatedPress
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop ?? { top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={accessibilityLabel}
      style={{
        backgroundColor: containerColor, borderRadius, padding,
        alignItems: 'center', justifyContent: 'center' }}
    >
      {typeof icon === 'string' ? (
        <Ionicons name={icon as any} size={size} color={tint} />
      ) : (icon)}
    </AnimatedPress>
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
  borderWidth = 0, size = 10.5, weight = '600', paddingH = 10, paddingV = 4, borderRadius = Radii.pill }: PillProps) {
  return (
    <View style={{
      backgroundColor: bg, borderRadius, paddingHorizontal: paddingH, paddingVertical: paddingV,
      borderWidth, borderColor, alignSelf: 'flex-start' }}>
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
  labelColor, weight = '700', size = 11, paddingH = 12, paddingV = 6, testID }: ChipProps) {
  return (
    <AnimatedPress accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={{
        backgroundColor: selected ? selectedColor : unselectedBg,
        borderRadius: Radii.pill,
        paddingHorizontal: paddingH, paddingVertical: paddingV,
        borderWidth: selected ? 0 : 1,
        borderColor: selected ? selectedColor : unselectedBorder }}
    >
      <Txt
        size={size}
        weight={weight}
        color={selected ? Colors.textInverse : (labelColor ?? Colors.textSecondary)}
      >
        {label}
      </Txt>
    </AnimatedPress>
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
      gap: gap > 0 ? gap : undefined }, style]}>
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
      gap: gap > 0 ? gap : undefined }, style]}>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  fillMaxWidth: { width: '100%' },
  fillMaxSize: { flex: 1 } });

// The loading/error primitives live in their own file but belong to the same kit — re-exported
// so a screen imports them from '@/components/ui' like everything else it renders.
export { Spinner, LoadingState, ErrorState } from './Spinner';
export type { SpinnerProps, LoadingStateProps, ErrorStateProps } from './Spinner';
export { Txt, type TxtProps };
export { AnimatedPress, type AnimatedPressProps } from './AnimatedPress';
export { AnimatedChevron } from './AnimatedChevron';
export { StatusChip, toneFor, type StatusTone } from './StatusChip';
export { ListRow, ListSectionHeader, initialsOf } from './ListRow';
export { RoomPicker } from './RoomPicker';
export { ChoiceChips } from './ChoiceChips';
export { TrendChart, type TrendChartSeries, type TrendChartPoint } from './TrendChart';
export { MetricRow } from './MetricRow';
export { MetricDeck, type DeckCardData } from './MetricDeck';
export { CountUp } from './CountUp';
export { PickerField, type PickerFieldProps } from './PickerField';
export { SearchField, type SearchFieldProps } from './SearchField';
export { Sheet, type SheetProps } from './Sheet';
export { OutlinedTextField, type OutlinedTextFieldProps } from './OutlinedTextField';
