/**
 * Staff detail — one staff member's record, as a destination.
 *
 * Replaces two of the three bottom sheets the directory used to stack. The old path was
 * row → action-menu Sheet → profile Sheet → edit Sheet → Alert: four modal layers to change
 * someone's shift, each with its own close affordance, and Android back unwound them one at
 * a time with nothing on screen saying how deep you were.
 *
 * The action menu is gone entirely rather than rebuilt as an action sheet. Its three items
 * each had a better home once this screen existed: View became the row tap, Edit is a header
 * action, Delete is in the overflow beside Reset PIN. A menu whose only job was to choose
 * between a screen and a form is a layer the screen itself removes.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppHeader, HeaderChip } from '@/components/AppHeader';
import {
  Col, ErrorState, LoadingState, PGowActionSheet, PGowDialog,
  Row, Spacer, StatusChip, Txt, type PGowAction } from '@/components/ui';
import { resetStaffCredentials, useStaffMember, useRemoveStaffMutation } from '@/features/staff/useStaff';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  manager: 'Manager',
  chef: 'Chef',
  kitchen_staff: 'Kitchen Staff',
  maintenance: 'Maintenance Staff',
  delivery_agent: 'Delivery Agent' };

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const isManager = useIsManagerMode();
  const toast = useToast();

  const { member, isLoading, error, refetch } = useStaffMember(id);
  const removeStaff = useRemoveStaffMutation(activePgId ?? undefined);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetPin, setResetPin] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Frame><LoadingState label="Loading this staff member…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this staff member" onRetry={refetch} /></Frame>;
  if (!member) {
    return (
      <Frame>
        <ErrorState
          title="This staff member is no longer in this PG"
          error={new Error('They may have been removed since this screen was opened.')}
        />
      </Frame>
    );
  }

  const roleLabel = ROLE_DISPLAY_NAMES[member.role] ?? member.role;

  // D-06 on the server: appointing or removing a manager is owner-only, so a manager may not
  // delete a peer manager. Hiding it beats surfacing a button that answers 403.
  const canDelete = !(isManager && member.role === 'manager');

  const overflowActions: PGowAction[] = [
    { label: 'Reset login PIN', icon: 'key-outline', onPress: () => setResetPin(true) },
    ...(canDelete
      ? [{ label: `Delete ${member.name}`, icon: 'trash-outline' as const, destructive: true, onPress: () => setConfirmDelete(true) }]
      : []),
  ];

  const handleDelete = async () => {
    setBusy(true);
    try {
      await removeStaff.mutateAsync(member.id);
      setConfirmDelete(false);
      toast('success', 'Staff removed', `${member.name} no longer has access to this PG.`);
      // Back to the directory, not to a detail screen for a record that no longer exists.
      router.back();
    } catch (e) {
      setConfirmDelete(false);
      toast('error', 'Could not remove', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPin = async (pin: string) => {
    if (!/^\d{4}$/.test(pin)) {
      toast('error', 'PIN must be 4 digits', 'Enter exactly four numbers.');
      return;
    }
    setBusy(true);
    try {
      await resetStaffCredentials(member.id, { pin });
      setResetPin(false);
      toast('success', 'PIN reset', `${member.name} can sign in with the new PIN.`);
    } catch (e) {
      toast('error', 'Could not reset PIN', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <AppHeader
        title={member.name}
        subtitle={roleLabel}
        onBack={() => router.back()}
        actions={
          <>
            <HeaderChip
              icon="create-outline"
              label={`Edit ${member.name}`}
              onPress={() => router.push(`/(owner)/staff/${member.id}/edit` as never)}
            />
            <HeaderChip icon="ellipsis-vertical" label="More actions" onPress={() => setOverflowOpen(true)} />
          </>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* L2 — what the reader opened this screen for. */}
        <Row justify="space-between" align="center">
          <Col>
            <Txt variant="meta" color={Colors.textMuted}>Role</Txt>
            <Txt variant="statValue" color={Colors.textPrimary}>{roleLabel}</Txt>
          </Col>
          <StatusChip label="Active" tone="ok" />
        </Row>

        <Section title="Personal details">
          <DetailRow label="Name" value={member.name} />
          <DetailRow label="Phone" value={member.phone || '—'} />
        </Section>

        <Section title="Work details">
          <DetailRow label="Assigned role" value={roleLabel} />
          <DetailRow label="Shift" value={member.shiftTime || 'Day Shift'} />
          <DetailRow
            label="Monthly salary"
            value={member.monthlySalary ? `₹${member.monthlySalary.toLocaleString('en-IN')}` : '—'}
          />
        </Section>

        <Section title="Account access">
          <DetailRow label="Account status" value="Active" />
          <DetailRow label="Login PIN" value="••••" />
        </Section>
      </ScrollView>

      <PGowActionSheet
        visible={overflowOpen}
        title={member.name}
        actions={overflowActions}
        onDismiss={() => setOverflowOpen(false)}
        testID="staff_overflow"
      />

      <PGowDialog
        visible={confirmDelete}
        title={`Delete ${member.name}?`}
        message="This removes their login and their access to this PG. It cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        testID="staff_delete"
      />

      <PGowDialog
        visible={resetPin}
        title="Reset login PIN"
        message={`${member.name} will need the new PIN to sign in.`}
        confirmLabel="Reset PIN"
        busy={busy}
        prompt={{ label: 'New 4-digit PIN', placeholder: '0000', required: true, requiredMessage: 'Enter a 4-digit PIN.' }}
        onConfirm={handleResetPin}
        onCancel={() => setResetPin(false)}
        testID="staff_reset_pin"
      />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

/** Hairline-separated group. Deliberately not a Card — the screen is already the container. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Spacer size={22} />
      <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.sectionLabel}>
        {title.toUpperCase()}
      </Txt>
      <View style={styles.hr} />
      {children}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="center" style={styles.detailRow}>
      <Txt variant="body" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="body" weight="600" color={Colors.textPrimary} style={styles.detailValue} numberOfLines={1}>
        {value}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 48 },
  headerBtn: { padding: 8, borderRadius: Radii.control },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8 },
  hr: { height: 1, backgroundColor: Colors.separator, marginBottom: 4 },
  detailRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  detailValue: { flex: 1, textAlign: 'right', marginLeft: 16 } });
