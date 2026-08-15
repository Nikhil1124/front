/**
 * PanicButton — the floating SOS trigger.
 *
 * Renders ONLY the button itself. The parent positions it (typically
 * bottom-right via absolute positioning) so the same component can sit in a
 * staff dashboard footer, a manager dashboard header, or a tab bar overlay
 * without this file knowing about any of those layouts.
 *
 * Visual:
 *   - Circular, default 64x64.
 *   - Linear gradient from StatusRed to a darker red, drawn with
 *     `expo-linear-gradient`'s `LinearGradient`.
 *   - Subtle pulse: scale 1.0 → 1.05 → 1.0 over 1.2s, looping. Disabled when
 *     `disabled` is true so the button reads as inert, not as a stuck alert.
 *   - "SOS" label in white bold, with an alert icon above it.
 *
 * Interaction:
 *   - Press fires `haptic('heavy')` then `onPress`. The haptic is on the JS
 *     thread (not the worklet) because the heavy impact is the user's
 *     confirmation that the press registered, and it must fire even if the
 *     worklet thread is busy animating the pulse.
 *   - Long-press shows a hint tooltip ("Hold for emergency") for 1.5s. The
 *     spec calls this optional; we implement it because it costs nothing and
 *     stops a first-time user from mashing the button.
 *
 * ── Integration note (Task 8) ──────────────────────────────────────────────
 * This is a PRESENTATIONAL component — it fires `onPress` and does nothing
 * else. Screens that need the full trigger flow (confirmation dialog →
 * `triggerPanic` → toast) should wrap it:
 *
 *     <PanicButton onPress={() => confirmAndTrigger(pgId)} />
 *
 * The previous Task 8 stub called `triggerPanic` internally; that behaviour
 * now lives in the screen, not here, so the button is reusable outside the
 * panic flow (e.g. a "test alert" button in dev settings).
 */
import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Palette } from '@/theme';
import { haptic } from '@/utils/haptics';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export interface PanicButtonProps {
  /** Fired on press (after a heavy haptic). Optional so the button can be
   *  mounted as a pure visual affordance — e.g. a dev-settings "test alert"
   *  preview — but every production call site SHOULD pass this. Defaults to a
   *  no-op so a bare `<PanicButton />` compiles without crashing. */
  onPress?: () => void;
  /** Diameter in dp. Default 64. */
  size?: number;
  disabled?: boolean;
  /** Optional accessibility label override. */
  accessibilityLabel?: string;
}

export function PanicButton({
  onPress,
  size = 64,
  disabled = false,
  accessibilityLabel = 'Trigger SOS panic alert',
}: PanicButtonProps) {
  const scale = useSharedValue(1);
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the pulse. Started on mount, cancelled when disabled flips on so the
  // button stops pulsing the instant it becomes inert (not on the next loop
  // iteration, which would be a visible lag).
  React.useEffect(() => {
    if (disabled) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    // withSequence + withRepeat: 1.0 → 1.05 → 1.0, then repeat. Easing.inOut
    // keeps the pulse breathing rather than snapping.
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false, // don't reverse — the sequence already describes a full breath
    );
    return () => cancelAnimation(scale);
  }, [disabled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    haptic('heavy');
    onPress?.();
  };

  const handleLongPress = () => {
    if (disabled) return;
    setHintVisible(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintVisible(false), 1500);
  };

  return (
    <View style={{ width: size, height: size }} pointerEvents="box-none">
      <AnimatedLinearGradient
        // `colors` is a plain prop on LinearGradient, not an animated value —
        // wrapping in Animated only animates the transform, which is what we
        // want. The cast keeps TS happy about the AnimatedComponent intersection.
        colors={[Palette.StatusRed, '#7F1D1D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.5 : 1 },
          animatedStyle,
        ]}
      >
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {/* MaterialCommunityIcons has no "alert-triangle"; `alert` is the
              exclamation-in-a-triangle glyph. */}
          <MaterialCommunityIcons
            name="alert"
            size={size * 0.26}
            color={Colors.IvoryWhiteText}
            style={{ marginBottom: 1 }}
          />
          <Text
            style={{
              color: Colors.IvoryWhiteText,
              fontWeight: '900',
              fontSize: size * 0.22,
              letterSpacing: 1,
            }}
          >
            SOS
          </Text>
        </Pressable>
      </AnimatedLinearGradient>

      {hintVisible ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Hold for emergency</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: 'absolute',
    bottom: -34,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
  },
  hintText: {
    color: Colors.IvoryWhiteText,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default PanicButton;
