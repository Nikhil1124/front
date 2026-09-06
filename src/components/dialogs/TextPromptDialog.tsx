/**
 * TextPromptDialog — a cross-platform stand-in for `Alert.prompt`, and the app's centered
 * confirm-with-a-reason surface.
 *
 * `Alert.prompt` is iOS-only (see react-native/Libraries/Alert/Alert.js — its entire body is
 * gated behind `if (Platform.OS === 'ios')`, with no Android branch at all). Two screens
 * (GroceryCartScreen, GroceryCheckoutScreen) called it to let someone edit their delivery
 * address; on Android that made "Change Address" a dead button — no dialog, no error, the
 * tap just did nothing. One small real modal, used by both, replaces it everywhere at once.
 *
 * That iOS-only limitation is also why this is the shape a "reject, and say why" confirmation
 * has to take. A plain yes/no confirm stays a native `Alert.alert` (see `Sheet`'s header for
 * that split), but the moment the confirmation needs a sentence typed into it, the native
 * dialog cannot carry it on Android at all. Centered rather than bottom-anchored on purpose:
 * it interrupts, which is what a confirmation is for — a bottom sheet reads as somewhere you
 * went, and this is something that stopped you.
 *
 * `destructive` turns the confirm button red and is what the reject flows use; `required`
 * refuses an empty answer with an inline error rather than silently disabling the button,
 * which leaves someone tapping a dead control with no idea why.
 */
import { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, KeyboardAvoidingView, Pressable } from 'react-native';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Txt } from '@/components/ui/Txt';
import { Radii, Colors } from '@/theme';
import { AnimatedPress } from '@/components/ui/AnimatedPress';

export interface TextPromptDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  onCancel: () => void;
  onSave: (text: string) => void;
  /** Verb for the confirm button — "Save" by default, "Reject payment" for a decision. */
  confirmLabel?: string;
  /** Paints the confirm button as destructive. */
  destructive?: boolean;
  /** Refuse an empty answer, with the reason on the field. */
  required?: boolean;
  /** Shown under the field — "The resident sees this". */
  helper?: string;
  busy?: boolean;
}

export function TextPromptDialog({
  visible,
  title,
  message,
  label,
  initialValue = '',
  placeholder,
  onCancel,
  onSave,
  confirmLabel = 'Save',
  destructive = false,
  required = false,
  helper,
  busy = false }: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();

  // Re-seed the field every time the dialog opens, so a previous edit that was cancelled
  // does not leak into the next time it's shown.
  useEffect(() => {
    if (visible) { setValue(initialValue); setError(undefined); }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.backdrop}>
          <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onCancel} />
          <View style={styles.card}>
            <Txt variant="sectionTitle" color={Colors.textPrimary}>{title}</Txt>
            {message ? <Txt variant="body" color={Colors.textSecondary} style={styles.message}>{message}</Txt> : null}
            <OutlinedTextField
              label={label}
              placeholder={placeholder}
              value={value}
              onChangeText={(v) => { setValue(v); if (error) setError(undefined); }}
              error={error}
              helper={helper}
              required={required}
              multiline={required}
              style={{ marginTop: 12 }}
            />
            <View style={styles.row}>
              <AnimatedPress accessibilityRole="button" style={styles.cancelBtn} onPress={onCancel}>
                <Txt variant="button" color={Colors.textPrimary}>Cancel</Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button"
                style={[styles.saveBtn, destructive && styles.destructiveBtn, busy && styles.saveBtnDisabled]}
                // Stays enabled when empty and answers on use, rather than sitting disabled
                // with no explanation — a dead button tells you nothing about why.
                onPress={() => {
                  const text = value.trim();
                  if (required && !text) { setError('Say why — this is what the other person sees'); return; }
                  onSave(text);
                }}
                disabled={busy}
              >
                <Txt variant="button" color={Colors.textInverse}>{busy ? 'Working…' : confirmLabel}</Txt>
              </AnimatedPress>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  destructiveBtn: { backgroundColor: Colors.danger },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,46,78,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10 },
  message: {
    marginTop: 4 },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center' },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center' },
  saveBtnDisabled: {
    opacity: 0.5 },
});
