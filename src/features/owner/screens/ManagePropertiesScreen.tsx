/**
 * ManagePropertiesScreen — Owner drill-down reached from the header's
 * profile menu ("Manage Properties"). Same portfolio list, stats, search,
 * switch/edit/add flow that used to live in MultiPgPortfolioDialog — now a
 * full screen with a back button instead of a modal, matching every other
 * Quick Action destination.
 */
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking, Image, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useAuthStore } from '@/store/authStore';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { usePaymentsQuery } from '@/features/payments/usePayments';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';
import { EditPgPropertyDialog } from '@/components/dialogs/EditPgPropertyDialog';
import type { PGOwnerEntity } from '@/types';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';

// ── Color System ─────────────────────────────────────────────────────────────
const PRIMARY = '#4F51D5';      // Premium Indigo / Violet
const PRIMARY_SOFT = '#EEEAFE'; // Soft Indigo
const BG = '#F7F8FC';           // Canvas bg
const CHARCOAL = '#16181D';     // Main text
const MUTED = '#6B7280';        // Secondary text
const BORDER = '#E5E7EB';       // Subtle border
const WHITE = '#FFFFFF';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';
const ERROR = '#DC2626';

export function ManagePropertiesScreen() {
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const activePgId = useAuthStore((s) => s.activePgId);
  const setActivePgId = useAuthStore((s) => s.setActivePgId);
  const { data: allGuests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { data: allPayments = [] } = usePaymentsQuery(activePgId ?? undefined);
  const { data: allComplaints = [] } = useComplaintsQuery(activePgId ?? undefined);
  const currentOwner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const switchPG = (pgId: string) => setActivePgId(pgId);

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
        rightAction={
          <IconBtn
            onPress={() => { hapticSelect(); setShowAddPgModal(true); }}
            icon="add"
            size={20}
            tint={WHITE}
            containerColor={PRIMARY}
            borderRadius={20}
            padding={8}
            accessibilityLabel="Add PG Property"
            testID="add_property_btn"
          />
        }
      >
        {/* ── Summary Metrics Row ── */}
        <PropertyStats
          totalPGs={allPGs.length}
          totalGuests={totalGuests}
          totalBeds={totalBeds}
          totalRevenue={totalRevenue}
          totalComplaints={totalComplaints}
        />

        <Spacer size={20} />

        {/* ── Search Bar ── */}
        <PropertySearch value={searchQuery} onChangeText={setSearchQuery} />

        <Spacer size={20} />

        {/* ── Property List ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={40} color={MUTED} />
            <Txt size={14} color={MUTED} weight="600" style={{ marginTop: 8 }}>
              No properties found matching search.
            </Txt>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            {filtered.map((pg) => {
              const isCurrent = currentOwner?.id === pg.id;
              const pgGuests = allGuests.filter((g) => g.pgId === pg.id);
              const pgRevenue = allPayments
                .filter((p) => p.pgId === pg.id && p.status === 'VERIFIED')
                .reduce((s, p) => s + p.amount, 0);
              const occupancyPct = pg.totalBeds > 0 ? Math.min(1, pgGuests.length / pg.totalBeds) : 0;

              return (
                <View
                  key={pg.id}
                  style={[
                    styles.propertyCard,
                    isCurrent && { borderColor: PRIMARY, borderWidth: 1.5 }
                  ]}
                >
                  {/* Property Image Header */}
                  <View style={styles.imageContainer}>
                    <Image
                      source={require('../../../../assets/bangalore_pg_building.png')}
                      style={styles.propertyImage}
                      resizeMode="cover"
                    />
                    {isCurrent && (
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Txt size={11} weight="800" color={WHITE}>Active</Txt>
                      </View>
                    )}
                  </View>

                  {/* Card Content Body */}
                  <View style={styles.cardContent}>
                    {/* Title and Edit Row */}
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Txt size={20} weight="900" color={CHARCOAL}>{pg.pgName}</Txt>
                        <Spacer size={6} />
                        <Row gap={4} align="flex-start">
                          <Ionicons name="location-outline" size={14} color={MUTED} style={{ marginTop: 2 }} />
                          <Txt size={12} color={MUTED} style={{ flex: 1 }} numberOfLines={2}>
                            {pg.address}
                          </Txt>
                        </Row>
                      </View>
                      <IconBtn
                        onPress={() => { hapticSelect(); setEditingPg(pg); }}
                        icon="create-outline"
                        size={18}
                        tint={PRIMARY}
                        containerColor={PRIMARY_SOFT}
                        borderRadius={10}
                        padding={8}
                        accessibilityLabel="Edit Property"
                      />
                    </Row>

                    {/* Manager Contact Box */}
                    <View style={styles.managerCard}>
                      <Row justify="space-between" align="center">
                        <Row gap={8} align="center" style={{ flex: 1 }}>
                          <View style={styles.managerIconBox}>
                            <Ionicons name="person-outline" size={16} color={PRIMARY} />
                          </View>
                          <Col style={{ flex: 1 }}>
                            <Txt size={11} color={MUTED} weight="700">ASSIGNED MANAGER</Txt>
                            <Txt size={13} weight="800" color={CHARCOAL} style={{ marginTop: 2 }}>
                              {pg.managerName || 'Not Assigned'}
                            </Txt>
                            <Txt size={11} color={MUTED} style={{ marginTop: 1 }}>
                              Phone: {pg.managerPhone || 'N/A'}
                            </Txt>
                          </Col>
                        </Row>
                        {pg.managerPhone ? (
                          <IconBtn
                            onPress={() => {
                              hapticSelect();
                              Linking.openURL(`tel:${pg.managerPhone.replace(/\s+/g, '')}`).catch(() => Alert.alert('Call Manager', pg.managerPhone));
                            }}
                            icon="call"
                            size={14}
                            tint={PRIMARY}
                            containerColor={PRIMARY_SOFT}
                            borderRadius={8}
                            padding={8}
                            accessibilityLabel="Call Manager"
                          />
                        ) : null}
                      </Row>
                    </View>

                    {/* Bed Occupancy Progress */}
                    <View>
                      <Row justify="space-between" align="center">
                        <Txt size={13} weight="800" color={CHARCOAL}>Beds Occupancy</Txt>
                        <Txt size={12} weight="800" color={PRIMARY}>
                          {Math.round(occupancyPct * 100)}% Filled
                        </Txt>
                      </Row>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressFill, { width: `${occupancyPct * 100}%` }]} />
                      </View>
                      <Txt size={11} color={MUTED} style={{ marginTop: 4 }}>
                        {pgGuests.length} occupied / {pg.totalBeds} beds
                      </Txt>
                    </View>

                    {/* Divider */}
                    <View style={styles.cardDivider} />

                    {/* Revenue & Managing CTA */}
                    <Row justify="space-between" align="center">
                      <Col>
                        <Txt size={10} color={MUTED} weight="800" style={{ letterSpacing: 0.5 }}>COLLECTED THIS MONTH</Txt>
                        <Txt size={18} weight="900" color={PRIMARY} style={{ marginTop: 2 }}>
                          ₹{Math.round(pgRevenue).toLocaleString('en-IN')}
                        </Txt>
                      </Col>
                      <Btn
                        onPress={async () => {
                          hapticSuccess();
                          await switchPG(pg.id);
                          router.back();
                        }}
                        containerColor={isCurrent ? PRIMARY : PRIMARY_SOFT}
                        textColor={isCurrent ? WHITE : PRIMARY}
                        borderRadius={12}
                        height={40}
                        style={{ paddingHorizontal: 16 }}
                      >
                        <Txt size={12} weight="800" color={isCurrent ? WHITE : PRIMARY}>
                          {isCurrent ? 'Managing Now' : 'Switch Property'}
                        </Txt>
                        <Spacer size={6} horizontal />
                        <Ionicons name={isCurrent ? 'arrow-forward' : 'swap-horizontal'} size={14} color={isCurrent ? WHITE : PRIMARY} />
                      </Btn>
                    </Row>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Spacer size={20} />

        {/* ── Add Property Empty-Space CTA ── */}
        <AddPropertyCTA onPress={() => { hapticSelect(); setShowAddPgModal(true); }} />

        <Spacer size={30} />
      </HubScreenWrapper>

      {showAddPgModal && <AddPgPropertyDialog onDismiss={() => setShowAddPgModal(false)} />}
      {editingPg && <EditPgPropertyDialog pg={editingPg} onDismiss={() => setEditingPg(null)} />}
    </>
  );
}

// ── Supporting Components ─────────────────────────────────────────────────────

interface PropertyStatsProps {
  totalPGs: number;
  totalGuests: number;
  totalBeds: number;
  totalRevenue: number;
  totalComplaints: number;
}

function PropertyStats({ totalPGs, totalGuests, totalBeds, totalRevenue, totalComplaints }: PropertyStatsProps) {
  const occupancyPct = totalBeds > 0 ? Math.round((totalGuests / totalBeds) * 100) : 0;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
      {/* Total PGs Card */}
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: '#EEF2FF' }]}>
          <Ionicons name="business" size={18} color={PRIMARY} />
        </View>
        <Txt size={11} color={MUTED} weight="700">Total PGs</Txt>
        <Txt size={20} weight="900" color={CHARCOAL} style={{ marginTop: 4 }}>{totalPGs}</Txt>
        <Txt size={10} color={MUTED} style={{ marginTop: 2 }}>Properties</Txt>
      </View>

      {/* Occupancy Card */}
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: '#ECFDF5' }]}>
          <Ionicons name="bed" size={18} color={SUCCESS} />
        </View>
        <Txt size={11} color={MUTED} weight="700">Occupancy</Txt>
        <Txt size={20} weight="900" color={SUCCESS} style={{ marginTop: 4 }}>{totalGuests}/{totalBeds}</Txt>
        <Txt size={10} color={MUTED} style={{ marginTop: 2 }}>{occupancyPct}% Filled</Txt>
      </View>

      {/* Revenue Card */}
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="wallet" size={18} color={WARNING} />
        </View>
        <Txt size={11} color={MUTED} weight="700">Revenue</Txt>
        <Txt size={20} weight="900" color={WARNING} style={{ marginTop: 4 }}>₹{Math.round(totalRevenue).toLocaleString('en-IN')}</Txt>
        <Txt size={10} color={MUTED} style={{ marginTop: 2 }}>Collected</Txt>
      </View>

      {/* Issues Card */}
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: '#FEF2F2' }]}>
          <Ionicons name="alert-circle" size={18} color={ERROR} />
        </View>
        <Txt size={11} color={MUTED} weight="700">Open Issues</Txt>
        <Txt size={20} weight="900" color={totalComplaints > 0 ? ERROR : CHARCOAL} style={{ marginTop: 4 }}>{totalComplaints}</Txt>
        <Txt size={10} color={MUTED} style={{ marginTop: 2 }}>{totalComplaints > 0 ? 'Urgent Alerts' : 'All Clear'}</Txt>
      </View>
    </ScrollView>
  );
}

interface PropertySearchProps {
  value: string;
  onChangeText: (t: string) => void;
}

function PropertySearch({ value, onChangeText }: PropertySearchProps) {
  return (
    <Row style={styles.searchRow}>
      <Ionicons name="search-outline" size={18} color={MUTED} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search PG by name, area, manager..."
        placeholderTextColor={MUTED}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={() => hapticSelect()} style={styles.filterBtn} activeOpacity={0.7}>
        <Ionicons name="options-outline" size={18} color={PRIMARY} />
      </TouchableOpacity>
    </Row>
  );
}

interface AddPropertyCTAProps {
  onPress: () => void;
}

function AddPropertyCTA({ onPress }: AddPropertyCTAProps) {
  return (
    <Card
      containerColor={WHITE}
      borderRadius={20}
      borderWidth={1}
      borderColor={BORDER}
      padding={[16, 16]}
      style={styles.addCtaCard}
    >
      <Row gap={12} align="center" justify="space-between">
        <Row gap={12} style={{ flex: 1 }} align="center">
          <View style={styles.addCtaIconBox}>
            <Ionicons name="business-outline" size={24} color={PRIMARY} />
          </View>
          <Col style={{ flex: 1 }}>
            <Txt size={14} weight="900" color={CHARCOAL}>Manage more PGs</Txt>
            <Txt size={11} color={MUTED} style={{ marginTop: 2 }}>
              Add another property and manage everything from one place.
            </Txt>
          </Col>
        </Row>
        <OutlinedBtn
          onPress={onPress}
          borderColor={PRIMARY}
          textColor={PRIMARY}
          borderRadius={12}
          height={38}
          style={{ paddingHorizontal: 12 }}
        >
          <Txt size={12} weight="800" color={PRIMARY}>+ Add New PG</Txt>
        </OutlinedBtn>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Stats scroll & card styles
  statsScroll: {
    paddingVertical: 4,
    gap: 12,
  },
  statCard: {
    width: 125,
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  // Search input styles
  searchRow: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: CHARCOAL,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Property Card layout
  propertyCard: {
    backgroundColor: WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  activePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  // Card details styles
  cardContent: {
    padding: 16,
    gap: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },

  // Manager sub-card styles
  managerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  managerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Beds Occupancy progress bar
  progressContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },

  // Add Property CTA Card
  addCtaCard: {
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  addCtaIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state container
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
});
