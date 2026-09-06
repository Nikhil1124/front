/**
 * AnimatedPress — a Pressable wrapper that adds the things every tappable
 * surface in this app deserves:
 *
 *  1. An actual scale-down on press (a "compression" cue) via a transform.
 *  2. A consistent `accessibilityRole` so screen readers announce it as a button.
 *
 * Use anywhere you would otherwise use `TouchableOpacity`. The component is
 * intentionally a thin shim — it forwards every `Pressable` prop and only adds
 * behaviour, so it can replace `TouchableOpacity`/`Pressable` in existing
 * screens without restructuring.
 *
 * Was built on `TouchableOpacity` with `` — `scale` values at every
 * call site are 0.85-0.98 (a gentle shrink), but `activeOpacity` is a transparency, not a
 * transform: passing 0.92 there means "stay 92% opaque while pressed", i.e. barely dim at
 * all. So the documented "scale-down" never happened — every one of this component's ~83
 * call sites rendered with no visible press feedback, which reads as an unresponsive button
 * even on the taps that do register. Rebuilt on `Pressable` with a real `transform: scale`.
 *
 * That rebuild (this file's previous version) fixed the transform but not the motion: it set
 * `style={({ pressed }) => pressed && { transform: [{ scale }] }}`, which is React Native's
 * own conditional-style mechanism — an instant swap between two fixed states on the JS thread,
 * not an animation. Every press in the app snapped rather than moved, despite the component's
 * own name. It is Reanimated now: `withSpring` drives the scale on the UI thread, so it
 * actually eases toward the pressed state rather than jumping to it — matching Material 3 and
 * the iOS HIG's shared rule that anything a finger is directly driving (a press, a drag) gets
 * spring physics, not a fixed-duration curve.
 *
 * That switch also buys reduced-motion support for free: `withSpring`'s `reduceMotion` option
 * defaults to `ReduceMotion.System`, so a user with that OS setting on gets the scale applied
 * instantly with no tween, automatically, the same way every other Reanimated animation in
 * this app already does (see `theme/motion.ts`'s header comment for the rest of that story).
 * The previous instant-swap version was accidentally "compliant" only because it never
 * animated at all — a floor this version had to earn on purpose.
 *
 * `hapticPattern` is accepted and ignored: this app has no haptics (the vibration
 * feedback was removed entirely), and dropping the prop here would have meant
 * touching every one of this component's call sites for no behavior
 * change — cheaper to make it a no-op than to edit JSX across the app.
 */
import React from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A duration-based spring rather than raw physical params (damping/stiffness/mass) — the
 *  same API `SlideInDown.springify()` uses elsewhere in the app, so "how long it roughly
 *  takes to settle" stays the one number anyone tuning this has to reason about.
 *  `dampingRatio` just under 1 (critically damped) is a deliberate choice for THIS app: it
 *  eases to rest with a touch of natural give rather than snapping dead, but it does not
 *  visibly overshoot and bounce back — this app's tone (financial records, muted palette) is
 *  closer to "considered" than "playful", and a bouncy button reads as the latter. */
const PRESS_SPRING = { duration: 220, dampingRatio: 0.9 } as const;

export interface AnimatedPressProps extends Omit<PressableProps, 'style'> {
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
  // Every AnimatedPress is a button; almost none of the ~82 call sites said so, which left
  // TalkBack and VoiceOver announcing them as plain text with no hint they could be
  // activated. Defaulting it here fixes the role everywhere at once and any call site that
  // is genuinely something else (a link, a tab) can still override. Pressable derives the
  // spoken label from the child <Text maxFontSizeMultiplier={1.3}> on its own, so only icon-only buttons still need an
  // explicit accessibilityLabel.
  accessibilityRole = 'button',
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressProps) {
  // 0 = at rest, 1 = fully pressed. A single shared value driving a linear blend between 1.0
  // and the caller's `scale` — simpler than `interpolate()` for a two-point range, and reads
  // the intent directly: "how pressed is this, right now".
  const pressProgress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressProgress.value * (1 - scale) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      onPressIn={(e: GestureResponderEvent) => {
        pressProgress.value = withSpring(1, PRESS_SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        pressProgress.value = withSpring(0, PRESS_SPRING);
        onPressOut?.(e);
      }}
      {...rest}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default AnimatedPress;
