/**
 * GuestSecurityTab — Resident Profile & Security Portal.
 *
 * Unified Luxury Emerald System:
 *   - Dark Forest to Rich Emerald Header (#173A33 → #0F5E4A)
 *   - Champagne Canvas (#F6F1E9), Pure White Cards (#FFFFFF), Soft Sage Borders (#B8C4B2)
 *   - High-Contrast Dark Forest Typography (#173A33)
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { GuestKycVerificationTab } from './GuestKycVerificationTab';
import { useKycStatus } from '@/features/kyc/useKycStatus';
import { useToast } from '@/hooks/useToast';
import { useChangePassword } from '@/features/auth/useAuth';
import { PGowApiError } from '@/data/apiClient';

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

interface KycPillConfig { label: string; color: string; bg: string; }
function kycPill(status: KycStatus): KycPillConfig {
  switch (status) {
    case 'UNKNOWN': return { label: 'Checking…', color: Colors.textSecondary, bg: '#F6F1E9' };
    case 'VERIFIED': return { label: 'Verified Shield', color: Colors.success, bg: '#F6F1E9' };
    case 'PENDING': return { label: 'Under Review', color: '#D97706', bg: '#FEF3C7' };
    case 'REJECTED': return { label: 'Action Required', color: Colors.danger, bg: '#FEE2E2' };
    case 'NOT_SUBMITTED':
    default: return { label: 'Not Submitted', color: Colors.textSecondary, bg: '#F6F1E9' };
  }
}

export function GuestSecurityTab() {
  const insets = useSafeAreaInsets();
  const guest = usePGowStore((s) => s.loggedInGuest);
  const changePasswordMutation = useChangePassword();
  const updateProfilePhoto = usePGowStore((s) => s.updateGuestProfilePhoto);
  const logout = usePGowStore((s) => s.logout);
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const kycStatus = useKycStatus() as KycStatus;
  const pill = kycPill(kycStatus);

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
    if (!currentPassword.trim() || !newPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter your current and new passcode.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Passcode Too Short', 'New passcode must be at least 8 characters long.');
      return;
    }
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
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.hWave1} />
        <View style={styles.hWave2} />
        <Row justify="space-between" align="center" style={styles.hRow}>
          <Col>
            <Txt size={26} weight="900" color="#FFFFFF">My Account & Profile</Txt>
            <Txt size={13} weight="500" color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
              Personal Identity, Security & Verification
            </Txt>
          </Col>
          <View style={styles.badgeWrap}>
            <Ionicons name="ribbon" size={20} color="#FFFFFF" />
          </View>
        </Row>
      </LinearGradient>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
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
              <TouchableOpacity accessibilityLabel="Profile" accessibilityRole="button"
                activeOpacity={0.85}
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
                  <Ionicons name={isUploadingPhoto ? 'hourglass' : 'camera'} size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Col style={{ flex: 1 }}>
                <Txt size={18} weight="900" color={Colors.textPrimary}>
                  {guest?.name ?? 'Resident'}
                </Txt>
                <Txt size={12} weight="600" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                  Room {guest?.roomNo ?? 'N/A'} • Premium Resident
                </Txt>
              </Col>
            </Row>

            <View style={[styles.kycPill, { backgroundColor: pill.bg }]}>
              <Ionicons
                name={kycStatus === 'VERIFIED' ? 'shield-checkmark' : kycStatus === 'PENDING' ? 'hourglass' : 'warning'}
                size={12}
                color={pill.color}
              />
              <Txt size={11} weight="800" color={pill.color} style={{ marginLeft: 4 }}>
                {pill.label}
              </Txt>
            </View>
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
        <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 24, marginBottom: 10 }}>
          Identity Verification (KYC)
        </Txt>
        <Card
          containerColor="#FFFFFF"
          borderRadius={20}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.sectionCard}
        >
          <Row gap={10} align="center" style={{ marginBottom: 10 }}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
            </View>
            <Txt size={15} weight="800" color={Colors.textPrimary}>Official Document Verification</Txt>
          </Row>
          <GuestKycVerificationTab scrollable={false} />
        </Card>

        {/* ── 4. SECURITY & PASSCODE MANAGEMENT ── */}
        <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 24, marginBottom: 10 }}>
          Security & Passcode
        </Txt>
        <Card
          containerColor="#FFFFFF"
          borderRadius={20}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.sectionCard}
        >
          <Row gap={10} align="center" style={{ marginBottom: 14 }}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="key" size={18} color={Colors.primary} />
            </View>
            <Txt size={15} weight="800" color={Colors.textPrimary}>Change Login Passcode</Txt>
          </Row>

          <OutlinedTextField
            label="Current Passcode"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            focusedBorderColor={Colors.primary}
            borderRadius={14}
            style={{ marginBottom: 12 }}
          />

          <OutlinedTextField
            label="New Passcode (min 8 characters)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            focusedBorderColor={Colors.primary}
            borderRadius={14}
            style={{ marginBottom: 16 }}
          />

          <TouchableOpacity accessibilityRole="button"
            activeOpacity={0.9}
            onPress={handleUpdatePassword}
            disabled={isUpdating}
            style={styles.updatePasscodeBtn}
          >
            <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Txt size={13} weight="800" color="#FFFFFF">Update Passcode</Txt>
          </TouchableOpacity>
        </Card>

        {/* ── 5. LOGOUT BUTTON ── */}
        <Spacer size={24} />
        <TouchableOpacity accessibilityRole="button"
          activeOpacity={0.88}
          onPress={confirmLogout}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Txt size={14} weight="800" color={Colors.danger} style={{ marginLeft: 8 }}>
            Log Out of PGow Account
          </Txt>
        </TouchableOpacity>

        <Spacer size={32} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: { overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hRow: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
  hWave1: { position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  hWave2: { position: 'absolute', bottom: 10, right: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
  badgeWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Profile Card
  profileCard: {
    marginTop: -14, backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  avatarRing: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F6F1E9', borderWidth: 2, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: '100%', height: '100%', borderRadius: 24,
  },
  avatarCameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  kycPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  contactDetailsBox: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F6F1E9',
  },

  // Section Cards
  sectionCard: {
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center',
  },

  // Buttons
  updatePasscodeBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  logoutBtn: {
    backgroundColor: '#FFF5F5', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#FECACA',
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
});
