/**
 * AddPgPropertyDialog — port of Kotlin `AddPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { Btn, OutlinedBtn, Row, Sheet, Txt } from '@/components/ui';



interface Props {
  onDismiss: () => void;
}

export function AddPgPropertyDialog({ onDismiss }: Props) {
  const createPG = usePGowStore((s) => s.createPGProperty);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  // Both of these used to ship a prefilled value — '36' beds and a '1234' manager PIN.
  // Neither is a safe thing to accept by default: the bed count drives the property's
  // credit limit and billing, and a PIN nobody chose is a PIN everybody can guess.
  const [totalBeds, setTotalBeds] = useState('');
  const [mgrName, setMgrName] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrPin, setMgrPin] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  const [bedsError, setBedsError] = useState<string | undefined>();

  const handleSave = async () => {
    const beds = parseInt(totalBeds, 10);
    const bedsInvalid = !Number.isFinite(beds) || beds <= 0;
    if (!name.trim() || !address.trim() || bedsInvalid) {
      setNameError(name.trim() ? undefined : 'Name the property');
      setAddressError(address.trim() ? undefined : 'Enter the property address');
      setBedsError(bedsInvalid ? 'Enter how many beds this PG has' : undefined);
      return;
    }
    if (!location) {
      Alert.alert('Location Required', 'Pin the property location on the map before saving.');
      return;
    }
    // No UPI field on this form — leave it unset rather than fabricating a handle that would
    // get persisted as this property's real payment account. Configure it via UPI Settings.
    const result = await createPG(
      name, address, beds,
      mgrName, mgrPhone, mgrPin, '', location,
    );
    if (result.ok) {
      Alert.alert('Success', `Property created with ${totalBeds} beds capacity!`);
      onDismiss();
    } else {
      Alert.alert('Failed', result.error ?? 'Unknown error');
    }
  };

  if (picking) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent>
        <LocationPicker
          onCancel={() => setPicking(false)}
          initial={location}
          onConfirm={(picked) => {
            setLocation(picked);
            if (picked.formatted_address && !address.trim()) {
              setAddress(picked.formatted_address);
            }
            setPicking(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Sheet
      visible
      title="Register New Property"
      subtitle="Set up branches, floors, rooms & capacity"
      onDismiss={onDismiss}
      testID="add_pg_property_dialog"
      footer={
        <Row gap={8}>
          <Btn
            onPress={handleSave}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.card}
            height={44}
            style={{ flex: 1 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Save Property</Txt>
          </Btn>
          <OutlinedBtn
            onPress={onDismiss}
            borderColor={Colors.borderSubtle}
            textColor={Colors.textPrimary}
            borderRadius={Radii.card}
            height={44}
            style={{ flex: 1 }}
          >
            <Txt variant="button" color={Colors.textPrimary}>Cancel</Txt>
          </OutlinedBtn>
        </Row>
      }
    >
      <View style={{ gap: 10 }}>
        <OutlinedTextField
          label="Property / PG Name *"
          placeholder="Koramangala Executive Hub"
          value={name}
          onChangeText={(v) => { setName(v); if (nameError) setNameError(undefined); }}
          error={nameError}
          containerColor={Colors.surfaceMuted}
          focusedBorderColor={Colors.primary}
          unfocusedBorderColor={Colors.borderSubtle}
        />
        <AddressAutocompleteField
          label="Property Address *"
          value={address}
          onChangeText={(v) => { setAddress(v); if (addressError) setAddressError(undefined); }}
          error={addressError}
          onLocationResolved={(loc) => {
            if (!location) setLocation(loc);
          }}
        />
        <LocationField value={location} onPress={() => setPicking(true)} />

        <OutlinedTextField
          label="Total Bed Capacity *"
          placeholder="e.g. 24"
          value={totalBeds}
          onChangeText={(v) => {
            setTotalBeds(v.replace(/\D/g, ''));
            if (bedsError) setBedsError(undefined);
          }}
          error={bedsError}
          keyboardType="number-pad"
          containerColor={Colors.surfaceMuted}
        />

        <View style={styles.sectionCard}>
          <Row align="center" gap={6} style={{ marginBottom: 6 }}>
            <Ionicons name="people" size={16} color={Colors.primary} />
            <Txt variant="cardTitle" color={Colors.textPrimary}>Assigned Primary Manager</Txt>
          </Row>
          <OutlinedTextField
            label="Manager Name"
            placeholder="Ramesh Kumar"
            value={mgrName}
            onChangeText={setMgrName}
            containerColor={Colors.surface}
            style={{ marginBottom: 8 }}
          />
          {/* One field per row, as in the staff form. Two inputs sharing a row halves the
              width you type a phone number into and squeezes "Login PIN" into a third of the
              sheet. */}
          <OutlinedTextField
            label="Manager Phone"
            placeholder="10-digit mobile"
            value={mgrPhone}
            onChangeText={setMgrPhone}
            keyboardType="phone-pad"
            containerColor={Colors.surface}
            style={{ marginBottom: 8 }}
          />
          <OutlinedTextField
            label="Login PIN"
            placeholder="4 digits"
            value={mgrPin}
            onChangeText={(v) => setMgrPin(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            containerColor={Colors.surface}
          />
          <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 4 }}>
            ℹ️ Up to 3 managers can be appointed to manage and allocate rooms.
          </Txt>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center', justifyContent: 'center' },
  headerIconBox: {
    width: 36, height: 36, borderRadius: Radii.control,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center' },
  sectionCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12 } });
