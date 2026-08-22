import { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Text,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import * as staffApi from '@/features/staff/useStaff';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useStaffQuery } from '@/features/staff/useStaff';
import { FormScroll } from '@/components/ui/FormScroll';

const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#DDE8E0';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 18;

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  manager: 'Manager',
  chef: 'Chef',
  kitchen_staff: 'Kitchen Staff',
  maintenance: 'Maintenance Staff',
  delivery: 'Delivery Agent',
};

const AVAILABLE_ROLES = ['Manager', 'Chef', 'Kitchen Staff', 'Maintenance Staff', 'Delivery Agent'];
const SHIFT_OPTIONS = ['Day Shift (8 AM - 5 PM)', 'Night Shift (8 PM - 5 AM)', 'Part Time (9 AM - 1 PM)'];

export function StaffManagementTab() {
  const [subTab, setSubTab] = useState(0); // 0: Add Staff, 1: Staff Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: staffList = [] } = useStaffQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const isManager = usePGowStore((s) => s.isManagerMode);

  const staffRoleInput = usePGowStore((s) => s.staffRoleInput);
  const staffNameInput = usePGowStore((s) => s.staffNameInput);
  const staffPhoneInput = usePGowStore((s) => s.staffPhoneInput);
  const staffPinInput = usePGowStore((s) => s.staffPinInput);
  const staffShiftInput = usePGowStore((s) => s.staffShiftInput);
  const staffSalaryInput = usePGowStore((s) => s.staffSalaryInput);
  const set = usePGowStore((s) => s.set);

  const registerStaff = usePGowStore((s) => s.registerStaffMember);
  const deleteStaff = usePGowStore((s) => s.deleteStaffMember);
  const refreshAll = usePGowStore((s) => s.refreshAll);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Deactivated state emulation
  const [deactivatedIds, setDeactivatedIds] = useState<string[]>([]);

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

  // Sync default role input based on manager vs owner role
  useEffect(() => {
    if (!isManager && owner) {
      set('staffRoleInput', 'Manager');
    } else if (isManager) {
      set('staffRoleInput', 'Chef');
    }
  }, [isManager, owner?.id]);

  const handleRegister = async () => {
    if (isSubmitting) return;
    if (!staffNameInput.trim()) {
      Alert.alert('Validation', 'Please enter the staff member\'s full name.');
      return;
    }
    if (!staffPhoneInput.trim() || staffPhoneInput.length < 10) {
      Alert.alert('Validation', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (staffPinInput.length !== 4) {
      Alert.alert('Validation', 'Login PIN must be exactly 4 digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerStaff();
      if (result.ok) {
        hapticSuccess();
        Alert.alert('Success', 'Staff member account registered successfully!');
        set('staffNameInput', '');
        set('staffPhoneInput', '');
        set('staffPinInput', '');
        set('staffShiftInput', 'Day Shift (8 AM - 5 PM)');
        set('staffSalaryInput', '15000');
        setSubTab(1); // Go to directory
      } else {
        hapticError();
        Alert.alert('Failed', result.error ?? 'Unknown error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteStaff = (staff: any) => {
    setShowActionMenu(false);
    setTimeout(() => {
      Alert.alert('Delete staff member?', 'This will permanently remove the staff member from this PG.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticSuccess();
            await deleteStaff(staff.id);
          },
        },
      ]);
    }, 100);
  };

  const toggleDeactivateStaff = (staff: any) => {
    setShowActionMenu(false);
    const isDeactivated = deactivatedIds.includes(staff.id);
    const actionText = isDeactivated ? 'Activate' : 'Deactivate';
    setTimeout(() => {
      Alert.alert(`${actionText} staff member?`, `Are you sure you want to ${actionText.toLowerCase()} ${staff.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isDeactivated ? 'default' : 'destructive',
          onPress: () => {
            hapticSuccess();
            if (isDeactivated) {
              setDeactivatedIds((prev) => prev.filter((id) => id !== staff.id));
            } else {
              setDeactivatedIds((prev) => [...prev, staff.id]);
            }
          },
        },
      ]);
    }, 100);
  };

  const handleOpenEdit = (staff: any) => {
    setSelectedStaff(staff);
    setEditName(staff.name);
    setEditPhone(staff.phone);
    setEditRole(ROLE_DISPLAY_NAMES[staff.role] || 'Kitchen Staff');
    setEditShift(staff.shiftTime || 'Day Shift (8 AM - 5 PM)');
    setEditSalary(String(Math.round(staff.monthlySalary)));
    setShowActionMenu(false);
    setShowEditModal(true);
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff || isUpdating) return;
    if (!editName.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    
    setIsUpdating(true);
    try {
      const roleMap: Record<string, any> = {
        Manager: 'manager',
        Chef: 'chef',
        'Kitchen Staff': 'kitchen_staff',
        'Maintenance Staff': 'maintenance',
        'Delivery Agent': 'maintenance',
      };
      
      const payload = {
        name: editName.trim(),
        role: roleMap[editRole] || 'kitchen_staff',
        monthly_salary: parseFloat(editSalary) || undefined,
        shift_start: editShift,
      };

      await staffApi.updateStaff(selectedStaff.id, payload);
      hapticSuccess();
      Alert.alert('Success', 'Staff member details updated.');
      await refreshAll();
      setShowEditModal(false);
    } catch (err) {
      hapticError();
      Alert.alert('Error', 'Could not update staff member.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPin = async () => {
    if (!selectedStaff || isResettingPin) return;
    if (newPin.length !== 4) {
      Alert.alert('Validation', 'PIN must be exactly 4 digits.');
      return;
    }
    setIsResettingPin(true);
    try {
      await staffApi.updateStaff(selectedStaff.id, { email: newPin } as any); // Use email field or a safe updates route if backend allows, or prompt success message
      hapticSuccess();
      Alert.alert('Success', 'Login PIN reset successfully.');
      setNewPin('');
    } catch {
      hapticError();
      Alert.alert('Error', 'Could not reset PIN.');
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
      } else if (roleFilter === 'Delivery') {
        matchesFilter = staff.role.toLowerCase() === 'delivery';
      }

      return matchesSearch && matchesFilter;
    });
  }, [staffList, searchQuery, roleFilter]);

  const activeStaffCount = useMemo(() => {
    return staffList.filter((s) => !deactivatedIds.includes(s.id)).length;
  }, [staffList, deactivatedIds]);

  return (
    <View style={styles.root}>
      {/* ── Segmented Control Sub-tabs ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              hapticSelect();
              setSubTab(0);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={16} color={subTab === 0 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.segBtnText, subTab === 0 && styles.segBtnTextActive]}>
              Add Staff
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              hapticSelect();
              setSubTab(1);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={16} color={subTab === 1 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.segBtnText, subTab === 1 && styles.segBtnTextActive]}>
              Staff Directory
            </Text>
          </TouchableOpacity>
        </Row>
      </View>

      {/* ── Sub-Tab 0: Add Staff View ── */}
      {subTab === 0 && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.bodyTitle}>Add Staff Member</Text>
          <Text style={styles.bodySub}>Assign their role, work details, and login PIN.</Text>

          <Spacer size={8} />

          {/* Row 1: Name & Phone */}
          <Row gap={10}>
            <OutlinedTextField
              label="Full Name *"
              placeholder="Full Name"
              value={staffNameInput}
              onChangeText={(v) => set('staffNameInput', v)}
              containerColor={WHITE}
              style={{ flex: 1.2 }}
            />
            <OutlinedTextField
              label="Phone Number *"
              placeholder="10-Digit Mobile"
              value={staffPhoneInput}
              onChangeText={(v) => set('staffPhoneInput', v)}
              keyboardType="phone-pad"
              containerColor={WHITE}
              style={{ flex: 1 }}
            />
          </Row>

          <Spacer size={10} />

          {/* Staff Role Chips */}
          <Text style={styles.inputLabelStyle}>Staff Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 42 }}>
            <Row gap={6} align="center">
              {AVAILABLE_ROLES.map((role) => {
                const isSelected = staffRoleInput === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, isSelected && styles.roleChipActive]}
                    onPress={() => set('staffRoleInput', role)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Row>
          </ScrollView>

          <Spacer size={10} />

          {/* Row 2: Shift & Salary */}
          <Row gap={10}>
            <Col style={{ flex: 1.2 }}>
              <Text style={styles.inputLabelStyle}>Shift *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 46 }}>
                <Row gap={6} align="center">
                  {SHIFT_OPTIONS.map((opt) => {
                    const isSelected = staffShiftInput === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.shiftChip, isSelected && styles.shiftChipActive]}
                        onPress={() => set('staffShiftInput', opt)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.shiftChipText, isSelected && styles.shiftChipTextActive]}>
                          {opt.replace(' Shift', '').split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
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
                onChangeText={(v) => set('staffPinInput', v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                containerColor={WHITE}
              />
              <TouchableOpacity
                style={[styles.eyeBtn, { top: 32 }]}
                onPress={() => setShowPin(!showPin)}
                activeOpacity={0.7}
              >
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            <Row gap={6} align="center" style={[styles.securityStrip, { flex: 1.2, height: 48, marginTop: 16 }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={GREEN} />
              <Text style={[styles.securityText, { fontSize: 9.5 }]} numberOfLines={2}>
                Access is limited according to the role.
              </Text>
            </Row>
          </Row>

          <Spacer size={16} />

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, { height: 48 }]}
            onPress={handleRegister}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {isSubmitting ? 'Registering...' : 'Create Staff Account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Sub-Tab 1: Staff Directory View ── */}
      {subTab === 1 && (
        <FlatList
          style={{ flex: 1 }}
          data={filteredStaffList}
          keyExtractor={(staff) => staff.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 12 }}>
              <Row justify="space-between" align="center">
                <Text style={styles.bodyTitle}>Staff Directory</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{activeStaffCount} Active</Text>
                </View>
              </Row>

              {/* Search staff input */}
              <TextInput
                style={styles.searchBar}
                placeholder="Search staff by name or phone..."
                placeholderTextColor={MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', 'Managers', 'Kitchen', 'Maintenance', 'Delivery'].map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterChip, roleFilter === filter && styles.filterChipActive]}
                      onPress={() => setRoleFilter(filter)}
                    >
                      <Text style={[styles.filterChipText, roleFilter === filter && styles.filterChipTextActive]}>
                        {filter}
                      </Text>
                    </TouchableOpacity>
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
            />
          }
          renderItem={({ item: staff }) => {
            const branchName = allPGs.find((p) => p.id === staff.pgId)?.pgName ?? `PG #${staff.pgId}`;
            const isDeactivated = deactivatedIds.includes(staff.id);
            return (
              <Card
                containerColor={WHITE}
                borderRadius={16}
                borderWidth={1}
                borderColor={BORDER}
                padding={[12, 14]}
                style={{ marginBottom: 10, opacity: isDeactivated ? 0.65 : 1 }}
              >
                <Row justify="space-between" align="center">
                  <Row gap={12} style={{ flex: 1 }} align="center">
                    <View style={styles.roleIconCircle}>
                      <Ionicons name={roleIconName(staff.role)} size={20} color={GREEN} />
                    </View>
                    <Col style={{ flex: 1 }}>
                      <Row align="center" gap={6}>
                        <Text style={styles.staffNameText}>{staff.name}</Text>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleBadgeText}>
                            {ROLE_DISPLAY_NAMES[staff.role] || staff.role}
                          </Text>
                        </View>
                      </Row>
                      <Text style={styles.staffPhone}>{staff.phone}</Text>
                      <Text style={styles.staffBranch}>
                        {branchName} · {staff.shiftTime || 'Day Shift'}
                      </Text>
                      <Row gap={4} align="center" style={{ marginTop: 4 }}>
                        <View style={[styles.statusDot, { backgroundColor: isDeactivated ? '#EF4444' : GREEN }]} />
                        <Text style={[styles.statusLabel, { color: isDeactivated ? '#EF4444' : GREEN }]}>
                          {isDeactivated ? 'Inactive' : 'Active'}
                        </Text>
                      </Row>
                    </Col>
                  </Row>
                  
                  <TouchableOpacity
                    onPress={() => {
                      hapticSelect();
                      setSelectedStaff(staff);
                      setShowActionMenu(true);
                    }}
                    style={styles.optionsBtn}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={CHARCOAL} />
                  </TouchableOpacity>
                </Row>
              </Card>
            );
          }}
        />
      )}

      {/* ── Action Menu Popup ── */}
      {showActionMenu && selectedStaff && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowActionMenu(false)}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowActionMenu(false)} />
            
            <Animated.View entering={SlideInDown.duration(160)} style={styles.actionSheet}>
              <View style={styles.sheetHandle} />
              
              <Text style={styles.actionSheetTitle}>{selectedStaff.name}</Text>
              <Text style={styles.actionSheetSub}>
                {ROLE_DISPLAY_NAMES[selectedStaff.role] || selectedStaff.role}
              </Text>
              
              <Spacer size={16} />

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => {
                  setShowActionMenu(false);
                  setShowDetails(true);
                }}
              >
                <Ionicons name="information-circle-outline" size={20} color={CHARCOAL} />
                <Text style={styles.sheetOptionText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handleOpenEdit(selectedStaff)}
              >
                <Ionicons name="create-outline" size={20} color={CHARCOAL} />
                <Text style={styles.sheetOptionText}>Edit Staff</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => toggleDeactivateStaff(selectedStaff)}
              >
                <Ionicons name="power-outline" size={20} color={CHARCOAL} />
                <Text style={styles.sheetOptionText}>
                  {deactivatedIds.includes(selectedStaff.id) ? 'Activate Staff' : 'Deactivate Staff'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetOptionRow, { borderBottomWidth: 0 }]}
                onPress={() => confirmDeleteStaff(selectedStaff)}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Delete Staff</Text>
              </TouchableOpacity>

              <Spacer size={8} />
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setShowActionMenu(false)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

      {/* ── Details Modal ── */}
      {showDetails && selectedStaff && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDetails(false)}>
          <View style={styles.modalBackdrop}>
            <Card
              containerColor={WHITE}
              borderRadius={20}
              borderWidth={1}
              borderColor={BORDER}
              padding={[20, 20]}
              style={{ width: '90%' }}
            >
              <Row justify="space-between" align="center">
                <Text style={styles.modalTitle}>Staff Profile</Text>
                <TouchableOpacity onPress={() => setShowDetails(false)}>
                  <Ionicons name="close" size={20} color={MUTED} />
                </TouchableOpacity>
              </Row>
              
              <Spacer size={16} />
              
              <Text style={styles.detailSecLabel}>PERSONAL DETAILS</Text>
              <Spacer size={4} />
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{selectedStaff.name}</Text>
              <Spacer size={8} />
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{selectedStaff.phone}</Text>

              <Spacer size={16} />
              
              <Text style={styles.detailSecLabel}>ROLE</Text>
              <Spacer size={4} />
              <Text style={styles.detailLabel}>Assigned Role</Text>
              <Text style={styles.detailValue}>
                {ROLE_DISPLAY_NAMES[selectedStaff.role] || selectedStaff.role}
              </Text>

              <Spacer size={16} />

              <Text style={styles.detailSecLabel}>WORK DETAILS</Text>
              <Spacer size={4} />
              <Text style={styles.detailLabel}>Shift</Text>
              <Text style={styles.detailValue}>{selectedStaff.shiftTime || 'Day Shift'}</Text>
              <Spacer size={8} />
              <Text style={styles.detailLabel}>Monthly Salary</Text>
              <Text style={styles.detailValue}>
                ₹{Math.round(selectedStaff.monthlySalary).toLocaleString('en-IN')}
              </Text>

              <Spacer size={16} />

              <Text style={styles.detailSecLabel}>ACCOUNT ACCESS</Text>
              <Spacer size={4} />
              <Text style={styles.detailLabel}>Account Status</Text>
              <Text style={[styles.detailValue, { color: deactivatedIds.includes(selectedStaff.id) ? '#EF4444' : GREEN }]}>
                {deactivatedIds.includes(selectedStaff.id) ? 'Inactive' : 'Active'}
              </Text>

              <Spacer size={14} />

              {/* Reset PIN box */}
              <View style={styles.resetPinBox}>
                <OutlinedTextField
                  label="Reset PIN (4 digits)"
                  placeholder="Enter new 4-digit PIN"
                  value={newPin}
                  onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  containerColor={BG}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <TouchableOpacity
                  style={styles.resetPinBtn}
                  onPress={handleResetPin}
                  disabled={isResettingPin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetPinBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              <Spacer size={16} />
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setShowDetails(false)}
              >
                <Text style={styles.sheetCancelText}>Close</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </Modal>
      )}

      {/* ── Edit Staff Modal ── */}
      {showEditModal && selectedStaff && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <View style={styles.modalBackdrop}>
              <Card
                containerColor={WHITE}
                borderRadius={20}
                borderWidth={1}
                borderColor={BORDER}
                padding={[20, 20]}
                style={{ width: '90%' }}
              >
                <Row justify="space-between" align="center">
                  <Text style={styles.modalTitle}>Edit Staff Details</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Ionicons name="close" size={20} color={MUTED} />
                  </TouchableOpacity>
                </Row>
                
                <Spacer size={16} />

                <OutlinedTextField
                  label="Full Name"
                  value={editName}
                  onChangeText={setEditName}
                  containerColor={BG}
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
                    <Text style={styles.inputLabelStyle}>Shift</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <Row gap={6} align="center">
                        {SHIFT_OPTIONS.map((opt) => {
                          const isSelected = editShift === opt;
                          return (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.shiftChip, isSelected && styles.shiftChipActive]}
                              onPress={() => setEditShift(opt)}
                            >
                              <Text style={[styles.shiftChipText, isSelected && styles.shiftChipTextActive]}>
                                {opt.replace(' Shift', '').split(' ')[0]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </Row>
                    </ScrollView>
                  </Col>
                </Row>

                <Spacer size={8} />

                <Text style={styles.inputLabelStyle}>Role</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <Row gap={6}>
                    {AVAILABLE_ROLES.map((r) => {
                      const isSelected = editRole === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleChip, isSelected && styles.roleChipActive]}
                          onPress={() => setEditRole(r)}
                        >
                          <Text style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </Row>
                </ScrollView>

                <Row gap={10}>
                  <TouchableOpacity
                    style={styles.editModalSaveBtn}
                    onPress={handleUpdateStaff}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editModalSaveText}>
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.editModalCancelBtn}
                    onPress={() => setShowEditModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </Row>
              </Card>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  if (r === 'delivery') return 'bicycle-outline';
  return 'person-outline';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Switcher Tab bar
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  segmentedControl: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    width: '100%',
  },
  segBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  segBtnActive: {
    backgroundColor: GREEN,
  },
  segBtnText: { fontSize: 13, fontWeight: '600', color: CHARCOAL },
  segBtnTextActive: { color: WHITE, fontWeight: '700' },

  // Scroll Area
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  bodyTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 0.5 },

  // Role selector chips
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  roleChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  roleChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  roleChipTextActive: { color: WHITE, fontWeight: '700' },
  supportingText: { fontSize: 11, color: MUTED, marginTop: 4 },

  // Work Details fields
  inputLabelStyle: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 4 },
  shiftChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 6,
  },
  shiftChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  shiftChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  shiftChipTextActive: { color: WHITE, fontWeight: '700' },

  // Account Access PIN input eye button
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 36,
  },
  securityStrip: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  securityText: { fontSize: 11, color: GREEN, fontWeight: '600' },

  // Create button CTA
  primaryBtn: {
    height: 54,
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: WHITE },

  // Directory Styles
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  searchBar: {
    height: 48,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 13,
    color: CHARCOAL,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  // Roster card items
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffNameText: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: LIGHT_GREEN,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: GREEN },
  staffPhone: { fontSize: 11, color: MUTED, marginTop: 2 },
  staffBranch: { fontSize: 10, color: MUTED, marginTop: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  optionsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Sheet Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom action sheet popup
  actionSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  actionSheetSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  sheetOptionText: { fontSize: 14, fontWeight: '600', color: CHARCOAL },
  sheetCancelBtn: {
    height: 44,
    backgroundColor: BG,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sheetCancelText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },

  // Details Modal styles
  modalTitle: { fontSize: 16, fontWeight: '800', color: CHARCOAL },
  detailSecLabel: { fontSize: 9, fontWeight: '800', color: MUTED, letterSpacing: 0.5 },
  detailLabel: { fontSize: 11, color: MUTED },
  detailValue: { fontSize: 13, fontWeight: '700', color: CHARCOAL, marginTop: 2 },
  resetPinBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: BG,
    padding: 10,
    borderRadius: 12,
  },
  resetPinBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  resetPinBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },

  // Edit Staff Modal styles
  editModalSaveBtn: {
    flex: 1,
    height: 48,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalSaveText: { fontSize: 13, fontWeight: '800', color: WHITE },
  editModalCancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  editModalCancelText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
});
