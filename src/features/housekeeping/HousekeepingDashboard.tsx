import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, TextInput, Image, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, Divider, IconBtn } from '@/components/ui';
import { Colors, Radii } from '@/theme';
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
import { formatTimeAgo } from '@/utils/format';
import type { FeedbackComplaintEntity } from '@/types';

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

  const { dockStyle } = useDock();

  // Facility checks: real, but local to this device — see useMaintenanceChecklist for why
  // there is no server counterpart yet.
  const inspections = useMaintenanceChecklist((s) => s.tree);
  const setItemStatus = useMaintenanceChecklist((s) => s.setItemStatus);

  // Issues: real requests. `useComplaintsQuery` is the same query OwnerReviewsTab and
  // OwnerAnnouncementsTab already read — a maintenance staffer is in `_QUEUE_ROLES`
  // server-side (pg-backend request/service/crud.py), so this is the property's actual
  // open-issue queue, not a filtered slice of it.
  const { data: complaints = [] } = useComplaintsQuery(activePgId ?? undefined);
  // The query includes both complaint and feedback tickets (that split is what a resident's
  // Support tab shows); a facility issue is only ever the former.
  const issues = complaints.filter((c) => c.type === 'COMPLAINT').map(toIssueView);

  if (isMgmt) {
    return (
      <HubScreenWrapper title="Maintenance Progress" icon="sparkles" scrollable={true}>
        <MaintenanceStatsSummary inspections={inspections} issues={issues} />
      </HubScreenWrapper>
    );
  }

  return (
    <View style={styles.root}>
      {activeTab === 'dash' && <MaintenanceDashView inspections={inspections} issues={issues} onGoToChecks={(cat: string) => { setCheckTabCategory(cat); setActiveTab('check'); }} />}
      {activeTab === 'check' && <FacilityCheckView inspections={inspections} setItemStatus={setItemStatus} selectedCat={checkTabCategory} setSelectedCat={setCheckTabCategory} />}
      {activeTab === 'issues' && <IssuesSupervisionView issues={issues} pgId={activePgId} />}
      {activeTab === 'profile' && <MaintenanceProfileView staff={staff} logout={logout} />}
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
        <Txt size={15} weight="900" color={Colors.textPrimary}>Today's Inspection Summary</Txt>
      </Row>

      <Row gap={10}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onGoToChecks?.('Electrical')} style={{ flex: 1 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1}>Electrical</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: elec.statusColor === Colors.success ? Colors.primary : elec.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={elec.statusColor === Colors.success ? "checkmark" : elec.statusColor === Colors.danger ? "close" : "warning"} size={14} color="#FFF" />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="900" color={Colors.textPrimary}>{elec.good} / {elec.total}</Txt>
            <Txt size={10} weight="700" color={elec.statusColor}>{elec.statusText}</Txt>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onGoToChecks?.('Cleanliness')} style={{ flex: 1 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1}>Cleanliness</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: clean.statusColor === Colors.success ? Colors.primary : clean.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={clean.statusColor === Colors.success ? "checkmark" : clean.statusColor === Colors.danger ? "close" : "warning"} size={14} color="#FFF" />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="900" color={Colors.textPrimary}>{clean.good} / {clean.total}</Txt>
            <Txt size={10} weight="700" color={clean.statusColor}>{clean.statusText}</Txt>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onGoToChecks?.('Kitchen Hygiene')} style={{ flex: 1 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1}>Kitchen Hygiene</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: kitch.statusColor === Colors.success ? Colors.primary : kitch.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={kitch.statusColor === Colors.success ? "checkmark" : kitch.statusColor === Colors.danger ? "close" : "warning"} size={14} color="#FFF" />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="900" color={Colors.textPrimary}>{kitch.good} / {kitch.total}</Txt>
            <Txt size={10} weight="700" color={kitch.statusColor}>{kitch.statusText}</Txt>
          </Card>
        </TouchableOpacity>
      </Row>

      <Row gap={10}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onGoToChecks?.('Plumbing')} style={{ flex: 1 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1}>Plumbing</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: plumb.statusColor === Colors.success ? Colors.primary : plumb.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={plumb.statusColor === Colors.success ? "checkmark" : plumb.statusColor === Colors.danger ? "close" : "warning"} size={14} color="#FFF" />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="900" color={Colors.textPrimary}>{plumb.good} / {plumb.total}</Txt>
            <Txt size={10} weight="700" color={plumb.statusColor}>{plumb.statusText}</Txt>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onGoToChecks?.('General')} style={{ flex: 1 }}>
          <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 8]} style={{ flex: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1}>General Facilities</Txt>
            <Spacer size={8} />
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: gen.statusColor === Colors.success ? Colors.primary : gen.statusColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={gen.statusColor === Colors.success ? "checkmark" : gen.statusColor === Colors.danger ? "close" : "warning"} size={14} color="#FFF" />
            </View>
            <Spacer size={8} />
            <Txt size={16} weight="900" color={Colors.textPrimary}>{gen.good} / {gen.total}</Txt>
            <Txt size={10} weight="700" color={gen.statusColor}>{gen.statusText}</Txt>
          </Card>
        </TouchableOpacity>
      </Row>

      <Row gap={10} style={{ marginTop: 4 }}>
        <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ flex: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
          <Txt size={24} weight="900" color={Colors.primaryDark}>{totalInspections}</Txt>
          <Txt size={12} weight="900" color={Colors.textPrimary}>Total Inspections</Txt>
          <Txt size={11} color={Colors.textMuted}>This Month</Txt>
        </Card>
        <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ flex: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
          <Txt size={24} weight="900" color={Colors.danger}>{issues.length}</Txt>
          <Txt size={12} weight="900" color={Colors.textPrimary}>Issues Found</Txt>
          <Txt size={11} color={Colors.textMuted}>Today</Txt>
        </Card>
      </Row>

      <Spacer size={4} />
      <Row justify="space-between" align="center">
        <Txt size={15} weight="900" color={Colors.textPrimary}>Recent Observations</Txt>
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
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color }} />
                 ) : (
                    <Ionicons name="warning" size={20} color={color} />
                 )}
                 <Col style={{ flex: 1 }}>
                   <Txt size={14} weight="900" color={Colors.textPrimary}>{iss.title}</Txt>
                   <Txt size={12} color={Colors.textMuted}>{iss.location}</Txt>
                 </Col>
                 <Col align="flex-end">
                   <Txt size={12} weight="800" color={color}>{iss.priority}</Txt>
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

function MaintenanceDashView({ inspections, issues, onGoToChecks }: any) {
  return (
    <FormScroll bottomPadding={120} contentContainerStyle={{ padding: 18, gap: 16 }}>
      <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
        <Row gap={12} align="center">
          <Ionicons name="menu" size={28} color={Colors.primaryDark} />
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={24} color={Colors.primary} />
          </View>
          <Col>
            <Txt size={18} weight="900" color={Colors.primaryDark}>Good Morning, Arjun 👋</Txt>
            <Txt size={12} weight="700" color={Colors.textMuted}>Maintenance Staff</Txt>
          </Col>
        </Row>
        <IconBtn icon="notifications" size={24} tint={Colors.primary} onPress={() => {}} />
      </Row>

      <MaintenanceStatsSummary inspections={inspections} issues={issues} onGoToChecks={onGoToChecks} />
    </FormScroll>
  );
}

function FacilityCheckView({ inspections, setItemStatus, selectedCat, setSelectedCat }: any) {
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
  const [isSyncSuccess, setIsSyncSuccess] = useState(false);

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
        <Txt size={22} weight="900" color={Colors.primaryDark}>Facility Checks</Txt>
        <Spacer size={16} />
        <Row justify="space-between" style={{ paddingHorizontal: 4 }}>
          {cats.map(c => {
             const isSelected = selectedCat === c.id;
             return (
               <TouchableOpacity key={c.id} onPress={() => handleCatChange(c.id)} activeOpacity={0.8} style={{ alignItems: 'center', flex: 1 }}>
                 <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: isSelected ? Colors.primary : Colors.surface, borderWidth: isSelected ? 0 : 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: isSelected ? Colors.primary : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: isSelected ? 4 : 0 }}>
                   <Ionicons name={c.icon as any} size={24} color={isSelected ? '#FFF' : Colors.textMuted} />
                 </View>
                 <Txt size={10} weight={isSelected ? "900" : "700"} color={isSelected ? Colors.primaryDark : Colors.textMuted} align="center">{c.id.split(' ')[0]}</Txt>
               </TouchableOpacity>
             );
          })}
        </Row>
      </View>
      
      <FormScroll bottomPadding={160} contentContainerStyle={{ padding: 18, paddingTop: 18, gap: 16 }}>
        {/* Progress Header */}
        <Row justify="space-between" align="flex-end">
          <Txt size={15} weight="900" color={Colors.textPrimary}>{selectedCat} Inspection</Txt>
          <Txt size={12} weight="800" color={Colors.primary}>{completedItems} / {totalItems} Completed</Txt>
        </Row>
        <View style={[styles.progressTrack, { height: 6, backgroundColor: Colors.surfaceElevated }]}>
          <View style={[styles.progressFill, { width: totalItems ? `${(completedItems/totalItems)*100}%` : '0%', backgroundColor: Colors.primary, borderRadius: 3 }]} />
        </View>
        
        <Spacer size={4} />
        
        {/* Area / Floor Filter */}
        {selectedCat === 'Electrical' && (
          <>
            <TouchableOpacity onPress={() => setShowAreaPicker(!showAreaPicker)} activeOpacity={0.8} style={{ backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle }}>
              <Row justify="space-between" align="center">
                <Txt size={14} color={Colors.textMuted}>Select Area / Floor</Txt>
                <Row align="center" gap={4}>
                  <Txt size={14} weight="800" color={Colors.textPrimary}>{activeArea}</Txt>
                  <Ionicons name={showAreaPicker ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                </Row>
              </Row>
            </TouchableOpacity>
            
            {/* Expanded Area Picker */}
            {showAreaPicker && (
              <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 12, marginTop: -8, overflow: 'hidden', zIndex: 10 }}>
                {availableAreas.map(area => (
                  <TouchableOpacity key={area} onPress={() => { setActiveArea(area); setShowAreaPicker(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt size={14} weight={activeArea === area ? "900" : "700"} color={activeArea === area ? Colors.primary : Colors.textPrimary}>{area}</Txt>
                    {activeArea === area && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Room Checklists */}
        {displayedRooms.map((roomGrp: any, rIdx: number) => (
          <Card key={roomGrp.room} containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt size={16} weight="900" color={Colors.primaryDark}>{roomGrp.room}</Txt>
            <Spacer size={12} />
            {roomGrp.items.map((item: any, iIdx: number) => {
              const dropdownKey = `${rIdx}-${iIdx}`;
              const isOpen = openDropdown === dropdownKey;
              return (
                <View key={item.name} style={{ marginVertical: 6 }}>
                  <Row justify="space-between" align="center">
                    <Txt size={14} weight="800" color={Colors.textPrimary}>{item.name}</Txt>
                    <TouchableOpacity 
                      onPress={() => setOpenDropdown(isOpen ? null : dropdownKey)} 
                      activeOpacity={0.7} 
                      style={{ minWidth: 130, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', backgroundColor: Colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isOpen ? Colors.primary : Colors.borderSubtle }}
                    >
                      <Row align="center" gap={6}>
                        {item.status === 'Working' && <Ionicons name="checkmark-circle" size={16} color={Colors.success} />}
                        {item.status === 'Needs Attention' && <Ionicons name="warning" size={16} color="#F97316" />}
                        {item.status === 'Not Working' && <Ionicons name="close-circle" size={16} color={Colors.danger} />}
                        <Txt size={13} weight="800" color={item.status === 'Working' ? Colors.success : item.status === 'Needs Attention' ? '#F97316' : Colors.danger}>
                          {item.status === 'Needs Attention' ? 'Attention' : item.status === 'Not Working' ? 'Broken' : 'Working'}
                        </Txt>
                      </Row>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </Row>
                  
                  {isOpen && (
                    <View style={{ backgroundColor: Colors.canvas, borderRadius: 8, marginTop: 8, padding: 4, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                      <TouchableOpacity onPress={() => handleSelectStatus(rIdx, iIdx, 'Working')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} /><Txt size={14} weight="800" color={Colors.textPrimary}>Working</Txt>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleSelectStatus(rIdx, iIdx, 'Needs Attention')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                        <Ionicons name="warning" size={18} color="#F97316" /><Txt size={14} weight="800" color={Colors.textPrimary}>Needs Attention</Txt>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleSelectStatus(rIdx, iIdx, 'Not Working')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
                        <Ionicons name="close-circle" size={18} color={Colors.danger} /><Txt size={14} weight="800" color={Colors.textPrimary}>Broken</Txt>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        ))}

        <Spacer size={20} />
        
        {/* Save Progress Button */}
        <Btn containerColor={Colors.primary} textColor="#FFF" borderRadius={Radii.lg} height={56} onPress={saveProgress} style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
          <Txt size={16} weight="900">Save Progress</Txt>
        </Btn>
      </FormScroll>

      <Modal transparent visible={showSaveConfirm} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isSyncSuccess ? '#F0FDF4' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={isSyncSuccess ? "checkmark" : "phone-portrait-outline"} size={24} color={isSyncSuccess ? Colors.success : Colors.primary} />
              </View>
              <TouchableOpacity onPress={() => { setShowSaveConfirm(false); setIsSyncSuccess(false); }} activeOpacity={0.8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </Row>
            {/* Every toggle above already writes to this device's storage the instant it's
                tapped (see handleSelectStatus) — this dialog is a confirmation, not the save
                itself, and says so honestly. There is no server endpoint for a facility
                checklist yet (see useMaintenanceChecklist), so "synced to the server" would
                have been a claim nothing behind it could back up. */}
            <Txt size={20} weight="900" color={Colors.primaryDark}>{isSyncSuccess ? 'Saved on this Device' : 'Finish this Check?'}</Txt>
            <Spacer size={8} />
            <Txt size={14} color={Colors.textMuted} style={{ lineHeight: 20 }}>
              {isSyncSuccess
                ? 'Your inspection progress is saved on this device and will still be here next time you open the app.'
                : 'Your changes are already saved as you tick them — this just confirms you\'re done with this round.'}
            </Txt>
            <Spacer size={24} />
            {isSyncSuccess ? (
              <Btn onPress={() => { setShowSaveConfirm(false); setIsSyncSuccess(false); }} containerColor={Colors.primary} textColor="#FFF" borderRadius={Radii.lg} height={50}>
                <Txt size={15} weight="900">Done</Txt>
              </Btn>
            ) : (
              <Row gap={12}>
                <TouchableOpacity onPress={() => setShowSaveConfirm(false)} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={15} weight="800" color={Colors.textPrimary}>Keep Checking</Txt>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSyncSuccess(true)} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={15} weight="800" color="#FFF">Done for Now</Txt>
                </TouchableOpacity>
              </Row>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function IssuesSupervisionView({ issues, pgId }: { issues: any[]; pgId: string | null }) {
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
  
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  
  const [err, setErr] = useState('');

  const CATS = ['Electrical', 'Cleanliness', 'Kitchen Hygiene', 'Plumbing', 'General Facilities'];
  const LOCS = ['Room', 'Bathroom', 'Kitchen', 'Corridor', 'Common Area', 'Entrance', 'Floor', 'Other'];

  if (showForm) {
    if (isSuccess) {
       return (
         <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 100 }}>
           <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
             <Ionicons name="checkmark" size={40} color={Colors.success} />
           </View>
           <Txt size={24} weight="900" color={Colors.primaryDark} align="center">Issue Reported</Txt>
           <Spacer size={12} />
           <Txt size={15} color={Colors.textMuted} align="center">The maintenance issue has been added successfully.</Txt>
           <Spacer size={32} />
           <Btn containerColor={Colors.primary} textColor="#FFF" borderRadius={Radii.lg} height={50} style={{ width: '100%' }} onPress={() => { setShowForm(false); setIsSuccess(false); }}>
             <Txt size={16} weight="900">View Issues</Txt>
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
              <Txt size={24} weight="900" color={Colors.primaryDark}>Report Issue</Txt>
              <Txt size={13} weight="700" color={Colors.textMuted} style={{ marginTop: 2 }}>Help keep the PG safe and well maintained</Txt>
            </Col>
            <View style={{ marginTop: -4 }}><IconBtn onPress={() => setShowForm(false)} icon="close" size={28} tint={Colors.textMuted} /></View>
          </Row>
          
          <Spacer size={24} />
          
          {/* Validation Error */}
          {err ? (
             <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
               <Txt size={13} weight="800" color={Colors.danger}>{err}</Txt>
             </View>
          ) : null}

          {/* Category */}
          <Txt size={14} weight="900" color={Colors.textPrimary}>Category</Txt>
          <Spacer size={8} />
          <TouchableOpacity 
            onPress={() => { setShowCatPicker(!showCatPicker); setShowLocPicker(false); setErr(''); }} 
            activeOpacity={0.8}
            style={[styles.inputBox, { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface }]}
          >
            <Txt size={15} weight={newCat ? "800" : "700"} color={newCat ? Colors.textPrimary : Colors.textMuted}>{newCat || 'Select Category'}</Txt>
            <Ionicons name={showCatPicker ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          {showCatPicker && (
             <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
               {CATS.map(c => (
                 <TouchableOpacity key={c} onPress={() => { setNewCat(c); setShowCatPicker(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                   <Txt size={14} weight="700" color={Colors.textPrimary}>{c}</Txt>
                 </TouchableOpacity>
               ))}
             </View>
          )}

          <Spacer size={20} />

          {/* Location */}
          <Row gap={12}>
            <Col style={{ flex: 1 }}>
              <Txt size={14} weight="900" color={Colors.textPrimary}>Location</Txt>
              <Spacer size={8} />
              <TouchableOpacity 
                onPress={() => { setShowLocPicker(!showLocPicker); setShowCatPicker(false); setErr(''); }} 
                activeOpacity={0.8}
                style={[styles.inputBox, { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface }]}
              >
                <Txt size={15} weight={newLoc ? "800" : "700"} color={newLoc ? Colors.textPrimary : Colors.textMuted}>{newLoc || 'Select Area'}</Txt>
                <Ionicons name={showLocPicker ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </Col>
            
            <Col style={{ flex: 1 }}>
              <Txt size={14} weight="900" color={Colors.textPrimary}>Room/Floor No.</Txt>
              <Spacer size={8} />
              <View style={[styles.inputBox, { height: 50, justifyContent: 'center', paddingVertical: 0, backgroundColor: Colors.surface }]}>
                <TextInput 
                  style={{ color: Colors.textPrimary, fontSize: 15, flex: 1, paddingVertical: 0 }}
                  placeholder="e.g. 204"
                  placeholderTextColor={Colors.textMuted}
                  value={newLocDetail}
                  onChangeText={setNewLocDetail}
                />
              </View>
            </Col>
          </Row>
          {showLocPicker && (
             <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
               {LOCS.map(l => (
                 <TouchableOpacity key={l} onPress={() => { setNewLoc(l); setShowLocPicker(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
                   <Txt size={14} weight="700" color={Colors.textPrimary}>{l}</Txt>
                 </TouchableOpacity>
               ))}
             </View>
          )}

          <Spacer size={20} />

          {/* Issue Description */}
          <Txt size={14} weight="900" color={Colors.textPrimary}>What's wrong?</Txt>
          <Spacer size={8} />
          <View style={[styles.inputBox, { height: 100, justifyContent: 'flex-start', paddingVertical: 12, backgroundColor: Colors.surface }]}>
            <TextInput 
              style={{ color: Colors.textPrimary, fontSize: 15, height: '100%', textAlignVertical: 'top' }} 
              placeholder="Describe the issue briefly..." 
              placeholderTextColor={Colors.textMuted} 
              multiline 
              value={newTitle} 
              onChangeText={(t) => { setNewTitle(t); setErr(''); }} 
            />
          </View>
          
          <Spacer size={20} />

          {/* Priority */}
          <Txt size={14} weight="900" color={Colors.textPrimary}>Priority</Txt>
          <Spacer size={8} />
          <Row gap={10}>
            <TouchableOpacity onPress={() => setNewPriority('Low')} activeOpacity={0.8} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: newPriority === 'Low' ? '#F3F4F6' : Colors.surface, borderWidth: 2, borderColor: newPriority === 'Low' ? Colors.textMuted : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
               {newPriority === 'Low' && <Ionicons name="checkmark" size={16} color={Colors.textPrimary} />}
               <Txt size={14} weight="900" color={Colors.textPrimary}>Low</Txt>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNewPriority('Medium')} activeOpacity={0.8} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: newPriority === 'Medium' ? '#FFEDD5' : Colors.surface, borderWidth: 2, borderColor: newPriority === 'Medium' ? '#F97316' : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
               {newPriority === 'Medium' && <Ionicons name="checkmark" size={16} color="#F97316" />}
               <Txt size={14} weight="900" color={newPriority === 'Medium' ? '#F97316' : Colors.textPrimary}>Medium</Txt>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNewPriority('High')} activeOpacity={0.8} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: newPriority === 'High' ? '#FEE2E2' : Colors.surface, borderWidth: 2, borderColor: newPriority === 'High' ? Colors.danger : Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
               {newPriority === 'High' && <Ionicons name="checkmark" size={16} color={Colors.danger} />}
               <Txt size={14} weight="900" color={newPriority === 'High' ? Colors.danger : Colors.textPrimary}>High</Txt>
            </TouchableOpacity>
          </Row>
          
          <Spacer size={20} />

          {/* Photo */}
          <Txt size={14} weight="900" color={Colors.textPrimary}>Add Photo</Txt>
          <Txt size={12} weight="700" color={Colors.textMuted} style={{ marginTop: 2 }}>Optional · Recommended for faster resolution</Txt>
          <Spacer size={8} />
          {hasPhoto && photoUri ? (
            <View style={{ height: 160, borderRadius: 12, backgroundColor: '#E5E7EB', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle }}>
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
              <Row gap={16} style={{ position: 'absolute', bottom: 16 }}>
                 <TouchableOpacity onPress={handleCapturePhoto} activeOpacity={0.8} style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}><Txt size={13} weight="800" color={Colors.textPrimary}>Retake</Txt></TouchableOpacity>
                 <TouchableOpacity onPress={() => { setHasPhoto(false); setPhotoUri(null); }} activeOpacity={0.8} style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}><Txt size={13} weight="800" color={Colors.danger}>Remove</Txt></TouchableOpacity>
              </Row>
            </View>
          ) : (
            <TouchableOpacity onPress={handleCapturePhoto} activeOpacity={0.8} style={{ height: 100, borderRadius: 12, backgroundColor: Colors.surface, borderStyle: 'dashed', borderWidth: 2, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={32} color={Colors.primary} />
              <Spacer size={4} />
              <Txt size={14} weight="900" color={Colors.primary}>Add Photo</Txt>
              <Txt size={12} color={Colors.textMuted}>Show the issue clearly</Txt>
            </TouchableOpacity>
          )}

          <Spacer size={20} />

          {/* Additional Notes */}
          <Txt size={14} weight="900" color={Colors.textPrimary}>Additional Notes</Txt>
          <Spacer size={8} />
          <View style={[styles.inputBox, { height: 80, justifyContent: 'flex-start', paddingVertical: 12, backgroundColor: Colors.surface }]}>
            <TextInput 
              style={{ color: Colors.textPrimary, fontSize: 15, height: '100%', textAlignVertical: 'top' }} 
              placeholder="Anything else the maintenance team should know?" 
              placeholderTextColor={Colors.textMuted} 
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
            textColor="#FFF"
            borderRadius={12}
            height={56}
            onPress={handleAddIssue}
            disabled={submitIssue.isPending}
            loading={submitIssue.isPending}
          >
            <Txt size={16} weight="900">{submitIssue.isPending ? 'Reporting…' : 'Report Issue'}</Txt>
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
          <Txt size={22} weight="900" color={Colors.primaryDark}>Issues Found</Txt>
          <Btn containerColor={Colors.primary} textColor="#FFF" borderRadius={8} height={32} contentStyle={{ paddingHorizontal: 12 }} onPress={() => setShowForm(true)}>
            <Txt size={11} weight="800">+ Report Issue</Txt>
          </Btn>
        </Row>
        <Spacer size={16} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {filters.map(f => {
             const isSelected = activeFilter === f;
             let color: string = Colors.textMuted;
             if (isSelected && f === 'All') color = '#FFF';
             else if (isSelected) color = '#FFF';
             else if (f === 'High') color = Colors.danger;
             else if (f === 'Medium') color = '#F97316';
             else if (f === 'Low') color = '#EAB308';
             else color = Colors.textPrimary;
             
             return (
               <Btn key={f} onPress={() => setActiveFilter(f)} containerColor={isSelected ? Colors.primary : Colors.canvas} textColor={color} borderRadius={16} height={32} contentStyle={{ paddingHorizontal: 12 }}>
                 <Txt size={13} weight="800" color={color}>{f}</Txt>
               </Btn>
             );
          })}
        </FormScroll>
      </View>
      <FormScroll bottomPadding={180} contentContainerStyle={{ padding: 18, gap: 16 }}>
        {displayedIssues.length === 0 ? (
           <Txt size={14} color={Colors.textMuted} align="center" style={{ marginTop: 40 }}>No issues found</Txt>
        ) : (
          displayedIssues.map((iss: any) => {
            let color: string = Colors.danger;
            let bgColor: string = '#FEE2E2';
            let icon = "snow-outline";
            if (iss.priority === 'Medium') { color = '#F97316'; bgColor = '#FFEDD5'; icon = "water-outline"; }
            if (iss.priority === 'Low') { color = '#EAB308'; bgColor = '#FEF9C3'; icon = "briefcase-outline"; }

            return (
              <TouchableOpacity key={iss.id} activeOpacity={0.8} onPress={() => setSelectedIssue(iss)}>
                <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={0} padding={[0, 0]} style={{ overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ width: 4, position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color }} />
                  <View style={{ padding: 16, paddingLeft: 20 }}>
                    <Row justify="space-between" align="flex-start">
                      <Row gap={12} align="center" style={{ flex: 1, paddingRight: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={icon as any} size={24} color={color} />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <View style={{ backgroundColor: bgColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 4 }}>
                            <Txt size={10} weight="800" color={color}>{iss.priority}</Txt>
                          </View>
                          <Txt size={16} weight="900" color={Colors.textPrimary}>{iss.title}</Txt>
                          <Txt size={13} color={Colors.textMuted} style={{ marginTop: 2 }}>{iss.location}</Txt>
                        </Col>
                      </Row>
                      <Col align="flex-end">
                        <Txt size={12} weight="800" color={iss.status === 'Resolved' ? Colors.success : Colors.primary}>{iss.status}</Txt>
                      </Col>
                    </Row>
                    <Spacer size={16} />
                    <Row justify="space-between" align="center">
                      <Txt size={12} color={Colors.textMuted}>Reported: {iss.time}</Txt>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </Row>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </FormScroll>
      <View style={{ position: 'absolute', bottom: 90, right: 20 }}>
        <TouchableOpacity 
          onPress={() => setShowForm(true)} 
          activeOpacity={0.8}
          style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Modal transparent visible={!!selectedIssue} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            {/* "Reopen" used to be offered here too — a local status flip with nothing behind
                it. The server has no un-resolve transition (resolve_request: "This ticket is
                already closed." — a hard CONFLICT, not a toggle), so a resolved ticket now
                only shows that it's resolved, rather than a button that could never work. */}
            <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-done" size={24} color={Colors.success} />
              </View>
              <TouchableOpacity onPress={() => setSelectedIssue(null)} activeOpacity={0.8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </Row>
            <Txt size={20} weight="900" color={Colors.primaryDark}>
              {selectedIssue?.status === 'Resolved' ? 'Already Resolved' : 'Mark as Resolved?'}
            </Txt>
            <Spacer size={8} />
            <Txt size={14} color={Colors.textMuted} style={{ lineHeight: 20 }}>
              {selectedIssue?.status === 'Resolved'
                ? `"${selectedIssue?.title}" has been resolved.`
                : `Mark "${selectedIssue?.title}" as resolved? The resident who reported it will be able to see this.`}
            </Txt>
            <Spacer size={24} />
            {selectedIssue?.status === 'Resolved' ? (
              <Btn onPress={() => setSelectedIssue(null)} containerColor={Colors.surfaceMuted} textColor={Colors.textPrimary} borderRadius={12} height={50}>
                <Txt size={15} weight="800" color={Colors.textPrimary}>Close</Txt>
              </Btn>
            ) : (
              <Row gap={12}>
                <TouchableOpacity onPress={() => setSelectedIssue(null)} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={15} weight="800" color={Colors.textPrimary}>Cancel</Txt>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={resolveIssue.isPending}
                  onPress={async () => {
                    if (!selectedIssue) return;
                    try {
                      await resolveIssue.mutateAsync({ id: selectedIssue.id });
                      setSelectedIssue(null);
                    } catch (err) {
                      Alert.alert('Could not resolve', err instanceof Error ? err.message : 'Please try again.');
                    }
                  }}
                  activeOpacity={0.8}
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', opacity: resolveIssue.isPending ? 0.6 : 1 }}
                >
                  <Txt size={15} weight="800" color="#FFF">{resolveIssue.isPending ? 'Resolving…' : 'Resolve'}</Txt>
                </TouchableOpacity>
              </Row>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MaintenanceProfileView({ staff, logout, hideLogout, inspections, issues }: any) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <FormScroll bottomPadding={120} contentContainerStyle={{ padding: 18, gap: 16 }}>
      <Col align="center" style={{ marginTop: 20 }}>
        <View style={styles.avatarBox}>
          <Txt size={32}>🛠️</Txt>
        </View>
        <Spacer size={12} />
        <Txt size={22} weight="900" color={Colors.primaryDark}>{staff?.name ?? 'Arjun Reddy'}</Txt>
        <Txt size={14} weight="700" color={Colors.primary}>Maintenance Staff</Txt>
        <Spacer size={4} />
        <Txt size={12} color={Colors.textMuted}>Employee ID: MS-2001</Txt>
      </Col>

      <Spacer size={20} />
      <View style={styles.sectionHeader}>
        <Txt size={13} weight="900" color={Colors.textSecondary}>STATUS & INFO</Txt>
      </View>
      <Card containerColor={Colors.surface} borderRadius={Radii.xl} borderWidth={1} borderColor={Colors.borderSubtle}>
        <Row justify="space-between" align="center" style={styles.profileRow}>
          <Row gap={12} align="center">
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="radio-button-on" size={18} color={Colors.success} /></View>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Availability</Txt>
          </Row>
          <Txt size={14} weight="800" color={Colors.success}>Available</Txt>
        </Row>
        <View style={styles.divider} />
        <Row justify="space-between" align="center" style={styles.profileRow}>
          <Row gap={12} align="center">
            <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="business" size={18} color={Colors.textPrimary} /></View>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Department</Txt>
          </Row>
          <Txt size={14} weight="700" color={Colors.textMuted}>Facility Maintenance</Txt>
        </Row>
        <View style={styles.divider} />
        <Row justify="space-between" align="center" style={styles.profileRow}>
          <Row gap={12} align="center">
            <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="stats-chart" size={18} color={Colors.textPrimary} /></View>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Inspections Completed</Txt>
          </Row>
          <Txt size={14} weight="900" color={Colors.primary}>1,240</Txt>
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
        <Btn onPress={() => setShowLogoutConfirm(true)} containerColor={Colors.danger} textColor="#FFF" borderRadius={Radii.lg} height={50}>
          <Ionicons name="exit" size={20} color="#FFF" />
          <Txt size={14} weight="900" style={{ marginLeft: 8 }}>Sign Out</Txt>
        </Btn>
      )}

      <Modal transparent visible={showLogoutConfirm} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="exit" size={24} color={Colors.danger} />
              </View>
              <TouchableOpacity onPress={() => setShowLogoutConfirm(false)} activeOpacity={0.8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </Row>
            <Txt size={20} weight="900" color={Colors.primaryDark}>Sign Out?</Txt>
            <Spacer size={8} />
            <Txt size={14} color={Colors.textMuted} style={{ lineHeight: 20 }}>
              Are you sure you want to sign out from your maintenance account?
            </Txt>
            <Spacer size={24} />
            <Row gap={12}>
              <TouchableOpacity onPress={() => setShowLogoutConfirm(false)} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={15} weight="800" color={Colors.textPrimary}>Cancel</Txt>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={15} weight="800" color="#FFF">Sign Out</Txt>
              </TouchableOpacity>
            </Row>
          </View>
        </View>
      </Modal>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  noteBox: { backgroundColor: Colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12, height: 60 },
  inputBox: { backgroundColor: Colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12, height: 46, justifyContent: 'center' },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  avatarBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  profileRow: { padding: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  iconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, backgroundColor: Colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
});
export default HousekeepingDashboard;
