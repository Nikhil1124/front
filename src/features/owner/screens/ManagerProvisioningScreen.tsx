/**
 * ManagerProvisioningScreen — Owner drill-down for manager list + invite.
 *
 * Hub-and-Spoke:
 *   Reached from the Owner dashboard's "👔 Manager Provisioning" action tile.
 *   Wraps the existing StaffManagementTab in a dedicated full-screen page
 *   with a sticky back header so owners can manage managers without the
 *   dashboard's other widgets competing for space.
 *
 *   The actual staff/manager form lives in StaffManagementTab — duplicated
 *   logic is the enemy of correctness here. This screen adds the navigation
 *   chrome (back button + title) and a focused manager-only summary at the
 *   top so the owner sees who is currently a manager before adding more.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer, LoadingState, ErrorState } from '@/components/ui';
import { RefreshControl } from 'react-native';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useStaffQuery } from '@/features/staff/useStaff';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { StaffManagementTab } from '@/features/owner/tabs/StaffManagementTab';

export function ManagerProvisioningScreen() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: staff = [],
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff,
    isRefetching: staffRefetching,
  } = useStaffQuery(activePgId ?? undefined);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();

  // Filter to managers — `currentStaff` carries everyone on the active
  // property's roster (cooks, housekeeping, etc.). The provisioning summary
  // is specifically about who can sign in to the Manager dashboard.
  const managers = staff.filter((s) => s.role.toLowerCase() === 'manager');

  return (
    <HubScreenWrapper
      refreshControl={<RefreshControl refreshing={staffRefetching} onRefresh={refetchStaff} />}
      title="Manager Provisioning"
      subtitle={`${managers.length} active manager${managers.length === 1 ? '' : 's'}`}
      icon="people-outline"
    >
      {/* Manager summary — at-a-glance list of who has manager access */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[14, 14]}
      >
        <Row justify="space-between" align="center">
          <Txt variant="body" weight="800" color={Colors.textPrimary}>Active Managers</Txt>
          <View style={styles.countPill}>
            <Txt variant="caption" weight="800" color={Colors.primaryDark}>{managers.length}</Txt>
          </View>
        </Row>
        <Spacer size={10} />
        {/* "No managers yet" was also what a failed or in-flight staff fetch looked like. */}
        {staffLoading ? (
          <LoadingState label="Loading managers…" fill={false} />
        ) : staffError ? (
          <ErrorState error={staffError} title="Could not load managers" onRetry={refetchStaff} fill={false} />
        ) : managers.length === 0 ? (
          <Row gap={8} align="center">
            <Ionicons name="information-circle" size={16} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted}>No managers provisioned yet. Use the form below to invite one.</Txt>
          </Row>
        ) : (
          <View style={{ gap: 8 }}>
            {managers.map((m) => {
              const pg = allPGs.find((p) => p.id === m.pgId);
              return (
                <Row key={m.id} gap={10} align="center">
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color={Colors.primary} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt variant="body" weight="700" color={Colors.textPrimary}>{m.name}</Txt>
                    <Txt variant="caption" color={Colors.textMuted}>{m.phone}</Txt>
                  </Col>
                  {pg ? (
                    <View style={styles.pgPill}>
                      <Txt variant="labelSmall" color={Colors.primaryDark} numberOfLines={1}>{pg.pgName}</Txt>
                    </View>
                  ) : null}
                </Row>
              );
            })}
          </View>
        )}
      </Card>

      <Spacer size={16} />

      {/* The actual form + full staff directory — reuses the existing tab so
          there is exactly one place where staff registration lives. The
          StaffManagementTab uses the legacy dark-theme tokens that have
          since been repointed at the mint palette, so it renders cleanly
          without further changes. */}
      <StaffManagementTab />
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  countPill: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  pgPill: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    maxWidth: 100,
  },
});
