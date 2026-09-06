/**
 * OwnerRegisterScreen — port of Kotlin `OwnerRegisterScreen(viewModel)`.
 */
import { useState } from 'react';
import { Modal, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Txt, Btn, Row, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AddressAutocompleteField } from '@/components/AddressAutocompleteField';
import { LocationField } from '@/components/LocationField';
import LocationPicker from '@/components/LocationPicker';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { fetchMe, useRegister } from '@/features/auth/useAuth';
import { useCreatePropertyMutation } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';

export function OwnerRegisterScreen() {
  const registerMutation = useRegister();
  const createPropertyMutation = useCreatePropertyMutation();
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const [picking, setPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  // Bindings
  const pgNameInput = usePGowStore((s) => s.pgNameInput);
  const ownerNameInput = usePGowStore((s) => s.ownerNameInput);
  const ownerEmailInput = usePGowStore((s) => s.ownerEmailInput);
  const ownerPhoneInput = usePGowStore((s) => s.ownerPhoneInput);
  const ownerPasswordInput = usePGowStore((s) => s.ownerPasswordInput);
  const ownerAddressInput = usePGowStore((s) => s.ownerAddressInput);
  const ownerLocationInput = usePGowStore((s) => s.ownerLocationInput);
  const pgTotalBedsInput = usePGowStore((s) => s.pgTotalBedsInput);
  const set = usePGowStore((s) => s.set);

  const [regErrors, setRegErrors] = useState<{ pgName?: string; ownerName?: string; phone?: string; password?: string }>({});

  const handleSubmit = async () => {
    if (isSubmitting) return;
    // Checked before the account is created, not after: registering and then failing on the
    // property would leave a signed-in owner with no PG and no obvious way back.
    const nextErrors = {
      pgName: pgNameInput.trim() ? undefined : 'Name your property',
      ownerName: ownerNameInput.trim() ? undefined : 'Enter your name',
      phone: ownerPhoneInput.trim() ? undefined : 'Enter your phone number',
      password: ownerPasswordInput.length < 8 ? 'At least 8 characters' : undefined,
    };
    setRegErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    if (!ownerLocationInput) {
      Alert.alert('Registration Failed', 'Pin your PG on the map before registering.');
      return;
    }
    setIsSubmitting(true);
    try {
      await registerMutation.mutateAsync({
        name: ownerNameInput.trim(),
        phone: map.toE164(ownerPhoneInput),
        password: ownerPasswordInput,
        email: ownerEmailInput.trim().toLowerCase() || undefined,
      });
      // The account exists now; the property is what makes them an owner.
      const pg = await createPropertyMutation.mutateAsync({
        name: pgNameInput.trim(),
        total_beds: parseInt(pgTotalBedsInput, 10) || 30,
        address: ownerAddressInput.trim() || undefined,
        latitude: ownerLocationInput.latitude,
        longitude: ownerLocationInput.longitude,
      });
      // Resync: `useAuthStore.activeRole` was set from a membership-less user right after
      // register, and `usePGowStore`'s own mirrors (loggedInOwner, etc.) are still empty —
      // both need the fresh property before this screen hands off to the dashboard.
      useAuthStore.getState().setUser(await fetchMe());
      await useAuthStore.getState().setActivePgId(pg.id);
      await refreshAll();
      set('ownerPasswordInput', '');
      set('ownerLocationInput', null);
      router.replace('/');
    } catch (err) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (picking) {
    // Explicitly edge-to-edge, rather than riding on the platform default: LocationPicker
    // pads its own controls by the safe-area insets, and those insets only describe this
    // modal if the modal actually extends under the system bars. Pinning both keeps the two
    // halves of that contract in step. RN warns if the nav bar is translucent without the
    // status bar, so they are set together.
    return (
      <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent>
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
    <FormScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]} style={styles.root}>
      <Row align="center" style={{ marginBottom: 16 }}>
        <IconBtn onPress={() => router.back()} icon="arrow-back" size={22} tint={Colors.textPrimary} />
        <Txt variant="statValue" weight="700" color={Colors.textPrimary} style={{ marginLeft: 8 }}>Register PG Owner</Txt>
      </Row>

      <Txt variant="body" color={Colors.textMuted} style={{ marginBottom: 24 }}>
        Create an account to digitize your PG dining, configure kitchen staff accounts, and streamline guest management.
      </Txt>

      <OutlinedTextField
        label="Paying Guest (PG) Name *"
        placeholder="Royal Meadows Co-Living"
        value={pgNameInput}
        onChangeText={(v) => { set('pgNameInput', v); if (regErrors.pgName) setRegErrors((e) => ({ ...e, pgName: undefined })); }}
        error={regErrors.pgName}
        leadingIcon="home"
        testID="pg_name_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Owner Name *"
        value={ownerNameInput}
        onChangeText={(v) => { set('ownerNameInput', v); if (regErrors.ownerName) setRegErrors((e) => ({ ...e, ownerName: undefined })); }}
        error={regErrors.ownerName}
        leadingIcon="person"
        testID="owner_name_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Gmail / Email Address *"
        value={ownerEmailInput}
        onChangeText={(v) => set('ownerEmailInput', v)}
        leadingIcon="mail"
        textContentType="emailAddress"
        autoComplete="email"
        keyboardType="email-address"
        testID="owner_email_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Phone Number *"
        value={ownerPhoneInput}
        onChangeText={(v) => { set('ownerPhoneInput', v); if (regErrors.phone) setRegErrors((e) => ({ ...e, phone: undefined })); }}
        error={regErrors.phone}
        leadingIcon="call"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Password * (min 8 characters)"
        value={ownerPasswordInput}
        onChangeText={(v) => { set('ownerPasswordInput', v); if (regErrors.password) setRegErrors((e) => ({ ...e, password: undefined })); }}
        error={regErrors.password}
        leadingIcon="lock-closed"
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        testID="owner_password_input"
        style={{ marginBottom: 12 }}
      />
      <OutlinedTextField
        label="Total Bed Capacity *"
        value={pgTotalBedsInput}
        onChangeText={(v) => set('pgTotalBedsInput', v.replace(/\D/g, ''))}
        leadingIcon="bed"
        keyboardType="number-pad"
        testID="pg_total_beds_input"
        style={{ marginBottom: 12 }}
      />
      <AddressAutocompleteField
        label="PG Full Address"
        value={ownerAddressInput}
        onChangeText={(v) => set('ownerAddressInput', v)}
        onLocationResolved={(loc) => {
          // Pre-seed the map pin so the owner doesn't have to open the picker
          // just to confirm what they already typed. The picker can still be
          // opened to fine-tune — that always wins.
          if (!ownerLocationInput) {
            set('ownerLocationInput', loc);
          }
        }}
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
        borderRadius={Radii.card}
        height={50}
        testID="owner_register_button"
      >
        <Txt variant="cardTitle" color={Colors.textInverse}>Register & Configure Bed Capacity</Txt>
      </Btn>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 24, paddingBottom: 100 },
});
