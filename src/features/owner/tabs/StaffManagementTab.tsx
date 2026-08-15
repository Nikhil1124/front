/**
 * StaffManagementTab — port of Kotlin `StaffManagementTab`.
 * 2 sub-tabs (Add Staff / Staff Directory) so each fits on screen without
 * the form and the full roster fighting for scroll space.
 */
import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect } from '@/utils/haptics';

const SUB_TABS = ['➕ Add Staff', '👥 Staff Directory'];

export function StaffManagementTab() {
  const [subTab, setSubTab] = useState(0);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManager = usePGowStore((s) => s.isManagerMode);
  const allPGs = usePGowStore((s) => s.allPGsState);
  const staffList = usePGowStore((s) => s.currentStaff);
  const staffRoleInput = usePGowStore((s) => s.staffRoleInput);
  const staffNameInput = usePGowStore((s) => s.staffNameInput);
  const staffPhoneInput = usePGowStore((s) => s.staffPhoneInput);
  const staffPinInput = usePGowStore((s) => s.staffPinInput);
  const staffShiftInput = usePGowStore((s) => s.staffShiftInput);
  const staffSalaryInput = usePGowStore((s) => s.staffSalaryInput);
  const set = usePGowStore((s) => s.set);
  const registerStaff = usePGowStore((s) => s.registerStaffMember);
  const deleteStaff = usePGowStore((s) => s.deleteStaffMember);

  const availableRoles = isManager
    ? ['Chef', 'Kitchen Staff', 'Maintenance Staff', 'Housekeeping', 'Security']
    : ['Manager', 'Chef', 'Kitchen Staff', 'Maintenance Staff', 'Housekeeping', 'Security'];

  useEffect(() => {
    if (!isManager && owner) {
      set('staffRoleInput', 'Manager');
    } else if (isManager) {
      set('staffRoleInput', 'Chef');
    }
  }, [isManager, owner]);

  const handleRegister = async () => {
    const result = await registerStaff();
    if (result.ok) Alert.alert('Success', 'Staff registered successfully!');
    else Alert.alert('Failed', result.error ?? 'Unknown');
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={styles.tabBar}>
        {SUB_TABS.map((label, idx) => {
          const sel = subTab === idx;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => { hapticSelect(); setSubTab(idx); }}
              style={[styles.subTab, { backgroundColor: sel ? Colors.primary : 'transparent' }]}
            >
              <Txt size={11} weight={sel ? '800' : '600'} color={sel ? Colors.textInverse : Colors.textMuted}>
                {label}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 14, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {subTab === 0 && (
          <>
            <Row gap={6} align="center">
              <Txt size={15} weight="900" color={Colors.textPrimary}>{!isManager ? 'Appoint Manager / Staff' : 'Add Staff Member'}</Txt>
              <InfoTip
                text={!isManager
                  ? 'Appoint managers or staff for this property. Staff are added to the property you are currently signed in to.'
                  : 'Register a kitchen or maintenance team member for this property.'}
              />
            </Row>
            <Spacer size={12} />

            <OutlinedTextField
              label="Staff / Manager Full Name *"
              placeholder="Ramesh Kumar"
              value={staffNameInput}
              onChangeText={(v) => set('staffNameInput', v)}
              containerColor={Colors.surfaceMuted}
              style={{ marginBottom: 8 }}
            />

            <Txt size={11} weight="800" color={Colors.textMuted}>Designation / Role</Txt>
            <Spacer size={4} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {availableRoles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  selected={staffRoleInput === role}
                  onPress={() => set('staffRoleInput', role)}
                  size={11}
                />
              ))}
            </ScrollView>
            <Spacer size={10} />

            <Row gap={8}>
              <OutlinedTextField
                label="Phone Number *"
                placeholder="+91 98765 43210"
                value={staffPhoneInput}
                onChangeText={(v) => set('staffPhoneInput', v)}
                keyboardType="phone-pad"
                containerColor={Colors.surfaceMuted}
                style={{ flex: 1 }}
              />
              <OutlinedTextField
                label="Login PIN (4 digits) *"
                placeholder="1234"
                value={staffPinInput}
                onChangeText={(v) => set('staffPinInput', v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                containerColor={Colors.surfaceMuted}
                style={{ flex: 1 }}
              />
            </Row>
            <Spacer size={8} />

            <Row gap={8}>
              <OutlinedTextField
                label="Shift Time"
                placeholder="8 AM - 4 PM"
                value={staffShiftInput}
                onChangeText={(v) => set('staffShiftInput', v)}
                containerColor={Colors.surfaceMuted}
                style={{ flex: 1 }}
              />
              <OutlinedTextField
                label="Monthly Salary (₹)"
                placeholder="15000"
                value={staffSalaryInput}
                onChangeText={(v) => set('staffSalaryInput', v)}
                keyboardType="number-pad"
                containerColor={Colors.surfaceMuted}
                style={{ flex: 1 }}
              />
            </Row>

            <Spacer size={14} />
            <Btn
              onPress={handleRegister}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
            >
              <Ionicons name="person-add" size={16} color={Colors.textInverse} />
              <Txt size={13} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>
                {!isManager ? 'Appoint & Provision Member' : 'Register Staff Member'}
              </Txt>
            </Btn>
          </>
        )}

        {subTab === 1 && (
          <>
            <Row justify="space-between" align="center">
              <Txt size={14} weight="900" color={Colors.textPrimary}>Registered Staff & Managers</Txt>
              <View style={styles.countBadge}>
                <Txt size={11} weight="800" color={Colors.primaryDark}>{staffList.length} Active</Txt>
              </View>
            </Row>
            <Spacer size={10} />

            {staffList.length === 0 ? (
              <Card containerColor={Colors.surface} borderRadius={14} padding={[20, 16]} style={{ alignItems: 'center' }}>
                <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
                <Txt size={12} weight="700" color={Colors.textMuted} style={{ marginTop: 6 }}>No staff registered yet.</Txt>
              </Card>
            ) : (
              staffList.map((staff) => {
                const branchName = allPGs.find((p) => p.id === staff.pgId)?.pgName ?? `PG #${staff.pgId}`;
                const isMgr = staff.role.toLowerCase() === 'manager';
                return (
                  <Card
                    key={staff.id}
                    containerColor={isMgr ? '#F0FDF9' : Colors.surface}
                    borderRadius={16}
                    borderWidth={1}
                    borderColor={isMgr ? '#86EFAC' : Colors.borderSubtle}
                    padding={[14, 14]}
                    style={{ marginBottom: 10 }}
                  >
                    <Row justify="space-between" align="center">
                      <Row gap={12} style={{ flex: 1 }} align="center">
                        <View style={[styles.roleIcon, { backgroundColor: isMgr ? '#DCFCE7' : Colors.surfaceMuted }]}>
                          <Ionicons
                            name={roleIconName(staff.role) as any}
                            size={20}
                            color={isMgr ? '#16A34A' : Colors.primary}
                          />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <Row align="center" gap={6}>
                            <Txt size={14} weight="800" color={Colors.textPrimary}>{staff.name}</Txt>
                            <View style={[styles.rolePill, { backgroundColor: isMgr ? '#BBF7D0' : '#E0F2FE' }]}>
                              <Txt size={9} weight="800" color={isMgr ? '#166534' : '#0369A1'}>{staff.role}</Txt>
                            </View>
                          </Row>
                          <Txt size={11} weight="700" color={Colors.primaryDark} style={{ marginTop: 2 }}>
                            🏢 {branchName}
                          </Txt>
                          <Txt size={10} color={Colors.textMuted}>
                            📞 {staff.phone} • PIN: {staff.loginPin}
                          </Txt>
                          <Txt size={10} weight="700" color={Colors.textSecondary}>
                            {staff.shiftTime ? `${staff.shiftTime} • ` : ''}₹{Math.round(staff.monthlySalary).toLocaleString('en-IN')}/mo
                          </Txt>
                        </Col>
                      </Row>
                      <IconBtn onPress={() => deleteStaff(staff.id)} icon="trash-outline" size={18} tint="#EF4444" />
                    </Row>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function roleIconName(role: string): string {
  if (role.toLowerCase() === 'manager') return 'people-circle';
  if (role.toLowerCase() === 'chef') return 'restaurant';
  if (role.toLowerCase().includes('maintenance')) return 'build';
  return 'ribbon';
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 4,
    gap: 4,
  },
  subTab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F0FDF9',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  roleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
