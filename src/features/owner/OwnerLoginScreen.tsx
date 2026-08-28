/**
 * OwnerLoginScreen — Premium redesign.
 * Compact header · clean segmented control · labelled input fields ·
 * password toggle · forgot-password link · strong CTA · registration footer.
 * Single flat colour system: #176B3A forest green, #F8FAF8 canvas.
 */
import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { Colors } from '@/theme';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';

// ── Design tokens ──────────────────────────────────────────────────────────────
const GREEN   = '#176B3A';
const BG      = '#F8FAF8';
const CHARCOAL = '#1C2B22';
const MUTED   = '#5A6E60';
const BORDER  = '#D8E4DC';
const WHITE   = '#FFFFFF';
const FIELD_H = 56;
const RADIUS  = 13;

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Owner',    short: 'Owner' },
  { label: 'Manager',  short: 'Manager' },
  { label: 'Staff',    short: 'Staff' },
  { label: 'Resident', short: 'Resident' },
];

interface Props { initialTab?: number; }

// ── Reusable premium field ─────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  keyboard?: 'default' | 'phone-pad' | 'email-address' | 'number-pad';
  testID?: string;
  error?: string;
  maxLength?: number;
}

function Field({
  label, value, onChangeText, placeholder, icon,
  secure = false, keyboard = 'default', testID, error, maxLength,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.fieldWrap,
        focused && styles.fieldWrapFocused,
        !!error && styles.fieldWrapError,
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? GREEN : MUTED}
            style={styles.fieldIcon}
          />
        )}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9EB09E"
          secureTextEntry={secure && !visible}
          keyboardType={keyboard}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          testID={testID}
          maxLength={maxLength}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setVisible(v => !v)}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={MUTED}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export function OwnerLoginScreen({ initialTab = 0 }: Props) {
  const loginOwner   = usePGowStore(s => s.loginOwner);
  const loginManager = usePGowStore(s => s.loginManager);
  const loginStaff   = usePGowStore(s => s.loginStaff);
  const loginGuest   = usePGowStore(s => s.loginGuest);
  const resetGuestPassword = usePGowStore(s => s.resetGuestPassword);
  const joinPG       = usePGowStore(s => s.joinPG);
  const guestScanCodeInput = usePGowStore(s => s.guestScanCodeInput);
  const set          = usePGowStore(s => s.set);
  const guestNameInput    = usePGowStore(s => s.guestNameInput);
  const guestEmailInput   = usePGowStore(s => s.guestEmailInput);
  const guestPhoneInput   = usePGowStore(s => s.guestPhoneInput);
  const guestRoomInput    = usePGowStore(s => s.guestRoomInput);
  const guestPasswordInput = usePGowStore(s => s.guestPasswordInput);
  const completeFirstTimePasswordChange = usePGowStore(s => s.completeFirstTimePasswordChange);
  const toast = useToast();
  const insets = useSafeAreaInsets();

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState(initialTab);
  const [containerW, setContainerW] = useState(0);
  const offset = useSharedValue(initialTab);

  const handleTabPress = (idx: number) => {
    hapticSelect();
    setTab(idx);
    offset.value = withSpring(idx, { damping: 22, stiffness: 220, mass: 0.8 });
  };

  const pillStyle = useAnimatedStyle(() => {
    if (containerW <= 0) return { width: 0, opacity: 0 };
    const pad = 4;
    const tabW = (containerW - pad * 2) / TABS.length;
    return {
      width: tabW,
      opacity: 1,
      transform: [{ translateX: offset.value * tabW }],
    };
  });

  // ── Loading states ───────────────────────────────────────────────────────────
  const [ownerLoading,   setOwnerLoading]   = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);
  const [staffLoading,   setStaffLoading]   = useState(false);
  const [guestLoading,   setGuestLoading]   = useState(false);

  // ── Owner fields ─────────────────────────────────────────────────────────────
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');

  // ── Manager fields ───────────────────────────────────────────────────────────
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrPin,   setMgrPin]   = useState('');

  // ── Staff fields ─────────────────────────────────────────────────────────────
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPin,   setStaffPin]   = useState('');

  // ── Resident fields ──────────────────────────────────────────────────────────
  const [guestMode,    setGuestMode]    = useState<'LOGIN' | 'JOIN'>('LOGIN');
  const [guestPhone,   setGuestPhone]   = useState('');
  const [guestPass,    setGuestPass]    = useState('');
  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState('');
  const [resetRoom,    setResetRoom]    = useState('');
  const [resetNew,     setResetNew]     = useState('');
  const [isScanSim,    setIsScanSim]    = useState(false);

  // ── First-time password modal ────────────────────────────────────────────────
  const [showFTP,     setShowFTP]     = useState(false);
  const [tempPass,    setTempPass]    = useState('');
  const [ftpNew,      setFtpNew]      = useState('');
  const [ftpConfirm,  setFtpConfirm]  = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOwnerLogin = async () => {
    if (!phone.trim() || !password.trim()) return;
    setOwnerLoading(true);
    const result = await loginOwner(phone, password);
    setOwnerLoading(false);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome back!', 'Owner dashboard loading…');
      router.replace('/');
    } else if (result.mustChangePassword) {
      hapticSelect();
      setTempPass(password);
      setShowFTP(true);
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown error');
    }
  };

  const handleManagerLogin = async () => {
    if (!mgrPhone.trim() || !mgrPin.trim()) return;
    setManagerLoading(true);
    const result = await loginManager(mgrPhone, mgrPin);
    setManagerLoading(false);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome Manager!', 'Manager dashboard loading…');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown error');
    }
  };

  const handleStaffLogin = async () => {
    if (!staffPhone.trim() || !staffPin.trim()) return;
    setStaffLoading(true);
    const result = await loginStaff(staffPhone, staffPin);
    setStaffLoading(false);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome!', 'Staff dashboard loading…');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown error');
    }
  };

  const handleGuestLogin = async () => {
    if (!guestPhone.trim() || !guestPass.trim()) return;
    setGuestLoading(true);
    const result = await loginGuest(guestPhone, guestPass);
    setGuestLoading(false);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Welcome Resident!', 'Your resident dashboard is ready.');
      router.replace('/');
    } else if (result.mustChangePassword) {
      hapticSelect();
      setTempPass(guestPass);
      setShowFTP(true);
    } else {
      hapticError();
      Alert.alert('Login Failed', result.error ?? 'Unknown error');
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
      Alert.alert('Failed', result.error ?? 'Unknown error');
    }
  };

  const handleReset = async () => {
    const result = await resetGuestPassword(resetEmail, resetRoom, resetNew);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Passcode updated', 'You can log in now.');
      setShowReset(false);
    } else {
      hapticError();
      Alert.alert('Failed', result.error ?? 'Unknown error');
    }
  };

  const handleFTPSubmit = async () => {
    if (!ftpNew.trim() || ftpNew.length < 8) {
      hapticError();
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (ftpNew !== ftpConfirm) {
      hapticError();
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    const result = await completeFirstTimePasswordChange(tempPass, ftpNew);
    if (result.ok) {
      hapticSuccess();
      setShowFTP(false);
      toast('success', 'Password updated', 'Welcome to your dashboard.');
      router.replace('/');
    } else {
      hapticError();
      Alert.alert('Password Change Failed', result.error ?? 'Could not update password');
    }
  };

  // ── Role intro copy ───────────────────────────────────────────────────────────
  const roleIntro: Record<number, { title: string; sub: string; cta: string }> = {
    0: { title: 'Owner Login',    sub: 'Sign in to manage your PG operations and property.',   cta: 'Log In as Owner' },
    1: { title: 'Manager Login',  sub: 'Sign in to manage your assigned branch.',               cta: 'Log In as Manager' },
    2: { title: 'Staff Login',    sub: 'Enter your credentials. The system routes you automatically.', cta: 'Access Staff Dashboard' },
    3: { title: 'Resident Login', sub: 'Access your resident profile and room details.',         cta: 'Access Resident Account' },
  };

  const intro = roleIntro[tab];

  return (
    <View style={styles.root}>
      {/* ── First-time password modal ─────────────────────────────────────── */}
      <Modal visible={showFTP} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Row gap={6} align="center" style={{ marginBottom: 16 }}>
              <Text style={styles.modalTitle}>🔒 Set New Password</Text>
              <InfoTip text="Your account was created with a temporary password. Please set your own secret password (min 8 characters) to continue." />
            </Row>
            <Field label="New Password *" value={ftpNew} onChangeText={setFtpNew} secure testID="first_time_new_password" />
            <Field label="Confirm Password *" value={ftpConfirm} onChangeText={setFtpConfirm} secure testID="first_time_confirm_password" />
            <View style={{ height: 4 }} />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFTPSubmit} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Set Password & Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setShowFTP(false)} activeOpacity={0.7}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Reset passcode modal ──────────────────────────────────────────── */}
      <Modal visible={showReset} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Guest Passcode</Text>
            <View style={{ height: 12 }} />
            <Field label="Registered Email" value={resetEmail} onChangeText={setResetEmail} keyboard="email-address" testID="reset_email_input" />
            <Field label="Registered Room No" value={resetRoom} onChangeText={setResetRoom} testID="reset_room_input" />
            <Field label="New Passcode / Password" value={resetNew} onChangeText={setResetNew} secure testID="reset_new_password_input" />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Update Passcode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setShowReset(false)} activeOpacity={0.7}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── QR Scanner modal ─────────────────────────────────────────────── */}
      <Modal visible={isScanSim} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lobby QR Code Scanner</Text>
            <View style={{ height: 12 }} />
            <View style={styles.scannerFrame}>
              <Text style={{ color: MUTED, fontSize: 12 }}>[ simulated camera frame ]</Text>
            </View>
            <View style={{ height: 16 }} />
            <Field
              label="Or Type QR Code Manually"
              placeholder="DZQP9899"
              value={guestScanCodeInput}
              onChangeText={v => set('guestScanCodeInput', v)}
              testID="manual_qr_input"
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { setIsScanSim(false); handleJoin(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Verify & Link PG</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setIsScanSim(false)} activeOpacity={0.7}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Compact nav bar ───────────────────────────────────────────────── */}
      <View style={[styles.navBar, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={CHARCOAL} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>PG Portal Login</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'android' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Segmented tab control ──────────────────────────────────────── */}
          <View
            style={styles.segControl}
            onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
          >
            {containerW > 0 && (
              <Animated.View style={[styles.segPill, pillStyle]} />
            )}
            <View style={styles.segRow}>
              {TABS.map((t, idx) => {
                const sel = tab === idx;
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={styles.segTab}
                    onPress={() => handleTabPress(idx)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.segLabel, sel && styles.segLabelSel]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Role intro ────────────────────────────────────────────────── */}
          <Animated.View
            key={`intro-${tab}`}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(100)}
            style={{ marginTop: 28, marginBottom: 4 }}
          >
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.roleTitle}>{intro.title}</Text>
            <Text style={styles.roleSub}>{intro.sub}</Text>
          </Animated.View>

          <View style={styles.divider} />

          {/* ── Tab content ───────────────────────────────────────────────── */}
          <Animated.View
            key={`form-${tab}`}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(100)}
          >
            {/* ── Tab 0: Owner ─────────────────────────────────────────── */}
            {tab === 0 && (
              <View>
                <Field
                  label="Phone Number"
                  placeholder="Enter your 10-digit mobile number"
                  value={phone}
                  onChangeText={setPhone}
                  icon="call-outline"
                  keyboard="phone-pad"
                  maxLength={10}
                  testID="owner_login_phone"
                />
                <Field
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  icon="lock-closed-outline"
                  secure
                  testID="owner_login_password"
                />
                <TouchableOpacity style={styles.forgotLink} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
                <View style={{ height: 24 }} />
                <TouchableOpacity
                  style={[styles.primaryBtn, (!phone.trim() || !password.trim()) && styles.primaryBtnDisabled]}
                  onPress={handleOwnerLogin}
                  activeOpacity={0.85}
                  disabled={ownerLoading || !phone.trim() || !password.trim()}
                  testID="owner_login_button"
                >
                  {ownerLoading
                    ? <ActivityIndicator color={WHITE} />
                    : <Text style={styles.primaryBtnText}>Log In as Owner</Text>
                  }
                </TouchableOpacity>
                <View style={styles.registerRow}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/owner-register')} activeOpacity={0.7}>
                    <Text style={styles.registerLink}>Register your PG</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Tab 1: Manager ───────────────────────────────────────── */}
            {tab === 1 && (
              <View>
                <Field
                  label="Phone Number"
                  placeholder="Enter your 10-digit mobile number"
                  value={mgrPhone}
                  onChangeText={setMgrPhone}
                  icon="call-outline"
                  keyboard="phone-pad"
                  maxLength={10}
                  testID="manager_login_pg_input"
                />
                <Field
                  label="4-digit PIN"
                  placeholder="Enter your manager PIN"
                  value={mgrPin}
                  onChangeText={v => setMgrPin(v.replace(/\D/g, '').slice(0, 4))}
                  icon="lock-closed-outline"
                  keyboard="number-pad"
                  secure
                  maxLength={4}
                  testID="manager_login_pin_input"
                />
                <Text style={styles.hintText}>Your PG owner sets this PIN when they add you.</Text>
                <View style={{ height: 24 }} />
                <TouchableOpacity
                  style={[styles.primaryBtn, (!mgrPhone.trim() || !mgrPin.trim()) && styles.primaryBtnDisabled]}
                  onPress={handleManagerLogin}
                  activeOpacity={0.85}
                  disabled={managerLoading || !mgrPhone.trim() || !mgrPin.trim()}
                  testID="manager_login_button"
                >
                  {managerLoading
                    ? <ActivityIndicator color={WHITE} />
                    : <Text style={styles.primaryBtnText}>Log In as Manager</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* ── Tab 2: Staff ─────────────────────────────────────────── */}
            {tab === 2 && (
              <View>
                {/* Route info — compact */}
                <View style={styles.routeInfoBox}>
                  <Row gap={6} align="center" style={{ marginBottom: 6 }}>
                    <Ionicons name="information-circle-outline" size={16} color={GREEN} />
                    <Text style={styles.routeInfoTitle}>Unified Dynamic Routing</Text>
                  </Row>
                  <Text style={styles.routeInfoSub}>
                    Enter your credentials. The system automatically detects your role
                    and routes you to the correct portal.
                  </Text>
                  <Row gap={6} style={{ marginTop: 12 }}>
                    {[
                      { icon: 'restaurant-outline' as const, label: 'Kitchen' },
                      { icon: 'construct-outline' as const, label: 'Maintenance' },
                      { icon: 'bicycle-outline' as const, label: 'Delivery' },
                    ].map(item => (
                      <View key={item.label} style={styles.routeChip}>
                        <Ionicons name={item.icon} size={13} color={GREEN} />
                        <Text style={styles.routeChipLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </Row>
                </View>

                <Field
                  label="Phone Number"
                  placeholder="Enter your 10-digit mobile number"
                  value={staffPhone}
                  onChangeText={setStaffPhone}
                  icon="call-outline"
                  keyboard="phone-pad"
                  maxLength={10}
                  testID="staff_login_owner_email"
                />
                <Field
                  label="4-digit Staff PIN"
                  placeholder="Enter your 4-digit PIN"
                  value={staffPin}
                  onChangeText={v => setStaffPin(v.replace(/\D/g, '').slice(0, 4))}
                  icon="lock-closed-outline"
                  keyboard="number-pad"
                  secure
                  maxLength={4}
                  testID="staff_login_pin"
                />
                <Text style={styles.hintText}>Your PG owner sets this PIN when they add you.</Text>
                <View style={{ height: 24 }} />
                <TouchableOpacity
                  style={[styles.primaryBtn, (!staffPhone.trim() || !staffPin.trim()) && styles.primaryBtnDisabled]}
                  onPress={handleStaffLogin}
                  activeOpacity={0.85}
                  disabled={staffLoading || !staffPhone.trim() || !staffPin.trim()}
                  testID="staff_login_submit"
                >
                  {staffLoading
                    ? <ActivityIndicator color={WHITE} />
                    : <Text style={styles.primaryBtnText}>Access Staff Dashboard</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* ── Tab 3: Resident ──────────────────────────────────────── */}
            {tab === 3 && (
              <View>
                {/* Login / Join sub-toggle */}
                <View style={styles.subToggle}>
                  <TouchableOpacity
                    style={[styles.subToggleBtn, guestMode === 'LOGIN' && styles.subToggleBtnSel]}
                    onPress={() => { hapticSelect(); setGuestMode('LOGIN'); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.subToggleLabel, guestMode === 'LOGIN' && styles.subToggleLabelSel]}>
                      Resident Login
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.subToggleBtn, guestMode === 'JOIN' && styles.subToggleBtnSel]}
                    onPress={() => { hapticSelect(); setGuestMode('JOIN'); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.subToggleLabel, guestMode === 'JOIN' && styles.subToggleLabelSel]}>
                      Join via QR Code
                    </Text>
                  </TouchableOpacity>
                </View>

                {guestMode === 'LOGIN' ? (
                  <View style={{ marginTop: 20 }}>
                    <Field
                      label="Phone Number"
                      placeholder="Enter your registered phone number"
                      value={guestPhone}
                      onChangeText={setGuestPhone}
                      icon="call-outline"
                      keyboard="phone-pad"
                      maxLength={10}
                      testID="guest_login_phone"
                    />
                    <Field
                      label="Password"
                      placeholder="Enter your password"
                      value={guestPass}
                      onChangeText={setGuestPass}
                      icon="lock-closed-outline"
                      secure
                      testID="guest_login_password"
                    />
                    <TouchableOpacity
                      style={styles.forgotLink}
                      onPress={() => setShowReset(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                    <View style={{ height: 24 }} />
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!guestPhone.trim() || !guestPass.trim()) && styles.primaryBtnDisabled]}
                      onPress={handleGuestLogin}
                      activeOpacity={0.85}
                      disabled={guestLoading || !guestPhone.trim() || !guestPass.trim()}
                      testID="guest_login_button"
                    >
                      {guestLoading
                        ? <ActivityIndicator color={WHITE} />
                        : <Text style={styles.primaryBtnText}>Access Resident Account</Text>
                      }
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 20 }}>
                    <Field label="Full Name *"       value={guestNameInput}     onChangeText={v => set('guestNameInput', v)}     icon="person-outline"  testID="guest_register_name" />
                    <Field label="Email Address *"   value={guestEmailInput}    onChangeText={v => set('guestEmailInput', v)}    icon="mail-outline"    keyboard="email-address" testID="guest_register_email" />
                    <Row gap={10}>
                      <View style={{ flex: 1.6 }}>
                        <Field label="Phone *" value={guestPhoneInput} onChangeText={v => set('guestPhoneInput', v)} icon="call-outline" keyboard="phone-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Room No *" value={guestRoomInput} onChangeText={v => set('guestRoomInput', v)} icon="home-outline" testID="guest_register_room" />
                      </View>
                    </Row>
                    <Field label="Password * (min 8 chars)" value={guestPasswordInput} onChangeText={v => set('guestPasswordInput', v)} icon="lock-closed-outline" secure testID="guest_join_password_input" />
                    <Field label="PG Code (from lobby poster) *" placeholder="DZQP9899" value={guestScanCodeInput} onChangeText={v => set('guestScanCodeInput', v.toUpperCase())} icon="qr-code-outline" testID="guest_join_code_input" />

                    {/* QR scan shortcut */}
                    <TouchableOpacity
                      style={styles.qrCard}
                      onPress={() => {
                        setIsScanSim(true);
                        Alert.alert('Enter the code', "Type the code from your PG's poster below.");
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="qr-code-sharp" size={36} color={GREEN} />
                      <View style={{ marginLeft: 14 }}>
                        <Text style={styles.qrCardTitle}>
                          {guestScanCodeInput ? `Code: ${guestScanCodeInput} ✅` : 'Enter PG Lobby Code'}
                        </Text>
                        <Text style={styles.qrCardSub}>Tap to simulate lobby code capture</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={{ height: 16 }} />
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin} activeOpacity={0.85} testID="guest_join_submit">
                      <Text style={styles.primaryBtnText}>Join This PG</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Nav bar
  navBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: CHARCOAL, letterSpacing: 0.1 },

  scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 40 },

  // Segmented control
  segControl: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    height: 46,
    justifyContent: 'center',
    position: 'relative',
  },
  segRow:   { flexDirection: 'row', height: '100%', alignItems: 'center' },
  segTab:   { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  segLabel: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  segLabelSel: { color: GREEN, fontWeight: '800' },
  segPill: {
    position: 'absolute',
    left: 4, top: 4, bottom: 4,
    backgroundColor: '#EAF5EE',
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: GREEN,
    zIndex: 1,
  },

  // Role intro
  welcomeText: { fontSize: 13, color: MUTED, fontWeight: '500', marginBottom: 4 },
  roleTitle:   { fontSize: 24, fontWeight: '800', color: CHARCOAL, marginBottom: 6 },
  roleSub:     { fontSize: 13.5, color: MUTED, lineHeight: 20 },
  divider:     { height: 1, backgroundColor: BORDER, marginVertical: 20 },

  // Field
  fieldLabel: { fontSize: 13, fontWeight: '700', color: CHARCOAL, marginBottom: 7 },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_H,
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
  },
  fieldWrapFocused: { borderColor: GREEN, borderWidth: 1.5 },
  fieldWrapError:   { borderColor: '#DC2626' },
  fieldIcon:        { marginRight: 10 },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: CHARCOAL,
    height: '100%',
    paddingVertical: 0,
  },
  eyeBtn:    { padding: 6 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 5, marginLeft: 2 },

  // Forgot password
  forgotLink: { alignSelf: 'flex-end', marginTop: -4, paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Hint text
  hintText: { fontSize: 12, color: MUTED, marginTop: -6, marginBottom: 4 },

  // Primary button
  primaryBtn: {
    height: 56,
    backgroundColor: GREEN,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#A8C9B6', opacity: 0.8 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.2 },

  // Ghost / cancel button
  ghostBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600', color: MUTED },

  // Register row
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  registerText: { fontSize: 13.5, color: MUTED },
  registerLink: { fontSize: 13.5, fontWeight: '700', color: GREEN },

  // Modal / backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '88%',
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: CHARCOAL },

  // Scanner frame
  scannerFrame: {
    width: 200, height: 160, alignSelf: 'center',
    borderWidth: 2, borderColor: GREEN, borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 12,
  },

  // Sub-toggle (Resident: Login vs Join)
  subToggle: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 3,
    overflow: 'hidden',
  },
  subToggleBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  subToggleBtnSel: { backgroundColor: '#EAF5EE', borderWidth: 1, borderColor: GREEN },
  subToggleLabel:  { fontSize: 13, fontWeight: '600', color: MUTED },
  subToggleLabelSel: { color: GREEN, fontWeight: '800' },

  // Staff route info
  routeInfoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C6E8D4',
    padding: 14,
    marginBottom: 20,
  },
  routeInfoTitle: { fontSize: 13, fontWeight: '800', color: CHARCOAL },
  routeInfoSub:   { fontSize: 12, color: MUTED, lineHeight: 18 },
  routeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: WHITE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  routeChipLabel: { fontSize: 11, fontWeight: '700', color: GREEN },

  // QR card
  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    backgroundColor: WHITE,
  },
  qrCardTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  qrCardSub:   { fontSize: 12, color: MUTED, marginTop: 2 },
});
