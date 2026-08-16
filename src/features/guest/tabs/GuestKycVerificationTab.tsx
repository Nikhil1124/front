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
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { hapticSelect } from '@/utils/haptics';

interface Props {
  scrollable?: boolean;
}

type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

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
        bg: Colors.alertGradientStart,
        border: Colors.warning,
        icon: 'hourglass',
        iconColor: Colors.warning,
        title: 'Pending Verification',
        message: 'Your ID (Aadhaar / Passport) is being verified by your property manager. You will receive a notification once approved.',
      };
    case 'REJECTED':
      return {
        bg: '#FEF2F2',
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

  const kycStatus = (guest?.kycStatus ?? 'NOT_SUBMITTED') as KycStatus;
  const banner = bannerFor(kycStatus, guest?.kycRejectReason);

  const openUpload = () => {
    hapticSelect();
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
          <Txt size={18} weight="800" color={Colors.textPrimary}>Identity Verification (KYC)</Txt>
        </Col>
        <View style={[styles.statusIconBubble, { backgroundColor: `${banner.iconColor}1A` }]}>
          <Ionicons name={banner.icon as any} size={26} color={banner.iconColor} />
        </View>
      </Row>

      {/* Status banner — colour-coded, with reason when rejected */}
      <Card
        containerColor={banner.bg}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1.5}
        borderColor={banner.border}
        padding={[16, 16]}
      >
        <Row gap={12} align="flex-start">
          <Ionicons name={banner.icon as any} size={24} color={banner.iconColor} />
          <Col style={{ flex: 1 }}>
            <Txt size={14} weight="800" color={banner.iconColor}>{banner.title}</Txt>
            <Txt size={12} color={Colors.textSecondary} style={{ lineHeight: 18, marginTop: 4 }}>
              {banner.message}
            </Txt>
            {kycStatus === 'VERIFIED' && guest?.kycVerificationDate ? (
              <Row gap={6} align="center" style={{ marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Txt size={11} weight="700" color={Colors.success}>
                  Verified on {new Date(guest.kycVerificationDate).toLocaleDateString()}
                </Txt>
              </Row>
            ) : null}
            {kycStatus === 'PENDING' && guest?.kycSubmissionDate ? (
              <Row gap={6} align="center" style={{ marginTop: 8 }}>
                <Ionicons name="time" size={14} color={Colors.warning} />
                <Txt size={11} weight="700" color={Colors.warning}>
                  Submitted {new Date(guest.kycSubmissionDate).toLocaleDateString()}
                </Txt>
              </Row>
            ) : null}
          </Col>
        </Row>
      </Card>

      {/* Action card — Submit / Re-upload CTA. Hidden when verified. */}
      {kycStatus !== 'VERIFIED' && (
        <Card
          containerColor={Colors.surface}
          borderRadius={Layout.borderRadiusCard}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
        >
          <Row gap={6} align="center">
            <Txt size={15} weight="700" color={Colors.textPrimary}>
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
            borderRadius={Layout.borderRadiusButton}
            height={46}
            testID="kyc_open_upload_btn"
          >
            <Ionicons name={kycStatus === 'REJECTED' ? 'refresh-circle' : 'cloud-upload'} size={18} color={Colors.textInverse} />
            <Txt size={14} weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>
              {kycStatus === 'REJECTED' ? 'Re-upload Documents' : 'Start KYC Submission'}
            </Txt>
          </Btn>
        </Card>
      )}

      {/* Help card — what to do if stuck */}
      <Card
        containerColor={Colors.surfaceMuted}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderMuted}
        padding={[14, 14]}
      >
        <Row gap={10} align="flex-start">
          <Ionicons name="information-circle" size={18} color={Colors.info} />
          <Col style={{ flex: 1 }}>
            <Txt size={12} weight="700" color={Colors.textPrimary}>Need help with verification?</Txt>
            <Txt size={11} color={Colors.textMuted} style={{ lineHeight: 16, marginTop: 2 }}>
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
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
});
