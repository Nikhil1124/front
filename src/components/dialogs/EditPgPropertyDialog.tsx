/**
 * EditPgPropertyDialog — port of Kotlin `EditPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import PropertyMap from '@/components/PropertyMap';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import type { PGOwnerEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';
import { Btn, Card, Col, OutlinedBtn, Row, Sheet, Txt } from '@/components/ui';

interface Props {
  pg: PGOwnerEntity;
  onDismiss: () => void;
}

export function EditPgPropertyDialog({ pg, onDismiss }: Props) {
  const updatePG = usePGowStore((s) => s.updatePGProperty);
  const [name, setName] = useState(pg.pgName);
  const [address, setAddress] = useState(pg.address);
  const [nameError, setNameError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  // `|| 36` used to sit here: a property whose stored bed count was 0/unknown opened this
  // form prefilled with 36, and saving — even with nothing else changed — wrote 36 back as
  // if the owner had stated it. Empty stays empty.
  const [totalBeds, setTotalBeds] = useState(pg.totalBeds ? String(pg.totalBeds) : '');
  const [mgrName, setMgrName] = useState(pg.managerName);
  const [mgrPhone, setMgrPhone] = useState(pg.managerPhone);
  const [mgrPin, setMgrPin] = useState(pg.managerPin);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      setNameError(name.trim() ? undefined : 'Name the property');
      setAddressError(address.trim() ? undefined : 'Enter the property address');
      return;
    }
    const result = await updatePG(
      pg, name, address, parseInt(totalBeds, 10) || pg.totalBeds,
      mgrName, mgrPhone, mgrPin, pg.upiId, location,
    );
    if (result.ok) {
      Alert.alert('Success', 'PG Branch updated successfully!');
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
          initial={
            location ??
            (pg.latitude && pg.longitude
              ? { latitude: Number(pg.latitude), longitude: Number(pg.longitude) }
              : null)
          }
          onConfirm={(picked) => {
            setLocation(picked);
            setPicking(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Sheet
      visible
      title="Edit Property Details"
      subtitle={pg.pgName}
      onDismiss={onDismiss}
      testID="edit_pg_property_dialog"
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
            <Txt variant="button" color={Colors.textInverse}>Update Branch</Txt>
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
      <Card
        containerColor={Colors.surface}
        borderRadius={Radii.sheet}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[20, 20]}
        style={{ width: '100%' }}
      >
        <Row align="center" gap={8} style={{ marginBottom: 12 }}>
          <View style={styles.headerIconBox}>
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
          </View>
          <Col>
            <Txt variant="screenTitle" color={Colors.textPrimary}>Edit Property Details</Txt>
            <Txt variant="caption" color={Colors.textMuted}>{pg.pgName}</Txt>
          </Col>
        </Row>

        <FormScroll style={{ flex: 0, maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          <OutlinedTextField
            label="Property / PG Name"
            value={name}
            onChangeText={(v) => { setName(v); if (nameError) setNameError(undefined); }}
            error={nameError}
            containerColor={Colors.surfaceMuted}
            focusedBorderColor={Colors.primary}
            unfocusedBorderColor={Colors.borderSubtle}
          />
          <OutlinedTextField
            label="Branch Location / Address"
            value={address}
            onChangeText={(v) => { setAddress(v); if (addressError) setAddressError(undefined); }}
            error={addressError}
            containerColor={Colors.surfaceMuted}
            focusedBorderColor={Colors.primary}
            unfocusedBorderColor={Colors.borderSubtle}
          />
          <PropertyMap
            formattedAddress={pg.formattedAddress}
            latitude={pg.latitude}
            longitude={pg.longitude}
            height={110}
          />
          <LocationField
            value={location}
            onPress={() => setPicking(true)}
            placeholder={pg.formattedAddress || 'Pin the location on the map'}
          />

          <OutlinedTextField
            label="Total Bed Capacity"
            value={totalBeds}
            onChangeText={setTotalBeds}
            keyboardType="number-pad"
            containerColor={Colors.surfaceMuted}
          />
          <OutlinedTextField
            label="Assigned Manager Name"
            value={mgrName}
            onChangeText={setMgrName}
            containerColor={Colors.surfaceMuted}
          />
          <Row gap={8}>
            <OutlinedTextField
              label="Manager Phone Number"
              value={mgrPhone}
              onChangeText={setMgrPhone}
              keyboardType="phone-pad"
              containerColor={Colors.surfaceMuted}
              style={{ flex: 2 }}
            />
            <OutlinedTextField
              label="Manager PIN"
              value={mgrPin}
              onChangeText={setMgrPin}
              keyboardType="number-pad"
              containerColor={Colors.surfaceMuted}
              style={{ flex: 1 }}
            />
          </Row>
        </FormScroll>

      </Card>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconBox: {
    width: 36, height: 36, borderRadius: Radii.control,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
});
