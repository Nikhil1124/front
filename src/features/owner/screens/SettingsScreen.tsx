/**
 * SettingsScreen — reached from the header's profile menu ("Settings").
 * Account summary + payment/UPI configuration + sign out — the basics every
 * owner or manager needs; more sections land here as they come up.
 */
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { useActiveProperty } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { UpiConfigSection } from '@/features/owner/tabs/UpiConfigSection';

export function SettingsScreen() {
  const { activeEntity: owner } = useActiveProperty();
  const isManager = usePGowStore((s) => s.isManagerMode);
  const logout = usePGowStore((s) => s.logout);

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <HubScreenWrapper title="Settings" subtitle={owner?.pgName ?? 'Account'}>
      <Txt variant="body" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>ACCOUNT</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
        <Row gap={10} align="center">
          <Ionicons name="person-circle" size={22} color={Colors.primary} />
          <Col style={{ flex: 1 }}>
            <Txt variant="body" weight="800" color={Colors.textPrimary}>{isManager ? owner?.managerName ?? 'Manager' : owner?.ownerName ?? 'Owner'}</Txt>
            <Txt variant="caption" color={Colors.textMuted}>{isManager ? 'Manager' : 'Owner'} • {owner?.pgName ?? 'Property'}</Txt>
          </Col>
        </Row>
        {owner?.phone ? (
          <>
            <Spacer size={8} />
            <Row gap={10} align="center">
              <Ionicons name="call" size={18} color={Colors.textMuted} />
              <Txt variant="caption" color={Colors.textSecondary}>{owner.phone}</Txt>
            </Row>
          </>
        ) : null}
        {owner?.email ? (
          <>
            <Spacer size={8} />
            <Row gap={10} align="center">
              <Ionicons name="mail" size={18} color={Colors.textMuted} />
              <Txt variant="caption" color={Colors.textSecondary}>{owner.email}</Txt>
            </Row>
          </>
        ) : null}
      </Card>

      <Spacer size={20} />
      <Txt variant="body" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>PAYMENT & UPI CONFIGURATION</Txt>
      <Spacer size={8} />
      <UpiConfigSection />

      <Spacer size={20} />
      <Btn onPress={confirmLogout} containerColor={Colors.surface} textColor={Colors.danger} borderRadius={12} height={48} borderWidth={1} borderColor="#FECACA">
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Txt variant="body" weight="800" color={Colors.danger} style={{ marginLeft: 8 }}>Log Out</Txt>
      </Btn>
    </HubScreenWrapper>
  );
}
