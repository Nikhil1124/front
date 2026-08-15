/**
 * AddPgPropertyDialog — port of Kotlin `AddPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, ScrollView, StyleSheet, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

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

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Validation', 'PG Name and Address are required.');
      return;
    }
    const result = await createPG(
      name, address, parseInt(totalBeds, 10) || 30,
      mgrName, mgrPhone, mgrPin, 'pgowowner@ybl', location,
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
      <Modal visible animationType="slide">
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Card
          containerColor={Colors.surface}
          borderRadius={24}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '92%', maxHeight: '90%', zIndex: 2 }}
        >
          <Row align="center" gap={8} style={{ marginBottom: 12 }}>
            <View style={styles.headerIconBox}>
              <Ionicons name="business" size={20} color={Colors.primary} />
            </View>
            <Col>
              <Txt size={17} weight="900" color={Colors.textPrimary}>Register New Property</Txt>
              <Txt size={11} color={Colors.textMuted}>Set up branches, floors, rooms & capacity</Txt>
            </Col>
          </Row>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <OutlinedTextField
              label="Property / PG Name *"
              placeholder="Koramangala Executive Hub"
              value={name}
              onChangeText={setName}
              containerColor={Colors.surfaceMuted}
              focusedBorderColor={Colors.primary}
              unfocusedBorderColor={Colors.borderSubtle}
            />
            <OutlinedTextField
              label="Property Address *"
              placeholder="8th Block, Koramangala, Bangalore"
              value={address}
              onChangeText={setAddress}
              containerColor={Colors.surfaceMuted}
              focusedBorderColor={Colors.primary}
              unfocusedBorderColor={Colors.borderSubtle}
            />
            <LocationField value={location} onPress={() => setPicking(true)} />

            <OutlinedTextField
              label="Total Bed Capacity *"
              value={totalBeds}
              onChangeText={setTotalBeds}
              keyboardType="number-pad"
              containerColor={Colors.surfaceMuted}
            />

            {/* Manager Assignment (Supports up to 3 Managers per property) */}
            <View style={styles.sectionCard}>
              <Row align="center" gap={6} style={{ marginBottom: 6 }}>
                <Ionicons name="people" size={16} color={Colors.primary} />
                <Txt size={12} weight="800" color={Colors.textPrimary}>Assigned Primary Manager</Txt>
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
              <Txt size={10} color={Colors.textMuted} style={{ marginTop: 4 }}>
                ℹ️ Up to 3 managers can be appointed to manage and allocate rooms.
              </Txt>
            </View>
          </ScrollView>

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
              <Txt size={13} weight="800" color={Colors.textInverse}>Save Property</Txt>
            </Btn>
            <OutlinedBtn
              onPress={onDismiss}
              borderColor={Colors.borderSubtle}
              textColor={Colors.textPrimary}
              borderRadius={12}
              height={44}
              style={{ flex: 1 }}
            >
              <Txt size={13} weight="800" color={Colors.textPrimary}>Cancel</Txt>
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
  sectionCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
  },
});
