/**
 * Set your password — the gate between signing in with a temporary password and reaching the
 * app.
 *
 * A full screen rather than a sheet, because this is a STEP IN THE AUTH FLOW, not an
 * interruption of one. That is how every system that issues temporary credentials presents
 * it — Cognito's `NEW_PASSWORD_REQUIRED` challenge, Okta and Entra's forced-change page, the
 * screen a bank shows after a first login. The user is mid-flow and the flow cannot continue;
 * a gate is a screen, and a screen is the only shape that can carry two fields, live rule
 * feedback and a policy list without fighting a keyboard for room.
 *
 * It also removes a dead end. As a dismissible sheet, swiping it away returned the user to a
 * blank login form with nothing changed and no explanation — they were never signed in,
 * because the sign-in handler returns early on `must_change_password`. Here the only exits
 * are completing the change or explicitly going back to sign in.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScroll } from '@/components/ui/FormScroll';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Btn, PGowDialog, Row, Spacer, Txt } from '@/components/ui';
import { useChangePassword } from '@/features/auth/useAuth';
import { applyRoleBridge } from '@/features/auth/roleBridge';
import {
  clearPendingTempPassword,
  takePendingTempPassword } from '@/features/auth/pendingPasswordChange';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

const MIN_LENGTH = 8;

export default function SetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const changePassword = useChangePassword();

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ next?: string; confirm?: string }>({});
  const [abandoning, setAbandoning] = useState(false);

  // Live rules, not a popup after the fact. Someone choosing a password should be able to see
  // which rule they have not met while they are still typing.
  const longEnough = next.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && next === confirm;

  const submit = async () => {
    const found = {
      next: longEnough ? undefined : `Use at least ${MIN_LENGTH} characters`,
      confirm: next === confirm ? undefined : 'Both boxes must match',
    };
    setErrors(found);
    if (found.next || found.confirm) return;

    // Read-and-clear: the temporary password cannot outlive this one submit.
    const tempPass = takePendingTempPassword();
    if (!tempPass) {
      toast('error', 'Start again', 'Your sign-in expired. Enter your phone number and temporary password again.');
      router.replace('/(auth)/welcome');
      return;
    }

    try {
      await changePassword.mutateAsync({ current_password: tempPass, new_password: next });
      await applyRoleBridge();
      toast('success', 'Password updated', 'Loading your dashboard…');
      router.replace('/');
    } catch (err) {
      // Put it back so a network blip does not cost them the whole sign-in.
      setErrors({ next: err instanceof Error ? err.message : 'Nothing was changed. Try again.' });
    }
  };

  const leave = () => setAbandoning(true);

  return (
    <View style={styles.root}>
      <FormScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28 }]} showsVerticalScrollIndicator={false}>
        <Txt variant="hero" color={Colors.textPrimary}>Set your password</Txt>
        <Spacer size={8} />
        <Txt variant="body" color={Colors.textSecondary}>
          Your account is still on the temporary password you were given. Choose your own to continue.
        </Txt>

        <Spacer size={26} />
        <OutlinedTextField
          label="New password"
          value={next}
          onChangeText={(v) => { setNext(v); if (errors.next) setErrors((e) => ({ ...e, next: undefined })); }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.next}
          testID="set_password_new"
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Confirm password"
          value={confirm}
          onChangeText={(v) => { setConfirm(v); if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined })); }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.confirm}
          testID="set_password_confirm"
        />

        <Spacer size={18} />
        <Rule met={longEnough} label={`At least ${MIN_LENGTH} characters`} />
        <Rule met={matches} label="Both boxes match" />
      </FormScroll>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Btn
          onPress={submit}
          disabled={changePassword.isPending}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Radii.control}
          height={50}
          style={{ width: '100%' }}
          testID="set_password_submit"
        >
          <Txt variant="button" color={Colors.textInverse}>
            {changePassword.isPending ? 'Saving…' : 'Save and continue'}
          </Txt>
        </Btn>
        <Spacer size={10} />
        <Btn
          onPress={leave}
          containerColor={Colors.canvas}
          textColor={Colors.textMuted}
          borderRadius={Radii.control}
          height={44}
          style={{ width: '100%' }}
        >
          <Txt variant="button" color={Colors.textMuted}>Back to sign in</Txt>
        </Btn>
      </View>

      <PGowDialog
        visible={abandoning}
        title="Leave without setting a password?"
        message="You will have to sign in with the temporary password again to get back here."
        confirmLabel="Back to sign in"
        cancelLabel="Stay"
        onConfirm={() => {
          clearPendingTempPassword();
          setAbandoning(false);
          router.replace('/(auth)/welcome');
        }}
        onCancel={() => setAbandoning(false)}
        testID="set_password_abandon"
      />
    </View>
  );
}

/** One password rule, ticked as it is met. */
function Rule({ met, label }: { met: boolean; label: string }) {
  return (
    <Row gap={8} align="center" style={styles.rule}>
      <View style={[styles.dot, met && styles.dotMet]} />
      <Txt variant="meta" color={met ? Colors.success : Colors.textMuted}>{label}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { paddingHorizontal: 22, paddingBottom: 32 },
  footer: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.canvas },
  rule: { paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: Radii.pill, backgroundColor: Colors.borderSubtle },
  dotMet: { backgroundColor: Colors.success } });
