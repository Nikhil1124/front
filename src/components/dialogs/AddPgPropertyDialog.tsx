/**
 * AddPgPropertyDialog — port of Kotlin `AddPgPropertyDialog`.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert, Pressable, ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

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

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Validation', 'PG Name and Address are required.');
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
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={{ width: '92%', maxHeight: '90%', zIndex: 2 }}>
          <Card
            containerColor={Colors.surface}
            borderRadius={24}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[20, 20]}
            style={{ width: '100%', maxHeight: '100%' }}
          >
          <Row align="center" gap={8} style={{ marginBottom: 12 }}>
            <View style={styles.headerIconBox}>
              <Ionicons name="business" size={20} color={Colors.primary} />
            </View>
            <Col>
              <Txt variant="screenTitle" weight="900" color={Colors.textPrimary}>Register New Property</Txt>
              <Txt variant="caption" color={Colors.textMuted}>Set up branches, floors, rooms & capacity</Txt>
            </Col>
          </Row>

          {/* FormScroll doesn't work here: its inner ScrollView is hardcoded flex: 1, which
              needs an ancestor with a real (non-content-sized) height to fill — this Card
              has none (it's centered and sized to its own content, capped by maxHeight:
              '90%', not flex: 1), so flex: 1 collapsed to zero exactly like the flex: 0 it
              replaced did. A plain maxHeight-bounded ScrollView (no flex anywhere in the
              chain) is the correct pattern for a scrollable region inside a content-sized
              modal card — it sizes to content up to the cap, then scrolls, with no
              circular dependency on a parent that isn't flex-bounded itself. */}
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
              onChangeText={setName}
              containerColor={Colors.surfaceMuted}
              focusedBorderColor={Colors.primary}
              unfocusedBorderColor={Colors.borderSubtle}
            />
            <AddressAutocompleteField
              label="Property Address *"
              value={address}
              onChangeText={setAddress}
              onLocationResolved={(loc) => {
                // Pre-seed map pin from autocomplete pick; user can still open the picker to adjust
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

            {/* Manager Assignment (Supports up to 3 Managers per property) */}
            <View style={styles.sectionCard}>
              <Row align="center" gap={6} style={{ marginBottom: 6 }}>
                <Ionicons name="people" size={16} color={Colors.primary} />
                <Txt variant="caption" weight="800" color={Colors.textPrimary}>Assigned Primary Manager</Txt>
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
              <Txt variant="body" weight="800" color={Colors.textInverse}>Save Property</Txt>
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
    backgroundColor: '#EEF2FF',
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
