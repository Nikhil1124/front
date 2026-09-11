/**
 * Register a new property.
 *
 * Seven controls, a nested full-screen map picker, and a submit that creates a billable
 * entity — that is a form screen, not a panel. It was a Sheet whose body had no scroller of
 * its own, relying on the sheet's internal one, while a full-screen Modal for the map picker
 * was already layered on top of it.
 *
 * The map picker stays a Modal: a device-capability surface that needs the whole screen is
 * one of the two cases where a modal over a screen is right.
 */
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import { FormScroll } from '@/components/ui/FormScroll';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Btn, PGowDialog, Row, Spacer, Txt } from '@/components/ui';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';

export default function NewPropertyScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const createPG = usePGowStore((s) => s.createPGProperty);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  // Neither of these ships a prefilled value. '36' beds drives the property's credit limit
  // and billing, and a PIN nobody chose is a PIN everybody can guess.
  const [totalBeds, setTotalBeds] = useState('');
  const [mgrName, setMgrName] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrPin, setMgrPin] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string; beds?: string; location?: string }>({});

  const dirty = !!(name || address || totalBeds || mgrName || mgrPhone || mgrPin || location);

  const leave = () => { if (dirty) { setDiscarding(true); return; } router.back(); };

  const save = async () => {
    const beds = parseInt(totalBeds, 10);
    const bedsInvalid = !Number.isFinite(beds) || beds <= 0;
    const found = {
      name: name.trim() ? undefined : 'Name the property',
      address: address.trim() ? undefined : 'Enter the property address',
      beds: bedsInvalid ? 'Enter how many beds this PG has' : undefined,
      // Was an Alert.alert — a popup describing which of the fields behind it is empty.
      location: location ? undefined : 'Pin the property on the map',
    };
    setErrors(found);
    if (found.name || found.address || found.beds || found.location) return;

    setBusy(true);
    // No UPI field on this form — left unset rather than fabricating a handle that would be
    // persisted as this property's real payment account. Configure it via UPI Settings.
    const result = await createPG(name, address, beds, mgrName, mgrPhone, mgrPin, '', location!);
    setBusy(false);
    if (result.ok) {
      toast('success', 'Property created', `${name.trim()} is set up with ${beds} beds.`);
      router.back();
    } else {
      toast('error', 'Could not create property', result.error ?? 'Nothing was saved.');
    }
  };

  if (picking) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent>
        <View style={{ flex: 1 }} accessibilityViewIsModal>
          <LocationPicker
            onCancel={() => setPicking(false)}
            initial={location}
            onConfirm={(picked) => {
              setLocation(picked);
              setErrors((e) => ({ ...e, location: undefined }));
              setPicking(false);
            }}
          />
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title="New property" subtitle="Branches, floors, rooms & capacity" onBack={leave} />

      <FormScroll contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>THE PROPERTY</Txt>
        <OutlinedTextField
          label="Property / PG Name *"
          placeholder="Koramangala Executive Hub"
          value={name}
          onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
          error={errors.name}
        />
        <Spacer size={12} />
        <AddressAutocompleteField
          label="Property Address *"
          value={address}
          onChangeText={(v) => { setAddress(v); if (errors.address) setErrors((e) => ({ ...e, address: undefined })); }}
          error={errors.address}
          onLocationResolved={(loc) => { if (!location) setLocation(loc); }}
        />
        <Spacer size={12} />
        <LocationField value={location} onPress={() => setPicking(true)} />
        {errors.location ? (
          <Row gap={4} align="center" style={{ marginTop: 6 }}>
            <Ionicons name="alert-circle" size={13} color={Colors.danger} />
            <Txt variant="meta" color={Colors.danger}>{errors.location}</Txt>
          </Row>
        ) : null}
        <Spacer size={12} />
        <OutlinedTextField
          label="Total Bed Capacity *"
          placeholder="e.g. 24"
          value={totalBeds}
          onChangeText={(v) => { setTotalBeds(v.replace(/\D/g, '')); if (errors.beds) setErrors((e) => ({ ...e, beds: undefined })); }}
          error={errors.beds}
          keyboardType="number-pad"
        />

        <Spacer size={22} />
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.group}>PRIMARY MANAGER</Txt>
        <OutlinedTextField label="Manager Name" placeholder="Ramesh Kumar" value={mgrName} onChangeText={setMgrName} />
        <Spacer size={12} />
        <OutlinedTextField
          label="Manager Phone"
          placeholder="10-digit mobile"
          value={mgrPhone}
          onChangeText={(v) => setMgrPhone(v.replace(/\D/g, '').slice(0, 10))}
          keyboardType="phone-pad"
        />
        <Spacer size={12} />
        <OutlinedTextField
          label="Manager Login PIN"
          placeholder="4-digit PIN"
          value={mgrPin}
          onChangeText={(v) => setMgrPin(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          helper="They sign in with their phone number and this PIN."
        />
      </FormScroll>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Btn
          onPress={save}
          disabled={busy}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
        >
          <Txt variant="button" color={Colors.textInverse}>{busy ? 'Creating…' : 'Create property'}</Txt>
        </Btn>
      </View>

      <PGowDialog
        visible={discarding}
        title="Discard this property?"
        message="Nothing you have entered will be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => { setDiscarding(false); router.back(); }}
        onCancel={() => setDiscarding(false)}
        testID="new_property_discard"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 32 },
  group: { letterSpacing: 0.6, marginBottom: 10 },
  footer: { paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.canvas } });
