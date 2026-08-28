/**
 * EditPgPropertyDialog — port of Kotlin `EditPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import PropertyMap from '@/components/PropertyMap';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import type { PGOwnerEntity } from '@/types';

interface Props {
  pg: PGOwnerEntity;
  onDismiss: () => void;
}

export function EditPgPropertyDialog({ pg, onDismiss }: Props) {
  const updatePG = usePGowStore((s) => s.updatePGProperty);
  const [name, setName] = useState(pg.pgName);
  const [address, setAddress] = useState(pg.address);
  const [totalBeds, setTotalBeds] = useState(String(pg.totalBeds || 36));
  const [mgrName, setMgrName] = useState(pg.managerName);
  const [mgrPhone, setMgrPhone] = useState(pg.managerPhone);
  const [mgrPin, setMgrPin] = useState(pg.managerPin);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Validation', 'PG Name and Address are required.');
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
      <Modal visible animationType="slide">
        <LocationPicker
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Card
          containerColor={Colors.surface}
          borderRadius={24}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '92%', maxHeight: '90%' }}
        >
          <Row align="center" gap={8} style={{ marginBottom: 12 }}>
            <View style={styles.headerIconBox}>
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </View>
            <Col>
              <Txt variant="screenTitle" weight="900" color={Colors.textPrimary}>Edit Property Details</Txt>
              <Txt variant="caption" color={Colors.textMuted}>{pg.pgName}</Txt>
            </Col>
          </Row>

          {/* Same real fix as AddPgPropertyDialog: FormScroll's inner ScrollView is
              hardcoded flex: 1, which needs a flex-bounded ancestor — this Card sizes to
              its own content (maxHeight: '90%' is just a cap, not flex: 1), so flex: 1
              collapsed to zero the same way flex: 0 did. Plain maxHeight-bounded
              ScrollView, no flex anywhere in the chain. */}
          <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : undefined}>
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ gap: 10 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <OutlinedTextField
              label="Property / PG Name"
              value={name}
              onChangeText={setName}
              containerColor={Colors.surfaceMuted}
              focusedBorderColor={Colors.primary}
              unfocusedBorderColor={Colors.borderSubtle}
            />
            <OutlinedTextField
              label="Branch Location / Address"
              value={address}
              onChangeText={setAddress}
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
            </ScrollView>
          </KeyboardAvoidingView>

          <Spacer size={14} />
          <Row gap={8}>
            <Btn
              onPress={handleSave}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
              style={{ flex: 1 }}
            >
              <Txt variant="body" weight="800" color={Colors.textInverse}>Update Branch</Txt>
            </Btn>
            <OutlinedBtn
              onPress={onDismiss}
              borderColor={Colors.borderSubtle}
              textColor={Colors.textPrimary}
              borderRadius={12}
              height={44}
              style={{ flex: 1 }}
            >
              <Txt variant="body" weight="800" color={Colors.textPrimary}>Cancel</Txt>
            </OutlinedBtn>
          </Row>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0FDF9',
    alignItems: 'center', justifyContent: 'center',
  },
});
