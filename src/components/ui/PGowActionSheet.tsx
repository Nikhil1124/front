/**
 * PGowActionSheet — a short list of things you can DO to one object.
 *
 * Not a panel about the object; a menu of verbs. The distinction matters because the app had
 * four of these built as full `Sheet`s, wearing a detail sheet's chrome — accent icon, title,
 * subtitle, divider — on top of a three-item menu. The header was bigger than the menu.
 *
 * The API is deliberately closed: `actions` is an array, and there is no `children`. A caller
 * cannot put a form, a toggle or a paragraph in here, because the moment one of those appears
 * this is no longer an action sheet — it is a compact `Sheet`, and it should say so by being
 * one. That boundary is the whole reason this is a separate component rather than a `Sheet`
 * variant with a convention attached.
 *
 * Above six actions, stop: an object with seven things you can do to it has earned its own
 * screen, where they live in a header and an overflow.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress } from './AnimatedPress';
import { Txt } from './Txt';

export interface PGowAction {
  /** The verb. "Edit staff", not "Edit". */
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Renders red and is placed after a gap, so momentum cannot land on it. */
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface PGowActionSheetProps {
  visible: boolean;
  /**
   * Optional, one line, and it names the OBJECT — "Vignesh" — not the menu. Omit it whenever
   * the trigger already made clear what is being acted on, which is most of the time.
   */
  title?: string;
  actions: PGowAction[];
  onDismiss: () => void;
  cancelLabel?: string;
  testID?: string;
}

export function PGowActionSheet({
  visible,
  title,
  actions,
  onDismiss,
  cancelLabel = 'Cancel',
  testID,
}: PGowActionSheetProps) {
  const insets = useSafeAreaInsets();

  // Rows close the sheet BEFORE they act. A row that navigates while the sheet is still up
  // leaves a dismissing modal over a screen that is already changing, and a row that opens a
  // dialog would be stacking a second layer — which the depth rule forbids. Sequential, not
  // nested.
  const run = (action: PGowAction) => {
    if (action.disabled) return;
    onDismiss();
    action.onPress();
  };

  const ordinary = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} testID={testID}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <Animated.View entering={SlideInDown.springify(220).dampingRatio(0.85)} style={styles.wrapper}>
          {/* Trapped on the sheet body so a screen reader cannot walk out into the screen
              behind, which is still mounted. The Cancel row inside is the way out. */}
          <View accessibilityViewIsModal>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.handleZone} accessible={false}>
                <View style={styles.handleBar} />
              </View>

              {title ? (
                <Txt variant="meta" weight="600" color={Colors.textMuted} align="center" style={styles.title} numberOfLines={1}>
                  {title}
                </Txt>
              ) : null}

              {ordinary.map((action) => (
                <ActionRow key={action.label} action={action} onRun={run} />
              ))}

              {destructive.length > 0 ? <View style={styles.destructiveGap} /> : null}
              {destructive.map((action) => (
                <ActionRow key={action.label} action={action} onRun={run} />
              ))}

              {/* Present even though the backdrop and hardware back both dismiss — those are
                  learned behaviours, and this is the one that is visible. */}
              <View style={styles.cancelGap} />
              <AnimatedPress
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                onPress={onDismiss}
                style={styles.cancelRow}
              >
                <Txt variant="button" color={Colors.textSecondary}>{cancelLabel}</Txt>
              </AnimatedPress>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function ActionRow({ action, onRun }: { action: PGowAction; onRun: (a: PGowAction) => void }) {
  const tint = action.destructive ? Colors.danger : Colors.textPrimary;
  return (
    <AnimatedPress
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!action.disabled }}
      disabled={action.disabled}
      onPress={() => onRun(action)}
      style={[styles.row, action.disabled && styles.rowDisabled]}
      testID={action.testID}
    >
      <Ionicons name={action.icon} size={20} color={action.disabled ? Colors.textMuted : tint} />
      <Txt variant="button" color={action.disabled ? Colors.textMuted : tint} style={styles.rowLabel} numberOfLines={1}>
        {action.label}
      </Txt>
      {/* No chevron. A chevron says "you will go somewhere and can come back"; these are
          commands, and several of them finish where they stand. */}
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  wrapper: { width: '100%' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 8 },
  handleZone: { paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  handleBar: { width: 34, height: 4, borderRadius: Radii.pill, backgroundColor: Colors.borderSubtle },
  title: { paddingBottom: 8, paddingHorizontal: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: Radii.control },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { flex: 1 },
  // A real gap, not a hairline: a hairline does not stop a thumb that is already moving.
  destructiveGap: { height: 10 },
  cancelGap: { height: 8, borderTopWidth: 1, borderTopColor: Colors.separator, marginTop: 4 },
  cancelRow: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.control } });

export default PGowActionSheet;
