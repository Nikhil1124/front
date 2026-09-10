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
  Modal, View, StyleSheet, ScrollView, Pressable, Keyboard, Platform,
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
  // `paddingBottom` used to be `Platform.OS === 'ios' ? 28 : 16` — a hardcoded guess at the
  // safe area, which is wrong in three directions at once: too much on an iPhone with no home
  // indicator, too little on an Android device using gesture navigation (where the inset runs
  // 24–48px, so the sheet's footer landed inside the swipe-up strip), and unnecessary on
  // Android 3-button nav. The real number is only known at runtime.
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // ── Keyboard ──────────────────────────────────────────────────────────────────────────
  // The sheet is anchored to the bottom, so without this the keyboard opens straight over
  // it: the field being typed into, and the footer holding the submit button, both end up
  // underneath. Fifteen of this component's call sites are forms, which made "the sliding-up
  // thing has issues" a fair description of every one of them.
  //
  // Measured as OVERLAP against the window rather than taken as the keyboard's height, the
  // same way `FormScroll` does it — on edge-to-edge Android the two are not the same number.
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
  // The grab handle has been drawn since this component was written but was never draggable —
  // it looked like an affordance and did nothing, so the only ways out were the X and the
  // backdrop. A downward drag past a third of the sheet (or a fast flick) closes it now, and
  // anything short of that springs back.
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} testID={testID}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          entering={SlideInDown.springify(220).dampingRatio(0.85)}
          style={[
            styles.sheetWrapper,
            // Fixed height only when there is room for it — see `size`.
            size === '3/4' && kbOverlap === 0 ? { height: '75%' } : null,
            dragStyle,
            { marginBottom: kbOverlap },
          ]}
        >
          {/* A plain View, not a `Pressable` wrapping the whole sheet. That wrapper existed
              only to stop a tap falling through to the backdrop — which it did not need to
              do, since the backdrop is a sibling behind it, not an ancestor — and it made a
              screen reader announce the entire sheet as one button. */}
          <View>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <GestureDetector gesture={drag}>
                <View style={styles.handleZone} accessible={false}>
                  <View style={styles.handleBar} />
                </View>
              </GestureDetector>

              <View style={[styles.headerStrip, { backgroundColor: `${accent}22` }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  {icon && (
                    <View style={[styles.iconChip, { backgroundColor: `${accent}30` }]}>
                      <Ionicons name={icon} size={20} color={accent} />
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
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </AnimatedPress>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces>
                {children}
              </ScrollView>

              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // 0.78 was near-opaque — it read as a new screen rather than a layer over the one you
    // were on, which is the whole point of a sheet. 0.45 is the usual scrim weight and still
    // clears contrast against the surface above it.
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' },
  sheetWrapper: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: Colors.borderSubtle,
    maxHeight: '100%' },
  // A real target for the drag gesture — 5px of grabber is not something a thumb can catch.
  handleZone: { paddingTop: 4, paddingBottom: 4, alignItems: 'center' },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: Radii.badge,
    backgroundColor: Colors.borderSubtle,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4 },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22 },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center' },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.canvas } });
