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
import React, { useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown } from 'react-native-reanimated';

import { Txt, Row } from '@/components/ui';
import { Colors } from '@/theme';
import { haptic } from '@/utils/haptics';

export interface DetailBottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Tint color for the icon header strip. Defaults to CyberGreen. */
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
  accent = Colors.CyberGreen,
  icon,
  onDismiss,
  footer,
  children,
  testID,
}: DetailBottomSheetProps) {
  // Fire a soft tick when the sheet opens, so the user gets an immediate
  // confirmation that their tap was registered.
  useEffect(() => {
    if (visible) haptic('selection');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={styles.sheetWrapper}
          onPress={(e) => e.stopPropagation()}
        >
          <Animated.View
            entering={SlideInDown.springify().damping(18).stiffness(260).mass(0.7)}
            style={styles.sheet}
          >
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
                  <Txt variant="screenTitle" color={Colors.IvoryWhiteText} numberOfLines={1}>
                    {title}
                  </Txt>
                  {subtitle ? (
                    <Txt variant="caption" color={Colors.SlateMutedText} numberOfLines={2}>
                      {subtitle}
                    </Txt>
                  ) : null}
                </View>
              </Row>
              <TouchableOpacity
                onPress={onDismiss}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={Colors.SlateMutedText} />
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
          </Animated.View>
        </Pressable>
      </Pressable>
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
    backgroundColor: Colors.LuxurySurfaceDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: Colors.LuxuryCardBorder,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.LuxuryCardBorder,
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
    borderTopColor: Colors.LuxuryCardBorder,
    backgroundColor: Colors.LuxuryPureBlack,
  },
});

export default DetailBottomSheet;
