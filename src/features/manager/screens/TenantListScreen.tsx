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
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Pill } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { GuestEntity } from '@/types';

interface KycPillConfig { label: string; color: string; bg: string; }
function kycPill(status: string | undefined): KycPillConfig {
  switch (status) {
    case 'VERIFIED': return { label: 'Verified', color: Colors.success, bg: Colors.surfaceElevated };
    case 'PENDING':  return { label: 'Pending',  color: Colors.warning, bg: Colors.alertGradientStart };
    case 'REJECTED': return { label: 'Rejected',  color: Colors.danger,  bg: '#FEF2F2' };
    case 'NOT_SUBMITTED':
    default:          return { label: 'Not Submitted', color: Colors.textMuted, bg: Colors.surfaceMuted };
  }
}

export function TenantListScreen() {
  const guests = usePGowStore((s) => s.currentGuests);
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);

  const [rejectGuestId, setRejectGuestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
            if (r.ok) hapticSuccess();
            else { hapticError(); Alert.alert('Failed', r.error ?? 'Could not verify.'); }
          },
        },
      ],
    );
  };

  const handleRejectSubmit = async () => {
    if (!rejectGuestId) return;
    if (!rejectReason.trim()) {
      hapticError();
      Alert.alert('Reason required', 'Please provide a short reason for the rejection.');
      return;
    }
    setSubmittingId(rejectGuestId);
    const r = await verifyKyc(rejectGuestId, false, rejectReason.trim());
    setSubmittingId(null);
    if (r.ok) {
      hapticSuccess();
      setRejectGuestId(null);
      setRejectReason('');
    } else {
      hapticError();
      Alert.alert('Failed', r.error ?? 'Could not reject.');
    }
  };

  const pending = guests.filter((g) => g.kycStatus === 'PENDING');
  const rejected = guests.filter((g) => g.kycStatus === 'REJECTED');
  const verified = guests.filter((g) => g.kycStatus === 'VERIFIED');

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
        ListHeaderComponent={
          <View>
            {/* KYC Triage bar — surfaces the counts at a glance */}
            <Row gap={10}>
              <TriageTile label="Pending" count={pending.length} color={Colors.warning} />
              <TriageTile label="Rejected" count={rejected.length} color={Colors.danger} />
              <TriageTile label="Verified" count={verified.length} color={Colors.success} />
            </Row>
            <Spacer size={16} />
          </View>
        }
        ListEmptyComponent={
          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} padding={[20, 20]}>
            <Col align="center">
              <Ionicons name="people-outline" size={42} color={Colors.textMuted} />
              <Spacer size={10} />
              <Txt size={14} weight="700" color={Colors.textPrimary}>No tenants yet</Txt>
              <Txt size={12} color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>
                Tenants will appear here once they join via the property's join code.
              </Txt>
            </Col>
          </Card>
        }
        renderItem={({ item: g }) => {
          const pill = kycPill(g.kycStatus);
          const canDecide = g.kycStatus === 'PENDING' || g.kycStatus === 'REJECTED';
          return (
            <Card
              containerColor={Colors.surface}
              borderRadius={Layout.borderRadiusCard}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[14, 14]}
            >
              <Row gap={12} align="center">
                <View style={[styles.avatar, { backgroundColor: `${pill.color}1A` }]}>
                  <Txt size={14} weight="800" color={pill.color}>{(g.name ?? '?').slice(0, 1).toUpperCase()}</Txt>
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt size={14} weight="800" color={Colors.textPrimary}>{g.name}</Txt>
                  <Txt size={11} color={Colors.textMuted}>Room {g.roomNo || '—'} • {g.phone || 'No phone'}</Txt>
                </Col>
                <Pill label={pill.label} color={pill.color} bg={pill.bg} />
              </Row>

              {/* Action row — visible only when there's a decision to make */}
              {canDecide ? (
                <Row gap={8} style={{ marginTop: 12 }}>
                  {g.kycStatus === 'PENDING' && (
                    <Btn
                      onPress={() => handleVerify(g)}
                      containerColor={Colors.success}
                      textColor={Colors.textInverse}
                      borderRadius={Layout.borderRadiusButton}
                      height={36}
                      loading={submittingId === g.id}
                      style={{ flex: 1 }}
                      testID={`tenant_verify_${g.id}`}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                      <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Verify KYC</Txt>
                    </Btn>
                  )}
                  <OutlinedBtn
                    onPress={() => { hapticSelect(); setRejectGuestId(g.id); setRejectReason(''); }}
                    borderColor={Colors.danger}
                    textColor={Colors.danger}
                    borderRadius={Layout.borderRadiusButton}
                    height={36}
                    style={{ flex: g.kycStatus === 'PENDING' ? undefined : 1 }}
                    testID={`tenant_reject_${g.id}`}
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.danger} />
                    <Txt size={12} weight="700" color={Colors.danger} style={{ marginLeft: 6 }}>
                      {g.kycStatus === 'PENDING' ? 'Reject' : 'Re-reject'}
                    </Txt>
                  </OutlinedBtn>
                </Row>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Reject reason modal */}
      <Modal visible={rejectGuestId !== null} transparent animationType="fade" onRequestClose={() => setRejectGuestId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRejectGuestId(null)}>
          <Pressable onPress={() => {/* swallow */}} style={styles.rejectCardWrap}>
            <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
              <Row gap={8} align="center">
                <View style={styles.titleIconWrap}>
                  <Ionicons name="warning" size={20} color={Colors.danger} />
                </View>
                <Col>
                  <Txt size={16} weight="800" color={Colors.textPrimary}>Reject KYC Submission</Txt>
                  <Txt size={11} color={Colors.textMuted}>The resident will be asked to re-upload</Txt>
                </Col>
              </Row>
              <Spacer size={16} />
              <OutlinedTextField
                label="Reason for rejection *"
                placeholder="Photo blurry — please retake"
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                height={80}
                testID="tenant_reject_reason_input"
              />
              <Spacer size={14} />
              <Row gap={10}>
                <Btn
                  onPress={handleRejectSubmit}
                  containerColor={Colors.danger}
                  textColor={Colors.textInverse}
                  borderRadius={Layout.borderRadiusButton}
                  height={44}
                  loading={!!submittingId}
                  style={{ flex: 1 }}
                  testID="tenant_reject_submit_btn"
                >
                  <Ionicons name="close-circle" size={16} color={Colors.textInverse} />
                  <Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>Reject Submission</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setRejectGuestId(null)}
                  borderColor={Colors.borderMuted}
                  textColor={Colors.textSecondary}
                  borderRadius={Layout.borderRadiusButton}
                  height={44}
                >
                  <Txt size={13} weight="700" color={Colors.textSecondary}>Cancel</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </HubScreenWrapper>
  );
}

function TriageTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.triageTile, { borderColor: `${color}66` }]}>
      <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>{label.toUpperCase()}</Txt>
      <Txt size={18} weight="900" color={color} style={{ marginTop: 4 }}>{count}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  rejectCardWrap: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  titleIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  triageTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadiusCard,
    borderWidth: 1,
    padding: 12,
  },
});
