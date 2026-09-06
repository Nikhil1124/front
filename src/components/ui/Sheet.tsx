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
import { type ReactNode } from 'react';
import { Modal, View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Txt } from './Txt';
import { Row } from './index';
import { Radii, Colors } from '@/theme';
import { AnimatedPress } from '@/components/ui/AnimatedPress';

export interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Tint for the header strip and its icon chip. Defaults to the brand. */
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss: () => void;
  /** Pinned below the scrolling content — action buttons, a total, a submit bar. Stays put
   *  while the content scrolls, so the primary action never scrolls out of reach. */
  footer?: ReactNode;
  children?: ReactNode;
  testID?: string;
}

export function Sheet({
  visible, title, subtitle, accent = Colors.primary, icon, onDismiss, footer, children, testID,
}: SheetProps) {
  // `paddingBottom` used to be `Platform.OS === 'ios' ? 28 : 16` — a hardcoded guess at the
  // safe area, which is wrong in three directions at once: too much on an iPhone with no home
  // indicator, too little on an Android device using gesture navigation (where the inset runs
  // 24–48px, so the sheet's footer landed inside the swipe-up strip), and unnecessary on
  // Android 3-button nav. The real number is only known at runtime.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} testID={testID}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View entering={SlideInDown.springify(220).dampingRatio(0.85)} style={styles.sheetWrapper}>
          <Pressable style={{ flex: 1 }} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.handleBar} />

              <View style={[styles.headerStrip, { backgroundColor: `${accent}22` }]}>
                <Row align="center" gap={10} style={{ flex: 1 }}>
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
                </Row>
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
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end' },
  sheetWrapper: {
    maxHeight: '88%',
    minHeight: '40%',
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
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: Radii.badge,
    backgroundColor: Colors.borderSubtle,
    alignSelf: 'center',
    marginTop: 8,
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
    paddingBottom: 24 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.canvas } });
