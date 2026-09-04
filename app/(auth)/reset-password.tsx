/**
 * Forgot-password recovery — POST /v1/auth/password/reset-request then reset-confirm.
 *
 * Two phases in one screen, not two routes: opened plain (from either login tab's "Forgot
 * Password?" link) it starts on the phone step; opened via the emailed reset link
 * (`pgow://reset-password?token=...`, Expo Router routes this here for free from the
 * `(auth)` group) it skips straight to the new-password step with `token` already filled in.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt, Btn, Row, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { FormScroll } from '@/components/ui/FormScroll';
import { Colors } from '@/theme';
import * as map from '@/data/mappers';
import { useRequestPasswordResetMutation, useConfirmPasswordResetMutation } from '@/features/auth/useAuth';
import { PGowApiError } from '@/data/apiClient';
import { useToast } from '@/hooks/useToast';

export default function ResetPasswordScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const requestMutation = useRequestPasswordResetMutation();
  const confirmMutation = useConfirmPasswordResetMutation();

  const [phone, setPhone] = useState('');
  const [requested, setRequested] = useState(false);

  const [token, setToken] = useState(tokenParam ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showConfirmStep = requested || !!tokenParam;

  const handleRequest = async () => {
    if (!phone.trim()) return;
    try {
      await requestMutation.mutateAsync(map.toE164(phone));
    } catch {
      // Deliberately quiet: the endpoint only fails on 503 (feature not configured), and
      // "the email couldn't be sent" isn't actionable for someone locked out — either way
      // they're routed to the same fallback message below.
    } finally {
      setRequested(true);
    }
  };

  const handleConfirm = async () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Paste the reset code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    try {
      await confirmMutation.mutateAsync({ token: token.trim(), newPassword });
      toast('success', 'Password updated', 'You are signed in.');
      router.replace('/');
    } catch (err) {
      Alert.alert(
        'Reset Failed',
        err instanceof PGowApiError && err.httpStatus === 401
          ? 'This reset link is invalid or has expired. Request a new one.'
          : err instanceof Error ? err.message : 'Unknown error',
      );
    }
  };

  return (
    <FormScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]} style={styles.root}>
      <Row align="center" style={{ marginBottom: 16 }}>
        <IconBtn onPress={() => router.back()} icon="arrow-back" size={22} tint={Colors.textPrimary} />
        <Txt variant="statValue" weight="800" color={Colors.textPrimary} style={{ marginLeft: 8 }}>
          Reset Password
        </Txt>
      </Row>

      {!showConfirmStep ? (
        <>
          <Txt variant="body" color={Colors.textMuted} style={{ marginBottom: 24 }}>
            Enter the phone number on your account. If it has an email on file, we'll send a
            password reset link to it.
          </Txt>
          <OutlinedTextField
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            leadingIcon="call"
            keyboardType="phone-pad"
            style={{ marginBottom: 16 }}
          />
          <Btn
            onPress={handleRequest}
            loading={requestMutation.isPending}
            disabled={requestMutation.isPending || !phone.trim()}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={12}
            height={50}
          >
            <Txt variant="cardTitle" color={Colors.textInverse}>Send Reset Link</Txt>
          </Btn>
        </>
      ) : (
        <>
          <Txt variant="body" color={Colors.textMuted} style={{ marginBottom: 24 }}>
            {tokenParam
              ? 'Set a new password below.'
              : "If that number has an email on file, a reset link is on its way — open it on this device, or paste the code from the email below."}
          </Txt>
          <OutlinedTextField
            label="Reset Code"
            value={token}
            onChangeText={setToken}
            leadingIcon="key"
            editable={!tokenParam}
            style={{ marginBottom: 12, opacity: tokenParam ? 0.6 : 1 }}
          />
          <OutlinedTextField
            label="New Password * (min 8 characters)"
            value={newPassword}
            onChangeText={setNewPassword}
            leadingIcon="lock-closed"
            secureTextEntry
            style={{ marginBottom: 12 }}
          />
          <OutlinedTextField
            label="Confirm New Password *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leadingIcon="lock-closed"
            secureTextEntry
            style={{ marginBottom: 16 }}
          />
          <Btn
            onPress={handleConfirm}
            loading={confirmMutation.isPending}
            disabled={confirmMutation.isPending}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={12}
            height={50}
          >
            <Txt variant="cardTitle" color={Colors.textInverse}>Set New Password</Txt>
          </Btn>
          <Spacer size={12} />
          <Btn
            onPress={() => { setRequested(false); setToken(''); }}
            containerColor="transparent"
            textColor={Colors.textMuted}
            borderRadius={12}
            height={44}
          >
            <Txt variant="body" color={Colors.textMuted}>Send another link</Txt>
          </Btn>
        </>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 24, paddingBottom: 100 },
});
