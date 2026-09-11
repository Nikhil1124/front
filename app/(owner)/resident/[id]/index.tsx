/**
 * Resident detail — the owner's single view of one resident.
 *
 * Was the tallest sheet in the app: a 3/4-height panel carrying five sections, three
 * equal-weight top buttons (Edit, Verify KYC, Delete — a destructive action given the same
 * visual weight as the other two), and no way to link to it. A rent-overdue push naming a
 * resident could not open that resident, because the record had no address.
 *
 * Edit is a header action, KYC review is its own route reached from the section that
 * describes it, and Delete moved into the overflow where a destructive action belongs.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppHeader, HeaderChip } from '@/components/AppHeader';
import {
  Btn, Col, ErrorState, LoadingState, PGowActionSheet, PGowDialog,
  Row, Spacer, StatusChip, Txt, toneFor, type PGowAction } from '@/components/ui';
import { useGuest, useRemoveGuestMutation } from '@/features/guests/useGuests';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { formatINR } from '@/utils/format';
import { Colors, Radii } from '@/theme';

export default function ResidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const toast = useToast();

  const { guest, isLoading, error, refetch } = useGuest(id);
  const removeGuest = useRemoveGuestMutation(activePgId ?? undefined);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Frame><LoadingState label="Loading this resident…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this resident" onRetry={refetch} /></Frame>;
  if (!guest) {
    return (
      <Frame>
        <ErrorState
          title="This resident is no longer in this PG"
          error={new Error('They may have been removed since this screen was opened.')}
        />
      </Frame>
    );
  }

  const overflowActions: PGowAction[] = [
    { label: 'Review KYC documents', icon: 'shield-checkmark-outline', onPress: () => router.push(`/(owner)/resident/${guest.id}/kyc` as never) },
    { label: `Remove ${guest.name}`, icon: 'person-remove-outline', destructive: true, onPress: () => setConfirmRemove(true) },
  ];

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeGuest.mutateAsync(guest.id);
      setConfirmRemove(false);
      toast('success', 'Resident removed', `${guest.name} is no longer on this property.`);
      router.back();
    } catch (e) {
      setConfirmRemove(false);
      toast('error', 'Could not remove', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <AppHeader
        title={guest.name}
        subtitle={guest.roomNo ? `Room ${guest.roomNo}` : undefined}
        onBack={() => router.back()}
        actions={
          <>
            <HeaderChip
              icon="create-outline"
              label={`Edit ${guest.name}`}
              onPress={() => router.push(`/(owner)/resident/${guest.id}/edit` as never)}
            />
            <HeaderChip icon="ellipsis-vertical" label="More actions" onPress={() => setOverflowOpen(true)} />
          </>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* L2 — the reason an owner opens this screen: have they paid? */}
        <Row justify="space-between" align="center">
          <Col>
            <Txt variant="meta" color={Colors.textMuted}>{guest.isBillPaid ? 'Rent status' : 'Rent due'}</Txt>
            <Txt variant="statValue" color={guest.isBillPaid ? Colors.success : Colors.warning}>
              {guest.isBillPaid ? 'Paid' : formatINR(guest.rentAmount)}
            </Txt>
          </Col>
          <StatusChip label={kycLabel(guest.kycStatus)} tone={toneFor(guest.kycStatus)} />
        </Row>

        <Section title="Room & contact">
          <DetailRow label="Room" value={guest.roomNo || '—'} />
          <DetailRow label="Phone" value={guest.phone || '—'} />
          <DetailRow label="Email" value={guest.email || '—'} />
        </Section>

        <Section title="Payment status">
          <DetailRow label="Monthly rent" value={formatINR(guest.rentAmount)} />
          <DetailRow label="This cycle" value={guest.isBillPaid ? 'Paid' : 'Unpaid'} />
        </Section>

        <Section title="KYC verification">
          <DetailRow label="Status" value={kycLabel(guest.kycStatus)} />
          <DetailRow label="ID type" value={guest.idProofType || '—'} />
          {guest.kycRejectReason ? <DetailRow label="Rejection reason" value={guest.kycRejectReason} /> : null}
          <Spacer size={12} />
          <Btn
            onPress={() => router.push(`/(owner)/resident/${guest.id}/kyc` as never)}
            containerColor={Colors.surfaceMuted}
            textColor={Colors.textPrimary}
            borderRadius={Radii.control}
            height={44}
            style={{ width: '100%' }}
          >
            <Txt variant="button" color={Colors.textPrimary}>Review documents</Txt>
          </Btn>
        </Section>

        <Section title="Stay">
          <DetailRow label="Joined" value={guest.registrationDate ? new Date(guest.registrationDate).toLocaleDateString('en-IN') : '—'} />
          <DetailRow label="Reward points" value={String(guest.rewardPoints ?? 0)} />
        </Section>
      </ScrollView>

      <PGowActionSheet
        visible={overflowOpen}
        title={guest.name}
        actions={overflowActions}
        onDismiss={() => setOverflowOpen(false)}
        testID="resident_overflow"
      />

      <PGowDialog
        visible={confirmRemove}
        title={`Remove ${guest.name}?`}
        message="This takes them off the property and frees their bed. It cannot be undone."
        confirmLabel="Remove"
        tone="destructive"
        busy={busy}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        testID="resident_remove"
      />
    </Frame>
  );
}

function kycLabel(status: string): string {
  switch (status) {
    case 'VERIFIED': return 'Verified';
    case 'PENDING': return 'Pending review';
    case 'REJECTED': return 'Rejected';
    default: return 'Not submitted';
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

/** Hairline-separated group — not a Card. The screen is already the container. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Spacer size={22} />
      <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.sectionLabel}>{title.toUpperCase()}</Txt>
      <View style={styles.hr} />
      {children}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="center" style={styles.detailRow}>
      <Txt variant="body" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="body" weight="600" color={Colors.textPrimary} style={styles.detailValue} numberOfLines={2}>{value}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 48 },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8 },
  hr: { height: 1, backgroundColor: Colors.separator, marginBottom: 4 },
  detailRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  detailValue: { flex: 1, textAlign: 'right', marginLeft: 16 } });
