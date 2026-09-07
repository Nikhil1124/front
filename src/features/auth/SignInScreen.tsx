/**
 * Sign in — one form for everyone.
 *
 * This replaces a four-tab picker (Owner / Manager / Staff / Resident) sitting behind a
 * welcome screen that carried about twenty pieces of content to ask a single question.
 *
 * The picker asked something the app already knows. `POST /auth/login` takes only a phone and
 * a password — `LoginRequest` has no role field — and the server resolves the role from the
 * identity, which is exactly what `applyRoleBridge` then reads back. The Owner and Resident
 * tabs were the same call with the same payload; the only thing separating them in code was
 * the toast copy and an `asGuest` flag that was destructured straight back out and never sent.
 *
 * What genuinely differs is not the role but the *credential*:
 *
 *     phone + password → /auth/login       owner, manager acting as owner, resident
 *     phone + PIN      → /auth/login-pin   staff, manager on the floor
 *
 * So that is the only choice this screen offers, and it offers it as a link rather than a tab
 * bar — most people never need it. Registering a property and joining one with a code are
 * once-in-a-lifetime actions and sit in the footer, not in prime screen space.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { FormScroll } from '@/components/ui/FormScroll';
import { Colors, Radii } from '@/theme';
import { useToast } from '@/hooks/useToast';
import { useLogin, usePinLogin, useChangePassword } from '@/features/auth/useAuth';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { toUserRole } from '@/store/roles';
import { PGowApiError } from '@/data/apiClient';
import * as map from '@/data/mappers';
import { AnimatedPress, Btn, Row, Sheet, Spacer, Txt } from '@/components/ui';

type Mode = 'password' | 'pin';

/** A tappable line of text. `Btn` is always a filled control and `Txt` is not pressable, so
 *  the secondary actions on this screen had nothing to be. Sized to clear a 44pt target. */
function TextLink({
  label, onPress, testID, inline = false,
}: { label: string; onPress: () => void; testID?: string; inline?: boolean }) {
  return (
    <AnimatedPress
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={inline ? undefined : styles.link}
    >
      <Txt size={12.5} weight="700" color={Colors.primary} align="center">{label}</Txt>
    </AnimatedPress>
  );
}

export function SignInScreen() {
  const loginMutation = useLogin();
  const pinLoginMutation = usePinLogin();
  const changePasswordMutation = useChangePassword();
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('password');
  const [phone, setPhone] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // First-time password: a temporary password must be replaced before the session is usable.
  const [showFTP, setShowFTP] = useState(false);
  const [tempPass, setTempPass] = useState('');
  const [ftpNew, setFtpNew] = useState('');
  const [ftpConfirm, setFtpConfirm] = useState('');

  /** Mirrors the freshly-derived role into the older store slices that still read it.
   *  Navigation itself only needs `useAuthStore.activeRole`, which the mutations already set. */
  const applyRoleBridge = async () => {
    const role = toUserRole(useAuthStore.getState().activeRole);
    usePGowStore.getState().patch({ activeRole: role, isManagerMode: role === 'MANAGER' });
    await refreshAll();
  };

  const isPasswordChangeRequired = (err: unknown) =>
    err instanceof PGowApiError
    && err.httpStatus === 403
    && err.message.toLowerCase().includes('password');

  const handleSubmit = async () => {
    if (!phone.trim() || !secret.trim()) {
      setError(mode === 'pin' ? 'Enter your phone number and PIN.' : 'Enter your phone number and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'pin') {
        await pinLoginMutation.mutateAsync({ phone: map.toE164(phone), pin: secret.trim() });
      } else {
        const data = await loginMutation.mutateAsync({ phone: map.toE164(phone), password: secret });
        if (data.must_change_password) {
          setTempPass(secret);
          setShowFTP(true);
          return;
        }
      }
      await applyRoleBridge();
      // No per-role welcome copy: the app does not know which dashboard it is about to show
      // until the role resolves, and saying "Welcome back" covers every one of them.
      toast('success', 'Welcome back', 'Loading your dashboard…');
      router.replace('/');
    } catch (err) {
      if (mode === 'password' && isPasswordChangeRequired(err)) {
        setTempPass(secret);
        setShowFTP(true);
        return;
      }
      setError(
        err instanceof PGowApiError && err.httpStatus === 401
          ? mode === 'pin' ? 'That phone number and PIN do not match.' : 'That phone number and password do not match.'
          : err instanceof Error ? err.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFTPSubmit = async () => {
    if (ftpNew.trim().length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (ftpNew !== ftpConfirm) {
      Alert.alert('Passwords do not match', 'Type the same password in both fields.');
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({ current_password: tempPass, new_password: ftpNew });
      await applyRoleBridge();
      setShowFTP(false);
      toast('success', 'Password updated', 'Loading your dashboard…');
      router.replace('/');
    } catch (err) {
      Alert.alert('Could not update password', err instanceof Error ? err.message : 'Nothing was changed.');
    }
  };

  return (
    <View style={styles.root}>
      <FormScroll contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <View style={styles.mark}><Txt size={22} weight="700" color={Colors.textInverse}>P</Txt></View>
          <Spacer size={12} />
          <Txt size={29} weight="700" color={Colors.textPrimary} align="center">PGow</Txt>
          <Txt size={12} color={Colors.textMuted} align="center" style={{ marginTop: 3 }}>Co-living, managed</Txt>
        </View>

        <View style={styles.card}>
          <OutlinedTextField
            key="signin-phone"
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="off"
            testID="signin_phone"
          />
          <Spacer size={12} />
          <OutlinedTextField
            key="signin-secret"
            label={mode === 'pin' ? 'PIN' : 'Password'}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry
            keyboardType={mode === 'pin' ? 'number-pad' : 'default'}
            textContentType={mode === 'pin' ? 'oneTimeCode' : 'password'}
            autoComplete="off"
            testID="signin_secret"
          />
          {error ? (
            <Txt size={12} color={Colors.danger} style={{ marginTop: 10 }}>{error}</Txt>
          ) : null}
        </View>

        <Spacer size={14} />
        <Btn onPress={handleSubmit} loading={busy} height={52} borderRadius={Radii.card} testID="signin_submit">
          <Txt size={15} weight="700" color={Colors.textInverse}>Sign in</Txt>
        </Btn>

        <Spacer size={10} />
        <TextLink
          label={mode === 'pin' ? 'Sign in with a password instead' : 'Staff? Sign in with a PIN'}
          onPress={() => { setMode(mode === 'pin' ? 'password' : 'pin'); setSecret(''); setError(''); }}
          testID="signin_toggle_mode"
        />

        {mode === 'password' && (
          <>
            <Spacer size={4} />
            <TextLink label="Forgot password?" onPress={() => router.push('/(auth)/reset-password')} />
          </>
        )}

        {/* Pushes the footer to the bottom on a tall screen and collapses to nothing on a
            short one, so the links never float in the middle of a dead zone. */}
        <View style={{ flex: 1, minHeight: 24 }} />

        <Row justify="center" align="center" gap={6}>
          <Txt size={12.5} color={Colors.textMuted}>New here?</Txt>
          <TextLink label="Join a PG" onPress={() => router.push('/(auth)/guest-join')} testID="signin_join" inline />
          <Txt size={12.5} color={Colors.textMuted}>·</Txt>
          <TextLink label="Register a PG" onPress={() => router.push('/(auth)/owner-register')} inline />
        </Row>
      </FormScroll>

      {/* ── First-time password ─────────────────────────────────────────────── */}
      <Sheet
        visible={showFTP}
        title="Set your password"
        subtitle="Your account is still on the temporary password you were given. Choose your own to continue."
        onDismiss={() => setShowFTP(false)}
        testID="signin_set_password"
        footer={
          <Btn onPress={handleFTPSubmit} height={50} borderRadius={Radii.card} style={{ width: '100%' }}>
            <Txt size={14.5} weight="700" color={Colors.textInverse}>Save and continue</Txt>
          </Btn>
        }
      >
        <KeyboardAvoidingView style={{}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <OutlinedTextField
            key="signin-ftp-new-password"
            label="New password"
            value={ftpNew}
            onChangeText={setFtpNew}
            secureTextEntry
            autoComplete="off"
          />
          <Spacer size={12} />
          <OutlinedTextField
            key="signin-ftp-confirm-password"
            label="Confirm password"
            value={ftpConfirm}
            onChangeText={setFtpConfirm}
            secureTextEntry
            autoComplete="off"
          />
        </KeyboardAvoidingView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 48, paddingBottom: 28 },
  brand: { alignItems: 'center', marginBottom: 30 },
  mark: {
    width: 52, height: 52, borderRadius: Radii.card,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  link: { paddingVertical: 11, alignItems: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 23, 26, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    padding: 20,
  },
});
