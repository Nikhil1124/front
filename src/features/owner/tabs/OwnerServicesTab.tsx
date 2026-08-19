/**
 * OwnerServicesTab — Redesigned Services & Procurement page.
 * Uses flat design system: #176B3A green, #F7FAF7 canvas, #EEF8F1 light green.
 * Includes dynamic Procurement summaries and a clean list of real PG repair requests.
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Row, Col, Spacer } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { BookProntoRepairDialog } from '@/components/dialogs/HubDialogs';
import { useProcurementOrders } from '@/features/procurement/useProcurement';
import { hapticSelect } from '@/utils/haptics';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#E6EFEA';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 18;

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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Procurement Approval Summary ── */}
      <View style={styles.sectionCard}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center" style={{ flex: 1 }}>
            <View style={styles.iconBox}>
              <Ionicons name="cube-outline" size={20} color={GREEN} />
            </View>
            <Col style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Procurement</Text>
              <Text style={styles.cardSub}>
                {isManagerMode
                  ? 'Submit carts for owner approval'
                  : pendingCount > 0
                  ? `${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting approval`
                  : 'All procurement orders are up to date.'}
              </Text>
            </Col>
          </Row>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </Row>
        <Spacer size={16} />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            hapticSelect();
            router.push('/procurement');
          }}
          activeOpacity={0.85}
          testID="services_open_procurement_btn"
        >
          <Text style={styles.primaryBtnText}>Review Orders</Text>
        </TouchableOpacity>
      </View>

      {/* ── PG Services Header ── */}
      <View style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>PG Services</Text>
      </View>

      {/* ── On-Demand Repairs ── */}
      <View style={styles.sectionCard}>
        <Row gap={12} align="flex-start">
          <View style={styles.iconBox}>
            <Ionicons name="construct-outline" size={20} color={GREEN} />
          </View>
          <Col style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>PG Repairs</Text>
            <Text style={styles.cardSub}>
              Book a technician for plumbing, electrical, locks and AC repairs.
            </Text>
          </Col>
        </Row>
        <Spacer size={16} />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => setShowBookRepair(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Book Technician</Text>
        </TouchableOpacity>
      </View>

      {/* ── Active & Past Repairs List ── */}
      <Row justify="space-between" align="center" style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>Repair Requests</Text>
        {repairs.length > 0 && (
          <TouchableOpacity
            style={styles.textLink}
            onPress={() => setShowBookRepair(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.textLinkText}>Book Technician</Text>
          </TouchableOpacity>
        )}
      </Row>

      {repairs.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyCard}>
          <Ionicons name="shield-checkmark-outline" size={36} color={MUTED} />
          <Text style={styles.emptyTitle}>No repair requests</Text>
          <Text style={styles.emptySub}>
            You don't have any active or past repair requests.
          </Text>
          <Spacer size={16} />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowBookRepair(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Book a Technician</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Col gap={10}>
          {repairs.map((rep) => {
            const formattedDate = rep.timestamp
              ? new Date(rep.timestamp).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '19 Aug 2026';

            return (
              <View key={rep.id} style={styles.repairCard}>
                <Row justify="space-between" align="center">
                  <Col style={{ flex: 1 }}>
                    <Text style={styles.repairId}>Request #{rep.id.slice(0, 4)}</Text>
                    <Text style={styles.repairCategory}>
                      {rep.category}
                    </Text>
                  </Col>
                  <Col style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{rep.status}</Text>
                    </View>
                    <Text style={styles.repairDate}>{formattedDate}</Text>
                  </Col>
                </Row>
                {rep.assignedTechnicianName ? (
                  <View style={styles.techDetails}>
                    <Ionicons name="person-outline" size={14} color={GREEN} />
                    <Text style={styles.techText} numberOfLines={1}>
                      Technician: {rep.assignedTechnicianName} ({rep.technicianPhone})
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Col>
      )}

      {showBookRepair && <BookProntoRepairDialog onDismiss={() => setShowBookRepair(false)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 0 },

  // Summary Card
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 24,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 2, lineHeight: 18 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: WHITE },

  // Buttons
  primaryBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: WHITE },

  // Headers
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  textLink: { paddingVertical: 4 },
  textLinkText: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Empty state
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL, marginTop: 10 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  // Repair List Card
  repairCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 10,
  },
  repairId: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  repairCategory: { fontSize: 13, color: MUTED, marginTop: 2 },
  statusPill: {
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: GREEN },
  repairDate: { fontSize: 11, color: MUTED },
  techDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: BG,
    borderRadius: 8,
    padding: 10,
  },
  techText: { fontSize: 11, color: CHARCOAL, flex: 1 },
});
