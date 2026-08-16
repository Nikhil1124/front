/**
 * The scroll container every form/screen with text inputs should use, so the field someone is
 * typing into is never hidden under the keyboard.
 *
 * Why this is not just `<ScrollView>`:
 *
 * **Android.** Expo's edge-to-edge display (on by default since SDK 54, and not something
 * `app.json` can turn off) means the window no longer resizes when the keyboard opens — the
 * old `windowSoftInputMode="adjustResize"` behavior is effectively decorative now, and the
 * keyboard is instead drawn as an inset *over* the content. Without a real
 * `KeyboardAvoidingView`, a field near the bottom of the screen just disappears behind it.
 *
 * **iOS.** `automaticallyAdjustKeyboardInsets` on the ScrollView itself already handles this
 * correctly and natively (matches how Messages/Mail scroll content above the keyboard).
 *
 * Each platform gets exactly one mechanism, not both: running `KeyboardAvoidingView`'s
 * `behavior="padding"` *and* the automatic insets on the same screen double-counts the
 * keyboard height, leaving a gap the size of the keyboard above it — a second bug that reads
 * as a layout error and is harder to notice than the one it "fixes."
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
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
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
        // iOS only; a no-op on Android, where the KeyboardAvoidingView above does the work.
        automaticallyAdjustKeyboardInsets
        // Drag down over the form to dismiss, rather than hunting for a Done button.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default FormScroll;
