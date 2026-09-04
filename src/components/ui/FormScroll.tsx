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
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/theme';

interface FormScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  /** Extra room under the last field, on top of the safe-area inset. */
  bottomPadding?: number;
}

export function FormScroll({
  children,
  style,
  contentContainerStyle,
  bottomPadding = Spacing.xxl,
  horizontal,
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

  return (
    // `style` (e.g. a dialog capping this at `maxHeight: 420` so it fits inside a bounded
    // Card) belongs on this outer box, same as it would on a bare `<ScrollView style={...}>` —
    // the inner ScrollView just fills whatever bound this box ends up with. `flex: 1` is only
    // a default: putting it first in the array lets the caller's own `style` override it.
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior="padding"
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          contentContainerStyle,
          // Without this the last field can be scrolled to but not *past*, so it sits flush
          // against the keyboard with its error text (or the submit button) clipped off.
          { paddingBottom: bottomPadding + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        // Drag down over the form to dismiss, rather than hunting for a Done button.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default FormScroll;
