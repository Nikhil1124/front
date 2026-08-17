/**
 * GuestSecurityTab — Resident profile card + KYC verification + change passcode.
 *
 * Cyber Mint migration:
 *   - White cards on mint canvas, slate-900 text, teal accents.
 *   - Status pill in the header summarises KYC state at a glance.
 *   - The KYC verification body delegates to <GuestKycVerificationTab/>
 *     which now renders status banners + opens <KycUploadDialog/>.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { GuestKycVerificationTab } from './GuestKycVerificationTab';
import { FormScroll } from '@/components/ui/FormScroll';

type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface KycPillConfig { label: string; color: string; bg: string; }
function kycPill(status: KycStatus): KycPillConfig {
  switch (status) {
    case 'VERIFIED': return { label: 'Verified', color: Colors.success, bg: Colors.surfaceElevated };
    case 'PENDING': return { label: 'Pending', color: Colors.warning, bg: Colors.alertGradientStart };
    case 'REJECTED': return { label: 'Action Required', color: Colors.danger, bg: '#FEF2F2' };
    case 'NOT_SUBMITTED':
    default: return { label: 'Not Submitted', color: Colors.textMuted, bg: Colors.surfaceMuted };
  }
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Row justify="space-between" align="center" style={styles.fieldRow}>
      <Txt variant="caption" color={Colors.textMuted}>{label}</Txt>
      <Txt size={13} weight="600" color={Colors.textPrimary} style={mono ? styles.monoValue : undefined}>
        {value || '—'}
      </Txt>
    </Row>
  );
}

export function GuestSecurityTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const changePassword = usePGowStore((s) => s.changeGuestPassword);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const kycStatus = (guest?.kycStatus ?? 'NOT_SUBMITTED') as KycStatus;
  const pill = kycPill(kycStatus);

  return (
    <FormScroll contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Section title */}
      <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary}>Profile & KYC Verification</Txt>

      {/* Resident details card with KYC pill */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row justify="space-between" align="center">
          <Txt variant="cardTitle" weight="800" color={Colors.textPrimary}>Resident Details</Txt>
          <View style={[styles.kycPill, { backgroundColor: pill.bg }]}>
            <Ionicons
              name={kycStatus === 'VERIFIED' ? 'shield-checkmark' : kycStatus === 'PENDING' ? 'hourglass' : kycStatus === 'REJECTED' ? 'warning' : 'card'}
              size={11}
              color={pill.color}
            />
            <Txt variant="labelSmall" weight="800" color={pill.color} style={{ marginLeft: 4 }}>{pill.label}</Txt>
          </View>
        </Row>
        <Spacer size={12} />
        <Field label="Name" value={guest?.name ?? ''} />
        <Field label="Room Number" value={guest?.roomNo ?? ''} />
        <Field label="Email ID" value={guest?.email ?? ''} />
        <Field label="Phone" value={guest?.phone ?? ''} />
      </Card>

      {/* KYC verification body — banners + dialog */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row gap={8} align="center" style={styles.kycHeader}>
          <View style={styles.kycHeaderIcon}>
            <Ionicons name="ribbon" size={18} color={Colors.primary} />
          </View>
          <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary}>Identity Document (KYC)</Txt>
        </Row>
        <Spacer size={12} />
        <GuestKycVerificationTab scrollable={false} />
      </Card>

      {/* Change passcode */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row gap={8} align="center">
          <Ionicons name="lock-closed" size={18} color={Colors.primary} />
          <Txt variant="cardTitle" weight="800" color={Colors.textPrimary}>Change Login Passcode</Txt>
        </Row>
        <Spacer size={10} />
        {/* The server will not change a password without proof of the current one — that is
            what stops an unattended phone from being locked out of its own account. */}
        <OutlinedTextField
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          testID="guest_current_password_input"
          style={{ marginBottom: 10 }}
        />
        <OutlinedTextField
          label="New Passcode / Password (min 8 characters)"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          testID="guest_change_password_input"
          style={{ marginBottom: 16 }}
        />
        <Btn
          onPress={async () => {
            const r = await changePassword(newPassword, currentPassword);
            if (r.ok) {
              Alert.alert('Success', 'Passcode updated successfully!');
              setNewPassword('');
              setCurrentPassword('');
            } else {
              Alert.alert('Failed', r.error ?? 'Unknown');
            }
          }}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Layout.borderRadiusButton}
          height={44}
          testID="guest_change_password_btn"
        >
          <Ionicons name="key" size={16} color={Colors.textInverse} />
          <Txt variant="body" weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>Update Passcode</Txt>
        </Btn>
      </Card>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  kycPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Layout.borderRadiusChip,
    borderWidth: 1, borderColor: 'transparent',
  },
  fieldRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  monoValue: {
    fontVariant: ['tabular-nums'],
  },
  kycHeader: {
    marginBottom: 4,
  },
  kycHeaderIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
});
