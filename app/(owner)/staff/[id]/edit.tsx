/**
 * Edit staff — the form that used to be the third bottom sheet in the directory's stack.
 *
 * Eight controls behind a keyboard, in a panel that had to pin its own footer and manage its
 * own scroll. At a 1.3 font scale the fixed-height sheet squeezed the body against that
 * footer, which is the failure mode a form screen does not have. `FormScroll` handles the
 * keyboard here the same way the Sheet did, but with the whole viewport to do it in.
 *
 * Same group structure as Add Staff, so the two forms read as one thing: one control per row,
 * chips that wrap, named sections.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { FormScroll } from '@/components/ui/FormScroll';
import {
  Btn, ChoiceChips, ErrorState, LoadingState, PGowDialog, Spacer, Txt } from '@/components/ui';
import { useStaffMember, useUpdateStaffMutation } from '@/features/staff/useStaff';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  manager: 'Manager',
  chef: 'Chef',
  kitchen_staff: 'Kitchen Staff',
  maintenance: 'Maintenance Staff',
  delivery_agent: 'Delivery Agent' };

const AVAILABLE_ROLES = ['Manager', 'Chef', 'Kitchen Staff', 'Maintenance Staff', 'Delivery Agent'];
const SHIFT_OPTIONS = ['Day Shift (8 AM - 5 PM)', 'Night Shift (8 PM - 5 AM)', 'Part Time (9 AM - 1 PM)'];

/** Display label → the enum the server takes. Carried over verbatim from the sheet. */
const ROLE_MAP: Record<string, string> = {
  Manager: 'manager',
  Chef: 'chef',
  'Kitchen Staff': 'kitchen_staff',
  'Maintenance Staff': 'maintenance',
  // Its own role, not 'maintenance': a delivery agent gets the trips dashboard, and mapping
  // it onto maintenance would put them on the chef screens instead.
  'Delivery Agent': 'delivery_agent' };

/** Label text; `shift_start`/`shift_end` are SQL `time` columns and must be sent as a pair. */
const SHIFT_TIMES: Record<string, { shift_start: string; shift_end: string }> = {
  'Day Shift (8 AM - 5 PM)': { shift_start: '08:00:00', shift_end: '17:00:00' },
  'Night Shift (8 PM - 5 AM)': { shift_start: '20:00:00', shift_end: '05:00:00' },
  'Part Time (9 AM - 1 PM)': { shift_start: '09:00:00', shift_end: '13:00:00' } };

/** `mappers.toStaff` renders a saved shift as "08:00 - 17:00", which is not a picker label. */
function shiftLabelFor(shiftTime: string): string {
  const match = Object.entries(SHIFT_TIMES).find(
    ([, t]) => `${t.shift_start.slice(0, 5)} - ${t.shift_end.slice(0, 5)}` === shiftTime
  );
  return match?.[0] ?? SHIFT_OPTIONS[0];
}

export default function EditStaffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const activePgId = useAuthStore((s) => s.activePgId);
  const isManager = useIsManagerMode();
  const toast = useToast();

  const { member, isLoading, error, refetch } = useStaffMember(id);
  const updateStaff = useUpdateStaffMutation(activePgId ?? undefined);

  // Seeded once from the record; `undefined` means "not touched yet, use the record's value".
  const [name, setName] = useState<string | undefined>();
  const [role, setRole] = useState<string | undefined>();
  const [shift, setShift] = useState<string | undefined>();
  const [salary, setSalary] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const seeded = useMemo(
    () =>
      member
        ? {
            name: member.name,
            role: ROLE_DISPLAY_NAMES[member.role] ?? 'Kitchen Staff',
            shift: shiftLabelFor(member.shiftTime),
            salary: String(Math.round(member.monthlySalary || 0)),
          }
        : null,
    [member]
  );

  // D-06: appointing a manager is owner-only, so a manager must not see "Manager" as an
  // option they can select and then be refused at the server.
  const selectableRoles = isManager ? AVAILABLE_ROLES.filter((r) => r !== 'Manager') : AVAILABLE_ROLES;

  if (isLoading) return <Frame><LoadingState label="Loading this staff member…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this staff member" onRetry={refetch} /></Frame>;
  if (!member || !seeded) {
    return (
      <Frame>
        <ErrorState
          title="This staff member is no longer in this PG"
          error={new Error('They may have been removed since this screen was opened.')}
        />
      </Frame>
    );
  }

  const v = {
    name: name ?? seeded.name,
    role: role ?? seeded.role,
    shift: shift ?? seeded.shift,
    salary: salary ?? seeded.salary };

  const dirty =
    v.name !== seeded.name || v.role !== seeded.role || v.shift !== seeded.shift || v.salary !== seeded.salary;

  const leave = () => {
    if (dirty) { setConfirmDiscard(true); return; }
    router.back();
  };

  const save = async () => {
    if (!v.name.trim()) {
      setNameError('Enter their name');
      return;
    }
    setBusy(true);
    try {
      const mappedRole = ROLE_MAP[v.role];
      const shiftTimes = SHIFT_TIMES[v.shift];
      await updateStaff.mutateAsync({
        membershipId: member.id,
        params: {
          name: v.name.trim(),
          // No fallback role: silently saving the wrong one is worse than leaving it alone.
          ...(mappedRole ? { role: mappedRole as never } : {}),
          monthly_salary: parseFloat(v.salary) || undefined,
          ...(shiftTimes ?? {}),
        },
      });
      toast('success', 'Saved', `${v.name.trim()}'s details were updated.`);
      router.back();
    } catch (e) {
      toast('error', 'Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <AppHeader title="Edit staff" subtitle={seeded.name} onBack={leave} />

      <FormScroll contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>WHO THEY ARE</Txt>
        <OutlinedTextField
          label="Full Name *"
          value={v.name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(undefined); }}
          error={nameError}
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Phone Number"
          value={member.phone}
          onChangeText={() => {}}
          editable={false}
          helper="Changing a phone number changes how they sign in — reset their PIN instead."
        />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>THEIR ROLE</Txt>
        <ChoiceChips label="Staff role" options={selectableRoles} value={v.role} onChange={setRole} columns={2} />
        <Spacer size={14} />
        <ChoiceChips
          label="Shift"
          options={SHIFT_OPTIONS}
          value={v.shift}
          onChange={setShift}
          render={(o) => o.replace(' Shift', '').split(' ')[0]}
          columns={3}
        />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>PAY</Txt>
        <OutlinedTextField
          label="Monthly Salary (₹)"
          value={v.salary}
          onChangeText={(t) => setSalary(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
        />
      </FormScroll>

      {/* The gesture strip sits ON TOP of an edge-to-edge window, so a flat padding
          leaves this button under it and the system eats taps near the bottom. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Btn
          onPress={save}
          disabled={!dirty || busy}
          containerColor={dirty ? Colors.primary : Colors.surfaceMuted}
          textColor={dirty ? Colors.textInverse : Colors.textMuted}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
        >
          <Txt variant="button" color={dirty ? Colors.textInverse : Colors.textMuted}>
            {busy ? 'Saving…' : 'Save changes'}
          </Txt>
        </Btn>
      </View>

      <PGowDialog
        visible={confirmDiscard}
        title="Discard changes?"
        message="Your edits to this staff member will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => { setConfirmDiscard(false); router.back(); }}
        onCancel={() => setConfirmDiscard(false)}
        testID="staff_edit_discard"
      />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 32 },
  group: { letterSpacing: 0.6, marginBottom: 10 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.canvas } });
