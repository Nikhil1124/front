/**
 * KycUploadDialog — clean modal for resident KYC document submission / re-upload.
 *
 * Bug #2 fix (KYC Verification Sync):
 *   The spec calls for a `KycUploadDialog.tsx` so a rejected resident can
 *   tap a banner and re-submit documents in one focused flow. The old
 *   `GuestKycVerificationTab` mixed the form and the status banner together
 *   in the same scroll view, which meant a rejected resident had to scroll,
 *   pick a new ID type, re-enter their ID number, re-pick two photos, and
 *   hit submit — all in the same cramped card. Pulling that flow into a
 *   dedicated modal makes the re-upload path explicit.
 *
 * Cyber Mint migration:
 *   - White surface on mint canvas, slate-900 text, teal primary button.
 *   - Single-column form, large touch targets, sticky bottom action row.
 *   - Close button in the header AND tap-backdrop-to-dismiss (so nobody
 *     gets trapped — same pattern as the PaymentReceiptDialog fix).
 *
 * Cache invalidation:
 *   On success, the dialog calls `queryClient.invalidateQueries(['kyc'])`
 *   and `['session']` via the store's `submitGuestKyc` action — the store
 *   does the actual invalidation, so this dialog stays presentation-only.
 */
import { useEffect, useState } from 'react';
import {
  Modal, View, StyleSheet, Pressable, Alert, Platform, BackHandler,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { AnimatedPress, Btn, Card, Col, IconBtn, OutlinedBtn, Row, Sheet, Spacer, Txt } from '@/components/ui';
const ID_TYPES = ['Aadhaar Card', 'PAN Card', 'Passport', 'Driving License', 'Voter ID'];

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Pre-fill the form for re-upload (after rejection). When true, the
   *  dialog opens with a "Re-upload rejected documents" header. */
  reupload?: boolean;
  initialIdType?: string;
  initialIdNumber?: string;
}

export function KycUploadDialog({
  visible,
  onDismiss,
  reupload = false,
  initialIdType = 'Aadhaar Card',
  initialIdNumber = '',
}: Props) {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const submitKyc = usePGowStore((s) => s.submitGuestKyc);

  const [selectedIdType, setSelectedIdType] = useState(initialIdType || guest?.idProofType || 'Aadhaar Card');
  const [idNumber, setIdNumber] = useState(initialIdNumber);
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [idPhotoUri, setIdPhotoUri] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Both photo buttons used to set a literal `sample:selfie_preset_3` / `sample:iddoc_…`
   * string — no picker was ever opened, expo-image-picker was not even imported here, and
   * `uploadToPresignedUrl` then skipped any uri starting with `sample:` and returned
   * success. So KYC "succeeded" having uploaded nothing: the server issued an object key,
   * stored a document row pointing at it, and the owner opened a verification screen
   * showing a broken image for a photo that was never taken.
   */
  const pickImage = async (from: 'camera' | 'library'): Promise<string | null> => {
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  };

  const choosePhoto = (onPicked: (uri: string) => void, label: string) => {
    Alert.alert(label, 'Choose a source', [
      { text: 'Take Photo', onPress: async () => { const u = await pickImage('camera'); if (u) onPicked(u); } },
      { text: 'Choose from Library', onPress: async () => { const u = await pickImage('library'); if (u) onPicked(u); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Android hardware back: dismiss the modal rather than letting the OS
  // navigate away. Same pattern as PaymentReceiptDialog — see that file for
  // the rationale on the subscription lifecycle.
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  // Reset the form fields when the dialog is opened fresh. Without this,
  // a resident who opens, types half a number, closes, and reopens would
  // see stale state — they expect a clean form on each open.
  useEffect(() => {
    if (visible) {
      setSelectedIdType(initialIdType || guest?.idProofType || 'Aadhaar Card');
      setIdNumber(initialIdNumber);
      setProfilePhotoUri('');
      setIdPhotoUri('');
      setSubmitting(false);
      setShowDropdown(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only Aadhaar has anywhere to go: the backend stores `aadhaar_last4` and NOTHING else —
  // `user_documents` has no column for a PAN or passport number, deliberately ("the owner
  // verifies visually from the image, so keeping it buys nothing and creates breach
  // liability"). Demanding a number for the other four types blocked submission to collect a
  // value that was then discarded.
  const isAadhaar = selectedIdType === 'Aadhaar Card';
  const aadhaarDigits = idNumber.replace(/\D/g, '');

  const [idError, setIdError] = useState<string | undefined>();

  const handleSubmit = async () => {
    if (isAadhaar && aadhaarDigits.length < 4) {
      setIdError('Enter your Aadhaar number — only the last four digits are stored');
      return;
    }
    if (!idPhotoUri || !profilePhotoUri) {
      Alert.alert('Validation', 'Please attach both a selfie and a clear photo of your ID document.');
      return;
    }
    setSubmitting(true);
    const r = await submitKyc(selectedIdType, idNumber, idPhotoUri, profilePhotoUri);
    setSubmitting(false);
    if (r.ok) {
      Alert.alert(
        'Submitted',
        'Your KYC documents have been sent to your property manager for verification. You will receive a notification once reviewed.'
      );
      onDismiss();
    } else {
      Alert.alert('Submission Failed', r.error ?? 'Please try again.');
    }
  };

  return (
    <Sheet
      visible={visible}
      title={reupload ? 'Re-upload Documents' : 'Verify Your Identity'}
      subtitle={reupload ? 'Update your KYC and resubmit for review' : 'Required for resident onboarding'}
      icon="ribbon"
      accent={Colors.primary}
      onDismiss={onDismiss}
      testID="kyc_upload_dialog"
      footer={
        <Row gap={10}>
          <Btn
            onPress={handleSubmit}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={48}
            loading={submitting}
            style={{ flex: 1 }}
            testID="kyc_submit_btn"
          >
            <Ionicons name="send" size={16} color={Colors.textInverse} />
            <Txt variant="button" color={Colors.textInverse} style={{ marginLeft: 8 }}>
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </Txt>
          </Btn>
          <OutlinedBtn
            onPress={onDismiss}
            borderColor={Colors.borderMuted}
            textColor={Colors.textSecondary}
            borderRadius={Radii.control}
            height={48}
            testID="kyc_cancel_btn"
          >
            <Txt variant="body" weight="700" color={Colors.textSecondary}>Cancel</Txt>
          </OutlinedBtn>
        </Row>
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.sheet}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '100%', maxWidth: 480 }}
        >
          {/* Rejected banner — only when re-uploading */}
          {reupload && (
            <>
              <Spacer size={14} />
              <View style={styles.rejectedBanner}>
                <Ionicons name="warning" size={18} color={Colors.danger} />
                <Col style={{ flex: 1 }}>
                  <Txt variant="statusChip" color={Colors.danger}>Action Required</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {guest?.kycRejectReason
                      ? `Reason: ${guest.kycRejectReason}`
                      : 'Your previous submission was rejected. Please update and resubmit.'}
                  </Txt>
                </Col>
              </View>
            </>
          )}

          <Spacer size={16} />

          <ScrollView
            style={{ maxHeight: 370 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >

            {/* 1. Selfie / Profile photo */}
            <Txt variant="body" weight="700" color={Colors.primary}>1. Selfie / Profile Photo</Txt>
            <Spacer size={8} />
            <Row gap={12} align="center">
              <View style={[styles.photoBox, profilePhotoUri ? styles.photoBoxFilled : null]}>
                {profilePhotoUri
                  ? <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  : <Col align="center"><Ionicons name="person-circle" size={28} color={Colors.textMuted} /><Txt size={9} color={Colors.textMuted}>No selfie</Txt></Col>}
              </View>
              <Col style={{ flex: 1 }}>
                <Btn
                  onPress={() => choosePhoto(setProfilePhotoUri, 'Selfie')}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Radii.control}
                  height={36}
                  testID="kyc_upload_selfie_btn"
                >
                  <Ionicons name="camera" size={16} color={Colors.textInverse} />
                  <Txt variant="caption" weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Take / Choose Photo</Txt>
                </Btn>
              </Col>
            </Row>

            <Spacer size={16} />

            {/* 2. ID type dropdown */}
            <Txt variant="body" weight="700" color={Colors.primary}>2. ID Document Type</Txt>
            <Spacer size={8} />
            <AnimatedPress accessibilityRole="button"
              onPress={() => setShowDropdown(true)}
              style={styles.dropdownBox}
              testID="kyc_id_type_dropdown"
            >
              <Txt variant="body" color={Colors.textPrimary}>{selectedIdType}</Txt>
              <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </AnimatedPress>
            {/* Dropdown sheet — replaces the old anchored Modal so backdrop tap-to-close still works. */}
            <Sheet
              visible={showDropdown}
              title="Choose ID type"
              onDismiss={() => setShowDropdown(false)}
              testID="kyc_id_type_dropdown_sheet"
            >
              <View style={styles.dropdownMenu}>
                {ID_TYPES.map((t) => (
                  <AnimatedPress
                    accessibilityRole="button"
                    key={t}
                    onPress={() => { setSelectedIdType(t); setShowDropdown(false); }}
                    style={styles.dropdownItem}
                  >
                    <Txt variant="body" color={Colors.textPrimary}>{t}</Txt>
                    {selectedIdType === t && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </AnimatedPress>
                ))}
              </View>
            </Sheet>

            <Spacer size={12} />

            {/* 3. ID number — required only for Aadhaar; see the note on `isAadhaar` above. */}
            <OutlinedTextField
              label={isAadhaar ? 'Aadhaar Number *' : 'ID Document Number (optional)'}
              placeholder={isAadhaar ? '1234 5678 9012' : 'Not required — we read it from your photo'}
              value={idNumber}
              onChangeText={(v) => { setIdNumber(v); if (idError) setIdError(undefined); }}
              error={idError}
              keyboardType={isAadhaar ? 'number-pad' : 'default'}
              testID="kyc_id_number_input"
            />
            <Txt size={11} color={Colors.textMuted} style={{ marginTop: 4 }}>
              {isAadhaar
                ? 'Only the last 4 digits are stored. Your full number is never saved.'
                : 'Your manager verifies this document from the photo — the number is not stored.'}
            </Txt>

            <Spacer size={14} />

            {/* 4. ID photo */}
            <Txt variant="body" weight="700" color={Colors.primary}>3. ID Document Photo</Txt>
            <Spacer size={8} />
            <Row gap={12} align="center">
              <View style={[styles.idPhotoBox, idPhotoUri ? styles.photoBoxFilled : null]}>
                {idPhotoUri
                  ? <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  : <Col align="center"><Ionicons name="card" size={26} color={Colors.textMuted} /><Txt size={9} color={Colors.textMuted}>No ID photo</Txt></Col>}
              </View>
              <Col style={{ flex: 1 }}>
                <Btn
                  onPress={() => choosePhoto(setIdPhotoUri, 'ID Document Photo')}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Radii.control}
                  height={36}
                  testID="kyc_upload_id_doc_btn"
                >
                  <Ionicons name="cloud-upload" size={16} color={Colors.textInverse} />
                  <Txt variant="caption" weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Upload ID Image</Txt>
                </Btn>
              </Col>
            </Row>

          </ScrollView>

        </Card>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titleIconWrap: {
    width: 36, height: 36, borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.dangerPale,
    borderWidth: 1, borderColor: Colors.danger,
    borderRadius: Radii.card, padding: 12,
  },
  photoBox: {
    width: 80, height: 80, borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5, borderColor: Colors.borderMuted, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBoxFilled: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.success, borderStyle: 'solid',
  },
  idPhotoBox: {
    width: 110, height: 75, borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5, borderColor: Colors.borderMuted, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderMuted,
    borderRadius: Radii.control, paddingHorizontal: 12, paddingVertical: 14,
    backgroundColor: Colors.surfaceMuted,
  },
  dropdownBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  dropdownMenu: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderMuted,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
});
