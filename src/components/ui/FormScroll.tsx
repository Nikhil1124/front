/**
 * The scroll container every form/screen with text inputs should use, so the field someone is
 * typing into ends up ABOVE the keyboard, not hidden behind it.
 *
 * The two platforms reach that the same way but by different means, and this doc block used
 * to claim they shared one — they do not, and the mismatch is worth stating plainly.
 *
 * iOS: `KeyboardAvoidingView behavior="padding"` pads the container, shrinking the
 * ScrollView's viewport, and the ScrollView's native scroll-focused-input-into-view does
 * the rest. The OS never resizes the window for the keyboard, so something has to.
 *
 * Android: NOT `KeyboardAvoidingView` — with `behavior="padding"` it relayouts the container
 * on keyboard show, which makes the native ScrollView on Fabric reset its scroll offset to
 * y=0 and breaks the InputConnection. Instead `useAndroidKeyboardOverlap` below reserves the
 * covered space as *content* padding, which gives the same room to scroll into with no
 * container relayout. See that hook for why the overlap is measured rather than assumed.
 */
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/theme';

/**
 * How much of this window the keyboard actually covers — 0 when it covers nothing.
 *
 * Android used to need nothing here: `android:windowSoftInputMode=adjustResize` (set from
 * app.json's `softwareKeyboardLayoutMode: "resize"`) shrank the window when the keyboard
 * opened, the ScrollView's viewport shrank with it, and its native scroll-focused-input-
 * into-view did the rest. Edge-to-edge ends that. An edge-to-edge window already extends
 * behind the system bars and the IME, so it is not resized when the keyboard appears — the
 * ScrollView keeps its full-screen viewport, believes the focused field is already visible,
 * and never scrolls. The field sits behind the keyboard.
 *
 * Reserving that space as content padding restores exactly what adjustResize used to
 * provide — somewhere to scroll to — without a container relayout, which is what
 * `KeyboardAvoidingView behavior="padding"` does and why it reset Fabric's scroll offset.
 *
 * ── Why the overlap, and not simply the keyboard's height ───────────────────────────────
 * Because the app has to be correct on every Android version and every OEM, not just the
 * ones where edge-to-edge suppresses the resize. Where the window IS still resized, its
 * height already ends above the keyboard, and adding the keyboard's full height on top
 * would reserve that space twice — a screenful of dead scroll under the last field.
 * Measuring the overlap between the window's bottom edge and the keyboard's top edge
 * (`endCoordinates.screenY`) collapses both worlds into one number: it is the keyboard
 * height when nothing resized, and ~0 when the OS already did the work. No version check,
 * no OEM allowlist — it reads what actually happened on the device it is running on.
 */
function useAndroidKeyboardOverlap(): number {
  const [overlap, setOverlap] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const end = e.endCoordinates;
      if (!end) return setOverlap(0);
      // `screenY` is the keyboard's top edge. Fall back to its height on the rare device
      // that reports no `screenY` — the pre-fix behaviour, which is still better than 0.
      const keyboardTop = end.screenY ?? windowHeight - (end.height ?? 0);
      setOverlap(Math.max(0, Math.round(windowHeight - keyboardTop)));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [windowHeight]);

  return overlap;
}

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
  const keyboardOverlap = useAndroidKeyboardOverlap();

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
        // `keyboardOverlap` is 0 on iOS (KeyboardAvoidingView pads the container there) and
        // 0 on Android whenever the keyboard is closed or the window already resized.
        { paddingBottom: bottomPadding + insets.bottom + keyboardOverlap },
      ]}
      keyboardShouldPersistTaps="handled"
      // iOS: drag-to-dismiss interactively.
      // Android: 'on-drag' treats any micro-movement or scroll adjustment during a tap as
      // a drag and instantly dismisses the keyboard (keyboard flashes for a split second).
      // 'none' allows the keyboard to stay open while keyboardShouldPersistTaps manages taps.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      showsVerticalScrollIndicator={false}
      // `bounces={false}` everywhere used to be the rule, to kill the rubber-band on a screen
      // that does not scroll. But on iOS a `RefreshControl` IS the overscroll: with bounces
      // off the user cannot pull past the top, so pull-to-refresh silently does nothing —
      // and this container carries the refreshControl for every HubScreenWrapper screen.
      // Android is unaffected either way (SwipeRefreshLayout owns that gesture there), so
      // the bounce comes back only for the scrollers that actually have something to refresh.
      bounces={!!rest.refreshControl}
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
