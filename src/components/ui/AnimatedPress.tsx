/**
 * AnimatedPress — a Pressable wrapper that adds the three things every tappable
 * surface in this app deserves:
 *
 *  1. Scale-down on press (a "compression" cue) — animated via Reanimated so it
 *     does not fight the JS thread.
 *  2. Haptic feedback on press — fired from the worklet thread for low latency.
 *  3. A consistent `activeOpacity`-like tint via `animatedStyle`.
 *
 * Use anywhere you would otherwise use `TouchableOpacity`. The component is
 * intentionally a thin shim — it forwards every `Pressable` prop and only adds
 * behaviour, so it can replace `TouchableOpacity`/`Pressable` in existing
 * screens without restructuring.
 */
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';

import { haptic, HapticPattern } from '@/utils/haptics';

export interface AnimatedPressProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Scale to compress to when pressed. 0.97 ≈ gentle (spec), 0.90 ≈ emphatic. */
  scale?: number;
  /** Haptic pattern fired on press-in. Pass `null` to disable. */
  hapticPattern?: HapticPattern | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function AnimatedPress({
  scale = 0.97,
  hapticPattern = 'light',
  style,
  children,
  onPressIn,
  onPressOut,
  // Every AnimatedPress is a button; almost none of the ~82 call sites said so, which left
  // TalkBack and VoiceOver announcing them as plain text with no hint they could be
  // activated. Defaulting it here fixes the role everywhere at once and any call site that
  // is genuinely something else (a link, a tab) can still override. Pressable derives the
  // spoken label from the child <Text> on its own, so only icon-only buttons still need an
  // explicit accessibilityLabel.
  accessibilityRole = 'button',
  ...rest
}: AnimatedPressProps) {
  const fireHaptic = () => {
    if (hapticPattern) haptic(hapticPattern);
  };

  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      activeOpacity={scale}
      {...rest}
      onPressIn={(e) => {
        fireHaptic();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        onPressOut?.(e);
      }}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
}

export default AnimatedPress;
