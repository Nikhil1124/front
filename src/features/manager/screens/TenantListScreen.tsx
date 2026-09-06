/**
 * TenantListScreen — Manager drill-down for tenant management + KYC decisions.
 *
 * Hub-and-Spoke:
 *   Reached from the Manager dashboard's "👥 Tenant Management" action tile.
 *
 * Bug #2 fix (KYC Verification Sync — manager side):
 *   The spec calls for a 1-tap "Verify KYC" or "Reject KYC" button that
 *   calls POST /v1/kyc/{id}/decision. The store's `verifyGuestKycByOwner`
 *   already exists and now invalidates the React Query cache (qk.kyc,
 *   qk.guests, qk.session) — so a manager's decision here propagates to
 *   both the resident's UI and any other screen reading KYC state without
 *   a manual refresh.
 *
 *   The Reject flow opens a small inline prompt asking for the reason —
 *   without that, residents just see "Rejected" with no context, which is
 *   the exact UX gap the spec called out.
 *
 * Cyber Mint:
 *   - HubScreenWrapper for the sticky back header.
 *   - Tenant rows are surface cards with KYC status pills colour-coded
 *     (verified=green, pending=amber, rejected=red, none=slate).
 *   - The triage counts at the top are a `MetricDeck` — was three cards with a `${color}66`
 *     opacity-hack border and no "not submitted" count at all, the one number a manager
 *     chasing compliance actually needs and this screen never showed.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Pressable, FlatList } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Radii } from '@/theme';
import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';
import { useResponsivePadding } from '@/utils/responsive';
import { usePGowStore } from '@/store/usePGowStore';
import type { GuestEntity } from '@/types';

/** The KYC states, as words. Colour is `StatusChip`'s job now — this was the ninth place in
 *  the app inventing its own pill palette. */
const KYC_LABEL: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  NOT_SUBMITTED: 'Not submitted' };

import { useGuestsQuery } from '@/features/guests/useGuests';
import { useAuthStore } from '@/store/authStore';

import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { Btn, Card, Col, ErrorState, LoadingState, MetricDeck, Row, Spacer, StatusChip, Txt, initialsOf, toneFor, type DeckCardData } from '@/components/ui';

export function TenantListScreen() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const sidePadding = useResponsivePadding();
  const { data: guests = [], isLoading: guestsLoading, error: guestsError, refetch, isRefetching } = useGuestsQuery(activePgId ?? undefined);
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);

  const [rejectGuestId, setRejectGuestId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleVerify = (guest: GuestEntity) => {
    Alert.alert(
      'Verify KYC',
      `Approve ${guest.name}'s KYC submission? They will be notified immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            setSubmittingId(guest.id);
            const r = await verifyKyc(guest.id, true);
            setSubmittingId(null);
            if (!r.ok) Alert.alert('Failed', r.error ?? 'Could not verify.');
          } },
      ],
    );
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectGuestId) return;
    setSubmittingId(rejectGuestId);
    const r = await verifyKyc(rejectGuestId, false, reason);
    setSubmittingId(null);
    if (r.ok) setRejectGuestId(null);
    else Alert.alert('Failed', r.error ?? 'Could not reject.');
  };

  const pending = guests.filter((g) => g.kycStatus === 'PENDING');
  const rejected = guests.filter((g) => g.kycStatus === 'REJECTED');
  const verified = guests.filter((g) => g.kycStatus === 'VERIFIED');
  // Not shown anywhere on this screen before — residents who haven't submitted at all were
  // invisible between "pending" (submitted, waiting) and the roster total. A manager chasing
  // compliance needs this count as much as the pending queue.
  const notSubmitted = guests.filter((g) => !g.kycStatus || g.kycStatus === 'NOT_SUBMITTED');

  const deckCards: DeckCardData[] = [
    { key: 'pending', tint: 'brand', label: 'Awaiting your decision', value: String(pending.length) },
    { key: 'not_submitted', tint: 'amber', label: 'Not submitted', value: String(notSubmitted.length) },
    { key: 'rejected', tint: 'slate', label: 'Rejected', value: String(rejected.length) },
    { key: 'verified', tint: 'green', label: 'Verified', value: String(verified.length) },
  ];

  return (
    <HubScreenWrapper
      title="Tenant Management"
      subtitle={`${guests.length} residents • ${pending.length} pending KYC`}
      icon="people-outline"
      scrollable={false}
    >
      {/* Roster can run to ~200 residents (refreshAll fetches up to 200) — FlatList instead of
          `.map()` in a ScrollView so only the visible rows mount. */}
      <FlatList
        style={{ flex: 1 }}
        data={guests}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListHeaderComponent={
          <View>
            <MetricDeck cards={deckCards} sidePadding={sidePadding} testID="tenant_kyc_deck" />
            <Spacer size={20} />
          </View>
        }
        ListEmptyComponent={
          <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[20, 20]}>
            {guestsLoading ? (
              <LoadingState label="Loading tenants…" fill={false} />
            ) : guestsError ? (
              <ErrorState error={guestsError} title="Could not load tenants" onRetry={refetch} fill={false} />
            ) : (
              <Col align="center">
                <Ionicons name="people-outline" size={42} color={Colors.textMuted} />
                <Spacer size={10} />
                <Txt size={14} weight="700" color={Colors.textPrimary}>No tenants yet</Txt>
                <Txt size={12} color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>
                  Tenants will appear here once they join via the property's join code.
                </Txt>
              </Col>
            )}
          </Card>
        }
        renderItem={({ item: g }) => {
          const kycLabel = KYC_LABEL[g.kycStatus ?? ''] ?? 'Not submitted';
          const canDecide = g.kycStatus === 'PENDING' || g.kycStatus === 'REJECTED';
          const isExpanded = expandedId === g.id || canDecide;

          return (
            <Card
              containerColor={Colors.surface}
              borderRadius={Radii.card}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[14, 14]}
            >
              <Pressable accessibilityRole="button" onPress={() => setExpandedId(isExpanded ? null : g.id)}>
                <Row gap={12} align="center">
                  <View style={styles.avatar}>
                    <Txt size={13} weight="700" color={Colors.primary}>{initialsOf(g.name ?? '?')}</Txt>
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={14} weight="700" color={Colors.textPrimary}>{g.name}</Txt>
                    <Txt size={11} color={Colors.textMuted}>Room {g.roomNo || '—'} • {g.phone || 'No phone'}</Txt>
                  </Col>
                  <StatusChip label={kycLabel} tone={toneFor(g.kycStatus)} />
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                </Row>
              </Pressable>

              {/* KYC Document Photos Preview — visible when expanded or pending */}
              {isExpanded && (
                <View style={{ marginTop: 12 }}>
                  <Txt size={11} weight="700" color={Colors.textMuted} style={{ marginBottom: 6 }}>
                    SUBMITTED KYC DOCUMENTS
                  </Txt>
                  <KycDocumentsCard
                    idPhotoUri={g.idProofPhotoUri}
                    selfieUri={g.profilePhotoUri}
                    emptyHint="No KYC documents uploaded yet."
                  />
                </View>
              )}

              {/* Action row — visible only when there's a decision to make */}
              {canDecide ? (
                <Row gap={8} style={{ marginTop: 12 }}>
                  {g.kycStatus === 'PENDING' && (
                    <Btn
                      onPress={() => handleVerify(g)}
                      containerColor={Colors.success}
                      textColor={Colors.textInverse}
                      borderRadius={Radii.control}
                      height={36}
                      loading={submittingId === g.id}
                      style={{ flex: 1 }}
                      testID={`tenant_verify_${g.id}`}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                      <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Verify KYC</Txt>
                    </Btn>
                  )}
                  <Btn
                    onPress={() => setRejectGuestId(g.id)}
                    containerColor={Colors.danger}
                    textColor={Colors.textInverse}
                    borderRadius={Radii.control}
                    height={36}
                    style={{ flex: g.kycStatus === 'PENDING' ? undefined : 1 }}
                    testID={`tenant_reject_${g.id}`}
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.textInverse} />
                    <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>
                      {g.kycStatus === 'PENDING' ? 'Reject' : 'Re-reject'}
                    </Txt>
                  </Btn>
                </Row>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Centered, and the same dialog the notifications inbox uses to reject a payment —
          a confirmation that needs a sentence typed into it cannot be a native alert,
          because `Alert.prompt` is iOS-only. */}
      <TextPromptDialog
        visible={rejectGuestId !== null}
        title="Reject KYC submission"
        label="Reason for rejection"
        placeholder="Photo blurry — please retake"
        helper="The resident is asked to re-upload against this"
        confirmLabel="Reject"
        destructive
        required
        busy={!!submittingId}
        onCancel={() => setRejectGuestId(null)}
        onSave={handleRejectSubmit}
      />
</HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40, height: 40, borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center' }, });
