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
  View, StyleSheet, Platform, BackHandler,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { Btn, Card, ChoiceChips, Col, OutlinedBtn, PGowActionSheet, Row, Sheet, Spacer, Txt, type PGowAction } from '@/components/ui';
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
  const toast = useToast();

  const [selectedIdType, setSelectedIdType] = useState(initialIdType || guest?.idProofType || 'Aadhaar Card');
  const [idNumber, setIdNumber] = useState(initialIdNumber);
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [idPhotoUri, setIdPhotoUri] = useState('');
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
      toast(
        'warning',
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

  // Take Photo / Choose from Library / Cancel is a menu of verbs, not a decision — an action
  // sheet, not a dialog. It was an `Alert.alert` with a buttons array, which on Android draws
  // a centred alert for what is a source picker everywhere else in the platform.
  const [photoPicker, setPhotoPicker] = useState<{ label: string; onPicked: (uri: string) => void } | null>(null);
  const choosePhoto = (onPicked: (uri: string) => void, label: string) => setPhotoPicker({ label, onPicked });

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
  // A missing photo is a fact about the photo row, so it is said there rather than in a popup
  // that names both rows at once and covers the thing it is describing.
  const [photoErrors, setPhotoErrors] = useState<{ selfie?: string; idPhoto?: string }>({});

  const handleSubmit = async () => {
    const nextIdError = isAadhaar && aadhaarDigits.length < 4
      ? 'Enter your Aadhaar number — only the last four digits are stored'
      : undefined;
    const nextPhotoErrors = {
      selfie: profilePhotoUri ? undefined : 'Add a selfie so your manager can match you to the ID',
      idPhoto: idPhotoUri ? undefined : 'Add a clear photo of the document itself',
    };
    setIdError(nextIdError);
    setPhotoErrors(nextPhotoErrors);
    if (nextIdError || nextPhotoErrors.selfie || nextPhotoErrors.idPhoto) return;

    setSubmitting(true);
    const r = await submitKyc(selectedIdType, idNumber, idPhotoUri, profilePhotoUri);
    setSubmitting(false);
    if (r.ok) {
      toast(
        'success',
        'Documents submitted',
        'Your manager reviews them next — you get a notification either way.'
      );
      onDismiss();
    } else {
      toast('error', 'Could not submit', r.error ?? 'Please try again.');
    }
  };

  return (
    <>
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
                  onPress={() => choosePhoto((uri) => { setProfilePhotoUri(uri); setPhotoErrors((e) => ({ ...e, selfie: undefined })); }, 'Selfie')}
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
            {photoErrors.selfie ? (
              <Txt size={11} color={Colors.danger} style={{ marginTop: 6 }}>{photoErrors.selfie}</Txt>
            ) : null}

            <Spacer size={16} />

            {/* 2. ID type — five fixed options, shown rather than hidden.
                This was a `Sheet` rendered INSIDE this sheet: the only true nested sheet in
                the app. Two drag handles, two scrims, and a swipe-down whose target was
                ambiguous — on the onboarding path a resident cannot skip. There is room for
                all five here, so the surface is not needed at all. */}
            <Txt variant="body" weight="700" color={Colors.primary}>2. ID Document Type</Txt>
            <Spacer size={8} />
            <ChoiceChips
              options={ID_TYPES}
              value={selectedIdType}
              onChange={setSelectedIdType}
              columns={2}
              testID="kyc_id_type"
            />

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
                  onPress={() => choosePhoto((uri) => { setIdPhotoUri(uri); setPhotoErrors((e) => ({ ...e, idPhoto: undefined })); }, 'ID Document Photo')}
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
            {photoErrors.idPhoto ? (
              <Txt size={11} color={Colors.danger} style={{ marginTop: 6 }}>{photoErrors.idPhoto}</Txt>
            ) : null}

          </ScrollView>

        </Card>
      </KeyboardAvoidingView>
    </Sheet>

    {/* Sibling of the Sheet, not a child. It is still a surface over a surface while this
        whole screen remains a Sheet — transitional: once KYC becomes the four-route workflow
        this picker sits over a screen and the depth rule is satisfied. Not a regression
        meanwhile; the Alert.alert it replaces was also a modal over this sheet.

        `picked` is captured here rather than read inside onPress, because the action sheet
        closes before it runs its handler — by then `photoPicker` is already null. */}
    <PGowActionSheet
      visible={photoPicker != null}
      title={photoPicker?.label}
      onDismiss={() => setPhotoPicker(null)}
      actions={photoSourceActions(photoPicker?.onPicked, pickImage)}
      testID="kyc_photo_source"
    />
    </>
  );
}

/** Take Photo / Choose from Library, bound to whichever slot opened the picker. */
function photoSourceActions(
  onPicked: ((uri: string) => void) | undefined,
  pickImage: (from: 'camera' | 'library') => Promise<string | null>,
): PGowAction[] {
  const pick = (from: 'camera' | 'library') => async () => {
    const uri = await pickImage(from);
    if (uri) onPicked?.(uri);
  };
  return [
    { label: 'Take Photo', icon: 'camera-outline', onPress: pick('camera') },
    { label: 'Choose from Library', icon: 'images-outline', onPress: pick('library') },
  ];
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
});
