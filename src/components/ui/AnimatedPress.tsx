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
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

import { haptic, HapticPattern } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressProps extends Omit<PressableProps, 'style'> {
  /** Scale to compress to when pressed. 0.96 ≈ gentle, 0.90 ≈ emphatic. */
  scale?: number;
  /** Haptic pattern fired on press-in. Pass `null` to disable. */
  hapticPattern?: HapticPattern | null;
  /** Spring config for the press-out bounce. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const SPRING_OUT = {
  damping: 14,
  stiffness: 320,
  mass: 0.6,
  overshootClamping: false,
} as const;

const TIMING_IN = {
  duration: 90,
  easing: Easing.out(Easing.cubic),
} as const;

export function AnimatedPress({
  scale = 0.96,
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
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scale]) }],
    };
  });

  const fireHaptic = () => {
    'worklet';
    if (hapticPattern) runOnJS(haptic)(hapticPattern);
  };

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      {...rest}
      onPressIn={(e) => {
        pressed.value = withTiming(1, TIMING_IN);
        fireHaptic();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, SPRING_OUT);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default AnimatedPress;
