import { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Alert, FlatList, ScrollView, BackHandler } from 'react-native';
import { router } from 'expo-router';


import { Ionicons } from '@expo/vector-icons';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { EmptyState } from '@/components/EmptyState';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import * as staffApi from '@/features/staff/useStaff';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import {
  useStaffQuery,
  useAddStaffMutation,
  useUpdateStaffMutation,
  useRemoveStaffMutation } from '@/features/staff/useStaff';
import * as map from '@/data/mappers';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Col, ListRow, Row, SearchField, Sheet, Spacer, Txt } from '@/components/ui';

const GREEN = Colors.primary;        // Deep Ocean Blue brand primary
const BG = Colors.canvas;            // Light Ice Canvas BG
const CHARCOAL = Colors.textPrimary; // Obsidian Navy primary text
const MUTED = Colors.textMuted;      // Ocean Muted text
const BORDER = Colors.borderSubtle;  // Ice Cyan subtle border
const WHITE = Colors.surface;        // Pure White surface
const LIGHT_GREEN = Colors.surfaceElevated; // Soft Ice Cyan active tint

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  manager: 'Manager',
  chef: 'Chef',
  kitchen_staff: 'Kitchen Staff',
  maintenance: 'Maintenance Staff',
  delivery_agent: 'Delivery Agent' };

const AVAILABLE_ROLES = ['Manager', 'Chef', 'Kitchen Staff', 'Maintenance Staff', 'Delivery Agent'];
const SHIFT_OPTIONS = ['Day Shift (8 AM - 5 PM)', 'Night Shift (8 PM - 5 AM)', 'Part Time (9 AM - 1 PM)'];

/**
 * The label is display text; `memberships.shift_start`/`shift_end` are SQL `time` columns.
 * Sending the label straight through (as this screen used to) is always a 422 — and omitting
 * `shift_end` is a second one, because `_shift_is_a_pair` requires both or neither.
 */
const SHIFT_TIMES: Record<string, { shift_start: string; shift_end: string }> = {
  'Day Shift (8 AM - 5 PM)': { shift_start: '08:00:00', shift_end: '17:00:00' },
  'Night Shift (8 PM - 5 AM)': { shift_start: '20:00:00', shift_end: '05:00:00' },
  'Part Time (9 AM - 1 PM)': { shift_start: '09:00:00', shift_end: '13:00:00' } };

/**
 * The other half of the round-trip. `mappers.toStaff` renders a saved shift as "08:00 - 17:00",
 * which is not one of the picker's labels — so seeding the picker with it directly left
 * `SHIFT_TIMES[editShift]` undefined and quietly dropped the shift from every edit of a staff
 * member who already had one.
 */
function shiftLabelFor(shiftTime: string): string {
  const match = Object.entries(SHIFT_TIMES).find(
    ([, t]) => `${t.shift_start.slice(0, 5)} - ${t.shift_end.slice(0, 5)}` === shiftTime
  );
  return match?.[0] ?? SHIFT_OPTIONS[0];
}

export function StaffManagementTab() {
  const dockScroll = useDockScroll();
  const [subTab, setSubTab] = useState(0); // 0: Add Staff, 1: Staff Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: staffList = [], isLoading: staffLoading, error: staffError, refetch: refetchStaff, isRefetching: isRefetchingStaff } = useStaffQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = useIsManagerMode();
  // D-06 on the server (staff/service.py): "adding a manager is owner-only, so a manager
  // cannot appoint their own replacement or a peer" — the same rule applies to editing an
  // existing staffer's role to or from manager. Both role pickers below used to offer
  // "Manager" regardless of who was looking, so a manager could select it, fill in the rest
  // of the form, and only find out it was never possible from the 403 that came back.
  const selectableRoles = isManager ? AVAILABLE_ROLES.filter((r) => r !== 'Manager') : AVAILABLE_ROLES;

  const staffRoleInput = usePGowStore((s) => s.staffRoleInput);
  const staffNameInput = usePGowStore((s) => s.staffNameInput);
  const staffPhoneInput = usePGowStore((s) => s.staffPhoneInput);
  const staffPinInput = usePGowStore((s) => s.staffPinInput);
  const staffShiftInput = usePGowStore((s) => s.staffShiftInput);
  const staffSalaryInput = usePGowStore((s) => s.staffSalaryInput);
  const set = usePGowStore((s) => s.set);

  const addStaffMutation = useAddStaffMutation(activePgId ?? undefined);
  const updateStaffMutation = useUpdateStaffMutation(activePgId ?? undefined);
  const removeStaffMutation = useRemoveStaffMutation(activePgId ?? undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [isDeletingStaff, setIsDeletingStaff] = useState<string | null>(null);
  // Was `errorField: 'phone' | null`, which only tinted one field's border and said nothing.
  // `OutlinedTextField.error` carries the sentence now, so this holds one per field.
  const [errors, setErrors] = useState<{ name?: string; phone?: string; pin?: string; editName?: string; newPin?: string }>({});

  // Action Menu States
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Details Modal
  const [showDetails, setShowDetails] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [isResettingPin, setIsResettingPin] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('Kitchen Staff');
  const [editShift, setEditShift] = useState('Day Shift (8 AM - 5 PM)');
  const [editSalary, setEditSalary] = useState('15000');
  const [isUpdating, setIsUpdating] = useState(false);

  // Override back navigation — this screen lives inside the tab navigator, not a stack,
  // so native back would leave ghost tab state. We force-replace with overview instead.
  useEffect(() => {
    const onBack = () => {
      router.replace('/overview');
      return true; // prevent default
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  // Sync default role input based on manager vs owner role
  useEffect(() => {
    if (!isManager && owner) {
      set('staffRoleInput', 'Manager');
    } else if (isManager) {
      set('staffRoleInput', 'Chef');
    }
  }, [isManager, owner?.id]);

  // The label is display text; the backend takes the underlying role enum.
  const REGISTER_ROLE_MAP: Record<string, 'manager' | 'chef' | 'kitchen_staff' | 'maintenance' | 'delivery_agent'> = {
    Manager: 'manager', Supervisor: 'manager', Chef: 'chef',
    'Kitchen Staff': 'kitchen_staff',
    Maintenance: 'maintenance', 'Maintenance Staff': 'maintenance', Cleaner: 'maintenance',
    'Delivery Agent': 'delivery_agent', Delivery: 'delivery_agent', Rider: 'delivery_agent' };

  const handleRegister = async () => {
    if (isSubmitting) return;
    const fieldErrors = {
      name: staffNameInput.trim() ? undefined : 'Enter their full name',
      phone: !staffPhoneInput.trim() || staffPhoneInput.length < 10
        ? 'Enter a 10-digit mobile number' : undefined,
      pin: staffPinInput.length !== 4 ? 'The PIN is exactly 4 digits' : undefined,
    };
    setErrors(fieldErrors);
    if (fieldErrors.name || fieldErrors.phone || fieldErrors.pin) return;

    // Neither of these is about a field someone can fix by typing — one is an authorisation
    // rule, the other is app state — so they stay as alerts rather than being bolted onto an
    // input that isn't the problem.
    if (isManager && staffRoleInput === 'Manager') {
      Alert.alert('Not allowed', 'Managers cannot register other managers.');
      return;
    }
    if (!activePgId) {
      Alert.alert('No active property', 'Pick a property before adding staff.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addStaffMutation.mutateAsync({
        name: staffNameInput.trim(),
        phone: map.toE164(staffPhoneInput),
        role: REGISTER_ROLE_MAP[staffRoleInput] ?? 'kitchen_staff',
        pin: staffPinInput,
        monthly_salary: parseFloat(staffSalaryInput) || undefined });
      Alert.alert('Success', 'Staff member account registered successfully!');
      set('staffNameInput', '');
      set('staffPhoneInput', '');
      set('staffPinInput', '');
      set('staffShiftInput', 'Day Shift (8 AM - 5 PM)');
      set('staffSalaryInput', '15000');
      setSubTab(1); // Go to directory
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred.';
      const lowerError = errorMsg.toLowerCase();

      // A duplicate phone number is a fact about the phone field, so it belongs on the phone
      // field. It used to be tinted red AND explained in a popup — the tint said "here" and
      // the popup said "what", and you couldn't see both at once.
      if (lowerError.includes('number') || lowerError.includes('phone')) {
        setErrors((e) => ({ ...e, phone: 'An account with this number already exists' }));
      } else if (lowerError.includes('already exists')) {
        setErrors((e) => ({ ...e, phone: 'An account with these details already exists' }));
      } else {
        Alert.alert('Failed', errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteStaff = (staff: any) => {
    setShowActionMenu(false);
    if (isDeletingStaff) return;
    setTimeout(() => {
      Alert.alert('Delete staff member?', `Are you sure you want to delete ${staff.name} from this PG?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingStaff(staff.id);
            try {
              await removeStaffMutation.mutateAsync(staff.id);
              Alert.alert('Success', `${staff.name} has been deleted.`);
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Could not delete staff member.');
            } finally {
              setIsDeletingStaff(null);
            }
          } },
      ]);
    }, 100);
  };

  const handleOpenEdit = (staff: any) => {
    setSelectedStaff(staff);
    setEditName(staff.name);
    setEditPhone(staff.phone);
    setEditRole(ROLE_DISPLAY_NAMES[staff.role] || 'Kitchen Staff');
    setEditShift(shiftLabelFor(staff.shiftTime));
    setEditSalary(String(Math.round(staff.monthlySalary)));
    setShowActionMenu(false);
    setShowEditModal(true);
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff || isUpdating) return;
    if (!editName.trim()) {
      setErrors((e) => ({ ...e, editName: 'Enter their name' }));
      return;
    }
    
    setIsUpdating(true);
    try {
      const roleMap: Record<string, any> = {
        Manager: 'manager',
        Chef: 'chef',
        'Kitchen Staff': 'kitchen_staff',
        'Maintenance Staff': 'maintenance',
        // Its own role, not 'maintenance': a delivery agent gets the trips dashboard
        // (app/(staff)/(tabs)/eaters.tsx), and mapping it onto maintenance would put them
        // on the chef screens instead.
        'Delivery Agent': 'delivery_agent' };
      
      // No `|| 'kitchen_staff'` fallback: silently registering someone with the wrong role
      // is worse than refusing the edit. Omitting the field leaves the role unchanged.
      const mappedRole = roleMap[editRole];
      const shift = SHIFT_TIMES[editShift];

      const payload = {
        name: editName.trim(),
        ...(mappedRole ? { role: mappedRole } : {}),
        monthly_salary: parseFloat(editSalary) || undefined,
        // Both halves, as real `time` values — see SHIFT_TIMES.
        ...(shift ?? {}) };

      await updateStaffMutation.mutateAsync({ membershipId: selectedStaff.id, params: payload });
      Alert.alert('Success', 'Staff member details updated.');
      setShowEditModal(false);
    } catch (err) {
      Alert.alert('Error', 'Could not update staff member.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPin = async () => {
    if (!selectedStaff || isResettingPin) return;
    // Mirrors the server's own `^[0-9]{4}$` — a length check alone let "12a4" through to a 422.
    if (!/^[0-9]{4}$/.test(newPin)) {
      setErrors((e) => ({ ...e, newPin: 'Exactly 4 digits, numbers only' }));
      return;
    }
    setIsResettingPin(true);
    try {
      await staffApi.resetStaffCredentials(selectedStaff.id, { pin: newPin });
      Alert.alert('Success', 'Login PIN reset successfully.');
      setNewPin('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not reset PIN.');
    } finally {
      setIsResettingPin(false);
    }
  };

  // Directory filter logic
  const filteredStaffList = useMemo(() => {
    return staffList.filter((staff) => {
      const matchesSearch =
        !searchQuery.trim() ||
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.phone.includes(searchQuery);

      let matchesFilter = true;
      if (roleFilter === 'Managers') {
        matchesFilter = staff.role.toLowerCase() === 'manager';
      } else if (roleFilter === 'Kitchen') {
        matchesFilter = staff.role.toLowerCase() === 'chef' || staff.role.toLowerCase() === 'kitchen_staff';
      } else if (roleFilter === 'Maintenance') {
        matchesFilter = staff.role.toLowerCase().includes('maintenance');
      }

      return matchesSearch && matchesFilter;
    });
  }, [staffList, searchQuery, roleFilter]);

  // Every membership `useStaffQuery` returns is a currently-employed staffer — the server
  // has no "temporarily suspended" state, only `ended_at` (a permanent employment end via
  // Delete Staff), which already drops the row from this list. So "active" is just "on
  // this list" now, not a separate flag layered on top of it.
  const activeStaffCount = staffList.length;

  return (
    <View style={styles.root}>
      {/* ── Segmented Control Sub-tabs ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(0);
            }}
          >
            <Ionicons name="person-add-outline" size={16} color={subTab === 0 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 0 && styles.segBtnTextActive]}>
              Add Staff
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(1);
            }}
          >
            <Ionicons name="people-outline" size={16} color={subTab === 1 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 1 && styles.segBtnTextActive]}>
              Staff Directory
            </Txt>
          </AnimatedPress>
        </Row>
      </View>

      {/* ── Sub-Tab 0: Add Staff View ── */}
      {subTab === 0 && (
        <ScrollView
          {...dockScroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Add Staff Member</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodySub}>Assign their role, work details, and login PIN.</Txt>

          <Spacer size={8} />

          {/* Row 1: Name & Phone */}
          <Row gap={10}>
            <OutlinedTextField
              label="Full Name *"
              placeholder="Full Name"
              value={staffNameInput}
              onChangeText={(v) => { set('staffNameInput', v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
              error={errors.name}
              style={{ flex: 1.2 }}
            />
            <OutlinedTextField
              label="Phone Number *"
              placeholder="10-Digit Mobile"
              value={staffPhoneInput}
              onChangeText={(v) => { set('staffPhoneInput', v); if (errors.phone) setErrors((e) => ({ ...e, phone: undefined })); }}
              keyboardType="phone-pad"
              error={errors.phone}
              style={{ flex: 1 }}
            />
          </Row>

          <Spacer size={10} />

          {/* Staff Role Chips */}
          <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Staff Role</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 42 }}>
            <Row gap={6} align="center">
              {selectableRoles.map((role) => {
                const isSelected = staffRoleInput === role;
                return (
                  <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                    key={role}
                    style={[styles.roleChip, isSelected && styles.roleChipActive]}
                    onPress={() => set('staffRoleInput', role)}
                  >
                    <Txt maxFontSizeMultiplier={1.3} style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}>
                      {role}
                    </Txt>
                  </AnimatedPress>
                );
              })}
            </Row>
          </ScrollView>

          <Spacer size={10} />

          {/* Row 2: Shift & Salary */}
          <Row gap={10}>
            <Col style={{ flex: 1.2 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Shift *</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 46 }}>
                <Row gap={6} align="center">
                  {SHIFT_OPTIONS.map((opt) => {
                    const isSelected = staffShiftInput === opt;
                    return (
                      <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                        key={opt}
                        style={[styles.shiftChip, isSelected && styles.shiftChipActive]}
                        onPress={() => set('staffShiftInput', opt)}
                      >
                        <Txt maxFontSizeMultiplier={1.3} style={[styles.shiftChipText, isSelected && styles.shiftChipTextActive]}>
                          {opt.replace(' Shift', '').split(' ')[0]}
                        </Txt>
                      </AnimatedPress>
                    );
                  })}
                </Row>
              </ScrollView>
            </Col>

            <OutlinedTextField
              label="Monthly Salary (₹)"
              placeholder="15000"
              value={staffSalaryInput}
              onChangeText={(v) => set('staffSalaryInput', v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              containerColor={WHITE}
              style={{ flex: 1 }}
            />
          </Row>

          <Spacer size={10} />

          {/* Row 3: Account Access PIN & Security Info */}
          <Row gap={10} align="center">
            <View style={{ flex: 1, position: 'relative' }}>
              <OutlinedTextField
                label="Login PIN (4 digits) *"
                placeholder="PIN"
                value={staffPinInput}
                onChangeText={(v) => { set('staffPinInput', v.replace(/\D/g, '').slice(0, 4)); if (errors.pin) setErrors((e) => ({ ...e, pin: undefined })); }}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                error={errors.pin}
              />
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
                style={[styles.eyeBtn, { top: 32 }]}
                onPress={() => setShowPin(!showPin)}
              >
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
              </AnimatedPress>
            </View>

            <Row gap={6} align="center" style={[styles.securityStrip, { flex: 1.2, height: 48, marginTop: 16 }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={GREEN} />
              <Txt maxFontSizeMultiplier={1.3} style={[styles.securityText, { fontSize: 9.5 }]} numberOfLines={2}>
                Access is limited according to the role.
              </Txt>
            </Row>
          </Row>

          <Spacer size={16} />

          {/* Primary CTA */}
          <AnimatedPress accessibilityRole="button"
            style={[styles.primaryBtn, { height: 48 }]}
            onPress={handleRegister}
            disabled={isSubmitting}
          >
            <Txt maxFontSizeMultiplier={1.3} style={styles.primaryBtnText}>
              {isSubmitting ? 'Registering...' : 'Create Staff Account'}
            </Txt>
          </AnimatedPress>
        </ScrollView>
      )}

      {/* ── Sub-Tab 1: Staff Directory View ── */}
      {subTab === 1 && (
        <FlatList
          {...dockScroll}
          style={{ flex: 1 }}
          data={filteredStaffList}
          keyExtractor={(staff) => staff.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={refetchStaff}
          refreshing={isRefetchingStaff}
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 12 }}>
              <Row justify="space-between" align="center">
                <Txt maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Staff Directory</Txt>
                <View style={styles.countBadge}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.countBadgeText}>{activeStaffCount} Active</Txt>
                </View>
              </Row>

              {/* Search staff input */}
              <SearchField
                placeholder="Search staff by name or phone"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', 'Managers', 'Kitchen', 'Maintenance'].map((filter) => (
                    <AnimatedPress accessibilityRole="button"
                      key={filter}
                      style={[styles.filterChip, roleFilter === filter && styles.filterChipActive]}
                      onPress={() => setRoleFilter(filter)}
                    >
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.filterChipText, roleFilter === filter && styles.filterChipTextActive]}>
                        {filter}
                      </Txt>
                    </AnimatedPress>
                  ))}
                </Row>
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No staff members yet"
              subtitle="Add your first team member to start managing PG operations."
              accent={GREEN}
              loading={staffLoading}
              error={staffError}
            />
          }
          renderItem={({ item: staff, index }) => (
            <ListRow
              title={staff.name}
              meta={staff.shiftTime || 'Day Shift'}
              leading={<Ionicons name={roleIconName(staff.role)} size={18} color={Colors.primary} />}
              status={{ label: ROLE_DISPLAY_NAMES[staff.role] || staff.role, tone: roleTone(staff.role) }}
              // The row opens the action menu the "..." button used to. One target instead of
              // two, and the menu already holds every action that button led to.
              onPress={() => { setSelectedStaff(staff); setShowActionMenu(true); }}
              first={index === 0}
              last={index === filteredStaffList.length - 1}
              testID={`owner_staff_${staff.id}`}
            />
          )}
        />
      )}

      {/* ── Action Menu Popup ── */}
      {showActionMenu && selectedStaff && (
        <Sheet
          visible
          title={selectedStaff.name}
          subtitle={ROLE_DISPLAY_NAMES[selectedStaff.role] || selectedStaff.role}
          icon="person-outline"
          onDismiss={() => setShowActionMenu(false)}
        >

              <AnimatedPress accessibilityRole="button"
                style={styles.sheetOptionRow}
                onPress={() => {
                  setShowActionMenu(false);
                  setShowDetails(true);
                }}
              >
                <Ionicons name="information-circle-outline" size={20} color={CHARCOAL} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.sheetOptionText}>View Details</Txt>
              </AnimatedPress>

              <AnimatedPress accessibilityRole="button"
                style={styles.sheetOptionRow}
                onPress={() => handleOpenEdit(selectedStaff)}
              >
                <Ionicons name="create-outline" size={20} color={CHARCOAL} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.sheetOptionText}>Edit Staff</Txt>
              </AnimatedPress>

              <AnimatedPress accessibilityRole="button"
                style={[styles.sheetOptionRow, { borderBottomWidth: 0 }]}
                onPress={() => confirmDeleteStaff(selectedStaff)}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Txt maxFontSizeMultiplier={1.3} style={[styles.sheetOptionText, { color: Colors.danger }]}>Delete Staff</Txt>
              </AnimatedPress>

        </Sheet>
      )}

      {/* ── Details Modal ── */}
      {showDetails && selectedStaff && (
        <Sheet
          visible
          title="Staff profile"
          subtitle={selectedStaff.name}
          icon="id-card-outline"
          onDismiss={() => setShowDetails(false)}
        >
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailSecLabel}>PERSONAL DETAILS</Txt>
              <Spacer size={4} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Name</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailValue}>{selectedStaff.name}</Txt>
              <Spacer size={8} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Phone</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailValue}>{selectedStaff.phone}</Txt>

              <Spacer size={16} />
              
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailSecLabel}>ROLE</Txt>
              <Spacer size={4} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Assigned Role</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailValue}>
                {ROLE_DISPLAY_NAMES[selectedStaff.role] || selectedStaff.role}
              </Txt>

              <Spacer size={16} />

              <Txt maxFontSizeMultiplier={1.3} style={styles.detailSecLabel}>WORK DETAILS</Txt>
              <Spacer size={4} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Shift</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailValue}>{selectedStaff.shiftTime || 'Day Shift'}</Txt>
              <Spacer size={8} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Monthly Salary</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailValue}>
                ₹{Math.round(selectedStaff.monthlySalary).toLocaleString('en-IN')}
              </Txt>

              <Spacer size={16} />

              <Txt maxFontSizeMultiplier={1.3} style={styles.detailSecLabel}>ACCOUNT ACCESS</Txt>
              <Spacer size={4} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.detailLabel}>Account Status</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={[styles.detailValue, { color: GREEN }]}>Active</Txt>

              <Spacer size={14} />

              {/* Reset PIN box */}
              <View style={styles.resetPinBox}>
                <OutlinedTextField
                  label="Reset PIN (4 digits)"
                  placeholder="Enter new 4-digit PIN"
                  value={newPin}
                  onChangeText={(v) => { setNewPin(v.replace(/\D/g, '').slice(0, 4)); if (errors.newPin) setErrors((e) => ({ ...e, newPin: undefined })); }}
                  keyboardType="number-pad"
                  error={errors.newPin}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AnimatedPress accessibilityRole="button"
                  style={styles.resetPinBtn}
                  onPress={handleResetPin}
                  disabled={isResettingPin}
                >
                  <Txt maxFontSizeMultiplier={1.3} style={styles.resetPinBtnText}>Save</Txt>
                </AnimatedPress>
              </View>

        </Sheet>
      )}

      {/* ── Edit Staff Modal ── */}
      {/* The capped height, the scrolling body and the always-visible Save/Cancel row were
          all hand-built here — with a comment explaining the bug that came from getting it
          wrong. `Sheet` does exactly that natively: content scrolls, `footer` stays put. */}
      {showEditModal && selectedStaff && (
        <Sheet
          visible
          title="Edit staff details"
          subtitle={selectedStaff.name}
          icon="create-outline"
          onDismiss={() => setShowEditModal(false)}
          footer={
            <Row gap={10}>
              <AnimatedPress accessibilityRole="button" style={styles.editModalSaveBtn} onPress={handleUpdateStaff} disabled={isUpdating}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.editModalSaveText}>
                  {isUpdating ? 'Saving…' : 'Save changes'}
                </Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button" style={styles.editModalCancelBtn} onPress={() => setShowEditModal(false)}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.editModalCancelText}>Cancel</Txt>
              </AnimatedPress>
            </Row>
          }
        >
                  <OutlinedTextField
                    label="Full Name"
                    value={editName}
                    onChangeText={(v) => { setEditName(v); if (errors.editName) setErrors((e) => ({ ...e, editName: undefined })); }}
                    error={errors.editName}
                    style={{ marginBottom: 12 }}
                  />

                  <OutlinedTextField
                    label="Phone Number"
                    value={editPhone}
                    editable={false}
                    onChangeText={() => {}}
                    containerColor={BG}
                    style={{ marginBottom: 12, opacity: 0.6 }}
                  />

                  <Row gap={8} style={{ marginBottom: 12 }}>
                    <OutlinedTextField
                      label="Salary (₹)"
                      value={editSalary}
                      onChangeText={setEditSalary}
                      keyboardType="number-pad"
                      containerColor={BG}
                      style={{ flex: 1 }}
                    />
                    
                    <Col style={{ flex: 1.2 }}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Shift</Txt>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Row gap={6} align="center">
                          {SHIFT_OPTIONS.map((opt) => {
                            const isSelected = editShift === opt;
                            return (
                              <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                                key={opt}
                                style={[styles.shiftChip, isSelected && styles.shiftChipActive]}
                                onPress={() => setEditShift(opt)}
                              >
                                <Txt maxFontSizeMultiplier={1.3} style={[styles.shiftChipText, isSelected && styles.shiftChipTextActive]}>
                                  {opt.replace(' Shift', '').split(' ')[0]}
                                </Txt>
                              </AnimatedPress>
                            );
                          })}
                        </Row>
                      </ScrollView>
                    </Col>
                  </Row>

                  <Spacer size={8} />

                  <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Role</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <Row gap={6}>
                      {selectableRoles.map((r) => {
                        const isSelected = editRole === r;
                        return (
                          <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                            key={r}
                            style={[styles.roleChip, isSelected && styles.roleChipActive]}
                            onPress={() => setEditRole(r)}
                          >
                            <Txt maxFontSizeMultiplier={1.3} style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}>
                              {r}
                            </Txt>
                          </AnimatedPress>
                        );
                      })}
                    </Row>
                  </ScrollView>
        </Sheet>
      )}

    </View>
  );
}

function roleIconName(role: string): keyof typeof Ionicons.glyphMap {
  const r = role.toLowerCase();
  if (r === 'manager') return 'person-circle-outline';
  if (r === 'chef') return 'restaurant-outline';
  if (r === 'kitchen_staff') return 'egg-outline';
  if (r.includes('maintenance')) return 'build-outline';
  if (r === 'delivery_agent') return 'bicycle-outline';
  return 'person-outline';
}

function roleTone(role: string): any {
  const r = role.toLowerCase();
  if (r === 'manager') return 'info';
  if (r === 'chef' || r === 'kitchen_staff') return 'ok';
  if (r.includes('maintenance')) return 'warn';
  return 'neutral';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Switcher Tab bar
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10 },
  segmentedControl: {
    backgroundColor: WHITE,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    width: '100%' },
  segBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  segBtnActive: {
    backgroundColor: GREEN },
  segBtnText: { fontSize: 13, fontWeight: '600', color: CHARCOAL },
  segBtnTextActive: { color: WHITE, fontWeight: '700' },

  // Scroll Area
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40 },
  bodyTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Role selector chips
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER },
  roleChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  roleChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  roleChipTextActive: { color: WHITE, fontWeight: '700' },

  // Work Details fields
  inputLabelStyle: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 4 },
  shiftChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 6 },
  shiftChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  shiftChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  shiftChipTextActive: { color: WHITE, fontWeight: '700' },

  // Account Access PIN input eye button
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 36 },
  securityStrip: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: Radii.control,
    paddingHorizontal: 10,
    paddingVertical: 6 },
  securityText: { fontSize: 11, color: GREEN, fontWeight: '600' },

  // Create button CTA
  primaryBtn: {
    height: 54,
    backgroundColor: GREEN,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: WHITE },

  // Directory Styles
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.card,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  // Roster card items

  // Modal Sheet Backdrop

  // Bottom action sheet popup
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BG },
  sheetOptionText: { fontSize: 14, fontWeight: '600', color: CHARCOAL },

  // Details Modal styles
  detailSecLabel: { fontSize: 9, fontWeight: '700', color: MUTED, letterSpacing: 0.5 },
  detailLabel: { fontSize: 11, color: MUTED },
  detailValue: { fontSize: 13, fontWeight: '700', color: CHARCOAL, marginTop: 2 },
  resetPinBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: BG,
    padding: 10,
    borderRadius: Radii.card },
  resetPinBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16 },
  resetPinBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },

  // Edit Staff Modal styles
  editModalSaveBtn: {
    flex: 1,
    height: 48,
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  editModalSaveText: { fontSize: 13, fontWeight: '700', color: WHITE },
  editModalCancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  editModalCancelText: { fontSize: 13, fontWeight: '700', color: CHARCOAL } });
