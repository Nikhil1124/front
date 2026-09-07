/**
 * The scroll container every form/screen with text inputs should use, so the field someone is
 * typing into ends up ABOVE the keyboard, not hidden behind it.
 *
 * `KeyboardAvoidingView behavior="padding"` on both platforms: it pads the bottom of the view
 * by the keyboard's height, shrinking the ScrollView's own viewport, and the ScrollView's
 * native "scroll the focused input into view" behavior then does the rest — scrolling up
 * inside that shrunk viewport until the focused field clears the keyboard.
 *
 * This used to be iOS-only-via-`automaticallyAdjustKeyboardInsets`, Android-only-via-`padding`
 * — the automatic-insets path did not reliably bring the focused field above the keyboard, so
 * both platforms now share the one mechanism that does.
 */
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/theme';

interface FormScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  /** Extra room under the last field, on top of the safe-area inset. */
  bottomPadding?: number;
  /** Allows screens with sensitive touch layouts to opt out of Android relayout. */
  keyboardAvoidingBehavior?: KeyboardAvoidingViewProps['behavior'];
}

export function FormScroll({
  children,
  style,
  contentContainerStyle,
  bottomPadding = Spacing.xxl,
  horizontal,
  keyboardAvoidingBehavior,
  ...rest
}: FormScrollProps) {
  const insets = useSafeAreaInsets();

  // A horizontal strip (a chip selector, a card carousel) never holds the field someone is
  // typing into, and forcing the `flex: 1` wrapper below onto what's usually a compact,
  // intrinsically-sized row would make it expand to fill its parent's cross-axis space —
  // breaking the surrounding layout instead of fixing anything. Plain ScrollView, unchanged.
  if (horizontal) {
    return (
      <ScrollView horizontal style={style} contentContainerStyle={contentContainerStyle} {...rest}>
        {children}
      </ScrollView>
    );
  }

  const scroll = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        { flexGrow: 1 },
        contentContainerStyle,
        // Without this the last field can be scrolled to but not *past*, so it sits flush
        // against the keyboard with its error text (or the submit button) clipped off.
        { paddingBottom: bottomPadding + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      // iOS: drag-to-dismiss interactively.
      // Android: 'on-drag' treats any micro-movement or scroll adjustment during a tap as
      // a drag and instantly dismisses the keyboard (keyboard flashes for a split second).
      // 'none' allows the keyboard to stay open while keyboardShouldPersistTaps manages taps.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      {...rest}
    >
      {children}
    </ScrollView>
  );

  // iOS requires KeyboardAvoidingView (behavior="padding") because the OS does not resize
  // the window for the software keyboard.
  // On Android, KeyboardAvoidingView with behavior="padding" triggers an abrupt resize on
  // keyboard show, causing native Android ScrollView on Fabric to reset its scroll offset
  // back to y=0 (jumping back to the top 3 fields) and breaking the native InputConnection.
  // Android's native window handling (adjustResize) and ScrollView manage keyboard avoidance
  // cleanly without container layout jumps.
  const effectiveBehavior =
    keyboardAvoidingBehavior !== undefined
      ? keyboardAvoidingBehavior
      : Platform.OS === 'ios'
        ? 'padding'
        : undefined;

  return effectiveBehavior ? (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior={effectiveBehavior}>
      {scroll}
    </KeyboardAvoidingView>
  ) : (
    <View style={[{ flex: 1 }, style]}>{scroll}</View>
  );
}

export default FormScroll;
