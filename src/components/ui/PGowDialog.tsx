/**
 * PGowDialog — the app's one consequential-decision surface.
 *
 * A dialog is the most expensive surface in the system: it costs the user their place, so it
 * has to be the rarest. It exists for exactly one job — asking someone to commit to something
 * they cannot easily walk back. Success does not belong here (that is a toast), validation
 * does not belong here (that is an error on the field that failed), and information does not
 * belong here (that is inline, or a banner if it persists).
 *
 * This replaces the two things that were doing the job before:
 *
 *   - `Alert.alert` at 134 runtime call sites, of which only 18 carried a decision. The rest
 *     were blocking the user with an OS modal to report success or a failed field, which
 *     trains people to dismiss dialogs unread — exactly the habit you do not want in front of
 *     "Delete staff member?".
 *   - `TextPromptDialog`, whose "confirm with a typed reason" shape is folded in here as the
 *     optional `prompt`. `Alert.prompt` is iOS-only, which is why that shape had to be a real
 *     modal in the first place; that reasoning is unchanged, it just lives in one component now.
 *
 * Centred rather than bottom-anchored, deliberately: a bottom sheet reads as somewhere you
 * went, and this is something that stopped you.
 */
import { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, KeyboardAvoidingView, Pressable, Platform } from 'react-native';

import { Colors, Radii } from '@/theme';
import { AnimatedPress } from './AnimatedPress';
import { OutlinedTextField } from './OutlinedTextField';
import { Txt } from './Txt';

export interface PGowDialogPrompt {
  label?: string;
  placeholder?: string;
  initialValue?: string;
  /** Refuse an empty answer with an error on the field, rather than disabling the button —
   *  a dead control with no explanation is worse than a refusal that says why. */
  required?: boolean;
  requiredMessage?: string;
  helper?: string;
}

export interface PGowDialogProps {
  visible: boolean;
  /** The decision. Name the object: "Delete Vignesh?", never "Are you sure?". */
  title: string;
  /** The consequence, in a sentence or two. Say what becomes true and whether it can be undone. */
  message?: string;
  /** The verb. "Delete staff", "Send to 42 residents" — never "OK" or "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: (promptValue: string) => void;
  onCancel: () => void;
  /**
   * `destructive` paints the confirm red AND disables backdrop-tap dismissal, so a stray tap
   * outside the card can never be the thing that deletes something.
   */
  tone?: 'default' | 'destructive';
  /**
   * A dialog the user must answer — the forced password change, for instance. Backdrop tap
   * and hardware back both stop dismissing it. Use sparingly: this removes the user's escape.
   */
  blocking?: boolean;
  /** Turns the dialog into a confirm-with-a-typed-reason. At most one field, by design. */
  prompt?: PGowDialogPrompt;
  /** Disables both buttons while a mutation is in flight. */
  busy?: boolean;
  testID?: string;
}

export function PGowDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  blocking = false,
  prompt,
  busy = false,
  testID,
}: PGowDialogProps) {
  const [value, setValue] = useState(prompt?.initialValue ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();

  // Re-seed on every open so a cancelled edit does not leak into the next showing.
  useEffect(() => {
    if (visible) {
      setValue(prompt?.initialValue ?? '');
      setFieldError(undefined);
    }
  }, [visible, prompt?.initialValue]);

  // A destructive confirm must not be dismissible by a tap that lands outside the card, and a
  // blocking dialog must not be dismissible at all. Everything else closes the ordinary ways.
  const dismissOnBackdrop = !blocking && tone !== 'destructive';

  const handleConfirm = () => {
    if (busy) return;
    const trimmed = value.trim();
    if (prompt?.required && !trimmed) {
      setFieldError(prompt.requiredMessage ?? 'This is required.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Centred rather than bottom-anchored, but it dims the whole screen for the same reason
      // a sheet does — and without these the dimming stops at the system bars.
      statusBarTranslucent
      navigationBarTranslucent
      // Hardware back is Cancel, never Confirm. On a blocking dialog it is inert, which is
      // what "you must answer this" means on Android.
      onRequestClose={blocking ? () => {} : onCancel}
      testID={testID}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.backdrop}>
          {dismissOnBackdrop ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
            />
          ) : null}

          {/* The trap sits on the card, not the backdrop: the screen behind stays mounted, so
              without it a screen reader walks straight out of the decision and into content
              the user cannot act on. Both buttons are inside this subtree. */}
          <View style={styles.card} accessibilityViewIsModal>
            <Txt variant="sectionTitle" color={Colors.textPrimary}>{title}</Txt>
            {message ? (
              <Txt variant="body" color={Colors.textSecondary} style={styles.message}>{message}</Txt>
            ) : null}

            {prompt ? (
              <View style={styles.field}>
                <OutlinedTextField
                  label={prompt.label}
                  placeholder={prompt.placeholder}
                  value={value}
                  onChangeText={(v) => { setValue(v); if (fieldError) setFieldError(undefined); }}
                  error={fieldError}
                  helper={prompt.helper}
                />
              </View>
            ) : null}

            <View style={styles.row}>
              <AnimatedPress
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                disabled={busy}
                onPress={onCancel}
                style={styles.cancelBtn}
              >
                <Txt variant="button" color={Colors.textSecondary}>{cancelLabel}</Txt>
              </AnimatedPress>

              <AnimatedPress
                accessibilityRole="button"
                // The label carries the verb and the object, so a screen-reader user hears what
                // the button does before they press it rather than after.
                accessibilityLabel={confirmLabel}
                disabled={busy}
                onPress={handleConfirm}
                style={[styles.confirmBtn, tone === 'destructive' && styles.destructiveBtn]}
                testID={testID ? `${testID}_confirm` : undefined}
              >
                <Txt variant="button" color={Colors.textInverse}>{confirmLabel}</Txt>
              </AnimatedPress>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  message: { marginTop: 6 },
  field: { marginTop: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center' },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center' },
  destructiveBtn: { backgroundColor: Colors.danger } });

export default PGowDialog;
