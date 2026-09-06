/**
 * GuestKycVerificationTab — KYC status banner + open the KycUploadDialog.
 *
 * Bug #2 fix (KYC Verification Sync):
 *   The old tab embedded a full upload form (ID type, ID number, two photo
 *   pickers, submit button) directly in the resident's profile screen — a
 *   wall of UI that was confusing whether you were already verified or
 *   not. The spec asks for three clear status banners instead:
 *
 *     🟡 Pending Verification — "Your ID is being verified by your manager."
 *     🟢 Verified           — Green checkmark + verified date.
 *     🔴 Action Required     — "Document rejected. Reason: X. Tap to re-upload."
 *
 *   The re-upload flow is now a single tap → KycUploadDialog modal with
 *   BackHandler + backdrop-dismiss + explicit Submit/Cancel row.
 *
 * Cache sync: the dialog calls `submitGuestKyc`, which invalidates
 * `['kyc', pgId]` and `['session']` in the store, so any banner reading
 * `guest.kycStatus` re-renders with the new state on the next tick.
 */
import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { useKycStatus, canSubmitKyc } from '@/features/kyc/useKycStatus';
import { Btn, Card, Col, Row, Spacer, Txt } from '@/components/ui';
interface Props {
  scrollable?: boolean;
}

type KycStatus = 'UNKNOWN' | 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface BannerConfig {
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  message: string;
}

function bannerFor(status: KycStatus, rejectReason: string | undefined): BannerConfig {
  switch (status) {
    // Never render "not submitted" while we are still finding out. Telling a verified
    // resident they have submitted nothing — and offering them an upload button that would
    // open a SECOND submission on an already-approved account — is the failure this state
    // exists to prevent.
    case 'UNKNOWN':
      return {
        bg: Colors.surfaceMuted,
        border: Colors.borderMuted,
        icon: 'hourglass',
        iconColor: Colors.textMuted,
        title: 'Checking your verification status',
        message: 'One moment while we load your account.',
      };
    case 'VERIFIED':
      return {
        bg: Colors.surfaceElevated,
        border: Colors.success,
        icon: 'shield-checkmark',
        iconColor: Colors.success,
        title: 'Identity Verified',
        message: 'Your photo ID and selfie have been verified by your property manager. You have full access to all resident features.',
      };
    case 'PENDING':
      return {
        bg: Colors.pendingPale,
        border: Colors.warning,
        icon: 'hourglass',
        iconColor: Colors.warning,
        title: 'Pending Verification',
        message: 'Your ID (Aadhaar / Passport) is being verified by your property manager. You will receive a notification once approved.',
      };
    case 'REJECTED':
      return {
        bg: Palette.TintRed,
        border: Colors.danger,
        icon: 'ban',
        iconColor: Colors.danger,
        title: 'Action Required — KYC Rejected',
        message: rejectReason
          ? `Document rejected. Reason: ${rejectReason}. Tap "Re-upload Documents" below to resubmit.`
          : 'Your previous submission was rejected. Tap "Re-upload Documents" below to resubmit with clearer photos.',
      };
    case 'NOT_SUBMITTED':
    default:
      return {
        bg: Colors.surfaceMuted,
        border: Colors.borderMuted,
        icon: 'card',
        iconColor: Colors.textMuted,
        title: 'KYC Not Submitted',
        message: 'Mandatory onboarding step. Please upload a selfie and a clear photo of your government-issued ID to complete resident verification.',
      };
  }
}

export function GuestKycVerificationTab({ scrollable = true }: Props) {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const [showUpload, setShowUpload] = useState(false);

  // `/v1/me`'s gate, not `loggedInGuest` — see useKycStatus for why the old
  // `guest?.kycStatus ?? 'NOT_SUBMITTED'` showed a verified resident an upload prompt.
  const kycStatus = useKycStatus() as KycStatus;
  const banner = bannerFor(kycStatus, guest?.kycRejectReason);

  const openUpload = () => {
    setShowUpload(true);
  };

  // The container is either a ScrollView (when this tab is the only thing
  // on the screen) or a plain View (when it's embedded inside another tab
  // that already provides a scroll view — GuestSecurityTab does this).
  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { contentContainerStyle: { padding: 16, gap: 16 } }
    : { style: { gap: 16 } };

  return (
    <Container {...containerProps}>
      {/* Section title */}
      <Row justify="space-between" align="center">
        <Col style={{ flex: 1 }}>
          <Txt variant="sectionTitle" weight="700" color={Colors.textPrimary}>Identity Verification (KYC)</Txt>
        </Col>
        <View style={[styles.statusIconBubble, { backgroundColor: `${banner.iconColor}1A` }]}>
          <Ionicons name={banner.icon as any} size={26} color={banner.iconColor} />
        </View>
      </Row>

      {/* Status banner — colour-coded, with reason when rejected */}
      <Card
        containerColor={banner.bg}
        borderRadius={Radii.card}
        borderWidth={1.5}
        borderColor={banner.border}
        padding={[16, 16]}
      >
        <Row gap={12} align="flex-start">
          <Ionicons name={banner.icon as any} size={24} color={banner.iconColor} />
          <Col style={{ flex: 1 }}>
            <Txt variant="cardTitle" weight="700" color={banner.iconColor}>{banner.title}</Txt>
            <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 18, marginTop: 4 }}>
              {banner.message}
            </Txt>
            {kycStatus === 'VERIFIED' && guest?.kycVerificationDate ? (
              <Row gap={6} align="center" style={{ marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Txt variant="caption" weight="700" color={Colors.success}>
                  Verified on {new Date(guest.kycVerificationDate).toLocaleDateString()}
                </Txt>
              </Row>
            ) : null}
            {kycStatus === 'PENDING' && guest?.kycSubmissionDate ? (
              <Row gap={6} align="center" style={{ marginTop: 8 }}>
                <Ionicons name="time" size={14} color={Colors.warning} />
                <Txt variant="caption" weight="700" color={Colors.warning}>
                  Submitted {new Date(guest.kycSubmissionDate).toLocaleDateString()}
                </Txt>
              </Row>
            ) : null}
          </Col>
        </Row>
      </Card>

      {/* Action card — only when we positively KNOW there is something to do. Hidden while
          the status is still resolving and once verified, so the flow is one-way: a resident
          cannot open a fresh submission on top of an approved one. */}
      {canSubmitKyc(kycStatus) && (
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.card}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
        >
          <Row gap={6} align="center">
            <Txt variant="cardTitle" color={Colors.textPrimary}>
              {kycStatus === 'REJECTED' ? 'Re-upload Your Documents' : 'Submit Your Documents'}
            </Txt>
            <InfoTip
              text={kycStatus === 'REJECTED'
                ? 'Update your selfie and ID photo, then resubmit for review.'
                : 'You will need a clear selfie and a photo of your government-issued ID (Aadhaar, PAN, Passport, DL, or Voter ID).'}
            />
          </Row>
          <Spacer size={14} />
          <Btn
            onPress={openUpload}
            containerColor={kycStatus === 'REJECTED' ? Colors.danger : Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={46}
            testID="kyc_open_upload_btn"
          >
            <Ionicons name={kycStatus === 'REJECTED' ? 'refresh-circle' : 'cloud-upload'} size={18} color={Colors.textInverse} />
            <Txt variant="cardTitle" weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>
              {kycStatus === 'REJECTED' ? 'Re-upload Documents' : 'Start KYC Submission'}
            </Txt>
          </Btn>
        </Card>
      )}

      {/* Help card — what to do if stuck */}
      <Card
        containerColor={Colors.surfaceMuted}
        borderRadius={Radii.card}
        borderWidth={1}
        borderColor={Colors.borderMuted}
        padding={[14, 14]}
      >
        <Row gap={10} align="flex-start">
          <Ionicons name="information-circle" size={18} color={Colors.info} />
          <Col style={{ flex: 1 }}>
            <Txt variant="caption" weight="700" color={Colors.textPrimary}>Need help with verification?</Txt>
            <Txt variant="caption" color={Colors.textMuted} style={{ lineHeight: 16, marginTop: 2 }}>
              If your documents have been pending for over 24 hours or you believe a rejection was in error, please contact your property manager directly through the support tab.
            </Txt>
          </Col>
        </Row>
      </Card>

      {/* The actual upload modal — opened on tap. Carries its own
          BackHandler + backdrop-dismiss so residents never get trapped. */}
      <KycUploadDialog
        visible={showUpload}
        onDismiss={() => setShowUpload(false)}
        reupload={kycStatus === 'REJECTED'}
        initialIdType={guest?.idProofType || 'Aadhaar Card'}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  statusIconBubble: {
    width: 44, height: 44, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
