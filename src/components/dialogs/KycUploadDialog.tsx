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
  Modal, View, StyleSheet, Pressable, TouchableOpacity, Alert, Platform, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';

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

  const handleSubmit = async () => {
    if (!idNumber.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please enter your ID document number.');
      return;
    }
    if (!idPhotoUri || !profilePhotoUri) {
      hapticError();
      Alert.alert('Validation', 'Please attach both a selfie and a clear photo of your ID document.');
      return;
    }
    hapticSelect();
    setSubmitting(true);
    const r = await submitKyc(selectedIdType, idNumber, idPhotoUri, profilePhotoUri);
    setSubmitting(false);
    if (r.ok) {
      hapticSuccess();
      Alert.alert(
        'Submitted',
        'Your KYC documents have been sent to your property manager for verification. You will receive a notification once reviewed.'
      );
      onDismiss();
    } else {
      hapticError();
      Alert.alert('Submission Failed', r.error ?? 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable onPress={() => {/* swallow tap so it doesn't bubble */}} style={styles.cardWrap}>
          <Card
            containerColor={Colors.surface}
            borderRadius={20}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[20, 20]}
            style={{ width: '100%', maxWidth: 480 }}
          >
            {/* Header — title + sticky close button */}
            <Row justify="space-between" align="center">
              <Row gap={8}>
                <View style={styles.titleIconWrap}>
                  <Ionicons name="ribbon" size={22} color={Colors.primary} />
                </View>
                <Col>
                  <Txt size={16} weight="800" color={Colors.textPrimary}>
                    {reupload ? 'Re-upload Documents' : 'Verify Your Identity'}
                  </Txt>
                  <Txt size={11} color={Colors.textMuted}>
                    {reupload ? 'Update your KYC and resubmit for review' : 'Required for resident onboarding'}
                  </Txt>
                </Col>
              </Row>
              <IconBtn
                onPress={onDismiss}
                icon="close"
                size={20}
                tint={Colors.textSecondary}
                containerColor={Colors.surfaceMuted}
                borderRadius={999}
                padding={6}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                testID="kyc_upload_close_btn"
              />
            </Row>

            {/* Rejected banner — only when re-uploading */}
            {reupload && (
              <>
                <Spacer size={14} />
                <View style={styles.rejectedBanner}>
                  <Ionicons name="warning" size={18} color={Colors.danger} />
                  <Col style={{ flex: 1 }}>
                    <Txt size={12} weight="800" color={Colors.danger}>Action Required</Txt>
                    <Txt size={11} color={Colors.textSecondary}>
                      {guest?.kycRejectReason
                        ? `Reason: ${guest.kycRejectReason}`
                        : 'Your previous submission was rejected. Please update and resubmit.'}
                    </Txt>
                  </Col>
                </View>
              </>
            )}

            <Spacer size={16} />

            {/* 1. Selfie / Profile photo */}
            <Txt size={13} weight="700" color={Colors.primary}>1. Selfie / Profile Photo</Txt>
            <Spacer size={8} />
            <Row gap={12} align="center">
              <View style={[styles.photoBox, profilePhotoUri ? styles.photoBoxFilled : null]}>
                {profilePhotoUri
                  ? <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  : <Col align="center"><Ionicons name="person-circle" size={28} color={Colors.textMuted} /><Txt size={9} color={Colors.textMuted}>No selfie</Txt></Col>}
              </View>
              <Col style={{ flex: 1 }}>
                <Btn
                  onPress={() => setProfilePhotoUri(`sample:selfie_preset_${Math.floor(Math.random() * 5) + 1}`)}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Layout.borderRadiusButton}
                  height={36}
                  testID="kyc_upload_selfie_btn"
                >
                  <Ionicons name="camera" size={16} color={Colors.textInverse} />
                  <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Take / Choose Photo</Txt>
                </Btn>
              </Col>
            </Row>

            <Spacer size={16} />

            {/* 2. ID type dropdown */}
            <Txt size={13} weight="700" color={Colors.primary}>2. ID Document Type</Txt>
            <Spacer size={8} />
            <TouchableOpacity
              onPress={() => setShowDropdown(true)}
              style={styles.dropdownBox}
              testID="kyc_id_type_dropdown"
            >
              <Txt size={13} color={Colors.textPrimary}>{selectedIdType}</Txt>
              <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {/* Dropdown modal — for clean tap-outside-to-close */}
            <Modal visible={showDropdown} transparent animationType="fade" onRequestClose={() => setShowDropdown(false)}>
              <Pressable style={styles.dropdownBackdrop} onPress={() => setShowDropdown(false)}>
                <View style={styles.dropdownMenu}>
                  {ID_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => { setSelectedIdType(t); setShowDropdown(false); hapticSelect(); }}
                      style={styles.dropdownItem}
                    >
                      <Txt size={13} color={Colors.textPrimary}>{t}</Txt>
                      {selectedIdType === t && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Spacer size={12} />

            {/* 3. ID number */}
            <OutlinedTextField
              label="ID Document Number *"
              placeholder="1234 5678 9012"
              value={idNumber}
              onChangeText={setIdNumber}
              testID="kyc_id_number_input"
            />

            <Spacer size={14} />

            {/* 4. ID photo */}
            <Txt size={13} weight="700" color={Colors.primary}>3. ID Document Photo</Txt>
            <Spacer size={8} />
            <Row gap={12} align="center">
              <View style={[styles.idPhotoBox, idPhotoUri ? styles.photoBoxFilled : null]}>
                {idPhotoUri
                  ? <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  : <Col align="center"><Ionicons name="card" size={26} color={Colors.textMuted} /><Txt size={9} color={Colors.textMuted}>No ID photo</Txt></Col>}
              </View>
              <Col style={{ flex: 1 }}>
                <Btn
                  onPress={() => setIdPhotoUri(`sample:iddoc_${selectedIdType.toLowerCase().replace(/\s+/g, '_')}_${Math.floor(Math.random() * 900) + 100}`)}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Layout.borderRadiusButton}
                  height={36}
                  testID="kyc_upload_id_doc_btn"
                >
                  <Ionicons name="cloud-upload" size={16} color={Colors.textInverse} />
                  <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Upload ID Image</Txt>
                </Btn>
              </Col>
            </Row>

            <Spacer size={22} />

            {/* Bottom action row — distinct Submit / Cancel affordances */}
            <Row gap={10}>
              <Btn
                onPress={handleSubmit}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={Layout.borderRadiusButton}
                height={48}
                loading={submitting}
                style={{ flex: 1 }}
                testID="kyc_submit_btn"
              >
                <Ionicons name="send" size={16} color={Colors.textInverse} />
                <Txt size={14} weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>
                  {submitting ? 'Submitting…' : 'Submit for Verification'}
                </Txt>
              </Btn>
              <OutlinedBtn
                onPress={onDismiss}
                borderColor={Colors.borderMuted}
                textColor={Colors.textSecondary}
                borderRadius={Layout.borderRadiusButton}
                height={48}
                testID="kyc_cancel_btn"
              >
                <Txt size={13} weight="700" color={Colors.textSecondary}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
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
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.alertGradientStart,
    borderWidth: 1, borderColor: Colors.danger,
    borderRadius: Layout.borderRadiusCard, padding: 12,
  },
  photoBox: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5, borderColor: Colors.borderMuted, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBoxFilled: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.success, borderStyle: 'solid',
  },
  idPhotoBox: {
    width: 110, height: 75, borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5, borderColor: Colors.borderMuted, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderMuted,
    borderRadius: Layout.borderRadiusButton, paddingHorizontal: 12, paddingVertical: 14,
    backgroundColor: Colors.surfaceMuted,
  },
  dropdownBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  dropdownMenu: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadiusCard,
    borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderMuted,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
});
