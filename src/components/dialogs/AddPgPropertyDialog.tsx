/**
 * AddPgPropertyDialog — port of Kotlin `AddPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert, Pressable, ScrollView, KeyboardAvoidingView, Dimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { Btn, Card, Col, OutlinedBtn, Row, Sheet, Spacer, Txt } from '@/components/ui';

const SCREEN_H = Dimensions.get('window').height;


interface Props {
  onDismiss: () => void;
}

export function AddPgPropertyDialog({ onDismiss }: Props) {
  const createPG = usePGowStore((s) => s.createPGProperty);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [totalBeds, setTotalBeds] = useState('36');
  const [mgrName, setMgrName] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrPin, setMgrPin] = useState('1234');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      setNameError(name.trim() ? undefined : 'Name the property');
      setAddressError(address.trim() ? undefined : 'Enter the property address');
      return;
    }
    if (!location) {
      Alert.alert('Location Required', 'Pin the property location on the map before saving.');
      return;
    }
    // No UPI field on this form — leave it unset rather than fabricating a handle that would
    // get persisted as this property's real payment account. Configure it via UPI Settings.
    const result = await createPG(
      name, address, parseInt(totalBeds, 10) || 30,
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
            <Ionicons name="business" size={20} color={Colors.primary} />
          </View>
          <Col>
            <Txt variant="screenTitle" color={Colors.textPrimary}>Register New Property</Txt>
            <Txt variant="caption" color={Colors.textMuted}>Set up branches, floors, rooms & capacity</Txt>
          </Col>
        </Row>

        <KeyboardAvoidingView behavior="padding">
          <ScrollView
            style={{ maxHeight: SCREEN_H * 0.45 }}
            contentContainerStyle={{ gap: 10 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
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
              value={totalBeds}
              onChangeText={setTotalBeds}
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
              <Row gap={8}>
                <OutlinedTextField
                  label="Manager Phone"
                  value={mgrPhone}
                  onChangeText={setMgrPhone}
                  keyboardType="phone-pad"
                  containerColor={Colors.surface}
                  style={{ flex: 2 }}
                />
                <OutlinedTextField
                  label="Login PIN"
                  value={mgrPin}
                  onChangeText={setMgrPin}
                  keyboardType="number-pad"
                  containerColor={Colors.surface}
                  style={{ flex: 1 }}
                />
              </Row>
              <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 4 }}>
                ℹ️ Up to 3 managers can be appointed to manage and allocate rooms.
              </Txt>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Card>
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
