/**
 * DetailBottomSheet — a reusable bottom-sheet modal for "tap an item to see
 * details" flows. It slides up from the bottom on iOS/Android, dims the
 * background, and dismisses on backdrop tap or close button.
 *
 * Why a single component: every screen was rolling its own `Modal` with a
 * faded center dialog, which works for forms but feels wrong for *detail
 * views* of a list item — those should rise from the bottom, take 60-80% of
 * the screen, and leave the list visible behind. This is that pattern.
 *
 * Pass `title`, optional `accent` color (the icon/header tint), and children.
 * The bottom sheet handles its own dismissal, scroll, and animation.
 */
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { Txt, Row } from '@/components/ui';
import { Colors, Motion } from '@/theme';
export interface DetailBottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Tint color for the icon header strip. Defaults to Colors.primary. */
  accent?: string;
  /** Ionicons name shown beside the title. */
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss: () => void;
  /** Optional footer pinned to the bottom (action buttons etc). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  testID?: string;
}

export function DetailBottomSheet({
  visible,
  title,
  subtitle,
  accent = Colors.primary,
  icon,
  onDismiss,
  footer,
  children,
  testID,
}: DetailBottomSheetProps) {
  // `paddingBottom` used to be `Platform.OS === 'ios' ? 28 : 16` — a hardcoded guess at the
  // safe area, which is wrong in three directions at once: too much on an iPhone with no home
  // indicator, too little on an Android device using gesture navigation (where the inset runs
  // 24–48px, so the sheet's footer landed inside the swipe-up strip), and unnecessary on
  // Android 3-button nav. The real number is only known at runtime.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} testID={testID}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Pressable accessibilityRole="button"
          style={styles.sheetWrapper}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Drag handle */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={[styles.headerStrip, { backgroundColor: `${accent}22` }]}>
              <Row align="center" gap={10} style={{ flex: 1 }}>
                {icon && (
                  <View style={[styles.iconChip, { backgroundColor: `${accent}30` }]}>
                    <Ionicons name={icon} size={20} color={accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Txt variant="screenTitle" color={Colors.textPrimary} numberOfLines={1}>
                    {title}
                  </Txt>
                  {subtitle ? (
                    <Txt variant="caption" color={Colors.textMuted} numberOfLines={2}>
                      {subtitle}
                    </Txt>
                  ) : null}
                </View>
              </Row>
              <TouchableOpacity accessibilityLabel="Close" accessibilityRole="button"
                onPress={onDismiss}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              {children}
            </ScrollView>

            {/* Optional pinned footer */}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    maxHeight: '88%',
    minHeight: '40%',
    marginHorizontal: 0,
    marginBottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: Colors.borderSubtle,
    maxHeight: '88%',
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.borderSubtle,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.canvas,
  },
});

export default DetailBottomSheet;
