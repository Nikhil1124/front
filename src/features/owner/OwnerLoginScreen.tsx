/**
 * OwnerLoginScreen — port of Kotlin `OwnerLoginScreen(viewModel, initialTab)`.
 * Renders a 4-tab login (Owner / Manager / Staff / Resident) plus sub-toggle
 * between Guest Login and Join PG via QR.
 */
import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Modal, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { FormScroll } from '@/components/ui/FormScroll';

interface Props {
  initialTab?: number;
}

const TABS = ['PG Owner', 'PG Manager', 'Kitchen/Staff', 'Resident'];

export function OwnerLoginScreen({ initialTab = 0 }: Props) {
  const loginOwner = usePGowStore((s) => s.loginOwner);
  const loginManager = usePGowStore((s) => s.loginManager);
  const loginStaff = usePGowStore((s) => s.loginStaff);
  const loginGuest = usePGowStore((s) => s.loginGuest);
  const resetGuestPassword = usePGowStore((s) => s.resetGuestPassword);
  const joinPG = usePGowStore((s) => s.joinPG);
  const guestScanCodeInput = usePGowStore((s) => s.guestScanCodeInput);
  const set = usePGowStore((s) => s.set);
  const toast = useToast();

  const [selectedTab, setSelectedTab] = useState(initialTab);
  const [containerWidth, setContainerWidth] = useState(0);
  const tabOffset = useSharedValue(initialTab);

  const handleTabPress = (idx: number) => {
    hapticSelect();
    setSelectedTab(idx);
    tabOffset.value = withSpring(idx, {
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    });
  };

  useEffect(() => {
    tabOffset.value = withSpring(selectedTab, {
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    });
  }, [selectedTab]);

  const pillAnimatedStyle = useAnimatedStyle(() => {
    if (containerWidth <= 0) return { width: 0, opacity: 0 };
    const padding = 4;
    const usableWidth = containerWidth - padding * 2;
    const tabWidth = usableWidth / TABS.length;
    return {
      width: tabWidth,
      opacity: 1,
      transform: [{ translateX: tabOffset.value * tabWidth }],
    };
  });

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Owner tab. Phone is the login identity everywhere — the API has no email sign-in.
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Manager tab
  const [managerPhoneInput, setManagerPhoneInput] = useState('');
  const [managerPinInput, setManagerPinInput] = useState('');

  // Staff tab
  const [staffPhoneInput, setStaffPhoneInput] = useState('');
  const [staffPinInput, setStaffPinInput] = useState('');

  // Guest tab
  const [guestMode, setGuestMode] = useState<'LOGIN' | 'JOIN'>('LOGIN');
  const [guestPhoneInputForLogin, setGuestPhoneInputForLogin] = useState('');
  const [guestPasswordInputForLogin, setGuestPasswordInputForLogin] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetRoom, setResetRoom] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Local guest registration (joined with VM)
  const guestNameInput = usePGowStore((s) => s.guestNameInput);
  const guestEmailInput = usePGowStore((s) => s.guestEmailInput);
  const guestPhoneInput = usePGowStore((s) => s.guestPhoneInput);
  const guestRoomInput = usePGowStore((s) => s.guestRoomInput);
  const guestPasswordInput = usePGowStore((s) => s.guestPasswordInput);
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);

  const completeFirstTimePasswordChange = usePGowStore((s) => s.completeFirstTimePasswordChange);

  // First-time password change modal state
  const [showFirstTimePasswordModal, setShowFirstTimePasswordModal] = useState(false);
  const [tempPasswordHeld, setTempPasswordHeld] = useState('');
  const [firstTimeNewPassword, setFirstTimeNewPassword] = useState('');
  const [firstTimeConfirmPassword, setFirstTimeConfirmPassword] = useState('');

  const handleOwnerLogin = async () => {
    const result = await loginOwner(phoneInput, passwordInput);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome back!', 'Owner dashboard loading…');
      // Root-level guards for the owner group and for /groceries both flip true in the
      // same instant a token lands — an explicit target beats leaving the router to guess
      // between two simultaneously-valid screens. "/" re-runs app/index.tsx's role redirect.
      router.replace('/');
    } else if (result.mustChangePassword) {
      hapticSelect();
      setTempPasswordHeld(passwordInput);
      setShowFirstTimePasswordModal(true);
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown');
    }
  };

  const handleGuestLogin = async () => {
    const result = await loginGuest(guestPhoneInputForLogin, guestPasswordInputForLogin);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome Resident!', 'Your resident dashboard is ready.');
      router.replace('/');
    } else if (result.mustChangePassword) {
      hapticSelect();
      setTempPasswordHeld(guestPasswordInputForLogin);
      setShowFirstTimePasswordModal(true);
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown');
    }
  };

  const handleFirstTimePasswordSubmit = async () => {
    if (!firstTimeNewPassword.trim() || firstTimeNewPassword.length < 8) {
      hapticError();
      Alert.alert('Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (firstTimeNewPassword !== firstTimeConfirmPassword) {
      hapticError();
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    const result = await completeFirstTimePasswordChange(tempPasswordHeld, firstTimeNewPassword);
    if (result.ok) {
      hapticSuccess();
      setShowFirstTimePasswordModal(false);
      toast('success', 'Password updated', 'Welcome to your dashboard.');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Password Change Failed', result.error ?? 'Could not update password');
    }
  };

  const handleJoin = async () => {
    const result = await joinPG();
    if (result.ok) {
      hapticSuccess();
      toast('success', 'QR Verified!', 'Resident profile created.');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Failed', result.error ?? 'Unknown');
    }
  };

  const handleReset = async () => {
    const result = await resetGuestPassword(resetEmail, resetRoom, resetNewPassword);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Passcode updated', 'You can log in now.');
      setShowResetDialog(false);
    } else {
      hapticError();
      Alert.alert('Failed', result.error ?? 'Unknown');
    }
  };

  const handleManagerLogin = async () => {
    const result = await loginManager(managerPhoneInput, managerPinInput);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome Manager!', 'Manager dashboard loading…');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown');
    }
  };

  const handleStaffLogin = async () => {
    const result = await loginStaff(staffPhoneInput, staffPinInput);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome Staff!', 'Staff dashboard loading…');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown');
    }
  };

  return (
    <FormScroll contentContainerStyle={styles.scroll} style={styles.root}>
      {/* First-Time Login: Set New Password Modal */}
      <Modal visible={showFirstTimePasswordModal} transparent animationType="fade">
        <View style={styles.dialogBackdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '88%' }}>
            <Row gap={6} align="center" style={{ marginBottom: 16 }}>
              <Txt variant="sectionTitle" weight="900" color={Colors.primary}>🔒 Set New Password</Txt>
              <InfoTip text="Your account was created with a temporary password. Please set your own secret password (min 8 characters) to continue." />
            </Row>
            <OutlinedTextField
              label="Set New Secret Password *"
              value={firstTimeNewPassword}
              onChangeText={setFirstTimeNewPassword}
              secureTextEntry
              testID="first_time_new_password"
              style={{ marginBottom: 10 }}
            />
            <OutlinedTextField
              label="Confirm New Secret Password *"
              value={firstTimeConfirmPassword}
              onChangeText={setFirstTimeConfirmPassword}
              secureTextEntry
              testID="first_time_confirm_password"
              style={{ marginBottom: 16 }}
            />
            <Row gap={8}>
              <Btn onPress={handleFirstTimePasswordSubmit} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={44} style={{ flex: 1 }}>
                <Txt variant="body" weight="800" color={Colors.textInverse}>Set Password & Log In</Txt>
              </Btn>
              <OutlinedBtn onPress={() => setShowFirstTimePasswordModal(false)} borderColor={Colors.borderSubtle} textColor={Colors.textMuted} borderRadius={10} height={44} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textMuted}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </View>
      </Modal>

      {/* Reset Passcode Dialog */}
      <Modal visible={showResetDialog} transparent animationType="fade">
        <View style={styles.dialogBackdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '88%' }}>
            <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary} style={{ marginBottom: 12 }}>Reset Guest Passcode</Txt>
            <OutlinedTextField label="Registered Email" value={resetEmail} onChangeText={setResetEmail} testID="reset_email_input" style={{ marginBottom: 10 }} />
            <OutlinedTextField label="Registered Room No" value={resetRoom} onChangeText={setResetRoom} testID="reset_room_input" style={{ marginBottom: 10 }} />
            <OutlinedTextField label="New Passcode / Password" value={resetNewPassword} onChangeText={setResetNewPassword} secureTextEntry testID="reset_new_password_input" style={{ marginBottom: 16 }} />
            <Row gap={8}>
              <Btn onPress={handleReset} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textInverse}>Update Passcode</Txt>
              </Btn>
              <OutlinedBtn onPress={() => setShowResetDialog(false)} borderColor={Colors.borderSubtle} textColor={Colors.textMuted} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textMuted}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </View>
      </Modal>

      {/* QR Scanner Dialog */}
      <Modal visible={isScanningSimulated} transparent animationType="fade">
        <View style={styles.dialogBackdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '88%' }}>
            <Txt variant="screenTitle" weight="900" color={Colors.textPrimary} style={{ marginBottom: 12 }}>Lobby QR Code Scanner</Txt>
            <View style={styles.scannerFrame}>
              <Txt variant="caption" color={Colors.textMuted}>[ simulated camera frame ]</Txt>
            </View>
            <Spacer size={16} />
            <OutlinedTextField
              label="Or Type QR Code String Manually"
              placeholder="DZQP9899"
              value={guestScanCodeInput}
              onChangeText={(v) => set('guestScanCodeInput', v)}
              testID="manual_qr_input"
              style={{ marginBottom: 16 }}
            />
            <Row gap={8}>
              <Btn onPress={() => { setIsScanningSimulated(false); handleJoin(); }} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textInverse}>Verify & Link PG</Txt>
              </Btn>
              <OutlinedBtn onPress={() => setIsScanningSimulated(false)} borderColor={Colors.borderSubtle} textColor={Colors.textMuted} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textMuted}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </View>
      </Modal>

      {/* Header */}
      <Row align="center" style={{ marginVertical: 8 }}>
        <IconBtn onPress={() => router.back()} icon="arrow-back" size={22} tint={Colors.textPrimary} />
        <Txt variant="statValue" weight="800" color={Colors.textPrimary} style={{ marginLeft: 8 }}>PG Portal Login</Txt>
      </Row>

      {/* Smooth Sliding Segmented Tab Bar */}
      <View style={styles.tabContainer} onLayout={onTabsLayout}>
        {containerWidth > 0 && (
          <Animated.View style={[styles.slidingPill, pillAnimatedStyle]} />
        )}
        <Row style={styles.tabRow}>
          {TABS.map((tab, idx) => {
            const isSel = selectedTab === idx;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                onPress={() => handleTabPress(idx)}
                style={styles.tab}
              >
                <Txt
                  size={11.5}
                  weight={isSel ? '800' : '600'}
                  color={isSel ? Colors.primary : Colors.textMuted}
                  align="center"
                  numberOfLines={1}
                >
                  {tab}
                </Txt>
              </TouchableOpacity>
            );
          })}
        </Row>
      </View>

      <Spacer size={20} />

      {/* Animated Tab Content Container */}
      <Animated.View
        key={selectedTab}
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(90)}
      >
        {/* Tab 0: Owner Login */}
        {selectedTab === 0 && (
          <View>
            <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary}>Owner Login</Txt>
            <Spacer size={16} />
            <OutlinedTextField label="Phone Number" value={phoneInput} onChangeText={setPhoneInput} leadingIcon="call" keyboardType="phone-pad" testID="owner_login_phone" style={{ marginBottom: 14 }} />
            <OutlinedTextField label="Password" value={passwordInput} onChangeText={setPasswordInput} leadingIcon="lock-closed" secureTextEntry testID="owner_login_password" style={{ marginBottom: 10 }} />
            <Txt variant="caption" color={Colors.textMuted}>Use the phone number and password you registered with.</Txt>
            <Spacer size={20} />
            <Btn onPress={handleOwnerLogin} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={50} testID="owner_login_button">
              <Txt variant="cardTitle" color={Colors.textInverse}>Log In as Owner</Txt>
            </Btn>
          </View>
        )}

        {/* Tab 1: Manager Login */}
        {selectedTab === 1 && (
          <View>
            <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary}>PG Manager Login (Individual Branch)</Txt>
            <Spacer size={16} />
            <OutlinedTextField
              label="Manager Phone Number"
              placeholder="98765 43210"
              value={managerPhoneInput}
              onChangeText={setManagerPhoneInput}
              leadingIcon="call"
              keyboardType="phone-pad"
              testID="manager_login_pg_input"
              style={{ marginBottom: 14 }}
            />
            <OutlinedTextField
              label="Manager 4-digit PIN"
              value={managerPinInput}
              onChangeText={(v) => setManagerPinInput(v.replace(/\D/g, '').slice(0, 4))}
              leadingIcon="lock-closed"
              keyboardType="number-pad"
              secureTextEntry
              testID="manager_login_pin_input"
              style={{ marginBottom: 10 }}
            />
            <Txt variant="caption" color={Colors.textMuted}>Your PG owner sets this PIN when they add you.</Txt>
            <Spacer size={20} />
            <Btn onPress={handleManagerLogin} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={50} testID="manager_login_button">
              <Txt variant="cardTitle" color={Colors.textInverse}>Log In as PG Manager</Txt>
            </Btn>
          </View>
        )}

        {/* Tab 2: Kitchen & Staff */}
        {selectedTab === 2 && (
          <View>
            <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary}>Kitchen & Maintenance Staff Login</Txt>
            <Spacer size={16} />
            <OutlinedTextField
              label="Your Phone Number"
              value={staffPhoneInput}
              onChangeText={setStaffPhoneInput}
              leadingIcon="call"
              keyboardType="phone-pad"
              testID="staff_login_owner_email"
              style={{ marginBottom: 14 }}
            />
            <OutlinedTextField
              label="4-digit Staff PIN"
              value={staffPinInput}
              onChangeText={(v) => setStaffPinInput(v.replace(/\D/g, '').slice(0, 4))}
              leadingIcon="lock-closed"
              keyboardType="number-pad"
              secureTextEntry
              testID="staff_login_pin"
              style={{ marginBottom: 10 }}
            />
            <Txt variant="caption" color={Colors.textMuted}>Your PG owner sets this PIN when they add you.</Txt>
            <Spacer size={20} />
            <Btn onPress={handleStaffLogin} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={50} testID="staff_login_submit">
              <Txt variant="cardTitle" color={Colors.textInverse}>Access Staff Dashboard</Txt>
            </Btn>
          </View>
        )}

        {/* Tab 3: Resident / Guest */}
        {selectedTab === 3 && (
          <View>
            <Row gap={12} style={{ marginBottom: 16 }}>
              <Btn
                onPress={() => setGuestMode('LOGIN')}
                containerColor={guestMode === 'LOGIN' ? Colors.primary : Colors.surfaceElevated}
                textColor={guestMode === 'LOGIN' ? Colors.textInverse : Colors.textSecondary}
                borderRadius={10}
                height={40}
                style={{ flex: 1, borderWidth: 1, borderColor: guestMode === 'LOGIN' ? Colors.primary : Colors.borderSubtle }}
              >
                <Txt variant="body" weight="700" color={guestMode === 'LOGIN' ? Colors.textInverse : Colors.textSecondary}>Guest Login</Txt>
              </Btn>
              <Btn
                onPress={() => setGuestMode('JOIN')}
                containerColor={guestMode === 'JOIN' ? Colors.primary : Colors.surfaceElevated}
                textColor={guestMode === 'JOIN' ? Colors.textInverse : Colors.textSecondary}
                borderRadius={10}
                height={40}
                style={{ flex: 1, borderWidth: 1, borderColor: guestMode === 'JOIN' ? Colors.primary : Colors.borderSubtle }}
              >
                <Txt variant="body" weight="700" color={guestMode === 'JOIN' ? Colors.textInverse : Colors.textSecondary}>Join PG via QR</Txt>
              </Btn>
            </Row>

            {guestMode === 'LOGIN' ? (
              <View>
                <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary} style={{ marginBottom: 20 }}>Access Resident Profile</Txt>
                <OutlinedTextField label="Registered Phone Number" value={guestPhoneInputForLogin} onChangeText={setGuestPhoneInputForLogin} leadingIcon="call" keyboardType="phone-pad" testID="guest_login_phone" style={{ marginBottom: 16 }} />
                <OutlinedTextField label="Password" value={guestPasswordInputForLogin} onChangeText={setGuestPasswordInputForLogin} leadingIcon="lock-closed" secureTextEntry testID="guest_login_password" style={{ marginBottom: 12 }} />
                <Row justify="space-between">
                  <TouchableOpacity onPress={() => setShowResetDialog(true)} style={{ paddingVertical: 4 }}>
                    <Txt variant="body" weight="700" color={Colors.primary}>Forgot Phone / Pass?</Txt>
                  </TouchableOpacity>
                  <Txt variant="caption" color={Colors.textMuted}>Your PG owner sets these for you.</Txt>
                </Row>
                <Spacer size={24} />
                <Btn onPress={handleGuestLogin} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={52} testID="guest_login_button">
                  <Txt variant="sectionTitle" color={Colors.textInverse}>Access Guest Account</Txt>
                </Btn>
              </View>
            ) : (
              <View>
                <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary} style={{ marginBottom: 20 }}>Register with QR Code</Txt>
                <OutlinedTextField label="Guest Name *" value={guestNameInput} onChangeText={(v) => set('guestNameInput', v)} leadingIcon="person" testID="guest_register_name" style={{ marginBottom: 12 }} />
                <OutlinedTextField label="Email Address *" value={guestEmailInput} onChangeText={(v) => set('guestEmailInput', v)} leadingIcon="mail" keyboardType="email-address" testID="guest_register_email" style={{ marginBottom: 12 }} />
                <Row gap={8}>
                  <OutlinedTextField label="Phone *" value={guestPhoneInput} onChangeText={(v) => set('guestPhoneInput', v)} leadingIcon="call" keyboardType="phone-pad" style={{ flex: 1.5, marginRight: 4 }} />
                  <OutlinedTextField label="Room No *" value={guestRoomInput} onChangeText={(v) => set('guestRoomInput', v)} leadingIcon="home" testID="guest_register_room" style={{ flex: 1, marginLeft: 4 }} />
                </Row>
                <Spacer size={12} />
                <OutlinedTextField label="Choose a Password * (min 8 characters)" value={guestPasswordInput} onChangeText={(v) => set('guestPasswordInput', v)} leadingIcon="lock-closed" secureTextEntry testID="guest_join_password_input" style={{ marginBottom: 12 }} />
                <OutlinedTextField label="PG Code (from the lobby poster) *" placeholder="DZQP9899" value={guestScanCodeInput} onChangeText={(v) => set('guestScanCodeInput', v.toUpperCase())} leadingIcon="qr-code" testID="guest_join_code_input" style={{ marginBottom: 12 }} />
                <Btn onPress={handleJoin} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={48} testID="guest_join_submit">
                  <Txt variant="cardTitle" color={Colors.textInverse}>Join This PG</Txt>
                </Btn>
                <Spacer size={20} />
                <TouchableOpacity
                  onPress={() => {
                    setIsScanningSimulated(true);
                    Alert.alert('Enter the code', "Type the code from your PG's poster below.");
                  }}
                  style={styles.scannerCard}
                >
                  <Col align="center">
                    <Ionicons name="qr-code-sharp" size={44} color={Colors.primary} />
                    <Txt variant="cardTitle" color={Colors.textPrimary} style={{ marginTop: 8 }}>
                      {guestScanCodeInput ? `Code ${guestScanCodeInput} ✅` : 'Enter PG Lobby Code'}
                    </Txt>
                    <Txt variant="caption" color={Colors.textMuted} align="center">Simulates instant lens capture & security verification</Txt>
                  </Col>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 100 },
  tabContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 4,
    marginTop: 12,
    position: 'relative',
    height: 48,
    justifyContent: 'center',
  },
  tabRow: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 2,
  },
  slidingPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 1,
  },
  dialogBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  scannerFrame: {
    width: 200, height: 200, alignSelf: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 12, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  scannerCard: {
    borderWidth: 1.5, borderColor: Colors.borderSubtle,
    borderRadius: 14, padding: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
});
