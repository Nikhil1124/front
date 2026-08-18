/**
 * OwnerServicesTab — port of Kotlin `OwnerServicesTab`.
 * Procurement entry point + Pronto on-demand repairs.
 *
 * Groceries used to live here as two more sub-tabs ("10-Min Grocery" /
 * "Daily Grocery") — that catalog moved to its own dedicated Groceries
 * screen (see src/features/groceries), reachable from its own dashboard
 * tile, so this tab is repairs-only now.
 *
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { BookProntoRepairDialog } from '@/components/dialogs/HubDialogs';
// ── Task 8: procurement approval queue ──────────────────────────────────────
import { useProcurementOrders } from '@/features/procurement/useProcurement';
import { hapticSelect } from '@/utils/haptics';

export function OwnerServicesTab() {
  const [showBookRepair, setShowBookRepair] = useState(false);

  const repairs = usePGowStore((s) => s.pgRepairRequestsState);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManagerMode = usePGowStore((s) => s.isManagerMode);

  const { data: pendingOrders = [] } = useProcurementOrders({
    pgId: owner?.id,
    status: isManagerMode ? undefined : 'pending_owner_approval',
  });
  const pendingCount = pendingOrders.length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* Task 8: Procurement approval queue entry point */}
      <Card containerColor={Colors.surfaceElevated} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
        <Row justify="space-between" align="center">
          <Row gap={10} align="center" style={{ flex: 1 }}>
            <View style={styles.procIcon}>
              <Ionicons name="cube" size={20} color={Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt size={13} weight="900" color={Colors.textPrimary}>Procurement</Txt>
              <Txt variant="caption" color={Colors.textSecondary}>
                {isManagerMode
                  ? 'Submit carts for owner approval'
                  : `${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting your approval`}
              </Txt>
            </Col>
          </Row>
          {pendingCount > 0 && (
            <View style={styles.procBadge}>
              <Txt size={11} weight="900" color={Colors.textInverse}>{pendingCount}</Txt>
            </View>
          )}
        </Row>
        <Spacer size={10} />
        <Btn
          onPress={() => { hapticSelect(); router.push('/procurement'); }}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={10}
          height={42}
          testID="services_open_procurement_btn"
        >
          <Ionicons name={isManagerMode ? 'cart' : 'checkmark-done'} size={16} color={Colors.textInverse} />
          <Txt variant="caption" weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>
            {isManagerMode ? 'Open Procurement Catalog' : 'Open Approval Queue'}
          </Txt>
        </Btn>
      </Card>

      <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary} style={{ letterSpacing: 0.5 }}>PG SERVICES</Txt>

      <Card containerColor={Colors.surfaceElevated} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
        <Row gap={10} align="center">
          <Txt size={24}>🛠️</Txt>
          <Col>
            <Txt size={13} weight="900" color={Colors.textPrimary}>Pronto On-Demand PG Repairs</Txt>
            <Txt variant="caption" color={Colors.tertiary}>15-Min Express doorstep arrival for Plumbing, Electricals, Locks & ACs</Txt>
          </Col>
        </Row>
      </Card>
      <Row justify="space-between" align="center">
        <Txt variant="body" weight="700" color={Colors.textPrimary}>Active & Past PG Repairs</Txt>
        <Btn onPress={() => setShowBookRepair(true)} containerColor={Colors.tertiary} textColor={Colors.textInverse} borderRadius={8} height={32} contentStyle={{ paddingHorizontal: 10 }}>
          <Ionicons name="build" size={14} color={Colors.textInverse} />
          <Txt variant="caption" weight="700" color={Colors.textInverse} style={{ marginLeft: 4 }}>Book Technician</Txt>
        </Btn>
      </Row>
      {repairs.length === 0 ? (
        <Card containerColor={Colors.surface} borderRadius={12} padding={[16, 16]}>
          <Txt variant="caption" color={Colors.textMuted}>No repair requests logged.{'\n'}Click 'Book Technician' to dispatch a certified PG repair expert!</Txt>
        </Card>
      ) : (
        repairs.map((rep) => (
          <Card key={rep.id} containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row justify="space-between" align="center">
              <Txt size={13} weight="900" color={Colors.tertiary}>{rep.category} • {rep.urgency}</Txt>
              <View style={[styles.statusPill, { backgroundColor: '#FFFBEB' }]}><Txt variant="labelSmall" color={Colors.tertiary}>{rep.status}</Txt></View>
            </Row>
            <Spacer size={6} />
            <Txt variant="caption" weight="700" color={Colors.textPrimary}>{rep.issueTitle}</Txt>
            <View style={styles.techBox}>
              <Col style={{ flex: 1 }}>
                <Txt variant="caption" weight="700" color={Colors.textPrimary}>Technician: {rep.assignedTechnicianName}</Txt>
                <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>Phone: {rep.technicianPhone} • Rating: ★{rep.technicianRating}</Txt>
              </Col>
              <Txt size={11} weight="900" color={Colors.primary}>ETA: {rep.etaMinutes}m</Txt>
            </View>
          </Card>
        ))
      )}

      {showBookRepair && <BookProntoRepairDialog onDismiss={() => setShowBookRepair(false)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  procIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  procBadge: {
    minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8, borderWidth: 2, borderColor: Colors.surface,
  },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  techBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceElevated, borderRadius: 8, padding: 8, marginTop: 6 },
});
