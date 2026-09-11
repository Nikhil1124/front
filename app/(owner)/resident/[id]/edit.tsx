/**
 * Edit resident — four editable fields, plus the two that deliberately are not.
 *
 * Phone is the login identity and the API's update payload has no field for it; password is
 * absent on purpose, because an owner who could set one could sign in as the resident and
 * read their payment history. Both are shown read-only with the reason, rather than omitted —
 * an owner looking for "change their number" should find out why they cannot, not wonder
 * whether the screen forgot it.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { FormScroll } from '@/components/ui/FormScroll';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { RoomPicker } from '@/components/ui/RoomPicker';
import { Btn, ErrorState, LoadingState, PGowDialog, Spacer, Txt } from '@/components/ui';
import { useGuest, useUpdateGuestMutation } from '@/features/guests/useGuests';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

export default function EditResidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const activePgId = useAuthStore((s) => s.activePgId);
  const toast = useToast();

  const { guest, isLoading, error, refetch } = useGuest(id);
  const updateGuest = useUpdateGuestMutation(activePgId ?? undefined);

  const [name, setName] = useState<string | undefined>();
  const [room, setRoom] = useState<string | undefined>();
  const [rent, setRent] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [rentError, setRentError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const seeded = useMemo(
    () => (guest
      ? { name: guest.name, room: guest.roomNo, rent: String(Math.round(guest.rentAmount || 0)), email: guest.email }
      : null),
    [guest]
  );

  if (isLoading) return <Frame><LoadingState label="Loading this resident…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this resident" onRetry={refetch} /></Frame>;
  if (!guest || !seeded) {
    return (
      <Frame>
        <ErrorState title="This resident is no longer in this PG" error={new Error('They may have been removed.')} />
      </Frame>
    );
  }

  const v = {
    name: name ?? seeded.name,
    room: room ?? seeded.room,
    rent: rent ?? seeded.rent,
    email: email ?? seeded.email };

  const dirty = v.name !== seeded.name || v.room !== seeded.room || v.rent !== seeded.rent || v.email !== seeded.email;

  const leave = () => { if (dirty) { setConfirmDiscard(true); return; } router.back(); };

  const save = async () => {
    if (!v.name.trim()) { setNameError('Enter their name'); return; }
    const parsedRent = parseFloat(v.rent);
    if (!Number.isFinite(parsedRent) || parsedRent <= 0) {
      setRentError('Enter the agreed monthly rent');
      return;
    }
    setBusy(true);
    try {
      await updateGuest.mutateAsync({
        membershipId: guest.id,
        params: {
          name: v.name.trim() || guest.name,
          email: v.email.trim().toLowerCase() || undefined,
          room_no: v.room.trim() || guest.roomNo,
          rent_amount: parsedRent } });
      toast('success', 'Saved', `${v.name.trim()}'s profile was updated.`);
      router.back();
    } catch (e) {
      toast('error', 'Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <AppHeader title="Edit resident" subtitle={seeded.name} onBack={leave} />

      <FormScroll contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>IDENTITY</Txt>
        <OutlinedTextField
          label="Resident Full Name *"
          value={v.name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(undefined); }}
          error={nameError}
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Email Address"
          value={v.email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>STAY &amp; ROOM</Txt>
        <RoomPicker pgId={activePgId} value={v.room} onChange={setRoom} label="Room *" />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>BILLING</Txt>
        <OutlinedTextField
          label="Monthly Rent Fee (₹) *"
          value={v.rent}
          onChangeText={(t) => { setRent(t.replace(/\D/g, '')); if (rentError) setRentError(undefined); }}
          keyboardType="number-pad"
          error={rentError}
        />

        <Spacer size={20} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>NOT EDITABLE HERE</Txt>
        <OutlinedTextField
          label="Phone Number"
          value={guest.phone}
          onChangeText={() => {}}
          editable={false}
          helper="This is how they sign in. The update API has no field for it."
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
        message="Your edits to this resident will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => { setConfirmDiscard(false); router.back(); }}
        onCancel={() => setConfirmDiscard(false)}
        testID="resident_edit_discard"
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
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.canvas } });
