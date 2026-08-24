/**
 * AdminDashboardTab — port of Kotlin `AdminDashboardTab(viewModel, notifications, guests)`.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { OwnerFinancialSummaryChartCard } from '@/components/charts/OwnerFinancialSummaryChartCard';
// ── Task 8: PnL trend chart (3m / 6m / 1y) ─────────────────────────────────
import { PnLChart } from '@/components/charts/PnLChart';
import type { PnLInterval } from '@/types';
import type { PGOwnerEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

interface Props {
  onAddPg: () => void;
}

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { usePaymentsQuery } from '@/features/payments/usePayments';
import { useMealsQuery, useMealResponsesQuery } from '@/features/meals/useMeals';
import { useStaffQuery } from '@/features/staff/useStaff';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import * as map from '@/data/mappers';
import type { GuestRSVPEntity } from '@/types';

export function AdminDashboardTab({ onAddPg }: Props) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = useIsManagerMode();
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const allGuests = guests;
  const { data: allPayments = [] } = usePaymentsQuery(activePgId ?? undefined);
  const { data: notifications = [] } = useMealsQuery(activePgId ?? undefined);
  const { data: staffList = [] } = useStaffQuery(activePgId ?? undefined);
  const { data: complaints = [] } = useComplaintsQuery(activePgId ?? undefined);
  const formatServiceTime12h = usePGowStore((s) => s.formatServiceTime12h);
  const getAlertTriggerTime = usePGowStore((s) => s.getAlertTriggerTime);
  const triggerSimulated2HourAlert = usePGowStore((s) => s.triggerSimulated2HourAlert);
  const deleteGuest = usePGowStore((s) => s.deleteGuest);
  const switchActivePG = usePGowStore((s) => s.switchActivePG);
  const setActiveNotificationId = usePGowStore((s) => s.setActiveNotificationId);
  const toast = useToast();

  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRsvpFilter, setSelectedRsvpFilter] = useState('All');
  // ── Task 8: PnL interval selector ─────────────────────────────────────────
  // Default 3m — the most recent window is the most actionable for an owner
  // glancing at the dashboard. Stored here so the selection persists across
  // tab switches within the same dashboard session.
  const [pnlInterval, setPnlInterval] = useState<PnLInterval>('3m');
  // The PnLChart wrapper at @/components/charts/PnLChart fetches its own data
  // via usePnL(pgId, interval), so this tab only owns the interval selection.

  // Nothing was selected yet — default to the newest schedule, same as the meal list is
  // already ordered. Guarded with a functional update so this never fights a manual tap.
  useEffect(() => {
    if (notifications.length > 0) {
      setSelectedNotification((cur: any) => cur ?? notifications[0]);
    }
  }, [notifications]);

  // The roster `refreshAll` fetches is scoped to whichever meal id this holds — keep it in
  // sync with what's on screen, or a tapped meal shows the previous one's headcount.
  useEffect(() => {
    if (selectedNotification) {
      setActiveNotificationId(selectedNotification.id);
    }
  }, [selectedNotification?.id]);

  const selectedMealId = selectedNotification?.id ?? notifications[0]?.id;
  const { data: mealResponses = [] } = useMealResponsesQuery(selectedMealId, activePgId ?? undefined);
  const rsvpsForSelected: GuestRSVPEntity[] = mealResponses
    .filter((r) => r.choice !== null)
    .map((r) => ({
      id: `${selectedMealId}:${r.membership_id}`,
      notificationId: selectedMealId ?? '',
      guestId: r.membership_id,
      guestName: r.name,
      choice: r.choice === 'eating' ? 'REQUIRED' : 'NOT_REQUIRED',
      timestamp: map.toMillis(r.responded_at),
    }));

  const skipsCount = rsvpsForSelected.filter((r) => r.choice === 'NOT_REQUIRED').length;
  // No per-plate cost exists in the backend — this is a stated assumption applied to a real
  // count, not a fact, so it is labelled "Estimated" below rather than "Live".
  const selectedCostPlate = 45;
  const estimatedSavings = skipsCount * selectedCostPlate;
  const filteredGuests = guests.filter((g) =>
    !searchQuery.trim() ||
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.roomNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const reqCount = rsvpsForSelected.filter((r) => r.choice === 'REQUIRED').length;
  const notReqCount = rsvpsForSelected.filter((r) => r.choice === 'NOT_REQUIRED').length;
  const pendingCount = guests.length - reqCount - notReqCount;

  return (
    <FormScroll contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* Portfolio/Manager banner */}
      {isManager ? (
        <Card containerColor="#1E1B4B" borderRadius={20} borderWidth={1} borderColor="rgba(255,167,38,0.6)" padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Row gap={10}>
              <View style={styles.roleIconBox}>
                <Ionicons name="people-circle" size={20} color={Colors.CyberAmber} />
              </View>
              <Col>
                <Txt variant="labelSmall" weight="900" color={Colors.CyberAmber} style={{ letterSpacing: 0.5 }}>MANAGER VIEW</Txt>
                <Txt variant="sectionTitle" color={Colors.IvoryWhiteText}>{owner?.pgName ?? 'PG Branch'}</Txt>
              </Col>
            </Row>
            <View style={styles.branchBadge}>
              <Txt variant="labelSmall" weight="900" color={Colors.CyberPurple}>BRANCH SCOPE</Txt>
            </View>
          </Row>
          <Spacer size={12} />
          <Row gap={8}>
            <View style={styles.miniStatBox}>
              <Txt size={9} color={Colors.SlateMutedText}>Residents</Txt>
              <Txt size={12} weight="900" color={Colors.IvoryWhiteText}>{guests.length} Active</Txt>
            </View>
            <View style={styles.miniStatBox}>
              <Txt size={9} color={Colors.SlateMutedText}>Staff</Txt>
              <Txt size={12} weight="900" color={Colors.CyberGreen}>{staffList.length} Members</Txt>
            </View>
            <View style={styles.miniStatBox}>
              <Txt size={9} color={Colors.SlateMutedText}>Complaints</Txt>
              <Txt size={12} weight="900" color={Colors.CyberAmber}>{complaints.filter((c) => c.status !== 'Resolved').length} Open</Txt>
            </View>
          </Row>
        </Card>
      ) : (
        <Card containerColor="#13112A" borderRadius={24} borderWidth={1} borderColor="rgba(0,163,140,0.6)" padding={[16, 16]}>
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Ionicons name="business" size={18} color={Colors.CyberPurple} />
              <Txt size={11} weight="900" color={Colors.CyberPurple} style={{ letterSpacing: 1 }}>PORTFOLIO HUB</Txt>
            </Row>
            <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>{allPGs.length} PG Branches</Txt>
          </View>
          <Spacer size={12} />
          <Row gap={8}>
            <View style={styles.miniStatBox}>
              <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Branches</Txt>
              <Txt size={13} weight="900" color={Colors.IvoryWhiteText}>{allPGs.length}</Txt>
            </View>
            <View style={styles.miniStatBox}>
              <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Capacity</Txt>
              <Txt size={13} weight="900" color={Colors.CyberGreen}>{allGuests.length} Beds</Txt>
            </View>
            <View style={styles.miniStatBox}>
              <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Revenue</Txt>
              <Txt size={13} weight="900" color={Colors.CyberGreen}>₹{Math.round(allPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0)).toLocaleString('en-IN')}</Txt>
            </View>
          </Row>
          <Spacer size={12} />
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {allPGs.map((pg: PGOwnerEntity) => {
              const isCurrent = owner?.id === pg.id;
              return (
                <TouchableOpacity key={pg.id} onPress={() => switchActivePG(pg)}>
                  <View style={[styles.pgChip, isCurrent && styles.pgChipActive]}>
                    <Txt size={11} weight={isCurrent ? '900' : '500'} color={isCurrent ? Colors.LuxuryPureBlack : Colors.IvoryWhiteText}>
                      {pg.pgName}{isCurrent ? ' ✓' : ''}
                    </Txt>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={onAddPg} testID="admin_add_pg_chip">
              <View style={styles.addPgChip}>
                <Ionicons name="add" size={14} color={Colors.CyberGreen} />
                <Txt variant="caption" weight="700" color={Colors.CyberGreen} style={{ marginLeft: 4 }}>Add PG</Txt>
              </View>
            </TouchableOpacity>
          </FormScroll>
        </Card>
      )}

      {/* Hero Cost Saved Card */}
      <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={28} borderWidth={1.5} borderColor={Colors.CyberPink} padding={[24, 24]}>
        <Row justify="space-between" align="center">
          <Row gap={6}>
            <Ionicons name="star" size={16} color={Colors.CyberPink} />
            <Txt size={11} weight="900" color="#DCD7FC" style={{ letterSpacing: 1.8 }}>ESTIMATED SAVINGS FROM SKIPPED PORTIONS</Txt>
          </Row>
          <View style={styles.livePill}>
            <Txt variant="labelSmall" weight="800" color={Colors.CyberPink} style={{ letterSpacing: 0.5 }}>ESTIMATE</Txt>
          </View>
        </Row>
        <Spacer size={14} />
        <Txt size={46} weight="900" color="#FFFFFF" style={{ letterSpacing: -1 }}>≈ ₹{estimatedSavings.toLocaleString('en-IN')}</Txt>
        <Spacer size={8} />
        <Row gap={6}>
          <Ionicons name="leaf" size={16} color={Colors.CyberGreen} />
          <Txt size={12} weight="500" color={Colors.SlateMutedText}>
            {skipsCount} real skipped portions × ₹{selectedCostPlate} assumed cost per plate — no per-plate cost is tracked yet, so this is an estimate, not a ledger figure.
          </Txt>
        </Row>
      </Card>

      <OwnerFinancialSummaryChartCard />

      {/* Task 8: multi-month P&L trend (replaces single-cycle view when the
          owner wants a longer window). The legacy card above stays as the
          this-cycle snapshot; this one layers a 3m / 6m / 1y trend on top.
          The wrapper chart fetches its own data via `usePnL(pgId, interval)`,
          so we only need to pass the interval + change handler. */}
      <PnLChart
        interval={pnlInterval}
        onIntervalChange={setPnlInterval}
      />

      {/* Dining Schedule Card */}
      <Card containerColor="#140E2D" borderRadius={16} borderWidth={1} borderColor="#2C2250" padding={[16, 16]}>
        <Row justify="space-between" align="center">
          <Row gap={8}>
            <View style={[styles.dot, { backgroundColor: Colors.CyberPurple }]} />
            <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>Select Dining Schedule</Txt>
          </Row>
          {selectedNotification && (
            <View style={styles.mealBadge}>
              <Txt variant="labelSmall" weight="800" color={Colors.IvoryWhiteText}>{selectedNotification.mealType}</Txt>
            </View>
          )}
        </Row>
        <Spacer size={8} />
        {notifications.length === 0 ? (
          <View style={styles.emptySchedule}>
            <Ionicons name="restaurant" size={24} color="#9CA3AF" />
            <Txt variant="caption" color="#9CA3AF">No meal schedules published yet.</Txt>
          </View>
        ) : (
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {notifications.map((notif) => (
              <Chip
                key={notif.id}
                label={notif.mealType}
                selected={selectedNotification?.id === notif.id}
                onPress={() => setSelectedNotification(notif)}
              />
            ))}
          </FormScroll>
        )}
        {selectedNotification && (
          <View style={styles.scheduleDetail}>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" weight="700" color={Colors.IvoryWhiteText} numberOfLines={1}>
                🕒 Service: {formatServiceTime12h(selectedNotification.serviceTime)} (Menu: {selectedNotification.menuItems})
              </Txt>
              <Row gap={4} style={{ marginTop: 2 }}>
                <Ionicons
                  name="notifications"
                  size={12}
                  color={selectedNotification.isAlertSent ? '#02E0A5' : '#FFB800'}
                />
                <Txt variant="labelSmall" color={selectedNotification.isAlertSent ? '#02E0A5' : Colors.SlateMutedText}>
                  {selectedNotification.isAlertSent ? 'Broadcasting active' : `Auto-alert at ${getAlertTriggerTime(selectedNotification.serviceTime)}`}
                </Txt>
              </Row>
            </View>
            {!selectedNotification.isAlertSent && (
              <Btn
                onPress={async () => {
                  const result = await triggerSimulated2HourAlert(selectedNotification);
                  if (result.ok) {
                    toast('success', 'Alert Sent', 'Group alert dispatched immediately!');
                    setSelectedNotification({ ...selectedNotification, isAlertSent: true });
                  } else {
                    toast('error', 'Failed', result.error ?? 'Could not send the alert.');
                  }
                }}
                containerColor={Colors.CyberPurple}
                textColor={Colors.IvoryWhiteText}
                borderRadius={8}
                height={28}
                contentStyle={{ paddingHorizontal: 10 }}
              >
                <Txt variant="labelSmall" color={Colors.IvoryWhiteText}>⚡ Alert Now</Txt>
              </Btn>
            )}
          </View>
        )}
      </Card>

      {/* RSVP Summary */}
      {selectedNotification && (
        <Card containerColor="#140E2D" borderRadius={16} borderWidth={1} borderColor="#2C2250" padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Txt variant="body" weight="700" color={Colors.SlateMutedText}>Current RSVP Status Summary</Txt>
            <Txt size={11} weight="900" color={Colors.CyberGreen}>{reqCount + notReqCount} Registered</Txt>
          </Row>
          <Spacer size={12} />
          <Row gap={8}>
            <View style={[styles.rsvpStatBox, { borderColor: '#1E2E25' }]}>
              <Txt variant="labelSmall" color="#10B981">Going</Txt>
              <Txt variant="sectionTitle" weight="900" color="#FFFFFF">{reqCount}</Txt>
            </View>
            <View style={[styles.rsvpStatBox, { borderColor: '#2E1E1E' }]}>
              <Txt variant="labelSmall" color="#EF4444">Skipping</Txt>
              <Txt variant="sectionTitle" weight="900" color="#FFFFFF">{notReqCount}</Txt>
            </View>
            <View style={[styles.rsvpStatBox, { borderColor: '#2E271E' }]}>
              <Txt variant="labelSmall" color="#FFB800">Pending</Txt>
              <Txt variant="sectionTitle" weight="900" color="#FFFFFF">{pendingCount}</Txt>
            </View>
          </Row>
        </Card>
      )}

      {/* Search & Filter */}
      <Card containerColor="#140E2D" borderRadius={16} borderWidth={1} borderColor="#2C2250" padding={[14, 14]}>
        <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>Filters & Directory Search</Txt>
          <Txt variant="caption" color={Colors.SlateMutedText}>{filteredGuests.length} Matching</Txt>
        </Row>
        <OutlinedTextField
          placeholder="Search Name, Room or Email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leadingIcon="search"
          testID="directory_search_input"
          style={{ marginBottom: 10 }}
        />
        <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>RSVP Choice Filter</Txt>
        <Spacer size={4} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['All', 'Eating', 'Skipping', 'Pending'].map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={selectedRsvpFilter === opt}
              onPress={() => setSelectedRsvpFilter(opt)}
            />
          ))}
        </FormScroll>
      </Card>

      {filteredGuests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Txt variant="body" color="#9CA3AF">No resident matching filter query.</Txt>
        </View>
      ) : (
        filteredGuests.map((guest) => {
          const rsvp = rsvpsForSelected.find((r) => r.guestId === guest.id);
          let choiceText = 'NO REPLY ⏳';
          let choiceColor = '#FFB800';
          if (rsvp?.choice === 'REQUIRED') { choiceText = 'EATING ✅'; choiceColor = '#10B981'; }
          else if (rsvp?.choice === 'NOT_REQUIRED') { choiceText = 'SKIPPING ❌'; choiceColor = '#EF4444'; }

          if (selectedRsvpFilter === 'Eating' && rsvp?.choice !== 'REQUIRED') return null;
          if (selectedRsvpFilter === 'Skipping' && rsvp?.choice !== 'NOT_REQUIRED') return null;
          if (selectedRsvpFilter === 'Pending' && rsvp != null) return null;

          return (
            <Card key={guest.id} containerColor="#100A26" borderRadius={16} borderWidth={1} borderColor="#2C2250" padding={[14, 14]}>
              <Row justify="space-between" align="center">
                <Row gap={10} style={{ flex: 1 }}>
                  <View style={[styles.avatarBox, { backgroundColor: '#251C47' }]}>
                    <Txt variant="cardTitle" weight="900" color="#FFFFFF">{guest.name.charAt(0).toUpperCase()}</Txt>
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>{guest.name}</Txt>
                    <Txt variant="caption" color={Colors.SlateMutedText} numberOfLines={1}>Room {guest.roomNo} • {guest.email}</Txt>
                  </Col>
                </Row>
                <View style={[styles.choicePill, { backgroundColor: `${choiceColor}26`, borderColor: choiceColor }]}>
                  <Txt variant="labelSmall" weight="900" color={choiceColor}>{choiceText}</Txt>
                </View>
              </Row>
              <Spacer size={10} />
              <View style={{ height: 1, backgroundColor: '#1D1F27' }} />
              <Spacer size={10} />
              <Row justify="space-between" align="center">
                <Row gap={4}>
                  <IconBtn
                    onPress={() => Alert.alert('Remove Resident', `Remove ${guest.name} from this property?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => deleteGuest(guest.id) },
                    ])}
                    icon="trash"
                    size={16}
                    tint="#EF4444"
                    containerColor="transparent"
                  />
                </Row>
              </Row>
            </Card>
          );
        })
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  roleIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,167,38,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  branchBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, backgroundColor: 'rgba(0,163,140,0.2)',
  },
  miniStatBox: {
    flex: 1, backgroundColor: '#11131A',
    borderRadius: 12, padding: 10,
  },
  livePill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: 'rgba(0,223,188,0.2)',
  },
  pgChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, backgroundColor: '#1F2430',
    borderWidth: 1, borderColor: '#333846',
  },
  pgChipActive: {
    backgroundColor: Colors.CyberGreen, borderColor: Colors.CyberGreen,
  },
  addPgChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, backgroundColor: '#0F291E',
    borderWidth: 1, borderColor: Colors.CyberGreen,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  mealBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, backgroundColor: '#1E1B4B',
  },
  emptySchedule: {
    backgroundColor: '#1D1F27', borderRadius: 12,
    padding: 16, alignItems: 'center', gap: 4,
  },
  scheduleDetail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0F1016', borderRadius: 12,
    borderWidth: 1, borderColor: '#1E2028',
    padding: 12, marginTop: 8,
  },
  rsvpStatBox: {
    flex: 1, backgroundColor: '#1B123C',
    borderRadius: 12, borderWidth: 1,
    padding: 10, alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 32, alignItems: 'center',
  },
  avatarBox: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  choicePill: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  allergyPill: {
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
});
