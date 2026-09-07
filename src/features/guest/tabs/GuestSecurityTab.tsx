/**
 * GuestSecurityTab — Resident Profile & Security Portal.
 *
 * Unified Luxury Emerald System:
 *   - Dark Forest to Rich Emerald Header (#173A33 → #0F5E4A)
 *   - Champagne Canvas (#F6F1E9), Pure White Cards (#FFFFFF), Soft Sage Borders (#B8C4B2)
 *   - High-Contrast Dark Forest Typography (#173A33)
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { GuestKycVerificationTab } from './GuestKycVerificationTab';
import { useKycStatus } from '@/features/kyc/useKycStatus';
import { useToast } from '@/hooks/useToast';
import { useChangePassword } from '@/features/auth/useAuth';
import { PGowApiError } from '@/data/apiClient';
import { AppHeader } from '@/components/AppHeader';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Card, Col, Row, Spacer, StatusChip, Txt, type StatusTone } from '@/components/ui';

/**
 * Same camera/gallery pattern as KycUploadDialog's `pickImage`/`choosePhoto` — real
 * permission requests and a real picker, not a placeholder string. See that file's own
 * doc comment for why a fake `sample:` uri is a landmine: `uploadToPresignedUrl`
 * (features/kyc/useKyc.ts, reused by `updateGuestProfilePhoto`) rejects anything shaped
 * like one rather than silently "succeeding" with nothing uploaded.
 */
async function pickPhoto(from: 'camera' | 'library'): Promise<string | null> {
  const perm = from === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert(
      from === 'camera' ? 'Camera permission required' : 'Photo permission required',
      `Allow ${from === 'camera' ? 'camera' : 'photo library'} access in your device settings to continue.`,
    );
    return null;
  }
  const result = from === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
  if (result.canceled) return null;
  return result.assets?.[0]?.uri ?? null;
}

type KycStatus = 'UNKNOWN' | 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * The resident's own KYC state, in their words rather than the system's.
 *
 * Deliberately not `toneFor` — a resident reads "Action required", not "Rejected", and
 * "Under review" rather than "Pending". Only the colours moved to tokens; the copy is the
 * point of having this here at all.
 */
function kycStatusLabel(status: KycStatus): { label: string; tone: StatusTone } {
  switch (status) {
    case 'UNKNOWN': return { label: 'Checking…', tone: 'neutral' };
    case 'VERIFIED': return { label: 'Verified', tone: 'ok' };
    case 'PENDING': return { label: 'Under review', tone: 'warn' };
    case 'REJECTED': return { label: 'Action required', tone: 'danger' };
    case 'NOT_SUBMITTED':
    default: return { label: 'Not submitted', tone: 'neutral' };
  }
}

export function GuestSecurityTab() {
  const dockScroll = useDockScroll();
  const guest = usePGowStore((s) => s.loggedInGuest);
  const changePasswordMutation = useChangePassword();
  const updateProfilePhoto = usePGowStore((s) => s.updateGuestProfilePhoto);
  const logout = usePGowStore((s) => s.logout);
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string }>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const kycStatus = useKycStatus() as KycStatus;
  const pill = kycStatusLabel(kycStatus);

  const handleChangePhoto = () => {
    if (isUploadingPhoto) return;
    const onPicked = async (uri: string) => {
      setIsUploadingPhoto(true);
      try {
        await updateProfilePhoto(uri);
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    Alert.alert('Change Profile Photo', 'Choose a source', [
      { text: 'Take Photo', onPress: async () => { const u = await pickPhoto('camera'); if (u) onPicked(u); } },
      { text: 'Choose from Library', onPress: async () => { const u = await pickPhoto('library'); if (u) onPicked(u); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of PGow?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleUpdatePassword = async () => {
    if (isUpdating) return;
    const nextErrors = {
      current: currentPassword.trim() ? undefined : 'Enter your current passcode',
      next: !newPassword.trim()
        ? 'Choose a new passcode'
        : newPassword.length < 8 ? 'At least 8 characters' : undefined,
    };
    setPwErrors(nextErrors);
    if (nextErrors.current || nextErrors.next) return;
    setIsUpdating(true);
    try {
      await changePasswordMutation.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      toast('success', 'Passcode Updated', 'Your login credentials have been updated.');
      setNewPassword('');
      setCurrentPassword('');
    } catch (err) {
      const message = err instanceof PGowApiError && err.httpStatus === 401
        ? 'Your current password is not correct.'
        : err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Update Failed', message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── 1. LUXURY EMERALD GRADIENT HEADER ── */}
      <AppHeader
        title="My Account & Profile"
        subtitle="Personal Identity, Security & Verification"
      />

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        {...dockScroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {/* ── 2. RESIDENT PROFILE IDENTITY CARD ── */}
        <View style={styles.profileCard}>
          <Row justify="space-between" align="center">
            <Row gap={14} align="center" style={{ flex: 1 }}>
              <AnimatedPress accessibilityLabel="Profile" accessibilityRole="button"
                onPress={handleChangePhoto}
                disabled={isUploadingPhoto}
                style={styles.avatarRing}
              >
                {guest?.profilePhotoUri ? (
                  <Image source={{ uri: guest.profilePhotoUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={32} color={Colors.primaryDark} />
                )}
                <View style={styles.avatarCameraBadge}>
                  <Ionicons name={isUploadingPhoto ? 'hourglass' : 'camera'} size={12} color={Colors.textInverse} />
                </View>
              </AnimatedPress>
              <Col style={{ flex: 1 }}>
                <Txt size={18} weight="700" color={Colors.textPrimary}>
                  {guest?.name ?? 'Resident'}
                </Txt>
                <Txt size={12} weight="600" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                  Room {guest?.roomNo ?? 'N/A'} • Premium Resident
                </Txt>
              </Col>
            </Row>

            <StatusChip label={pill.label} tone={pill.tone} />
          </Row>

          {(guest?.phone || guest?.email) && (
            <View style={styles.contactDetailsBox}>
              {guest?.phone ? (
                <Row gap={10} align="center">
                  <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
                  <Txt size={13} weight="600" color={Colors.textPrimary}>{guest.phone}</Txt>
                </Row>
              ) : null}
              {guest?.email ? (
                <Row gap={10} align="center" style={{ marginTop: 8 }}>
                  <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
                  <Txt size={13} weight="600" color={Colors.textPrimary}>{guest.email}</Txt>
                </Row>
              ) : null}
            </View>
          )}
        </View>

        {/* ── 3. IDENTITY DOCUMENT (KYC) VERIFICATION ── */}
        <Txt size={15} weight="700" color={Colors.textPrimary} style={{ marginTop: 24, marginBottom: 10 }}>
          Identity Verification (KYC)
        </Txt>
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.sheet}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.sectionCard}
        >
          <Row gap={10} align="center" style={{ marginBottom: 10 }}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
            </View>
            <Txt size={15} weight="700" color={Colors.textPrimary}>Official Document Verification</Txt>
          </Row>
          <GuestKycVerificationTab scrollable={false} />
        </Card>

        {/* ── 4. SECURITY & PASSCODE MANAGEMENT ── */}
        <Txt size={15} weight="700" color={Colors.textPrimary} style={{ marginTop: 24, marginBottom: 10 }}>
          Security & Passcode
        </Txt>
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.sheet}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.sectionCard}
        >
          <Row gap={10} align="center" style={{ marginBottom: 14 }}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="key" size={18} color={Colors.primary} />
            </View>
            <Txt size={15} weight="700" color={Colors.textPrimary}>Change Login Passcode</Txt>
          </Row>

          <OutlinedTextField
            key="guest-current-passcode"
            label="Current Passcode"
            value={currentPassword}
            onChangeText={(v) => { setCurrentPassword(v); if (pwErrors.current) setPwErrors((e) => ({ ...e, current: undefined })); }}
            error={pwErrors.current}
            secureTextEntry
            autoComplete="off"
            focusedBorderColor={Colors.primary}
            borderRadius={Radii.card}
            style={{ marginBottom: 12 }}
          />

          <OutlinedTextField
            key="guest-new-passcode"
            label="New Passcode (min 8 characters)"
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); if (pwErrors.next) setPwErrors((e) => ({ ...e, next: undefined })); }}
            error={pwErrors.next}
            helper="At least 8 characters"
            secureTextEntry
            autoComplete="off"
            focusedBorderColor={Colors.primary}
            borderRadius={Radii.card}
            style={{ marginBottom: 16 }}
          />

          <AnimatedPress accessibilityRole="button"
            onPress={handleUpdatePassword}
            disabled={isUpdating}
            style={styles.updatePasscodeBtn}
          >
            <Ionicons name="lock-closed" size={16} color={Colors.textInverse} style={{ marginRight: 8 }} />
            <Txt size={13} weight="700" color={Colors.textInverse}>Update Passcode</Txt>
          </AnimatedPress>
        </Card>

        {/* ── 5. LOGOUT BUTTON ── */}
        <Spacer size={24} />
        <AnimatedPress accessibilityRole="button"
          onPress={confirmLogout}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Txt size={14} weight="700" color={Colors.danger} style={{ marginLeft: 8 }}>
            Log Out of PGow Account
          </Txt>
        </AnimatedPress>

        <Spacer size={32} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  // Header

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Profile Card
  profileCard: {
    marginTop: -14, backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  avatarRing: {
    width: 52, height: 52, borderRadius: Radii.pill,
    backgroundColor: '#F6F1E9', borderWidth: 2, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center' },
  avatarImage: {
    width: '100%', height: '100%', borderRadius: Radii.sheet },
  avatarCameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center' },
  contactDetailsBox: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F6F1E9' },

  // Section Cards
  sectionCard: {
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: Radii.pill,
    backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center' },

  // Buttons
  updatePasscodeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.card,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  logoutBtn: {
    backgroundColor: '#FFF5F5', borderRadius: Radii.card,
    borderWidth: 1.5, borderColor: '#FECACA',
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } });
