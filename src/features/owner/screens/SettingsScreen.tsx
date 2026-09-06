/**
 * SettingsScreen — reached from the header's profile menu ("Settings").
 * Account summary + payment/UPI configuration + sign out — the basics every
 * owner or manager needs; more sections land here as they come up.
 */
import { Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, AnimatedPress } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Radii, Colors } from '@/theme';
import { useActiveProperty } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { UpiConfigSection } from '@/features/owner/tabs/UpiConfigSection';
import { useIsManagerMode } from '@/store/authStore';

export function SettingsScreen() {
  const { activeEntity: owner } = useActiveProperty();
  const isManager = useIsManagerMode();
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
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
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

      {/* Both of these screens existed with no way to reach them — `/manager-provisioning`
          and `/owner-subscription` had zero inbound navigation anywhere in the app, so the
          whole billing flow (398 lines) was dead weight in the bundle. Settings is where an
          owner looks for them. Manager provisioning is owner-only: a manager cannot appoint
          other managers. */}
      <Spacer size={20} />
      <Txt variant="body" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>PROPERTY & PLAN</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[4, 4]}>
        {!isManager && (
          <AnimatedPress
            style={styles.settingRow}
            onPress={() => router.push('/manager-provisioning')}
            accessibilityRole="button"
            accessibilityLabel="Manager provisioning"
          >
            <Ionicons name="people-circle-outline" size={22} color={Colors.primary} />
            <Col style={{ flex: 1, marginLeft: 10 }}>
              <Txt variant="body" weight="700" color={Colors.textPrimary}>Manager Provisioning</Txt>
              <Txt variant="caption" color={Colors.textMuted}>Appoint and review property managers</Txt>
            </Col>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </AnimatedPress>
        )}
        {/* Unlike Manager Provisioning above (genuinely owner-only — D-06 in the backend),
            billing's `get_subscription`/`subscribe` are `require_manage`: owner OR manager.
            Hiding this from managers blocked a capability the server grants them. */}
        <AnimatedPress
          style={styles.settingRow}
          onPress={() => router.push('/owner-subscription')}
          accessibilityRole="button"
          accessibilityLabel="Subscription and billing"
        >
          <Ionicons name="card-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1, marginLeft: 10 }}>
            <Txt variant="body" weight="700" color={Colors.textPrimary}>Subscription & Billing</Txt>
            <Txt variant="caption" color={Colors.textMuted}>
              {owner?.subscriptionActive ? 'Plan active — view invoices' : 'No active plan'}
            </Txt>
          </Col>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </AnimatedPress>
        <AnimatedPress
          style={styles.settingRow}
          onPress={() => router.push('/manage-properties')}
          accessibilityRole="button"
          accessibilityLabel="Manage properties"
        >
          <Ionicons name="business-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1, marginLeft: 10 }}>
            <Txt variant="body" weight="700" color={Colors.textPrimary}>Manage Properties</Txt>
            <Txt variant="caption" color={Colors.textMuted}>Switch, edit or add a property</Txt>
          </Col>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </AnimatedPress>
        <AnimatedPress
          style={styles.settingRow}
          onPress={() => router.push('/rsvp-trends')}
          accessibilityRole="button"
          accessibilityLabel="RSVP trends"
        >
          <Ionicons name="trending-up-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1, marginLeft: 10 }}>
            <Txt variant="body" weight="700" color={Colors.textPrimary}>RSVP Trends</Txt>
            <Txt variant="caption" color={Colors.textMuted}>Eating vs. skipping, last 7 days</Txt>
          </Col>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </AnimatedPress>
      </Card>

      <Spacer size={20} />
      <Txt variant="body" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>MONETIZATION</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[4, 4]}>
        <AnimatedPress
          style={styles.settingRow}
          onPress={() => router.push('/manage-ad')}
          accessibilityRole="button"
          accessibilityLabel="Sponsored ad"
        >
          <Ionicons name="megaphone-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1, marginLeft: 10 }}>
            <Txt variant="body" weight="700" color={Colors.textPrimary}>Sponsored Ad</Txt>
            <Txt variant="caption" color={Colors.textMuted}>Show a promotion to your residents</Txt>
          </Col>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </AnimatedPress>
      </Card>

      <Spacer size={20} />
      <Btn onPress={confirmLogout} containerColor={Colors.surface} textColor={Colors.danger} borderRadius={Radii.card} height={48} borderWidth={1} borderColor="#FECACA">
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Txt variant="body" weight="800" color={Colors.danger} style={{ marginLeft: 8 }}>Log Out</Txt>
      </Btn>
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
});
