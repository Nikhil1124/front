import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Alert, FlatList, BackHandler } from 'react-native';
import { router, useFocusEffect } from 'expo-router';


import { Ionicons } from '@expo/vector-icons';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { EmptyState } from '@/components/EmptyState';
import { FormScroll } from '@/components/ui/FormScroll';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useStaffQuery, useAddStaffMutation } from '@/features/staff/useStaff';
import * as map from '@/data/mappers';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, ListRow, Row, SearchField, Spacer, Txt } from '@/components/ui';

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Was `errorField: 'phone' | null`, which only tinted one field's border and said nothing.
  // `OutlinedTextField.error` carries the sentence now, so this holds one per field.
  const [errors, setErrors] = useState<{ name?: string; phone?: string; pin?: string; editName?: string; newPin?: string }>({});



  // Override back navigation — this screen lives inside the tab navigator, not a stack,
  // so native back would leave ghost tab state. We force-replace with overview instead.
  //
  // Scoped to focus. `BackHandler` listeners are GLOBAL and fire most-recently-added first,
  // so while this tab stayed mounted underneath a pushed route (the staff detail screen, for
  // one) its handler still ran and answered back by replacing the whole stack with /overview
  // — the pushed screen could never pop. `useFocusEffect` registers only while this tab is
  // the focused route, which is the only time the behaviour above is the right one.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/overview');
        return true; // prevent default
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

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

    // `?? 'kitchen_staff'` used to close this expression. A role label that isn't in the map
    // — a renamed chip, a typo, a new option someone adds to the picker and forgets to map —
    // silently created the person as kitchen staff instead. Role IS the permission set here,
    // so that is a privilege decision made by a missing dictionary key. Refuse instead.
    const mappedRole = REGISTER_ROLE_MAP[staffRoleInput];
    if (!mappedRole) {
      Alert.alert('Pick a role', `"${staffRoleInput}" isn't a role this property can assign.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addStaffMutation.mutateAsync({
        name: staffNameInput.trim(),
        phone: map.toE164(staffPhoneInput),
        role: mappedRole,
        pin: staffPinInput,
        monthly_salary: parseFloat(staffSalaryInput) || undefined,
        // Both halves, as real `time` values — see SHIFT_TIMES.
        ...(SHIFT_TIMES[staffShiftInput] ?? {}) });
      Alert.alert('Success', 'Staff member account registered successfully!');
      set('staffNameInput', '');
      set('staffPhoneInput', '');
      set('staffPinInput', '');
      set('staffShiftInput', 'Day Shift (8 AM - 5 PM)');
      set('staffSalaryInput', '');
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

      {/* ── Sub-Tab 0: Add Staff View ──
          `FormScroll`, and scrolling ENABLED. This was a plain ScrollView with
          `scrollEnabled={false}` — fine when the form packed two controls per row and fit a
          screen, wrong the moment it became one control per row and grew past one. The bottom
          of the form, "Create Staff Account" included, simply could not be reached. The other
          half is the keyboard: an edge-to-edge Android window is not resized when the IME
          opens, so tapping the PIN field put the keyboard over the submit button with no way
          to scroll out from under it. FormScroll reserves the covered space as content
          padding — see its header for why not KeyboardAvoidingView on Android. */}
      {subTab === 0 && (
        <FormScroll
          {...dockScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Add Staff Member</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodySub}>Assign their role, work details, and login PIN.</Txt>

          <Spacer size={8} />

          {/* One field per row, grouped into three sections.
              This form used to pack two controls into every row — name beside phone, a shift
              chip-picker beside a salary field, the PIN beside a static hint that read as a
              fourth input. On a phone that halves the width you type into, puts labels like
              "Login PIN (4 digits) *" in half a row so they truncate, and misaligns the
              baseline of a chip row against a text field. Full-width fields in named groups
              is the ordinary shape of a mobile form, and it is shorter to scan even though it
              is taller.

              The chip rows wrap now instead of scrolling sideways: "Maintenance" was cut off
              at the right edge with nothing to say it could be scrolled to. */}

          <Txt maxFontSizeMultiplier={1.3} style={styles.formSectionLabel}>WHO THEY ARE</Txt>
          <OutlinedTextField
            label="Full Name *"
            placeholder="e.g. Ramesh Kumar"
            value={staffNameInput}
            onChangeText={(v) => { set('staffNameInput', v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
            error={errors.name}
          />
          <Spacer size={12} />
          <OutlinedTextField
            label="Phone Number *"
            placeholder="10-digit mobile"
            value={staffPhoneInput}
            onChangeText={(v) => { set('staffPhoneInput', v); if (errors.phone) setErrors((e) => ({ ...e, phone: undefined })); }}
            keyboardType="phone-pad"
            error={errors.phone}
          />

          <Spacer size={20} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.formSectionLabel}>THEIR ROLE</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Staff Role *</Txt>
          <View style={styles.chipWrap}>
            {selectableRoles.map((role) => {
              const isSelected = staffRoleInput === role;
              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={role}
                  style={[styles.roleChip, isSelected && styles.roleChipActive]}
                  onPress={() => set('staffRoleInput', role)}
                >
                  <Txt maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}>
                    {role}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </View>

          <Spacer size={14} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Shift *</Txt>
          <View style={styles.chipWrap}>
            {SHIFT_OPTIONS.map((opt) => {
              const isSelected = staffShiftInput === opt;
              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={opt}
                  style={[styles.shiftChip, isSelected && styles.shiftChipActive]}
                  onPress={() => set('staffShiftInput', opt)}
                >
                  <Txt maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.shiftChipText, isSelected && styles.shiftChipTextActive]}>
                    {opt.replace(' Shift', '').split(' ')[0]}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </View>

          <Spacer size={20} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.formSectionLabel}>PAY &amp; ACCESS</Txt>
          <OutlinedTextField
            label="Monthly Salary (₹)"
            placeholder="e.g. 15000"
            value={staffSalaryInput}
            onChangeText={(v) => set('staffSalaryInput', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerColor={WHITE}
          />
          <Spacer size={12} />
          <View style={{ position: 'relative' }}>
            <OutlinedTextField
              label="Login PIN (4 digits) *"
              placeholder="4-digit PIN"
              value={staffPinInput}
              onChangeText={(v) => { set('staffPinInput', v.replace(/\D/g, '').slice(0, 4)); if (errors.pin) setErrors((e) => ({ ...e, pin: undefined })); }}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              error={errors.pin}
              // The hint that used to sit in its own column, where it read as another field.
              helper="Access is limited according to the role you picked above."
            />
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
              style={[styles.eyeBtn, { top: 32 }]}
              onPress={() => setShowPin(!showPin)}
            >
              <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
            </AnimatedPress>
          </View>

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
        </FormScroll>
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

              {/* Four fixed filters — they wrap onto a second line on a narrow phone
                  rather than the fourth one hanging half off the right edge. */}
              <View style={styles.chipWrap}>
                {['All', 'Managers', 'Kitchen', 'Maintenance'].map((filter) => (
                  <AnimatedPress accessibilityState={{ selected: roleFilter === filter }} accessibilityRole="button"
                    key={filter}
                    style={[styles.filterChip, roleFilter === filter && styles.filterChipActive]}
                    onPress={() => setRoleFilter(filter)}
                  >
                    <Txt maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.filterChipText, roleFilter === filter && styles.filterChipTextActive]}>
                      {filter}
                    </Txt>
                  </AnimatedPress>
                ))}
              </View>
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
              // Straight to the record. This used to open an action-menu sheet whose three
              // items were View / Edit / Delete — a layer that existed only to choose between
              // a screen and a form, both of which are now routes. View IS the row tap.
              onPress={() => router.push(`/(owner)/staff/${staff.id}` as never)}
              first={index === 0}
              last={index === filteredStaffList.length - 1}
              testID={`owner_staff_${staff.id}`}
            />
          )}
        />
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
  // A group heading inside a form — quieter than a screen title, louder than a field label.
  formSectionLabel: { fontSize: 11, fontWeight: '800', color: MUTED, letterSpacing: 0.6, marginBottom: 10 },
  // Chip rows wrap rather than scroll sideways, so the last option is never half off-screen.
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
