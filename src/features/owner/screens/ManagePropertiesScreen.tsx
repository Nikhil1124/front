/**
 * ManagePropertiesScreen — Owner drill-down reached from the header's
 * profile menu ("Manage Properties"). Same portfolio list, stats, search,
 * switch/edit/add flow that used to live in MultiPgPortfolioDialog — now a
 * full screen with a back button instead of a modal, matching every other
 * Quick Action destination.
 */
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';
import { EditPgPropertyDialog } from '@/components/dialogs/EditPgPropertyDialog';
import type { PGOwnerEntity } from '@/types';

export function ManagePropertiesScreen() {
  const allPGs = usePGowStore((s) => s.allPGsState);
  const allGuests = usePGowStore((s) => s.allGuestsState);
  const allPayments = usePGowStore((s) => s.allPaymentsState);
  const allComplaints = usePGowStore((s) => s.allComplaintsState);
  const currentOwner = usePGowStore((s) => s.loggedInOwner);
  const switchPG = usePGowStore((s) => s.switchActivePG);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [editingPg, setEditingPg] = useState<PGOwnerEntity | null>(null);

  const totalBeds = allPGs.reduce((sum, pg) => sum + pg.totalBeds, 0);
  const totalGuests = allGuests.length;
  const totalRevenue = allPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const totalComplaints = allComplaints.filter((c) => c.status !== 'Resolved').length;

  const filtered = allPGs.filter((pg) =>
    !searchQuery.trim() ||
    pg.pgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pg.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pg.managerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <HubScreenWrapper
        title="Manage Properties"
        subtitle={`${allPGs.length} Active PG Propert${allPGs.length === 1 ? 'y' : 'ies'}`}
        rightAction={<IconBtn onPress={() => setShowAddPgModal(true)} icon="add-circle" size={24} tint={Colors.primary} />}
      >
        <Row gap={6}>
          <View style={[styles.statBox, { backgroundColor: '#F0FDF9' }]}>
            <Txt variant="labelSmall" color={Colors.primaryDark}>Total PGs</Txt>
            <Txt variant="cardTitle" weight="900" color={Colors.primaryDark}>{allPGs.length}</Txt>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#ECFDF5' }]}>
            <Txt variant="labelSmall" color="#047857">Occupancy</Txt>
            <Txt variant="cardTitle" weight="900" color="#047857">{totalGuests}/{totalBeds}</Txt>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FFFBEB' }]}>
            <Txt variant="labelSmall" color="#B45309">Revenue</Txt>
            <Txt variant="cardTitle" weight="900" color="#B45309">₹{Math.round(totalRevenue).toLocaleString('en-IN')}</Txt>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FEF2F2' }]}>
            <Txt variant="labelSmall" color="#B91C1C">Open Issues</Txt>
            <Txt variant="cardTitle" weight="900" color="#B91C1C">{totalComplaints}</Txt>
          </View>
        </Row>

        <Spacer size={12} />
        <OutlinedTextField
          placeholder="Search PG by name, area, manager..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leadingIcon="search"
          containerColor={Colors.surfaceMuted}
          focusedBorderColor={Colors.primary}
          unfocusedBorderColor={Colors.borderSubtle}
        />
        <Spacer size={12} />

        <View style={{ gap: 10 }}>
          {filtered.map((pg) => {
            const isCurrent = currentOwner?.id === pg.id;
            const pgGuests = allGuests.filter((g) => g.pgId === pg.id);
            const pgRevenue = allPayments
              .filter((p) => p.pgId === pg.id && p.status === 'VERIFIED')
              .reduce((s, p) => s + p.amount, 0);
            const occupancyPct = pg.totalBeds > 0 ? Math.min(1, pgGuests.length / pg.totalBeds) : 0;
            return (
              <Card
                key={pg.id}
                containerColor={isCurrent ? '#F0FDF9' : Colors.surface}
                borderRadius={16}
                borderWidth={isCurrent ? 2 : 1}
                borderColor={isCurrent ? Colors.primary : Colors.borderSubtle}
                padding={[14, 14]}
              >
                <Row justify="space-between" align="center">
                  <View style={{ flex: 1 }}>
                    <Row align="center">
                      <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{pg.pgName}</Txt>
                      {isCurrent && (
                        <View style={styles.activeBadge}>
                          <Txt variant="labelSmall" weight="800" color={Colors.primaryDark}>Active Context</Txt>
                        </View>
                      )}
                    </Row>
                    <Txt variant="caption" color={Colors.textMuted} numberOfLines={1}>📍 {pg.address}</Txt>
                  </View>
                  <IconBtn onPress={() => setEditingPg(pg)} icon="create-outline" size={20} tint={Colors.primary} />
                </Row>

                <Spacer size={10} />
                <View style={styles.managerBanner}>
                  <Row justify="space-between" align="center" style={{ flex: 1 }}>
                    <Row gap={8} align="center">
                      <Ionicons name="people-circle" size={20} color={Colors.primary} />
                      <Col>
                        <Txt variant="caption" weight="800" color={Colors.textPrimary}>Manager: {pg.managerName || 'Not Assigned'}</Txt>
                        <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>📞 {pg.managerPhone || 'N/A'}</Txt>
                      </Col>
                    </Row>
                    {pg.managerPhone && (
                      <IconBtn
                        onPress={() => Linking.openURL(`tel:${pg.managerPhone.replace(/\s+/g, '')}`).catch(() => Alert.alert('Call Manager', pg.managerPhone))}
                        icon="call"
                        size={16}
                        tint={Colors.primary}
                      />
                    )}
                  </Row>
                </View>

                <Spacer size={10} />
                <Row justify="space-between">
                  <Txt variant="caption" weight="700" color={Colors.textPrimary}>Beds Occupancy: {pgGuests.length} / {pg.totalBeds}</Txt>
                  <Txt variant="caption" weight="800" color={Colors.primaryDark}>{Math.round(occupancyPct * 100)}% Filled</Txt>
                </Row>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${occupancyPct * 100}%` }]} />
                </View>

                <Spacer size={10} />
                <Row justify="space-between" align="center">
                  <Txt variant="caption" weight="800" color={Colors.primaryDark}>Collected: ₹{Math.round(pgRevenue).toLocaleString('en-IN')}</Txt>
                  <Btn
                    onPress={async () => { await switchPG(pg); router.back(); }}
                    containerColor={isCurrent ? Colors.primary : Colors.surfaceMuted}
                    textColor={isCurrent ? Colors.textInverse : Colors.textPrimary}
                    borderRadius={10}
                    height={32}
                    contentStyle={{ paddingHorizontal: 12 }}
                  >
                    <Txt variant="caption" weight="800" color={isCurrent ? Colors.textInverse : Colors.textPrimary}>
                      {isCurrent ? 'Managing Now' : 'Switch Property'}
                    </Txt>
                  </Btn>
                </Row>
              </Card>
            );
          })}
        </View>
      </HubScreenWrapper>

      {showAddPgModal && <AddPgPropertyDialog onDismiss={() => setShowAddPgModal(false)} />}
      {editingPg && <EditPgPropertyDialog pg={editingPg} onDismiss={() => setEditingPg(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  statBox: {
    flex: 1, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  activeBadge: {
    marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: '#CCFBF1',
  },
  managerBanner: {
    backgroundColor: Colors.surfaceMuted, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 10,
  },
  progressBar: {
    height: 6, backgroundColor: '#E2E8F0',
    borderRadius: 3, marginTop: 4, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.primary,
  },
});
