/**
 * OwnerRegisterScreen — port of Kotlin `OwnerRegisterScreen(viewModel)`.
 */
import { useState, useEffect} from 'react';
import { Modal, StyleSheet, Alert, Platform, BackHandler } from 'react-native';
import { Txt, Btn, Row, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { FormScroll } from '@/components/ui/FormScroll';

export function OwnerRegisterScreen() {
  const popScreen = usePGowStore((s) => s.popScreen);

  // Android hardware back — consistent with every screen's visible back button.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      popScreen();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const registerOwner = usePGowStore((s) => s.registerOwner);
  const [picking, setPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bindings
  const pgNameInput = usePGowStore((s) => s.pgNameInput);
  const ownerNameInput = usePGowStore((s) => s.ownerNameInput);
  const ownerEmailInput = usePGowStore((s) => s.ownerEmailInput);
  const ownerPhoneInput = usePGowStore((s) => s.ownerPhoneInput);
  const ownerPasswordInput = usePGowStore((s) => s.ownerPasswordInput);
  const ownerAddressInput = usePGowStore((s) => s.ownerAddressInput);
  const ownerLocationInput = usePGowStore((s) => s.ownerLocationInput);
  const set = usePGowStore((s) => s.set);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await registerOwner();
      if (result.ok) {
        Alert.alert('Registration Successful!', 'Configure bed capacity.');
      } else {
        Alert.alert('Registration Failed', result.error ?? 'Unknown error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (picking) {
    return (
      <Modal visible animationType="slide">
        <LocationPicker
          initial={ownerLocationInput}
          onConfirm={(picked) => {
            set('ownerLocationInput', picked);
            // Prefill the address line the first time, so an owner who pinned their building
            // is not asked to type what the map already resolved.
            if (picked.formatted_address && !ownerAddressInput.trim()) {
              set('ownerAddressInput', picked.formatted_address);
            }
            setPicking(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <FormScroll contentContainerStyle={styles.scroll} style={styles.root}>
      <Row align="center" style={{ marginBottom: 16 }}>
        <IconBtn onPress={() => popScreen()} icon="arrow-back" size={22} tint={Colors.textPrimary} />
        <Txt size={22} weight="800" color={Colors.textPrimary} style={{ marginLeft: 8 }}>Register PG Owner</Txt>
      </Row>

      <Txt size={13} color={Colors.textMuted} style={{ marginBottom: 24 }}>
        Create an account to digitize your PG dining, configure kitchen staff accounts, and streamline guest management.
      </Txt>

      <OutlinedTextField
        label="Paying Guest (PG) Name *"
        placeholder="Royal Meadows Co-Living"
        value={pgNameInput}
        onChangeText={(v) => set('pgNameInput', v)}
        leadingIcon="home"
        testID="pg_name_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Owner Name *"
        value={ownerNameInput}
        onChangeText={(v) => set('ownerNameInput', v)}
        leadingIcon="person"
        testID="owner_name_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Gmail / Email Address *"
        value={ownerEmailInput}
        onChangeText={(v) => set('ownerEmailInput', v)}
        leadingIcon="mail"
        keyboardType="email-address"
        testID="owner_email_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Phone Number *"
        value={ownerPhoneInput}
        onChangeText={(v) => set('ownerPhoneInput', v)}
        leadingIcon="call"
        keyboardType="phone-pad"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Password * (min 8 characters)"
        value={ownerPasswordInput}
        onChangeText={(v) => set('ownerPasswordInput', v)}
        leadingIcon="lock-closed"
        secureTextEntry
        testID="owner_password_input"
        style={{ marginBottom: 12 }}
      />
      <AddressAutocompleteField
        label="PG Full Address"
        value={ownerAddressInput}
        onChangeText={(v) => set('ownerAddressInput', v)}
        style={{ marginBottom: 12 }}
      />
      <LocationField value={ownerLocationInput} onPress={() => setPicking(true)} />
      <Spacer size={16} />

      <Btn
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}
        containerColor={Colors.primary}
        textColor={Colors.textInverse}
        borderRadius={12}
        height={50}
        testID="owner_register_button"
      >
        <Txt size={15} weight="700" color={Colors.textInverse}>Register & Configure Bed Capacity</Txt>
      </Btn>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 24, paddingBottom: 100 },
});
