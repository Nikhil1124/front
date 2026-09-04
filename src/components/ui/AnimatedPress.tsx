/**
 * AnimatedPress — a Pressable wrapper that adds the things every tappable
 * surface in this app deserves:
 *
 *  1. Scale-down on press (a "compression" cue) via `activeOpacity`.
 *  2. A consistent `accessibilityRole` so screen readers announce it as a button.
 *
 * Use anywhere you would otherwise use `TouchableOpacity`. The component is
 * intentionally a thin shim — it forwards every `Pressable` prop and only adds
 * behaviour, so it can replace `TouchableOpacity`/`Pressable` in existing
 * screens without restructuring.
 *
 * `hapticPattern` is accepted and ignored: this app has no haptics (the vibration
 * feedback was removed entirely), and dropping the prop here would have meant
 * touching every one of this component's ~150 call sites for no behavior
 * change — cheaper to make it a no-op than to edit JSX across the app.
 */
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';

export interface AnimatedPressProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Scale to compress to when pressed. 0.97 ≈ gentle (spec), 0.90 ≈ emphatic. */
  scale?: number;
  /** Accepted for call-site compatibility; haptics are disabled app-wide, so this is a no-op. */
  hapticPattern?: string | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function AnimatedPress({
  scale = 0.97,
  hapticPattern: _hapticPattern,
  style,
  children,
  onPressIn,
  onPressOut,
  // Every AnimatedPress is a button; almost none of the ~82 call sites said so, which left
  // TalkBack and VoiceOver announcing them as plain text with no hint they could be
  // activated. Defaulting it here fixes the role everywhere at once and any call site that
  // is genuinely something else (a link, a tab) can still override. Pressable derives the
  // spoken label from the child <Text maxFontSizeMultiplier={1.3}> on its own, so only icon-only buttons still need an
  // explicit accessibilityLabel.
  accessibilityRole = 'button',
  ...rest
}: AnimatedPressProps) {
  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      activeOpacity={scale}
      {...rest}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
}

export default AnimatedPress;
