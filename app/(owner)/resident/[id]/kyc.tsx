/**
 * KYC review — read a resident's documents properly, then decide.
 *
 * Document inspection in a 3/4-height sheet meant squinting at an ID card in a panel, with an
 * irreversible Approve/Reject pair underneath it. The images get the full screen width here
 * and remain tappable into the full-bleed zoom viewer `KycDocumentsCard` already owns.
 *
 * Reject takes a reason because the resident sees it and re-uploads against it — that is the
 * one dialog on this screen that carries a field.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { Btn, ErrorState, LoadingState, PGowDialog, Row, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';
import { useGuest } from '@/features/guests/useGuests';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

export default function KycReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);

  const { guest, isLoading, error, refetch } = useGuest(id);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Frame><LoadingState label="Loading documents…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this resident" onRetry={refetch} /></Frame>;
  if (!guest) {
    return (
      <Frame>
        <ErrorState title="This resident is no longer in this PG" error={new Error('They may have been removed.')} />
      </Frame>
    );
  }

  const decided = guest.kycStatus === 'VERIFIED' || guest.kycStatus === 'REJECTED';

  const approve = async () => {
    setBusy(true);
    const r = await verifyKyc(guest.id, true);
    setBusy(false);
    if (r.ok) {
      toast('success', 'KYC approved', `${guest.name} is verified.`);
      router.back();
    } else {
      toast('error', 'Could not approve', r.error ?? 'Please try again.');
    }
  };

  const reject = async (reason: string) => {
    setBusy(true);
    const r = await verifyKyc(guest.id, false, reason);
    setBusy(false);
    setRejecting(false);
    if (r.ok) {
      toast('success', 'KYC rejected', `${guest.name} can re-upload against your reason.`);
      router.back();
    } else {
      toast('error', 'Could not reject', r.error ?? 'Please try again.');
    }
  };

  return (
    <Frame>
      <AppHeader title="KYC review" subtitle={guest.name} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Row justify="space-between" align="center">
          <Txt variant="meta" color={Colors.textMuted}>Current status</Txt>
          <StatusChip label={guest.kycStatus.replace('_', ' ').toLowerCase()} tone={toneFor(guest.kycStatus)} />
        </Row>

        <Spacer size={16} />
        <KycDocumentsCard
          idPhotoUri={guest.idProofPhotoUri}
          selfieUri={guest.profilePhotoUri}
          emptyHint="This resident has not submitted any documents yet."
        />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.sectionLabel}>SUBMITTED DETAILS</Txt>
        <View style={styles.hr} />
        <DetailRow label="ID type" value={guest.idProofType || '—'} />
        {/* Only `aadhaar_last4` is persisted server-side — there is no column for a full PAN
            or passport number, deliberately. Say so rather than leaving a blank row. */}
        <DetailRow
          label="ID number"
          value={guest.idProofNumber || 'Not stored — verify visually from the photo'}
        />
        <DetailRow
          label="Submitted"
          value={guest.kycSubmissionDate ? new Date(guest.kycSubmissionDate).toLocaleDateString('en-IN') : '—'}
        />
        {guest.kycRejectReason ? <DetailRow label="Previous rejection" value={guest.kycRejectReason} /> : null}
      </ScrollView>

      {/* The gesture strip sits ON TOP of an edge-to-edge window, so a flat padding leaves
          these buttons under it and the system eats taps near the bottom. */}
      {!decided ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Row gap={10}>
            <Btn
              onPress={() => setRejecting(true)}
              disabled={busy}
              containerColor={Colors.surfaceMuted}
              textColor={Colors.danger}
              borderRadius={Radii.control}
              height={48}
              style={{ flex: 1 }}
            >
              <Txt variant="button" color={Colors.danger}>Reject</Txt>
            </Btn>
            <Btn
              onPress={approve}
              disabled={busy}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Radii.control}
              height={48}
              style={{ flex: 1.4 }}
            >
              <Txt variant="button" color={Colors.textInverse}>{busy ? 'Saving…' : 'Approve'}</Txt>
            </Btn>
          </Row>
        </View>
      ) : null}

      <PGowDialog
        visible={rejecting}
        title="Reject these documents"
        message={`${guest.name} sees this reason and re-uploads against it.`}
        confirmLabel="Reject"
        tone="destructive"
        busy={busy}
        prompt={{
          label: 'Reason',
          placeholder: 'The ID photo is cropped — please re-upload the full card',
          required: true,
          requiredMessage: 'Say what is wrong, so they can fix it.' }}
        onConfirm={reject}
        onCancel={() => setRejecting(false)}
        testID="kyc_reject"
      />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="center" style={styles.detailRow}>
      <Txt variant="body" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="body" weight="600" color={Colors.textPrimary} style={styles.detailValue} numberOfLines={3}>{value}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 32 },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8 },
  hr: { height: 1, backgroundColor: Colors.separator, marginBottom: 4 },
  detailRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  detailValue: { flex: 1, textAlign: 'right', marginLeft: 16 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.canvas } });
