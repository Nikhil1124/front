/**
 * Sheet — the one surface that rises from the bottom of the screen.
 *
 * Was `DetailBottomSheet`, and the rename is the point: it was built for "tap a row, see the
 * details", used in three files, while thirty-six others hand-rolled their own `<Modal>`. Its
 * own doc comment already said it existed because "every screen was rolling its own Modal" —
 * it just never got the guard that would have finished the job. `sheets.check.ts` is that
 * guard, and this is what it points at.
 *
 * ── What belongs here, and what doesn't ─────────────────────────────────────────────────────
 * Three things use a bottom sheet: a DETAIL view of something in a list, a FORM you fill in,
 * and a PICKER you choose from. All three want the same thing — rise from the bottom, leave
 * the list visible behind, take as much height as the content needs up to most of the screen.
 *
 * Two things deliberately do not:
 *
 *   A plain confirmation stays a native `Alert.alert`. Thirty of the app's thirty-one confirms
 *   already were one before this pass, so this is ratifying a decision the codebase had
 *   effectively made: the OS dialog is familiar, accessible, and cannot drift out of style
 *   because there is no style to drift.
 *
 *   A confirmation that needs a REASON typed into it is `TextPromptDialog` — centered, not
 *   bottom-anchored. It cannot be a native alert because `Alert.prompt` is iOS-only (its whole
 *   body is behind `if (Platform.OS === 'ios')`, with no Android branch), which is exactly why
 *   that component exists.
 *
 * ── The entrance ────────────────────────────────────────────────────────────────────────────
 * `animationType="none"` on the Modal, with the movement done in Reanimated instead: a spring
 * for the sheet (it is a surface arriving in space) and a plain fade for the scrim (opacity has
 * no momentum to model, and springing it would overshoot past opaque). Same split every other
 * sheet in the app now uses.
 */
import { type ReactNode, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Keyboard, Platform,
  useWindowDimensions, type KeyboardEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, SlideInDown, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

import { Txt } from './Txt';
import { Radii, Colors } from '@/theme';
import { AnimatedPress } from '@/components/ui/AnimatedPress';

export interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Tint for the header strip and its icon chip. Defaults to the brand. */
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * `'auto'` (default) sizes to the content, up to 88% of the screen. `'3/4'` pins the sheet
   * to a fixed three-quarter height whatever it holds.
   *
   * From Kushal's `kushal-apk-dev` work, and it answers OWN-01/OWN-05 in the owner QA notes —
   * "complaint review uses inconsistent popup/modal sizes; different complaints appear in
   * different popup layouts". Content-driven height is the cause: a two-line complaint got a
   * short sheet and a long one got a tall sheet, so the same action looked like a different
   * screen each time. Pinning the review sheets makes them one shape.
   *
   * Ignored while the keyboard is up: a fixed 75% plus the keyboard's own height does not fit
   * on screen, so the sheet falls back to content height and stays inside the 88% cap.
   */
  size?: 'auto' | '3/4';
  onDismiss: () => void;
  /** Pinned below the scrolling content — action buttons, a total, a submit bar. Stays put
   *  while the content scrolls, so the primary action never scrolls out of reach. */
  footer?: ReactNode;
  children?: ReactNode;
  testID?: string;
}

export function Sheet({
  visible, title, subtitle, accent = Colors.primary, icon, size = 'auto',
  onDismiss, footer, children, testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // ── Responsive design tokens — derived from live screen dimensions ─────────────────────
  // All magic numbers live here so the component itself reads intent, not pixels.
  //
  // Corner radius: ~6% of width feels proportional on both 360-dp and 430-dp phones.
  const cornerRadius = Math.round(screenWidth * 0.06);
  // Content padding: 4% of width, floored at 12 and capped at 24.
  const hPad = Math.min(Math.max(Math.round(screenWidth * 0.04), 12), 24);
  // Icon chip size: 9.5% of width, floored at 34 and capped at 46.
  const chipSize = Math.min(Math.max(Math.round(screenWidth * 0.095), 34), 46);
  // Close button size: 8% of width, floored at 28 and capped at 40.
  const closeBtnSize = Math.min(Math.max(Math.round(screenWidth * 0.08), 28), 40);
  // Icon glyph size: proportional to chipSize.
  const iconSize = Math.round(chipSize * 0.52);
  // Handle bar width: 11% of width, floored at 36 and capped at 56.
  const handleWidth = Math.min(Math.max(Math.round(screenWidth * 0.11), 36), 56);
  // Max height for "auto" sheets: 88% of screen.
  const maxSheetHeight = Math.round(screenHeight * 0.88);
  // Fixed height for "3/4" sheets: 75% of screen.
  const fixedSheetHeight = Math.round(screenHeight * 0.75);
  // Header vertical padding: 3% of width, floored at 10.
  const headerVPad = Math.max(Math.round(screenWidth * 0.03), 10);

  // ── Keyboard ──────────────────────────────────────────────────────────────────────────
  const [kbOverlap, setKbOverlap] = useState(0);
  useEffect(() => {
    if (!visible) { setKbOverlap(0); return; }
    const show = (e: KeyboardEvent) => {
      const top = e.endCoordinates?.screenY ?? screenHeight - (e.endCoordinates?.height ?? 0);
      setKbOverlap(Math.max(0, Math.round(screenHeight - top)));
    };
    const hide = () => setKbOverlap(0);
    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [visible, screenHeight]);

  // ── Drag to dismiss ───────────────────────────────────────────────────────────────────
  // useHideDockWhileOpen(visible); // Disabled so the dock remains visible under the sheet

  const dragY = useSharedValue(0);
  useEffect(() => { if (visible) dragY.value = 0; }, [visible, dragY]);
  const drag = Gesture.Pan()
    .onChange((e) => {
      dragY.value = Math.max(0, dragY.value + e.changeY);
    })
    .onEnd((e) => {
      if (dragY.value > screenHeight * 0.18 || e.velocityY > 900) {
        dragY.value = withTiming(screenHeight, { duration: 180 }, (done) => {
          if (done) runOnJS(onDismiss)();
        });
      } else {
        dragY.value = withSpring(0, { duration: 220, dampingRatio: 0.9 });
      }
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  // Safe-area bottom: at least 16px so nothing touches the nav strip.
  const bottomPad = Math.max(insets.bottom, Math.round(screenHeight * 0.02));

  if (!visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]}
      testID={testID}
    >
      {/* Full-screen scrim — fades in, catches backdrop taps */}
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* Sheet surface — slides up from the bottom independently */}
      <Animated.View
        entering={SlideInDown.springify(220).dampingRatio(0.85)}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: kbOverlap, // Use bottom instead of marginBottom for reliable Android offset
            maxHeight: maxSheetHeight,
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            overflow: 'hidden',
          },
          // Fixed height only when keyboard is not up — see size prop doc.
          size === '3/4' && kbOverlap === 0 ? { height: fixedSheetHeight } : null,
          dragStyle,
        ]}
      >
        <View accessibilityViewIsModal style={[{ flexShrink: 1 }, size === '3/4' && kbOverlap === 0 ? { flex: 1 } : null]}>
          <View style={[
            {
              backgroundColor: Colors.surface,
              borderTopLeftRadius: cornerRadius,
              borderTopRightRadius: cornerRadius,
              borderWidth: 1.5,
              borderBottomWidth: 0,
              borderColor: Colors.borderSubtle,
              maxHeight: '100%',
              flexShrink: 1, // Shrink to fit outer constraints so footer isn't pushed down
              paddingBottom: bottomPad,
            },
            size === '3/4' && kbOverlap === 0 ? { flex: 1 } : null,
          ]}>
            {/* Drag handle */}
            <GestureDetector gesture={drag}>
              <View style={{ paddingTop: Math.round(screenHeight * 0.005), paddingBottom: Math.round(screenHeight * 0.005), alignItems: 'center' }} accessible={false}>
                <View style={{
                  width: handleWidth,
                  height: Math.round(screenHeight * 0.006),
                  borderRadius: Radii.badge,
                  backgroundColor: Colors.borderSubtle,
                  alignSelf: 'center',
                  marginTop: Math.round(screenHeight * 0.006),
                  marginBottom: Math.round(screenHeight * 0.004),
                }} />
              </View>
            </GestureDetector>

            {/* Header strip */}
            <View style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: hPad,
                paddingVertical: headerVPad,
                borderTopLeftRadius: cornerRadius - 2,
                borderTopRightRadius: cornerRadius - 2,
                backgroundColor: `${accent}22`,
              },
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(screenWidth * 0.025), flex: 1 }}>
                {icon && (
                  <View style={{
                    width: chipSize,
                    height: chipSize,
                    borderRadius: Radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${accent}30`,
                  }}>
                    <Ionicons name={icon} size={iconSize} color={accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Txt variant="screenTitle" color={Colors.textPrimary} numberOfLines={1}>{title}</Txt>
                  {subtitle ? (
                    <Txt variant="caption" color={Colors.textMuted} numberOfLines={2}>{subtitle}</Txt>
                  ) : null}
                </View>
              </View>
              <AnimatedPress
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={onDismiss}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  width: closeBtnSize,
                  height: closeBtnSize,
                  borderRadius: Radii.pill,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={iconSize} color={Colors.textMuted} />
              </AnimatedPress>
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={{ flex: 1, flexShrink: 1 }}
              contentContainerStyle={{
                paddingHorizontal: hPad,
                paddingTop: Math.round(screenHeight * 0.016),
                // A footer is pinned below this, so the last row needs room to look like it
                // ended rather than like it was cut off against the divider. 1.2% of a tall
                // screen is ~29px, which read as a collision in QA's coordinate dump; 32dp is
                // the gap the rest of the app leaves above a pinned bar.
                paddingBottom: footer ? 32 : Math.round(screenHeight * 0.012),
              }}
              showsVerticalScrollIndicator={false}
              bounces
            >
              {children}
            </ScrollView>

            {/* Pinned footer */}
            {footer ? (
              <View style={{
                paddingHorizontal: hPad,
                paddingVertical: Math.round(screenHeight * 0.016),
                borderTopWidth: 1,
                borderTopColor: Colors.borderSubtle,
                backgroundColor: Colors.canvas,
              }}>
                {footer}
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});


