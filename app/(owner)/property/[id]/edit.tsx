/**
 * Edit a property.
 *
 * Six controls in a 420px scroll window inside a sheet — the smallest space in the app for
 * the second-largest form in it. A form screen instead, with the same grouping as the create
 * form so the two read as one thing.
 *
 * The map picker stays a full-screen Modal, which is correct for a device-capability surface.
 */
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import { FormScroll } from '@/components/ui/FormScroll';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Btn, ErrorState, LoadingState, PGowDialog, Spacer, Txt } from '@/components/ui';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const updatePG = usePGowStore((s) => s.updatePGProperty);

  const { data: properties = [], isLoading, error, refetch } = usePropertiesEntitiesQuery();
  const pg = useMemo(() => properties.find((p) => p.id === id), [properties, id]);

  const [name, setName] = useState<string | undefined>();
  const [address, setAddress] = useState<string | undefined>();
  const [totalBeds, setTotalBeds] = useState<string | undefined>();
  const [mgrName, setMgrName] = useState<string | undefined>();
  const [mgrPhone, setMgrPhone] = useState<string | undefined>();
  const [mgrPin, setMgrPin] = useState<string | undefined>();
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  if (picking) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent>
        <View style={{ flex: 1 }} accessibilityViewIsModal>
          <LocationPicker
            onCancel={() => setPicking(false)}
            initial={location}
            onConfirm={(picked) => { setLocation(picked); setPicking(false); }}
          />
        </View>
      </Modal>
    );
  }

  if (isLoading) return <Frame><LoadingState label="Loading this property…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this property" onRetry={refetch} /></Frame>;
  if (!pg) {
    return (
      <Frame>
        <ErrorState title="This property no longer exists" error={new Error('It may have been removed.')} />
      </Frame>
    );
  }

  // `|| 36` used to sit on the bed count: a property whose stored count was 0/unknown opened
  // prefilled with 36, and saving — even with nothing else touched — wrote 36 back as if the
  // owner had stated it. Empty stays empty.
  const seeded = {
    name: pg.pgName, address: pg.address,
    totalBeds: pg.totalBeds ? String(pg.totalBeds) : '',
    mgrName: pg.managerName ?? '', mgrPhone: pg.managerPhone ?? '', mgrPin: pg.managerPin ?? '' };

  const v = {
    name: name ?? seeded.name, address: address ?? seeded.address,
    totalBeds: totalBeds ?? seeded.totalBeds, mgrName: mgrName ?? seeded.mgrName,
    mgrPhone: mgrPhone ?? seeded.mgrPhone, mgrPin: mgrPin ?? seeded.mgrPin };

  const dirty = !!location || (Object.keys(seeded) as (keyof typeof seeded)[]).some((k) => v[k] !== seeded[k]);

  const leave = () => { if (dirty) { setDiscarding(true); return; } router.back(); };

  const save = async () => {
    const found = {
      name: v.name.trim() ? undefined : 'Name the property',
      address: v.address.trim() ? undefined : 'Enter the property address' };
    setErrors(found);
    if (found.name || found.address) return;

    setBusy(true);
    const result = await updatePG(
      pg, v.name, v.address, parseInt(v.totalBeds, 10) || pg.totalBeds,
      v.mgrName, v.mgrPhone, v.mgrPin, pg.upiId, location,
    );
    setBusy(false);
    if (result.ok) {
      toast('success', 'Saved', `${v.name.trim()} was updated.`);
      router.back();
    } else {
      toast('error', 'Could not save', result.error ?? 'Nothing was changed.');
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Edit property" subtitle={seeded.name} onBack={leave} />

      <FormScroll contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>THE PROPERTY</Txt>
        <OutlinedTextField
          label="Property / PG Name *"
          value={v.name}
          onChangeText={(t) => { setName(t); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
          error={errors.name}
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Branch Location / Address *"
          value={v.address}
          onChangeText={(t) => { setAddress(t); if (errors.address) setErrors((e) => ({ ...e, address: undefined })); }}
          error={errors.address}
        />
        <Spacer size={12} />
        <LocationField value={location} onPress={() => setPicking(true)} />
        <Spacer size={12} />
        <OutlinedTextField
          label="Total Bed Capacity"
          value={v.totalBeds}
          onChangeText={(t) => setTotalBeds(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
        />

        <Spacer size={22} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>ASSIGNED MANAGER</Txt>
        <OutlinedTextField label="Manager Name" value={v.mgrName} onChangeText={setMgrName} />
        <Spacer size={12} />
        <OutlinedTextField
          label="Manager Phone Number"
          value={v.mgrPhone}
          onChangeText={(t) => setMgrPhone(t.replace(/\D/g, '').slice(0, 10))}
          keyboardType="phone-pad"
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Manager PIN"
          value={v.mgrPin}
          onChangeText={(t) => setMgrPin(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
        />
      </FormScroll>

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
        visible={discarding}
        title="Discard changes?"
        message="Your edits to this property will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => { setDiscarding(false); router.back(); }}
        onCancel={() => setDiscarding(false)}
        testID="edit_property_discard"
      />
    </View>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 32 },
  group: { letterSpacing: 0.6, marginBottom: 10 },
  footer: { paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.canvas } });
