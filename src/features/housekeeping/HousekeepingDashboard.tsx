import React, { useState } from 'react';
import { View, StyleSheet, Alert, Image, RefreshControl } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Palette, Radii, DeckTints } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import {
  useComplaintsQuery,
  useSubmitComplaintMutation,
  useResolveComplaintMutation,
  getAttachmentUploadUrl,
  uploadAttachment,
  addAttachment,
} from '@/features/requests/useComplaints';
import { useMaintenanceChecklist, type ChecklistItemStatus } from './useMaintenanceChecklist';
import { formatTimeAgo, getGreeting } from '@/utils/format';
import type { FeedbackComplaintEntity } from '@/types';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { AnimatedPress, Btn, Card, ChoiceChips, Col, Divider, ErrorState, IconBtn, LoadingState, OutlinedTextField, PGowDialog, RoomPicker, Row, Spacer, Txt } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

/** `FeedbackComplaintEntity` → the shape every view in this file already renders. Keeping the
 *  UI-facing shape unchanged means MaintenanceStatsSummary / MaintenanceDashView needed no
 *  changes at all once the data feeding them became real. */
function toIssueView(c: FeedbackComplaintEntity) {
  return {
    id: c.id,
    title: c.title,
    location: [c.location, c.category].filter(Boolean).join(' • ') || 'Property',
    priority: c.priorityLabel ?? 'Medium',
    status: c.status,
    time: formatTimeAgo(c.timestamp),
  };
}

export function HousekeepingDashboard() {
  const staff = usePGowStore((s) => s.loggedInStaff);
  const logout = usePGowStore((s) => s.logout);
  const activeRole = useAuthStore((s) => s.activeRole);
  const activePgId = useAuthStore((s) => s.activePgId);
  const isMgmt = activeRole === 'owner' || activeRole === 'manager';

  const [activeTab, setActiveTab] = useState<'dash' | 'check' | 'issues' | 'profile'>('dash');
  const [checkTabCategory, setCheckTabCategory] = useState('Electrical');
  // This screen IS the entire app for a maintenance staffer (routed straight to `/housekeeping`,
  // no shared tabs layout with its own header the way chef/owner/guest get) — so the bell here
  // used to be a hardcoded no-op (`onPress={() => {}}`) with no notification query behind it at
  // all; the one role in the app whose bell never did anything.
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  const { dockStyle } = useDock();

  // Facility checks: real, but local to this device — see useMaintenanceChecklist for why
  // there is no server counterpart yet.
  const inspections = useMaintenanceChecklist((s) => s.tree);
  const setItemStatus = useMaintenanceChecklist((s) => s.setItemStatus);

  // Issues: real requests. `useComplaintsQuery` is the same query OwnerReviewsTab and
  // OwnerAnnouncementsTab already read — a maintenance staffer is in `_QUEUE_ROLES`
  // server-side (pg-backend request/service/crud.py), so this is the property's actual
  // open-issue queue, not a filtered slice of it.
  const {
    data: complaints = [],
    isLoading: complaintsLoading,
    error: complaintsError,
    refetch: refetchComplaints,
    isRefetching: isRefetchingComplaints,
  } = useComplaintsQuery(activePgId ?? undefined);
  // The query includes both complaint and feedback tickets (that split is what a resident's
  // Support tab shows); a facility issue is only ever the former.
  const issues = complaints.filter((c) => c.type === 'COMPLAINT').map(toIssueView);

  const refreshCtrl = <RefreshControl refreshing={isRefetchingComplaints} onRefresh={refetchComplaints} />;

  if (isMgmt) {
    return (
      <HubScreenWrapper title="Maintenance Progress" icon="sparkles" scrollable={true} refreshControl={refreshCtrl}>
        <MaintenanceStatsSummary inspections={inspections} issues={issues} />
      </HubScreenWrapper>
    );
  }

  return (
    <View style={styles.root}>
      {activeTab === 'dash' && (
        <MaintenanceDashView
          staff={staff}
          inspections={inspections}
          issues={issues}
          onGoToChecks={(cat: string) => { setCheckTabCategory(cat); setActiveTab('check'); }}
          refreshControl={refreshCtrl}
          unreadCount={unreadCount}
          onNotifPress={() => router.push('/notifications')}
        />
      )}
      {activeTab === 'check' && <FacilityCheckView inspections={inspections} setItemStatus={setItemStatus} selectedCat={checkTabCategory} setSelectedCat={setCheckTabCategory} />}
      {activeTab === 'issues' && (
        <IssuesSupervisionView
          issues={issues}
          pgId={activePgId}
          refreshControl={refreshCtrl}
          isLoading={complaintsLoading}
          error={complaintsError}
          onRetry={refetchComplaints}
        />
      )}
      {activeTab === 'profile' && <MaintenanceProfileView staff={staff} logout={logout} inspections={inspections} issues={issues} />}
      <View style={dockStyle as any}>
        <HeadlessDockTabButton icon="home" label="Dash" isFocused={activeTab === 'dash'} onPress={() => setActiveTab('dash')} />
        <HeadlessDockTabButton icon="checkmark-circle" label="Check" isFocused={activeTab === 'check'} onPress={() => setActiveTab('check')} />
        <HeadlessDockTabButton icon="warning" label="Issues" isFocused={activeTab === 'issues'} onPress={() => setActiveTab('issues')} />
        <HeadlessDockTabButton icon="person" label="Profile" isFocused={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
      </View>
    </View>
  );
}

// Force Metro to rebuild after syntax error fix

export function MaintenanceStatsSummary({ inspections, issues, onGoToChecks }: any) {
  const getCategoryStats = (cat: string) => {
    const items = inspections[cat] || [];
    let total = 0;
    let good = 0;
    let needsAtt = 0;
    let bad = 0;
    items.forEach((room: any) => room.items.forEach((item: any) => {
      total++;
      if (item.status === 'Working') good++;
      else if (item.status === 'Needs Attention') needsAtt++;
      else bad++;
    }));
    const statusText = bad > 0 ? 'Issue Found' : needsAtt > 0 ? 'Needs Attention' : 'Good';
    const statusColor = bad > 0 ? Colors.danger : needsAtt > 0 ? Colors.warning : Colors.success;
    return { good, total, statusText, statusColor };
  };

  const elec = getCategoryStats('Electrical');
  const clean = getCategoryStats('Cleanliness');
  const kitch = getCategoryStats('Kitchen Hygiene');
  const gen = getCategoryStats('General');
  const plumb = getCategoryStats('Plumbing');

  let totalInspections = 0;
  Object.values(inspections).forEach((cat: any) => {
    cat.forEach((room: any) => totalInspections += room.items.length);
  });

  return (
    <>
      <Row justify="space-between" align="center" style={{ marginTop: 10 }}>
        <Txt size={15} weight="700" color={Colors.textPrimary}>Today's Inspection Summary</Txt>
      </Row>

      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <AnimatedPress accessibilityRole="button" onPress={() => onGoToChecks?.('Electrical')} style={{ flex: 1, minWidth: 100 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="700" color={Colors.textPrimary} align="center" numberOfLines={1}>Electrical</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: Radii.pill, backgroundColor: elec.statusColor === Colors.success ? Colors.primary : elec.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={elec.statusColor === Colors.success ? "checkmark" : elec.statusColor === Colors.danger ? "close" : "warning"} size={14} color={Colors.textInverse} />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="700" color={Colors.textPrimary}>{elec.good} / {elec.total}</Txt>
            <Txt size={10} weight="700" color={elec.statusColor}>{elec.statusText}</Txt>
          </Card>
        </AnimatedPress>
        <AnimatedPress accessibilityRole="button" onPress={() => onGoToChecks?.('Cleanliness')} style={{ flex: 1, minWidth: 100 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="700" color={Colors.textPrimary} align="center" numberOfLines={1}>Cleanliness</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: Radii.pill, backgroundColor: clean.statusColor === Colors.success ? Colors.primary : clean.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={clean.statusColor === Colors.success ? "checkmark" : clean.statusColor === Colors.danger ? "close" : "warning"} size={14} color={Colors.textInverse} />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="700" color={Colors.textPrimary}>{clean.good} / {clean.total}</Txt>
            <Txt size={10} weight="700" color={clean.statusColor}>{clean.statusText}</Txt>
          </Card>
        </AnimatedPress>
        <AnimatedPress accessibilityRole="button" onPress={() => onGoToChecks?.('Kitchen Hygiene')} style={{ flex: 1, minWidth: 100 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="700" color={Colors.textPrimary} align="center" numberOfLines={1}>Kitchen Hygiene</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: Radii.pill, backgroundColor: kitch.statusColor === Colors.success ? Colors.primary : kitch.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={kitch.statusColor === Colors.success ? "checkmark" : kitch.statusColor === Colors.danger ? "close" : "warning"} size={14} color={Colors.textInverse} />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="700" color={Colors.textPrimary}>{kitch.good} / {kitch.total}</Txt>
            <Txt size={10} weight="700" color={kitch.statusColor}>{kitch.statusText}</Txt>
          </Card>
        </AnimatedPress>
      </Row>

      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <AnimatedPress accessibilityRole="button" onPress={() => onGoToChecks?.('Plumbing')} style={{ flex: 1, minWidth: 100 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="700" color={Colors.textPrimary} align="center" numberOfLines={1}>Plumbing</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: Radii.pill, backgroundColor: plumb.statusColor === Colors.success ? Colors.primary : plumb.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={plumb.statusColor === Colors.success ? "checkmark" : plumb.statusColor === Colors.danger ? "close" : "warning"} size={14} color={Colors.textInverse} />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="700" color={Colors.textPrimary}>{plumb.good} / {plumb.total}</Txt>
            <Txt size={10} weight="700" color={plumb.statusColor}>{plumb.statusText}</Txt>
          </Card>
        </AnimatedPress>
        <AnimatedPress accessibilityRole="button" onPress={() => onGoToChecks?.('General')} style={{ flex: 1, minWidth: 100 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="700" color={Colors.textPrimary} align="center" numberOfLines={1}>General Facilities</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: Radii.pill, backgroundColor: gen.statusColor === Colors.success ? Colors.primary : gen.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={gen.statusColor === Colors.success ? "checkmark" : gen.statusColor === Colors.danger ? "close" : "warning"} size={14} color={Colors.textInverse} />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="700" color={Colors.textPrimary}>{gen.good} / {gen.total}</Txt>
            <Txt size={10} weight="700" color={gen.statusColor}>{gen.statusText}</Txt>
          </Card>
        </AnimatedPress>
      </Row>

      <Row gap={10} style={{ marginTop: 4, flexWrap: 'wrap' }}>
        <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ flex: 1, minWidth: 140, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
          <Txt size={24} weight="700" color={Colors.primaryDark}>{totalInspections}</Txt>
          <Txt size={12} weight="700" color={Colors.textPrimary}>Total Inspections</Txt>
          <Txt size={11} color={Colors.textMuted}>This Month</Txt>
        </Card>
        <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ flex: 1, minWidth: 140, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
          <Txt size={24} weight="700" color={Colors.danger}>{issues.length}</Txt>
          <Txt size={12} weight="700" color={Colors.textPrimary}>Issues Found</Txt>
          <Txt size={11} color={Colors.textMuted}>Today</Txt>
        </Card>
      </Row>

      <Spacer size={4} />
      <Row justify="space-between" align="center">
        <Txt size={15} weight="700" color={Colors.textPrimary}>Recent Observations</Txt>
      </Row>
      <Col gap={8}>
        {issues.slice(0, 3).map((iss: any, idx: number) => {
          let color: string = Colors.danger;
          if (iss.priority === 'Medium') color = Colors.warning;
          if (iss.priority === 'Low') color = Colors.tertiary;
          return (
            <React.Fragment key={iss.id}>
              <Row align="center" gap={12}>
                {iss.priority === 'Low' ? (
                  <View style={{ width: 20, height: 20, borderRadius: Radii.pill, backgroundColor: color }} />
                ) : (
                  <Ionicons name="warning" size={20} color={color} />
                )}
                <Col style={{ flex: 1 }}>
                  <Txt size={14} weight="700" color={Colors.textPrimary}>{iss.title}</Txt>
                  <Txt size={12} color={Colors.textMuted}>{iss.location}</Txt>
                </Col>
                <Col align="flex-end">
                  <Txt size={12} weight="700" color={color}>{iss.priority}</Txt>
                  <Txt size={10} color={Colors.textMuted}>{iss.time}</Txt>
                </Col>
              </Row>
              {idx < 2 && <View style={{ marginVertical: 4 }}><Divider color={Colors.borderSubtle} /></View>}
            </React.Fragment>
          )
        })}
      </Col>
    </>
  );
}

function MaintenanceDashView({ staff, inspections, issues, onGoToChecks, refreshControl, unreadCount, onNotifPress }: any) {
  const firstName = staff?.name?.split(' ')[0] || 'there';
  return (
    <FormScroll bottomPadding={120} contentContainerStyle={{ padding: 18, gap: 16 }} refreshControl={refreshControl}>
      <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
        <Row gap={12} align="center">
          <Ionicons name="menu" size={28} color={Colors.primaryDark} />
          <View style={{ width: 44, height: 44, borderRadius: Radii.pill, backgroundColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={24} color={Colors.primary} />
          </View>
          <Col>
            <Txt size={18} weight="700" color={Colors.primaryDark}>{getGreeting()}, {firstName} 👋</Txt>
            <Txt size={12} weight="700" color={Colors.textMuted}>Maintenance Staff</Txt>
          </Col>
        </Row>
        <View style={{ position: 'relative' }}>
          <IconBtn icon="notifications" size={24} tint={Colors.primary} onPress={onNotifPress} />
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: Radii.pill, backgroundColor: Colors.danger }} />
          )}
        </View>
      </Row>

      <MaintenanceStatsSummary inspections={inspections} issues={issues} onGoToChecks={onGoToChecks} />
    </FormScroll>
  );
}

function FacilityCheckView({ inspections, setItemStatus, selectedCat, setSelectedCat }: any) {
  const toast = useToast();
  const [activeArea, setActiveArea] = useState('All Areas');
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  const cats = [
    { id: 'Electrical', icon: 'flash' },
    { id: 'Cleanliness', icon: 'color-fill' },
    { id: 'Kitchen Hygiene', icon: 'restaurant' },
    { id: 'Plumbing', icon: 'water' },
    { id: 'General', icon: 'business' }
  ];

  // Reset area filter when changing categories
  const handleCatChange = (catId: string) => {
    setSelectedCat(catId);
    setActiveArea('All Areas');
    setShowAreaPicker(false);
  };

  const currentRooms = inspections[selectedCat] || [];

  // Dynamically compute available areas based on current rooms
  const availableAreas = ['All Areas', ...currentRooms.map((r: any) => r.room)];

  // Filter rooms to display
  const displayedRooms = activeArea === 'All Areas'
    ? currentRooms
    : currentRooms.filter((r: any) => r.room === activeArea);

  let completedItems = 0;
  let totalItems = 0;

  // Progress is always calculated over the entire category (currentRooms), not just the filtered view
  currentRooms.forEach((r: any) => {
    r.items.forEach((item: any) => {
      totalItems++;
      if (['Working', 'Needs Attention', 'Not Working'].includes(item.status)) {
        completedItems++;
      }
    });
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const handleSelectStatus = (roomIdx: number, itemIdx: number, status: ChecklistItemStatus) => {
    const room = displayedRooms[roomIdx];
    const item = room.items[itemIdx];
    // Writes straight into the persisted store — every toggle is saved to this device the
    // instant it happens, not batched behind the "Save Progress" button below.
    setItemStatus(selectedCat, room.room, item.name, status);
    setOpenDropdown(null);
  };

  const saveProgress = () => {
    setShowSaveConfirm(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 18, paddingBottom: 16, backgroundColor: Colors.canvas, zIndex: 10, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
        <Txt size={22} weight="700" color={Colors.primaryDark}>Facility Checks</Txt>
        <Spacer size={16} />
        <Row justify="space-between" style={{ paddingHorizontal: 4 }}>
          {cats.map(c => {
            const isSelected = selectedCat === c.id;
            return (
              <AnimatedPress accessibilityRole="button" key={c.id} onPress={() => handleCatChange(c.id)} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ width: 56, height: 56, borderRadius: Radii.card, backgroundColor: isSelected ? Colors.primary : Colors.surface, borderWidth: isSelected ? 0 : 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: isSelected ? Colors.primary : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: isSelected ? 4 : 0 }}>
                  <Ionicons name={c.icon as any} size={24} color={isSelected ? Colors.textInverse : Colors.textMuted} />
                </View>
                <Txt size={10} weight={isSelected ? "900" : "700"} color={isSelected ? Colors.primaryDark : Colors.textMuted} align="center">{c.id.split(' ')[0]}</Txt>
              </AnimatedPress>
            );
          })}
        </Row>
      </View>

      <FormScroll bottomPadding={160} contentContainerStyle={{ padding: 18, paddingTop: 18, gap: 16 }}>
        {/* Progress Header */}
        <Row justify="space-between" align="flex-end">
          <Txt size={15} weight="700" color={Colors.textPrimary}>{selectedCat} Inspection</Txt>
          <Txt size={12} weight="700" color={Colors.primary}>{completedItems} / {totalItems} Completed</Txt>
        </Row>
        <View style={[styles.progressTrack, { height: 6, backgroundColor: Colors.surfaceElevated }]}>
          <View style={[styles.progressFill, { width: totalItems ? `${(completedItems / totalItems) * 100}%` : '0%', backgroundColor: Colors.primary, borderRadius: Radii.badge }]} />
        </View>

        <Spacer size={4} />

        {/* Area / Floor Filter */}
        {selectedCat === 'Electrical' && (
          <>
            <AnimatedPress accessibilityRole="button" onPress={() => setShowAreaPicker(!showAreaPicker)} style={{ backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle }}>
              <Row justify="space-between" align="center">
                <Txt size={14} color={Colors.textMuted}>Select Area / Floor</Txt>
                <Row align="center" gap={4}>
                  <Txt size={14} weight="700" color={Colors.textPrimary}>{activeArea}</Txt>
                  <Ionicons name={showAreaPicker ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                </Row>
              </Row>
            </AnimatedPress>

            {/* Expanded Area Picker */}
            {showAreaPicker && (
              <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radii.card, marginTop: -8, overflow: 'hidden', zIndex: 10 }}>
                {availableAreas.map(area => (
                  <AnimatedPress accessibilityRole="button" key={area} onPress={() => { setActiveArea(area); setShowAreaPicker(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt size={14} weight={activeArea === area ? "900" : "700"} color={activeArea === area ? Colors.primary : Colors.textPrimary}>{area}</Txt>
                    {activeArea === area && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </AnimatedPress>
                ))}
              </View>
            )}
          </>
        )}

        {/* Room Checklists */}
        {displayedRooms.map((roomGrp: any, rIdx: number) => (
          <Card key={roomGrp.room} containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt size={16} weight="700" color={Colors.primaryDark}>{roomGrp.room}</Txt>
            <Spacer size={12} />
            {roomGrp.items.map((item: any, iIdx: number) => {
              const dropdownKey = `${rIdx}-${iIdx}`;
              const isOpen = openDropdown === dropdownKey;
              return (
                <View key={item.name} style={{ marginVertical: 6 }}>
                  <Row justify="space-between" align="center">
                    <Txt size={14} weight="700" color={Colors.textPrimary}>{item.name}</Txt>
                    <AnimatedPress accessibilityRole="button"
                      onPress={() => setOpenDropdown(isOpen ? null : dropdownKey)}
                      style={{ minWidth: 130, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', backgroundColor: Colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.control, borderWidth: 1, borderColor: isOpen ? Colors.primary : Colors.borderSubtle }}
                    >
                      <Row align="center" gap={6}>
                        {item.status === 'Working' && <Ionicons name="checkmark-circle" size={16} color={Colors.success} />}
                        {item.status === 'Needs Attention' && <Ionicons name="warning" size={16} color="#F97316" />}
                        {item.status === 'Not Working' && <Ionicons name="close-circle" size={16} color={Colors.danger} />}
                        <Txt size={13} weight="700" color={item.status === 'Working' ? Colors.success : item.status === 'Needs Attention' ? '#F97316' : Colors.danger}>
                          {item.status === 'Needs Attention' ? 'Attention' : item.status === 'Not Working' ? 'Broken' : 'Working'}
                        </Txt>
                      </Row>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                    </AnimatedPress>
                  </Row>

                  {isOpen && (
                    <View style={{ backgroundColor: Colors.canvas, borderRadius: Radii.control, marginTop: 8, padding: 4, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                      <AnimatedPress accessibilityRole="button" onPress={() => handleSelectStatus(rIdx, iIdx, 'Working')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} /><Txt size={14} weight="700" color={Colors.textPrimary}>Working</Txt>
                      </AnimatedPress>
                      <AnimatedPress accessibilityRole="button" onPress={() => handleSelectStatus(rIdx, iIdx, 'Needs Attention')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                        <Ionicons name="warning" size={18} color="#F97316" /><Txt size={14} weight="700" color={Colors.textPrimary}>Needs Attention</Txt>
                      </AnimatedPress>
                      <AnimatedPress accessibilityRole="button" onPress={() => handleSelectStatus(rIdx, iIdx, 'Not Working')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
                        <Ionicons name="close-circle" size={18} color={Colors.danger} /><Txt size={14} weight="700" color={Colors.textPrimary}>Broken</Txt>
                      </AnimatedPress>
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        ))}

        <Spacer size={20} />

        {/* Save Progress Button */}
        <Btn containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={56} onPress={saveProgress} style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
          <Txt size={16} weight="700">Save Progress</Txt>
        </Btn>
      </FormScroll>

      {/* The confirm half is a decision, so a dialog. The success half was a second state of
          the same sheet saying "saved on this device" with one Done button — feedback nobody
          has to act on, which is a toast. Two states of one modal became one dialog and one
          toast. */}
      <PGowDialog
        visible={showSaveConfirm}
        title="Finish this check?"
        message="Your changes are already saved as you tick them — this just confirms you're done with this round."
        confirmLabel="Done for now"
        cancelLabel="Keep checking"
        onConfirm={() => {
          setShowSaveConfirm(false);
          toast('success', 'Saved on this device', 'Your inspection progress will still be here next time you open the app.');
        }}
        onCancel={() => setShowSaveConfirm(false)}
        testID="housekeeping_save_confirm"
      />
    </View>
  );
}

function IssuesSupervisionView({ issues, pgId, refreshControl, isLoading, error, onRetry }: {
  issues: any[];
  pgId: string | null;
  refreshControl?: React.ReactNode;
  // Passed down rather than re-queried here: the parent owns the complaints query, and a
  // second `useComplaintsQuery` in this child would be a separate cache subscriber that can
  // disagree with the list it is describing.
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const toast = useToast();
  const submitIssue = useSubmitComplaintMutation(pgId ?? undefined);
  const resolveIssue = useResolveComplaintMutation(pgId ?? undefined);

  const [showForm, setShowForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newLocDetail, setNewLocDetail] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);


  const [err, setErr] = useState('');

  const CATS = ['Electrical', 'Cleanliness', 'Kitchen Hygiene', 'Plumbing', 'General Facilities'];
  const LOCS = ['Room', 'Bathroom', 'Kitchen', 'Corridor', 'Common Area', 'Entrance', 'Floor', 'Other'];

  if (showForm) {
    if (isSuccess) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 100 }}>
          <View style={{ width: 80, height: 80, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Ionicons name="checkmark" size={40} color={Colors.success} />
          </View>
          <Txt size={24} weight="700" color={Colors.primaryDark} align="center">Issue Reported</Txt>
          <Spacer size={12} />
          <Txt size={15} color={Colors.textMuted} align="center">The maintenance issue has been added successfully.</Txt>
          <Spacer size={32} />
          <Btn containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={50} style={{ width: '100%' }} onPress={() => { setShowForm(false); setIsSuccess(false); }}>
            <Txt size={16} weight="700">View Issues</Txt>
          </Btn>
        </View>
      );
    }

    const handleCapturePhoto = async () => {
      try {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Denied', 'Camera permissions are required to capture a photo.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPhotoUri(result.assets[0].uri);
          setHasPhoto(true);
        }
      } catch (e) {
        Alert.alert('Error', 'Could not open the camera.');
      }
    };

    // Was entirely local: `setIssues([newItem, ...issues])` plus a hack that spliced a
    // fabricated entry into the Facility Checks tree so the two screens looked connected.
    // Neither ever left the device — the "Issue Reported" success screen appeared whether or
    // not anything had actually happened. Now it really does: `kind: 'complaint'`, the same
    // request type OwnerReviewsTab/OwnerAnnouncementsTab already read, so this lands in the
    // owner/manager inbox with a real push (create_request → notify(), pg-backend
    // request/service/crud.py) and can be escalated via Book a Technician like any other.
    const handleAddIssue = async () => {
      if (!newCat) return setErr('Please select a category.');
      if (!newLoc) return setErr('Please select a location.');
      if (!newTitle.trim()) return setErr('Please describe the issue.');
      if (!pgId) return setErr('No active property.');

      const fullLoc = newLocDetail.trim() ? `${newLoc} ${newLocDetail.trim()}` : newLoc;
      // High → 'express' so create_request's own notify() marks the push urgent for the
      // owner/manager; Low/Medium stay 'normal'. The 3-way Low/Medium/High label a
      // maintenance worker actually thinks in has no server column, so it rides in
      // `details.severity` and mappers.ts reads it back for display (toComplaint).
      const priority = newPriority === 'High' ? 'express' : 'normal';

      try {
        const created = await submitIssue.mutateAsync({
          pg_id: pgId,
          kind: 'complaint',
          category: newCat,
          title: newTitle.trim(),
          description: newNotes.trim(),
          priority,
          details: { severity: newPriority, location: fullLoc },
        });

        if (hasPhoto && photoUri) {
          try {
            const { upload_url, object_key } = await getAttachmentUploadUrl(created.id, 'image/jpeg');
            await uploadAttachment(upload_url, photoUri, 'image/jpeg');
            await addAttachment(created.id, { object_key, content_type: 'image/jpeg' });
          } catch (err) {
            // The ticket itself was created; only the photo did not attach.
            console.warn('[PGow] maintenance issue filed but photo failed to attach:', err);
          }
        }

        setNewTitle('');
        setNewNotes('');
        setNewLoc('');
        setNewLocDetail('');
        setNewCat('');
        setNewPriority('Medium');
        setHasPhoto(false);
        setPhotoUri(null);
        setErr('');
        setIsSuccess(true);
      } catch (err) {
        setErr(err instanceof Error ? err.message : 'Could not report this issue. Check your connection and try again.');
      }
    };

    return (
      <View style={{ flex: 1 }}>
        <FormScroll bottomPadding={40} contentContainerStyle={{ padding: 20 }}>
          {/* Header */}
          <Row align="flex-start" justify="space-between">
            <Col>
              <Txt size={24} weight="700" color={Colors.primaryDark}>Report Issue</Txt>
              <Txt size={13} weight="700" color={Colors.textMuted} style={{ marginTop: 2 }}>Help keep the PG safe and well maintained</Txt>
            </Col>
            <View style={{ marginTop: -4 }}><IconBtn onPress={() => setShowForm(false)} icon="close" size={28} tint={Colors.textMuted} /></View>
          </Row>

          <Spacer size={24} />

          {/* Validation Error */}
          {err ? (
            <View style={{ backgroundColor: Palette.TintRed, padding: 12, borderRadius: Radii.control, marginBottom: 16 }}>
              <Txt size={13} weight="700" color={Colors.danger}>{err}</Txt>
            </View>
          ) : null}

          {/* Category */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>Category</Txt>
          <Spacer size={8} />
          <ChoiceChips
            options={CATS}
            columns={2}
            value={newCat || null}
            onChange={(c) => { setNewCat(c); setErr(''); }}
            testID="issue_category"
          />

          <Spacer size={20} />

          {/* Location — eight areas is a chip row, not a dropdown. The dropdown hid its own
              options behind a tap and then pushed the rest of the form down when opened; the
              chips are all visible at once and the form does not move. When the area is a
              room, the room itself comes from the property layout rather than a number box —
              "204" typed here does not have to be a room that exists. */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>Where is it?</Txt>
          <Spacer size={8} />
          <ChoiceChips
            options={LOCS}
            value={newLoc || null}
            onChange={(l) => { setNewLoc(l); setErr(''); if (l !== 'Room') setNewLocDetail(''); }}
            testID="issue_area"
          />
          {newLoc === 'Room' ? (
            <>
              <Spacer size={14} />
              <RoomPicker pgId={pgId} value={newLocDetail} onChange={setNewLocDetail} label="Room" testID="issue_room" />
            </>
          ) : null}

          <Spacer size={20} />

          {/* Issue Description */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>What's wrong?</Txt>
          <Spacer size={8} />
          <View style={[styles.inputBox, { height: 100, justifyContent: 'flex-start', paddingVertical: 12, backgroundColor: Colors.surface }]}>
            <OutlinedTextField
              placeholder="Describe the issue briefly"
              multiline
              value={newTitle}
              onChangeText={(t) => { setNewTitle(t); setErr(''); }}
            />
          </View>

          <Spacer size={20} />

          {/* Priority */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>Priority</Txt>
          <Spacer size={8} />
          <Row gap={10}>
            <AnimatedPress accessibilityRole="button" onPress={() => setNewPriority('Low')} style={{ flex: 1, height: 46, borderRadius: Radii.control, backgroundColor: newPriority === 'Low' ? Colors.surfaceMuted : Colors.surface, borderWidth: 2, borderColor: newPriority === 'Low' ? Colors.textMuted : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              {newPriority === 'Low' && <Ionicons name="checkmark" size={16} color={Colors.textPrimary} />}
              <Txt size={14} weight="700" color={Colors.textPrimary}>Low</Txt>
            </AnimatedPress>
            <AnimatedPress accessibilityRole="button" onPress={() => setNewPriority('Medium')} style={{ flex: 1, height: 46, borderRadius: Radii.control, backgroundColor: newPriority === 'Medium' ? '#FFEDD5' : Colors.surface, borderWidth: 2, borderColor: newPriority === 'Medium' ? '#F97316' : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              {newPriority === 'Medium' && <Ionicons name="checkmark" size={16} color="#F97316" />}
              <Txt size={14} weight="700" color={newPriority === 'Medium' ? '#F97316' : Colors.textPrimary}>Medium</Txt>
            </AnimatedPress>
            <AnimatedPress accessibilityRole="button" onPress={() => setNewPriority('High')} style={{ flex: 1, height: 46, borderRadius: Radii.control, backgroundColor: newPriority === 'High' ? Palette.TintRed : Colors.surface, borderWidth: 2, borderColor: newPriority === 'High' ? Colors.danger : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              {newPriority === 'High' && <Ionicons name="checkmark" size={16} color={Colors.danger} />}
              <Txt size={14} weight="700" color={newPriority === 'High' ? Colors.danger : Colors.textPrimary}>High</Txt>
            </AnimatedPress>
          </Row>

          <Spacer size={20} />

          {/* Photo */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>Add Photo</Txt>
          <Txt size={12} weight="700" color={Colors.textMuted} style={{ marginTop: 2 }}>Optional · Recommended for faster resolution</Txt>
          <Spacer size={8} />
          {hasPhoto && photoUri ? (
            <View style={{ height: 160, borderRadius: Radii.card, backgroundColor: '#E5E7EB', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle }}>
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
              <Row gap={16} style={{ position: 'absolute', bottom: 16 }}>
                <AnimatedPress accessibilityRole="button" onPress={handleCapturePhoto} style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.sheet }}><Txt size={13} weight="700" color={Colors.textPrimary}>Retake</Txt></AnimatedPress>
                <AnimatedPress accessibilityRole="button" onPress={() => { setHasPhoto(false); setPhotoUri(null); }} style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.sheet }}><Txt size={13} weight="700" color={Colors.danger}>Remove</Txt></AnimatedPress>
              </Row>
            </View>
          ) : (
            <AnimatedPress accessibilityRole="button" onPress={handleCapturePhoto} style={{ height: 100, borderRadius: Radii.card, backgroundColor: Colors.surface, borderStyle: 'dashed', borderWidth: 2, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={32} color={Colors.primary} />
              <Spacer size={4} />
              <Txt size={14} weight="700" color={Colors.primary}>Add Photo</Txt>
              <Txt size={12} color={Colors.textMuted}>Show the issue clearly</Txt>
            </AnimatedPress>
          )}

          <Spacer size={20} />

          {/* Additional Notes */}
          <Txt size={14} weight="700" color={Colors.textPrimary}>Additional Notes</Txt>
          <Spacer size={8} />
          <View style={[styles.inputBox, { height: 80, justifyContent: 'flex-start', paddingVertical: 12, backgroundColor: Colors.surface }]}>
            <OutlinedTextField
              placeholder="Anything else the maintenance team should know?"
              multiline
              value={newNotes}
              onChangeText={setNewNotes}
            />
          </View>

        </FormScroll>

        {/* Fixed Footer */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, backgroundColor: Colors.canvas, borderTopWidth: 1, borderColor: Colors.borderSubtle }}>
          <Btn
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.card}
            height={56}
            onPress={handleAddIssue}
            disabled={submitIssue.isPending}
            loading={submitIssue.isPending}
          >
            <Txt size={16} weight="700">{submitIssue.isPending ? 'Reporting…' : 'Report Issue'}</Txt>
          </Btn>
        </View>
      </View>
    );
  }

  const filters = ['All', 'High', 'Medium', 'Low', 'Resolved'];

  const displayedIssues = activeFilter === 'All' ? issues : issues.filter((i: any) => i.priority === activeFilter || i.status === activeFilter);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 18, paddingBottom: 0 }}>
        <Row justify="space-between" align="center">
          <Txt size={22} weight="700" color={Colors.primaryDark}>Issues Found</Txt>
          <Btn containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={32} contentStyle={{ paddingHorizontal: 12 }} onPress={() => setShowForm(true)}>
            <Txt size={11} weight="700">+ Report Issue</Txt>
          </Btn>
        </Row>
        <Spacer size={16} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {filters.map(f => {
            const isSelected = activeFilter === f;
            let color: string = Colors.textMuted;
            if (isSelected && f === 'All') color = Colors.textInverse;
            else if (isSelected) color = Colors.textInverse;
            else if (f === 'High') color = Colors.danger;
            else if (f === 'Medium') color = '#F97316';
            else if (f === 'Low') color = '#EAB308';
            else color = Colors.textPrimary;

            return (
              <Btn key={f} onPress={() => setActiveFilter(f)} containerColor={isSelected ? Colors.primary : Colors.canvas} textColor={color} borderRadius={Radii.card} height={32} contentStyle={{ paddingHorizontal: 12 }}>
                <Txt size={13} weight="700" color={color}>{f}</Txt>
              </Btn>
            );
          })}
        </FormScroll>
      </View>
      <FormScroll bottomPadding={180} contentContainerStyle={{ padding: 18, gap: 16 }} refreshControl={refreshControl as any}>
        {/* "No issues found" is good news to a maintenance worker, so it must not also be what
            a failed or still-loading fetch looks like — that is how a real ticket gets missed. */}
        {isLoading ? (
          <LoadingState label="Loading issues…" fill={false} />
        ) : error ? (
          <ErrorState
            error={error}
            title="Could not load issues"
            onRetry={onRetry}
            fill={false}
          />
        ) : displayedIssues.length === 0 ? (
          <Txt size={14} color={Colors.textMuted} align="center" style={{ marginTop: 40 }}>No issues found</Txt>
        ) : (
          displayedIssues.map((iss: any) => {
            let color: string = Colors.danger;
            let bgColor: string = Palette.TintRed;
            let icon = "snow-outline";
            if (iss.priority === 'Medium') { color = '#F97316'; bgColor = '#FFEDD5'; icon = "water-outline"; }
            if (iss.priority === 'Low') { color = '#EAB308'; bgColor = '#FEF9C3'; icon = "briefcase-outline"; }

            return (
              <AnimatedPress accessibilityRole="button" key={iss.id} onPress={() => setSelectedIssue(iss)}>
                <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={0} padding={[0, 0]} style={{ overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ width: 4, position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color }} />
                  <View style={{ padding: 16, paddingLeft: 20 }}>
                    <Row justify="space-between" align="flex-start">
                      <Row gap={12} align="center" style={{ flex: 1, paddingRight: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: Radii.pill, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={icon as any} size={24} color={color} />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <View style={{ backgroundColor: bgColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.control, alignSelf: 'flex-start', marginBottom: 4 }}>
                            <Txt size={10} weight="700" color={color}>{iss.priority}</Txt>
                          </View>
                          <Txt size={16} weight="700" color={Colors.textPrimary}>{iss.title}</Txt>
                          <Txt size={13} color={Colors.textMuted} style={{ marginTop: 2 }}>{iss.location}</Txt>
                        </Col>
                      </Row>
                      <Col align="flex-end">
                        <Txt size={12} weight="700" color={iss.status === 'Resolved' ? Colors.success : Colors.primary}>{iss.status}</Txt>
                      </Col>
                    </Row>
                    <Spacer size={16} />
                    <Row justify="space-between" align="center">
                      <Txt size={12} color={Colors.textMuted}>Reported: {iss.time}</Txt>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </Row>
                  </View>
                </Card>
              </AnimatedPress>
            );
          })
        )}
      </FormScroll>
      <View style={{ position: 'absolute', bottom: 90, right: 20 }}>
        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button"
          onPress={() => setShowForm(true)}
          style={{ width: 60, height: 60, borderRadius: Radii.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
        >
          <Ionicons name="add" size={32} color={Colors.textInverse} />
        </AnimatedPress>
      </View>

      {/* Resolving is terminal server-side — `workflow.py` refuses any transition out of
          RESOLVED with a 409 — so there is no undo to offer and this stays a confirmation.
          The "Already Resolved" branch was informational; tapping a resolved issue now just
          says so and closes, with no modal at all. */}
      <PGowDialog
        visible={!!selectedIssue && selectedIssue?.status !== 'Resolved'}
        title="Mark as resolved?"
        message={`"${selectedIssue?.title}" — the resident who reported it will see this. It cannot be reopened.`}
        confirmLabel={resolveIssue.isPending ? 'Resolving…' : 'Resolve'}
        busy={resolveIssue.isPending}
        onConfirm={async () => {
          if (!selectedIssue) return;
          try {
            await resolveIssue.mutateAsync({ id: selectedIssue.id });
            setSelectedIssue(null);
            toast('success', 'Resolved', 'The resident has been notified.');
          } catch (err) {
            toast('error', 'Could not resolve', err instanceof Error ? err.message : 'Please try again.');
          }
        }}
        onCancel={() => setSelectedIssue(null)}
        testID="housekeeping_resolve"
      />
    </View>
  );
}

function MaintenanceProfileView({ staff, logout, hideLogout, inspections, issues }: any) {
  // Same reasoning as every other plain confirmation in the app — see Sheet's header.
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your PIN to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <FormScroll bottomPadding={120} contentContainerStyle={{ padding: 18, gap: 16 }}>
      {/* Was a navy gradient card with white text and an emoji avatar — the last of the
          pre-redesign heroes. Now the same tinted deck surface every other role's identity
          block uses, so a maintenance staffer's profile and an owner's read as one app. */}
      <View style={styles.identityCard}>
        <View style={styles.avatarBox}>
          <Ionicons name="construct" size={26} color={DeckTints.brand.ink} />
        </View>
        <Spacer size={10} />
        <Txt size={19} weight="700" color={DeckTints.brand.ink}>{staff?.name ?? 'Staff'}</Txt>
        <Txt size={13} weight="600" color={DeckTints.brand.sub}>Maintenance staff</Txt>
        <Spacer size={4} />
        <Txt size={11.5} color={DeckTints.brand.sub} tabular>
          {staff?.id ? `MS-${staff.id.slice(0, 4).toUpperCase()}` : 'Employee ID unavailable'}
        </Txt>
      </View>

      <Spacer size={20} />
      <View style={styles.sectionHeader}>
        <Txt size={13} weight="700" color={Colors.textSecondary}>STATUS & INFO</Txt>
      </View>
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle}>
        <Row justify="space-between" align="center" style={styles.profileRow}>
          <Row gap={12} align="center">
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="radio-button-on" size={18} color={Colors.success} /></View>
            <Txt size={14} weight="700" color={Colors.textPrimary}>Availability</Txt>
          </Row>
          <Txt size={14} weight="700" color={Colors.success}>Available</Txt>
        </Row>
        <View style={styles.divider} />
        <Row justify="space-between" align="center" style={styles.profileRow}>
          <Row gap={12} align="center">
            <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="business" size={18} color={Colors.textPrimary} /></View>
            <Txt size={14} weight="700" color={Colors.textPrimary}>Department</Txt>
          </Row>
          <Txt size={14} weight="700" color={Colors.textMuted}>Facility Maintenance</Txt>
        </Row>
      </Card>

      {inspections && issues && (
        <>
          <Spacer size={16} />
          <MaintenanceStatsSummary inspections={inspections} issues={issues} />
        </>
      )}

      <Spacer size={16} />
      {!hideLogout && (
        <Btn onPress={confirmSignOut} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={Radii.control} height={50}>
          <Ionicons name="exit" size={20} color={Colors.textInverse} />
          <Txt size={14} weight="700" style={{ marginLeft: 8 }}>Sign Out</Txt>
        </Btn>
      )}

</FormScroll>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    borderRadius: Radii.feature,
    backgroundColor: DeckTints.brand.fill,
    padding: 20,
    alignItems: 'center' },
  root: { flex: 1, backgroundColor: Colors.canvas },
  inputBox: { backgroundColor: Colors.surfaceMuted, borderRadius: Radii.control, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12, height: 46, justifyContent: 'center' },
  avatarBox: { width: 80, height: 80, borderRadius: Radii.pill, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  profileRow: { padding: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  iconBox: { width: 32, height: 32, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, backgroundColor: Colors.surfaceMuted, borderRadius: Radii.badge, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
});
export default HousekeepingDashboard;
