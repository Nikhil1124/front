import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Share,
  ActivityIndicator,
  BackHandler,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { DetailBottomSheet } from '@/components/DetailBottomSheet';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { EditPgPropertyDialog } from '@/components/dialogs/EditPgPropertyDialog';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatDateTime } from '@/utils/format';
import type { GuestEntity } from '@/types';

const GREEN = Colors.primary;        // Deep Ocean Blue brand primary
const BG = Colors.canvas;            // Light Ice Canvas BG
const CHARCOAL = Colors.textPrimary; // Obsidian Navy primary text
const MUTED = Colors.textMuted;      // Ocean Muted text
const BORDER = Colors.borderSubtle;  // Ice Cyan subtle border
const WHITE = Colors.surface;        // Pure White surface
const LIGHT_GREEN = Colors.surfaceElevated; // Soft Ice Cyan active tint
const RADIUS = 22;            // Premium corner radius

const KYC_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  VERIFIED: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', label: '✅ Verified' },
  PENDING: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', label: '⏳ KYC Pending' },
  REJECTED: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: '❌ Rejected' },
  DEFAULT: { bg: '#F7F8FC', border: '#E5E7EB', text: '#6B7280', label: '⚠️ No KYC' },
};

import { useGuestsQuery, useAddGuestMutation, useUpdateGuestMutation, useRemoveGuestMutation } from '@/features/guests/useGuests';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';

export function OwnerGuestsManagementTab() {
  const [subTab, setSubTab] = useState(0); // 0: Add Resident, 1: Directory
  const [showManualForm, setShowManualForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: guests = [], isLoading: guestsLoading, error: guestsError } = useGuestsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const addGuestMutation = useAddGuestMutation(activePgId ?? undefined);
  const updateGuestMutation = useUpdateGuestMutation(activePgId ?? undefined);
  const removeGuestMutation = useRemoveGuestMutation(activePgId ?? undefined);
  const verifyGuestKycByOwner = usePGowStore((s) => s.verifyGuestKycByOwner);
  const rotateJoinCode = usePGowStore((s) => s.rotateJoinCode);
  const disableJoinCode = usePGowStore((s) => s.disableJoinCode);
  const setDefaultRent = usePGowStore((s) => s.setDefaultRent);

  // Manual register form states
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestRoom, setGuestRoom] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestRent, setGuestRent] = useState('6500');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorField, setErrorField] = useState<'email' | 'phone' | 'rent' | null>(null);

  // Edit states
  const [editing, setEditing] = useState<GuestEntity | null>(null);
  const [isDeletingGuest, setIsDeletingGuest] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editRent, setEditRent] = useState('');

  // KYC review states
  const [reviewing, setReviewing] = useState<GuestEntity | null>(null);
  const [rejecting, setRejecting] = useState<GuestEntity | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Join code states
  const [rentInput, setRentInput] = useState('6500');
  const [busyJoinCode, setBusyJoinCode] = useState(false);

  // Detail sheets
  const [detailGuest, setDetailGuest] = useState<GuestEntity | null>(null);
  const [showEditProperty, setShowEditProperty] = useState(false);

  const activeRole = useAuthStore((s) => s.activeRole);
  const isManager = activeRole === 'manager';

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const pendingKyc = guests.filter((g) => g.kycStatus === 'PENDING');

  // Override back navigation — this screen lives inside the tab navigator, not a stack,
  // so native back would leave ghost tab state. We force-replace with overview instead.
  useEffect(() => {
    const onBack = () => {
      router.replace('/overview');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  const confirmDeleteGuest = (g: GuestEntity) => {
    if (isDeletingGuest) return;
    Alert.alert('Remove Resident', `Remove ${g.name} from this property?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          setIsDeletingGuest(g.id);
          try {
            await removeGuestMutation.mutateAsync(g.id);
            toast('success', 'Resident Removed', `${g.name} has been removed.`);
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Could not remove resident.');
          } finally {
            setIsDeletingGuest(null);
          }
      } },
    ]);
  };

  const handleCreate = async () => {
    if (isCreating) return;
    // `parseFloat(...) || 6500` used to sit here: clearing the rent field, or typing
    // anything unparseable, silently registered the resident at ₹6,500 — a number nobody
    // agreed to, which then drives every invoice and reminder for that tenancy.
    const parsedRent = parseFloat(guestRent);
    if (!Number.isFinite(parsedRent) || parsedRent <= 0) {
      setErrorField('rent');
      toast('error', 'Monthly rent required', 'Enter the agreed monthly rent for this resident.');
      return;
    }
    if (!guestName.trim() || !guestRoom.trim()) {
      toast('error', 'Missing details', 'Name & Room No are required.');
      return;
    }
    if (!guestPhone.trim()) {
      toast('error', 'Missing details', 'A phone number is required — it is what the resident signs in with.');
      return;
    }
    if (!guestPassword || guestPassword.length < 8) {
      toast('error', 'Missing details', 'Set a password of at least 8 characters for the resident.');
      return;
    }
    setIsCreating(true);
    setErrorField(null);
    try {
      await addGuestMutation.mutateAsync({
        name: guestName.trim(),
        phone: map.toE164(guestPhone),
        password: guestPassword,
        room_no: guestRoom.trim(),
        rent_amount: parsedRent,
        email: guestEmail.trim().toLowerCase() || undefined,
      });
      toast('success', 'Resident Registered', `${guestName} can now log in.`);
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setGuestRoom('');
      setGuestPassword('');
      setGuestRent('6500');
      setShowManualForm(false);
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Unknown error occurred.';
      const lowerError = errorMsg.toLowerCase();

      if (lowerError.includes('email')) {
        errorMsg = 'An account with this email already exists.';
        setErrorField('email');
      } else if (lowerError.includes('number') || lowerError.includes('phone')) {
        errorMsg = 'An account with this phone number already exists.';
        setErrorField('phone');
      } else if (lowerError.includes('already exists')) {
        errorMsg = 'An account with these details already exists.';
        setErrorField('phone');
      }

      Alert.alert('Failed', errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing || isUpdating) return;
    const parsedEditRent = parseFloat(editRent);
    if (!Number.isFinite(parsedEditRent) || parsedEditRent <= 0) {
      toast('error', 'Monthly rent required', 'Enter the agreed monthly rent for this resident.');
      return;
    }
    setIsUpdating(true);
    try {
      // Phone is the login identity and is not editable here — the API's update payload has
      // no field for it. Neither is the password: an owner who could set one could sign in
      // as the resident and read their payment history.
      await updateGuestMutation.mutateAsync({
        membershipId: editing.id,
        params: {
          name: editName.trim() || editing.name,
          email: editEmail.trim().toLowerCase() || undefined,
          room_no: editRoom.trim() || editing.roomNo,
          rent_amount: parsedEditRent > 0 ? parsedEditRent : undefined,
        },
      });
      toast('success', 'Profile Updated', 'Resident profile & monthly fee updated.');
      setEditing(null);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async (g: GuestEntity) => {
    await verifyGuestKycByOwner(g.id, true);
    toast('success', 'KYC Approved', `Notification sent to ${g.name}.`);
    setReviewing(null);
  };

  const handleReject = async () => {
    if (!rejecting) return;
    const reason = rejectionReason.trim() || 'Document or photo unreadable.';
    await verifyGuestKycByOwner(rejecting.id, false, reason);
    toast('warning', 'KYC Rejected', 'Resident notified. They can re-upload documents.');
    setRejecting(null);
    setRejectionReason('');
  };

  const openEdit = (g: GuestEntity) => {
    setEditing(g);
    setEditName(g.name);
    setEditEmail(g.email);
    setEditPhone(g.phone);
    setEditRoom(g.roomNo);
    setEditRent(String(g.rentAmount));
  };

  const openDetail = (g: GuestEntity) => {
    setDetailGuest(g);
  };

  // Join Code actions
  const guardJoinCode = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busyJoinCode) return;
    setBusyJoinCode(true);
    const result = await run();
    setBusyJoinCode(false);
    if (!result?.ok) Alert.alert('Failed', result?.error ?? 'Something went wrong.');
    return result;
  };

  const handleEnableJoinCode = async () => {
    const amount = parseFloat(rentInput);
    if (!(amount > 0)) {
      Alert.alert('Set the rent first', 'Enter the monthly rent a new resident should be put on.');
      return;
    }
    const saved = await guardJoinCode(() => setDefaultRent(amount));
    if (!saved?.ok) return;
    await guardJoinCode(rotateJoinCode);
  };

  const handleCopyCode = async () => {
    if (!owner?.joinCode) return;
    await Clipboard.setStringAsync(owner.joinCode);
    Alert.alert('Copied', `Code ${owner.joinCode} is on your clipboard.`);
  };

  const handleShareCode = async () => {
    if (!owner?.joinCode) return;
    try {
      await Share.share({
        message:
          `Join ${owner.pgName} on PGow.\n\nCode: ${owner.joinCode}\n\n` +
          'Open the app, choose "Join PG", and enter this code with your details.',
      });
    } catch {
      // Dismissed
    }
  };

  const handleRotateCode = () => {
    Alert.alert(
      'Replace the code?',
      'Anyone holding the current code — printed, photographed or forwarded — will no longer be able to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => guardJoinCode(rotateJoinCode) },
      ]
    );
  };

  const handleDisableCode = () => {
    Alert.alert(
      'Turn off self sign-up?',
      'New residents will have to be added by you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => guardJoinCode(disableJoinCode) },
      ]
    );
  };

  return (
    <View style={styles.root}>
      {/* ── Segmented Tab Selector ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(0);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-add"
              size={15}
              color={subTab === 0 ? WHITE : MUTED}
              style={{ marginRight: 6 }}
            />
            <Text maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 0 && styles.segBtnTextActive]}>
              Add Resident
            </Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(1);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people"
              size={16}
              color={subTab === 1 ? WHITE : MUTED}
              style={{ marginRight: 6 }}
            />
            <Text maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 1 && styles.segBtnTextActive]}>
              Directory
            </Text>
          </TouchableOpacity>
        </Row>
      </View>

      {/* ── Sub-tab Content ── */}
      {subTab === 0 ? (
        showManualForm ? (
          /* Manual Registration Form UI */
          <ScrollView
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
          >
            <Row align="center" gap={8} style={{ marginBottom: 12 }}>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button" onPress={() => setShowManualForm(false)} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={CHARCOAL} />
              </TouchableOpacity>
              <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Manual Registration</Text>
            </Row>

            <OutlinedTextField
              label="Guest Full Name *"
              placeholder="Ramesh Kumar"
              value={guestName}
              onChangeText={setGuestName}
              containerColor={WHITE}
              style={{ marginBottom: 12 }}
            />
            <OutlinedTextField
              label="Guest Email ID *"
              placeholder="ramesh@gmail.com"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
              containerColor={WHITE}
              style={{ marginBottom: 12 }}
              unfocusedBorderColor={errorField === 'email' ? Colors.danger : undefined}
            />
            <Row gap={10}>
              <OutlinedTextField
                label="Room No *"
                placeholder="101"
                value={guestRoom}
                onChangeText={setGuestRoom}
                containerColor={WHITE}
                style={{ flex: 1 }}
              />
              <OutlinedTextField
                label="Phone"
                placeholder="9876543210"
                value={guestPhone}
                onChangeText={setGuestPhone}
                keyboardType="phone-pad"
                containerColor={WHITE}
                style={{ flex: 1.2 }}
                unfocusedBorderColor={errorField === 'phone' ? Colors.danger : undefined}
              />
            </Row>
            <Spacer size={12} />
            <OutlinedTextField
              label="Monthly Rent Fee (₹) *"
              placeholder="6500"
              value={guestRent}
              onChangeText={setGuestRent}
              keyboardType="number-pad"
              containerColor={WHITE}
              style={{ marginBottom: 12 }}
            />
            <OutlinedTextField
              label="Login Passcode / Password *"
              placeholder="At least 8 characters"
              value={guestPassword}
              onChangeText={setGuestPassword}
              secureTextEntry
              containerColor={WHITE}
              style={{ marginBottom: 20 }}
            />

            <TouchableOpacity accessibilityRole="button"
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={isCreating}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add" size={16} color={WHITE} style={{ marginRight: 8 }} />
              <Text maxFontSizeMultiplier={1.3} style={styles.submitBtnText}>Register Resident ID & Password</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* Add Resident Options Roster */
          <ScrollView
            contentContainerStyle={styles.addRosterScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Add a Resident</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.bodySub}>Choose how you want to add a new resident.</Text>

            <Spacer size={16} />

            {/* Side-by-side Choice Cards */}
            <Row gap={12}>
              {/* Card 1: Invite Resident */}
              <View style={styles.choiceCard}>
                <View style={styles.choiceIconCircle}>
                  <Ionicons name="link-outline" size={20} color={GREEN} />
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.choiceTitle}>Invite Resident</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.choiceDesc}>
                  Share a secure sign-up link. Resident registers themselves.
                </Text>
                <Spacer size={12} />
                <TouchableOpacity accessibilityRole="button"
                  style={styles.choiceBtnSolid}
                  onPress={() => setShowInviteModal(true)}
                  activeOpacity={0.8}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.choiceBtnSolidText}>Create Sign-Up Link</Text>
                </TouchableOpacity>
              </View>

              {/* Card 2: Add Manually */}
              <View style={styles.choiceCard}>
                <View style={styles.choiceIconCircle}>
                  <Ionicons name="person-add-outline" size={20} color={GREEN} />
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.choiceTitle}>Add Manually</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.choiceDesc}>
                  Enter resident details yourself and create their account.
                </Text>
                <Spacer size={12} />
                <TouchableOpacity accessibilityRole="button"
                  style={styles.choiceBtnOutline}
                  onPress={() => setShowManualForm(true)}
                  activeOpacity={0.8}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.choiceBtnOutlineText}>Add Manually</Text>
                </TouchableOpacity>
              </View>
            </Row>

            <Spacer size={24} />

            {/* Timeline Workflow Step */}
            <Text maxFontSizeMultiplier={1.3} style={styles.workflowTitle}>How it works</Text>
            <Spacer size={12} />
            <Row align="center" justify="space-between" style={styles.workflowRow}>
              {/* Step 1 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="link" size={16} color={GREEN} />
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Choose Method</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Invite or add manually</Text>
              </Col>
              
              <Ionicons name="arrow-forward" size={14} color="#D0D6D2" style={{ marginHorizontal: 2 }} />

              {/* Step 2 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="person" size={16} color={GREEN} />
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Enter Details</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Provide required info</Text>
              </Col>

              <Ionicons name="arrow-forward" size={14} color="#D0D6D2" style={{ marginHorizontal: 2 }} />

              {/* Step 3 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="shield-checkmark" size={16} color={GREEN} />
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Account Ready</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Account will be created</Text>
              </Col>
            </Row>

            <Spacer size={20} />

            {/* Security Banner */}
            <Row gap={12} style={styles.securityBanner}>
              <View style={styles.securityIconBg}>
                <Ionicons name="shield-checkmark" size={18} color={GREEN} />
              </View>
              <Col style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.3} style={styles.securityBannerTitle}>Secure & Private</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.securityBannerText}>
                  Only you control who can join your PG. All data is encrypted and secure.
                </Text>
              </Col>
            </Row>

            <Spacer size={16} />

            {/* Need Help Link — there's no residents-management help screen to send this to
                yet, so it acknowledges the tap honestly instead of doing nothing. */}
            <TouchableOpacity accessibilityRole="button"
              style={styles.helpLinkRow}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Need help?', 'A residents management guide is not available yet. Contact PGow support if you have questions.')}
            >
              <Row justify="space-between" align="center" style={{ width: '100%' }}>
                <Row gap={10} align="center">
                  <Ionicons name="help-circle-outline" size={18} color={MUTED} />
                  <Text maxFontSizeMultiplier={1.3} style={styles.helpLinkText}>
                    Need help? Learn more about managing residents
                  </Text>
                </Row>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </Row>
            </TouchableOpacity>
          </ScrollView>
        )
      ) : (
        /* Directory Roster Renders list of guests */
        <FlatList
          data={guests}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.directoryList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 12 }}>
              <TouchableOpacity accessibilityRole="button"
                onPress={() => {
                  router.push('/bed-visualizer');
                }}
                activeOpacity={0.7}
              >
                <Card
                  containerColor={WHITE}
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={BORDER}
                  padding={[12, 14]}
                >
                  <Row justify="space-between" align="center">
                    <Row gap={10} align="center" style={{ flex: 1 }}>
                      <Ionicons name="bed-outline" size={18} color={GREEN} />
                      <Col style={{ flex: 1 }}>
                        <Txt size={13} weight="900" color={CHARCOAL}>
                          Bed Layout
                        </Txt>
                        <Txt variant="caption" color={MUTED}>
                          {owner?.totalBeds ?? 0} beds • assign & vacate by room
                        </Txt>
                      </Col>
                    </Row>
                    <Ionicons name="chevron-forward" size={18} color={MUTED} />
                  </Row>
                </Card>
              </TouchableOpacity>

              {pendingKyc.length > 0 && (
                <Card
                  containerColor="#FFFBEB"
                  borderRadius={16}
                  borderWidth={1}
                  borderColor="#FDE68A"
                  padding={[14, 14]}
                >
                  <Row gap={8} align="center">
                    <Ionicons name="hourglass" size={20} color="#B45309" />
                    <Txt size={13} weight="900" color="#92400E">
                      Pending Resident KYC ({pendingKyc.length})
                    </Txt>
                  </Row>
                  <Spacer size={10} />
                  {pendingKyc.map((g) => (
                    <Card
                      key={g.id}
                      containerColor={WHITE}
                      borderRadius={12}
                      borderWidth={1}
                      borderColor={BORDER}
                      padding={[12, 12]}
                      style={{ marginBottom: 8 }}
                    >
                      <Row justify="space-between" align="center">
                        <Col style={{ flex: 1 }}>
                          <Txt variant="body" weight="800" color={CHARCOAL}>
                            {g.name}
                          </Txt>
                          <Txt variant="caption" color={MUTED}>
                            Room {g.roomNo}
                          </Txt>
                          {g.idProofNumber ? (
                            <Txt variant="labelSmall" weight="400" color={MUTED}>
                              No: {g.idProofNumber}
                            </Txt>
                          ) : null}
                        </Col>
                        <Btn
                          onPress={() => setReviewing(g)}
                          containerColor={LIGHT_GREEN}
                          textColor={GREEN}
                          borderRadius={8}
                          height={32}
                          contentStyle={{ paddingHorizontal: 10 }}
                        >
                          <Txt variant="caption" weight="800" color={GREEN}>
                            Review Docs
                          </Txt>
                        </Btn>
                      </Row>
                      <Spacer size={8} />
                      <Row gap={8}>
                        <Btn
                          onPress={() => handleApprove(g)}
                          containerColor={GREEN}
                          textColor={WHITE}
                          borderRadius={8}
                          height={34}
                          style={{ flex: 1 }}
                        >
                          <Txt variant="caption" weight="800" color={WHITE}>
                            ✅ Approve
                          </Txt>
                        </Btn>
                        <Btn
                          onPress={() => setRejecting(g)}
                          containerColor={Colors.danger}
                          textColor={WHITE}
                          borderRadius={8}
                          height={34}
                          style={{ flex: 1 }}
                        >
                          <Txt variant="caption" weight="800" color={WHITE}>
                            ❌ Reject
                          </Txt>
                        </Btn>
                      </Row>
                    </Card>
                  ))}
                </Card>
              )}

              <Row justify="space-between" align="center">
                <Text maxFontSizeMultiplier={1.3} style={styles.directoryTitle}>Registered Residents</Text>
                <View style={styles.countBadge}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.countBadgeText}>{guests.length} Guests</Text>
                </View>
              </Row>

              {!isManager && (
                <TouchableOpacity accessibilityRole="button" onPress={() => setShowEditProperty(true)} activeOpacity={0.7}>
                  <Row gap={6} align="center">
                    <Ionicons name="bed-outline" size={14} color={MUTED} />
                    <Txt variant="caption" color={MUTED}>
                      {owner?.totalBeds ?? 0} total beds
                    </Txt>
                    <Txt variant="caption" weight="800" color={GREEN}>
                      Edit ›
                    </Txt>
                  </Row>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No residents registered yet"
              subtitle="Add one on the Add Guest tab or share your lobby Join Code so residents can self-register. Pull down to refresh."
              accent={GREEN}
              loading={guestsLoading}
              error={guestsError}
            />
          }
          renderItem={({ item: g }) => {
            const kyc = KYC_STYLE[g.kycStatus] ?? KYC_STYLE.DEFAULT;
            return (
              <AnimatedPress scale={0.985} onPress={() => openDetail(g)}>
                <Card
                  containerColor={WHITE}
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={BORDER}
                  padding={[14, 14]}
                  style={{ marginBottom: 10 }}
                >
                  <Row justify="space-between" align="center">
                    <Row gap={12} style={{ flex: 1 }}>
                      <View style={styles.avatar}>
                        <Txt variant="screenTitle" weight="900" color={GREEN}>
                          {g.name.charAt(0).toUpperCase()}
                        </Txt>
                      </View>
                      <Col style={{ flex: 1 }}>
                        <Txt variant="cardTitle" weight="800" color={CHARCOAL}>
                          {g.name}
                        </Txt>
                        <Txt variant="caption" color={MUTED}>
                          Room {g.roomNo} • {g.email}
                        </Txt>
                        <Txt variant="caption" weight="700" color={GREEN}>
                          ₹{Math.round(g.rentAmount)}/mo
                        </Txt>
                        <Row gap={6} style={{ marginTop: 4 }}>
                          <View style={[styles.pill, { backgroundColor: kyc.bg, borderColor: kyc.border }]}>
                            <Txt variant="labelSmall" weight="800" color={kyc.text}>
                              {kyc.label}
                            </Txt>
                          </View>
                          <View
                            style={[
                              styles.pill,
                              {
                                backgroundColor: g.isBillPaid ? '#ECFDF5' : '#FFFBEB',
                                borderColor: g.isBillPaid ? '#A7F3D0' : '#FDE68A',
                              },
                            ]}
                          >
                            <Txt variant="labelSmall" weight="800" color={g.isBillPaid ? '#047857' : '#B45309'}>
                              {g.isBillPaid ? '💵 Paid' : '⏳ Due'}
                            </Txt>
                          </View>
                        </Row>
                      </Col>
                    </Row>
                    <Row gap={2}>
                      <IconBtn
                        onPress={() => openEdit(g)}
                        icon="create-outline"
                        size={19}
                        tint={GREEN}
                        testID={`owner_edit_guest_${g.id}`}
                      />
                      {isDeletingGuest === g.id ? (
                        <View style={{ padding: 10 }}>
                          <ActivityIndicator size="small" color={Colors.danger} />
                        </View>
                      ) : (
                        <IconBtn onPress={() => confirmDeleteGuest(g)} icon="trash-outline" size={19} tint={Colors.danger} />
                      )}
                    </Row>
                  </Row>
                </Card>
              </AnimatedPress>
            );
          }}
        />
      )}

      {showEditProperty && owner && (
        <EditPgPropertyDialog pg={owner} onDismiss={() => setShowEditProperty(false)} />
      )}

      {/* Resident Detail Bottom Sheet */}
      <DetailBottomSheet
        visible={detailGuest != null}
        title={detailGuest?.name ?? 'Resident'}
        subtitle={`Room ${detailGuest?.roomNo ?? ''} • ${detailGuest?.email ?? ''}`}
        icon="person-circle"
        accent={GREEN}
        onDismiss={() => setDetailGuest(null)}
        footer={
          detailGuest ? (
            <Row gap={8}>
              <Btn
                onPress={() => {
                  openEdit(detailGuest);
                  setDetailGuest(null);
                }}
                containerColor={GREEN}
                textColor={WHITE}
                borderRadius={10}
                height={42}
                style={{ flex: 1 }}
              >
                <Ionicons name="create" size={16} color={WHITE} />
                <Txt variant="caption" weight="800" color={WHITE} style={{ marginLeft: 6 }}>
                  Edit
                </Txt>
              </Btn>
              {detailGuest.kycStatus === 'PENDING' && (
                <Btn
                  onPress={() => {
                    setReviewing(detailGuest);
                    setDetailGuest(null);
                  }}
                  containerColor="#D97706"
                  textColor={WHITE}
                  borderRadius={10}
                  height={42}
                  style={{ flex: 1 }}
                >
                  <Ionicons name="shield-checkmark" size={16} color={WHITE} />
                  <Txt variant="caption" weight="800" color={WHITE} style={{ marginLeft: 6 }}>
                    Review KYC
                  </Txt>
                </Btn>
              )}
              <Btn
                onPress={() => {
                  confirmDeleteGuest(detailGuest);
                  setDetailGuest(null);
                }}
                containerColor={Colors.danger}
                textColor={WHITE}
                borderRadius={10}
                height={42}
                style={{ flex: 1 }}
              >
                <Ionicons name="trash" size={16} color={WHITE} />
                <Txt variant="caption" weight="800" color={WHITE} style={{ marginLeft: 6 }}>
                  Delete
                </Txt>
              </Btn>
            </Row>
          ) : null
        }
      >
        {detailGuest && (
          <View>
            <Card
              containerColor={LIGHT_GREEN}
              borderRadius={12}
              borderWidth={1}
              borderColor={BORDER}
              padding={[14, 14]}
            >
              <Row align="center" gap={12}>
                <View style={[styles.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
                  <Txt variant="statValue" weight="900" color={GREEN}>
                    {detailGuest.name.charAt(0).toUpperCase()}
                  </Txt>
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt variant="sectionTitle" weight="800" color={CHARCOAL}>
                    {detailGuest.name}
                  </Txt>
                  <Txt variant="caption" color={MUTED}>
                    Resident ID: {detailGuest.id}
                  </Txt>
                  <Txt variant="caption" color={MUTED}>
                    Joined {formatDateTime(detailGuest.registrationDate)}
                  </Txt>
                </Col>
              </Row>
            </Card>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={GREEN} style={{ letterSpacing: 1 }}>
              ROOM & CONTACT
            </Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons name="home" size={14} color={MUTED} />
              <Txt variant="caption" color={CHARCOAL}>
                Room {detailGuest.roomNo}
              </Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={14} color={MUTED} />
              <Txt variant="caption" color={CHARCOAL}>
                {detailGuest.phone || '—'}
              </Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="mail" size={14} color={MUTED} />
              <Txt variant="caption" color={CHARCOAL}>
                {detailGuest.email}
              </Txt>
            </View>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={GREEN} style={{ letterSpacing: 1 }}>
              PAYMENT STATUS
            </Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={14} color="#059669" />
              <Txt variant="caption" color={CHARCOAL}>
                Monthly Rent: ₹{Math.round(detailGuest.rentAmount)}
              </Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons
                name={detailGuest.isBillPaid ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={detailGuest.isBillPaid ? '#059669' : '#B45309'}
              />
              <Txt variant="caption" color={detailGuest.isBillPaid ? '#059669' : '#B45309'}>
                {detailGuest.isBillPaid ? 'Rent paid this cycle' : 'Rent pending for this cycle'}
              </Txt>
            </View>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={GREEN} style={{ letterSpacing: 1 }}>
              KYC VERIFICATION
            </Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={
                  detailGuest.kycStatus === 'VERIFIED' ? '#059669' :
                  detailGuest.kycStatus === 'PENDING' ? '#B45309' :
                  detailGuest.kycStatus === 'REJECTED' ? Colors.danger : MUTED
                }
              />
              <Txt variant="caption" color={CHARCOAL}>
                Status: {detailGuest.kycStatus}
              </Txt>
            </View>
            {detailGuest.kycSubmissionDate ? (
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={14} color={MUTED} />
                <Txt variant="caption" color={CHARCOAL}>
                  Submitted {new Date(detailGuest.kycSubmissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {detailGuest.kycVerificationDate
                    ? ` • decided ${new Date(detailGuest.kycVerificationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </Txt>
              </View>
            ) : null}
            <Spacer size={8} />
            {/* The photos themselves, not the words "photo on file". These are readable at
                any KYC status, so an approved resident's documents stay reachable for a
                lease check or a police verification instead of vanishing at approval. */}
            <KycDocumentsCard
              idPhotoUri={detailGuest.idProofPhotoUri}
              selfieUri={detailGuest.profilePhotoUri}
              emptyHint={
                detailGuest.kycStatus === 'NOT_SUBMITTED'
                  ? 'This resident has not submitted KYC documents yet.'
                  : 'Documents are not available for this submission.'
              }
            />
            {detailGuest.kycRejectReason ? (
              <View style={styles.rejectReasonBox}>
                <Ionicons name="warning" size={14} color={Colors.danger} />
                <Txt variant="caption" color="#B91C1C" style={{ flex: 1 }}>
                  Rejection reason: {detailGuest.kycRejectReason}
                </Txt>
              </View>
            ) : null}
          </View>
        )}
      </DetailBottomSheet>

      {/* Edit Dialog */}
      <Modal visible={editing != null} transparent animationType="fade">
        {/* KAV platform-aware: padding on Android only, iOS handles it natively */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalBackdrop}>
            <Card
              containerColor={WHITE}
              borderRadius={20}
              borderWidth={1}
              borderColor={BORDER}
              padding={[16, 16]}
              style={{ width: '92%' }}
            >
              <Txt variant="sectionTitle" weight="800" color={CHARCOAL}>
                Edit Resident Profile
              </Txt>
              <Spacer size={12} />
              {/* ScrollView so fields are reachable when keyboard pushes the card up */}
              <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
                <OutlinedTextField
                  label="Resident Full Name *"
                  value={editName}
                  onChangeText={setEditName}
                  containerColor={BG}
                  style={{ marginBottom: 8 }}
                />
                <OutlinedTextField
                  label="Room No *"
                  value={editRoom}
                  onChangeText={setEditRoom}
                  containerColor={BG}
                  style={{ marginBottom: 8 }}
                />
                <OutlinedTextField
                  label="Monthly Rent Fee (₹) *"
                  value={editRent}
                  onChangeText={setEditRent}
                  keyboardType="number-pad"
                  containerColor={BG}
                  style={{ marginBottom: 8 }}
                />
                <OutlinedTextField
                  label="Phone Number"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  containerColor={BG}
                  style={{ marginBottom: 8 }}
                />
                <OutlinedTextField
                  label="Email Address *"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  containerColor={BG}
                  style={{ marginBottom: 4 }}
                />
              </ScrollView>
              <Spacer size={12} />
              <Row gap={8}>
                <Btn
                  onPress={handleUpdate}
                  disabled={isUpdating}
                  loading={isUpdating}
                  containerColor={GREEN}
                  textColor={WHITE}
                  borderRadius={10}
                  height={42}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={WHITE}>
                    Save Changes
                  </Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setEditing(null)}
                  borderColor={BORDER}
                  textColor={CHARCOAL}
                  borderRadius={10}
                  height={42}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={CHARCOAL}>
                    Cancel
                  </Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* Review KYC Dialog */}
      <Modal visible={reviewing != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card
            containerColor={WHITE}
            borderRadius={20}
            borderWidth={1}
            borderColor={BORDER}
            padding={[20, 20]}
            style={{ width: '92%' }}
          >
            <Row justify="space-between" align="center">
              <Txt variant="sectionTitle" weight="800" color={CHARCOAL}>
                KYC Document Review
              </Txt>
              <IconBtn onPress={() => setReviewing(null)} icon="close" size={20} tint={MUTED} />
            </Row>
            <Spacer size={12} />
            {reviewing && (
              <Col>
                <Txt variant="cardTitle" weight="800" color={CHARCOAL}>
                  {reviewing.name} (Room {reviewing.roomNo})
                </Txt>
                <Txt variant="caption" color={MUTED}>
                  Email: {reviewing.email} • Phone: {reviewing.phone}
                </Txt>
                <Spacer size={16} />
                <Txt variant="caption" weight="700" color={MUTED}>
                  Submitted documents
                </Txt>
                <Spacer size={8} />
                {/* The actual photos. This modal asks the owner to APPROVE somebody's
                    identity and used to show them the words "📷 Photo on file" — a decision
                    on a document nobody could look at. */}
                <KycDocumentsCard
                  idPhotoUri={reviewing.idProofPhotoUri}
                  selfieUri={reviewing.profilePhotoUri}
                  emptyHint="This submission has no readable images. Reject it and ask the resident to upload again."
                />
                <Spacer size={20} />
                <Row gap={8}>
                  <Btn
                    onPress={() => handleApprove(reviewing)}
                    containerColor={Colors.success}
                    textColor={WHITE}
                    borderRadius={10}
                    height={42}
                    style={{ flex: 1 }}
                  >
                    <Txt variant="caption" weight="800" color={WHITE}>
                      Approve KYC
                    </Txt>
                  </Btn>
                  <Btn
                    onPress={() => {
                      setRejecting(reviewing);
                      setReviewing(null);
                    }}
                    containerColor={Colors.danger}
                    textColor={WHITE}
                    borderRadius={10}
                    height={42}
                    style={{ flex: 1 }}
                  >
                    <Txt variant="caption" weight="800" color={WHITE}>
                      Reject KYC
                    </Txt>
                  </Btn>
                </Row>
              </Col>
            )}
          </Card>
        </View>
      </Modal>

      {/* Reject Reason Dialog */}
      <Modal visible={rejecting != null} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalBackdrop}>
            <Card
              containerColor={WHITE}
              borderRadius={20}
              borderWidth={1}
              borderColor={BORDER}
              padding={[16, 16]}
              style={{ width: '92%' }}
            >
              <Txt variant="sectionTitle" weight="800" color={Colors.danger}>
                Reject KYC for {rejecting?.name}
              </Txt>
              <Spacer size={12} />
              <Txt variant="caption" color={MUTED}>
                Provide a reason so the resident can re-upload clear documents:
              </Txt>
              <Spacer size={8} />
              <OutlinedTextField
                label="Rejection Reason"
                placeholder="ID photo blurry or ID number mismatch"
                value={rejectionReason}
                onChangeText={setRejectionReason}
                containerColor={BG}
                style={{ marginBottom: 16 }}
              />
              <Row gap={8}>
                <Btn
                  onPress={handleReject}
                  containerColor={Colors.danger}
                  textColor={WHITE}
                  borderRadius={10}
                  height={42}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={WHITE}>
                    Reject & Notify
                  </Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setRejecting(null)}
                  borderColor={BORDER}
                  textColor={CHARCOAL}
                  borderRadius={10}
                  height={42}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={CHARCOAL}>
                    Cancel
                  </Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* Invite Resident Sign-up Link Sheet / Modal */}
      {showInviteModal && owner && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowInviteModal(false)}>
          {/* behavior="padding" only on Android — iOS handles it natively */}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <Animated.View entering={FadeIn.duration(200)} style={styles.modalBackdrop}>
              <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setShowInviteModal(false)} />
              
              <Animated.View
                entering={SlideInDown.duration(180)}
                style={styles.inviteSheet}
              >
                {/* Drag handle */}
                <View style={styles.inviteHandleBar} />

                {/* Header */}
                <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
                  <Row gap={8} align="center">
                    <View style={styles.inviteHeaderIcon}>
                      <Ionicons name="link" size={18} color={GREEN} />
                    </View>
                    <Col>
                      <Text maxFontSizeMultiplier={1.3} style={styles.inviteSheetTitle}>Resident Sign-Up Link</Text>
                      <Text maxFontSizeMultiplier={1.3} style={styles.inviteSheetSub}>Let residents register themselves</Text>
                    </Col>
                  </Row>
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setShowInviteModal(false)} style={styles.inviteCloseBtn}>
                    <Ionicons name="close" size={20} color={MUTED} />
                  </TouchableOpacity>
                </Row>

                {owner.joinCode ? (
                  <>
                    <Text maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                      Residents who enter this code during self-registration will be added to your PG automatically. You will verify their KYC documents before they are approved.
                    </Text>

                    <Spacer size={16} />

                    <TouchableOpacity accessibilityRole="button" onPress={handleCopyCode} activeOpacity={0.75} style={styles.inviteCodeBox}>
                      <Col>
                        <Text maxFontSizeMultiplier={1.3} style={styles.inviteCodeLabel}>LOBBY JOIN CODE</Text>
                        <Text maxFontSizeMultiplier={1.3} style={styles.inviteCodeText}>{owner.joinCode}</Text>
                      </Col>
                      <Ionicons name="copy-outline" size={20} color={GREEN} />
                    </TouchableOpacity>

                    <Spacer size={12} />

                    <Row align="center" justify="space-between" style={styles.inviteRentRow}>
                      <Text maxFontSizeMultiplier={1.3} style={styles.inviteRentLabel}>Monthly rent for self sign-ups</Text>
                      <Text maxFontSizeMultiplier={1.3} style={styles.inviteRentValue}>
                        {owner.defaultRentAmount > 0 ? `₹${owner.defaultRentAmount.toLocaleString('en-IN')} / mo` : 'Not set'}
                      </Text>
                    </Row>

                    {!isManager && (
                      <>
                        <Spacer size={12} />
                        <Row gap={8} align="center">
                          <OutlinedTextField
                            label="Change rent (₹)"
                            value={rentInput}
                            onChangeText={setRentInput}
                            keyboardType="number-pad"
                            style={{ flex: 1 }}
                          />
                          <OutlinedBtn
                            onPress={() => guardJoinCode(() => setDefaultRent(parseFloat(rentInput)))}
                            borderColor={GREEN}
                            textColor={GREEN}
                            borderRadius={12}
                            height={52}
                            style={{ width: 88 }}
                          >
                            <Txt variant="caption" weight="800" color={GREEN}>
                              Save
                            </Txt>
                          </OutlinedBtn>
                        </Row>
                      </>
                    )}

                    <Spacer size={20} />

                    <Row gap={10}>
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.inviteShareBtn}
                        onPress={handleShareCode}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="share-social-outline" size={18} color={WHITE} style={{ marginRight: 6 }} />
                        <Text maxFontSizeMultiplier={1.3} style={styles.inviteShareBtnText}>Share Invitation</Text>
                      </TouchableOpacity>
                      {!isManager && (
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.inviteRotateBtn}
                          onPress={handleRotateCode}
                          activeOpacity={0.8}
                        >
                          <Text maxFontSizeMultiplier={1.3} style={styles.inviteRotateBtnText}>New Code</Text>
                        </TouchableOpacity>
                      )}
                    </Row>

                    {!isManager && (
                      <>
                        <Spacer size={14} />
                        <TouchableOpacity accessibilityRole="button" onPress={handleDisableCode} activeOpacity={0.7} style={{ alignSelf: 'center' }}>
                          <Text maxFontSizeMultiplier={1.3} style={styles.inviteDisableText}>Turn off self sign-up</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                ) : (
                  /* Disabled state */
                  !isManager && (
                    <>
                      <Text maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                        Self sign-up is currently off. Set the default monthly rent below to turn it on and generate a join code.
                      </Text>
                      <Spacer size={14} />
                      <OutlinedTextField
                        label="Monthly rent for new residents (₹) *"
                        placeholder="6500"
                        value={rentInput}
                        onChangeText={setRentInput}
                        keyboardType="number-pad"
                        style={{ marginBottom: 16 }}
                      />
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.inviteEnableBtn}
                        onPress={handleEnableJoinCode}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="key-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
                        <Text maxFontSizeMultiplier={1.3} style={styles.inviteEnableBtnText}>Turn on self sign-up</Text>
                      </TouchableOpacity>
                    </>
                  )
                )}

                {isManager && !owner.joinCode && (
                  <Text maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                    Self sign-up is currently disabled. Only the property owner can turn this on.
                  </Text>
                )}
              </Animated.View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header styles
  header: {
    height: 64,
    paddingHorizontal: 20,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  headerSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notiBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // Segmented Tab bar
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

  // Body Content
  addRosterScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  bodyTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Invite & Manual Choice Cards
  choiceCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'flex-start',
  },
  choiceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  choiceTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  choiceDesc: { fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 15, height: 46 },
  choiceBtnSolid: {
    height: 36,
    width: '100%',
    backgroundColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnSolidText: { fontSize: 11, fontWeight: '700', color: WHITE },
  choiceBtnOutline: {
    height: 36,
    width: '100%',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  choiceBtnOutlineText: { fontSize: 11, fontWeight: '700', color: GREEN },

  // Manual Form styles
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  submitBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: WHITE },

  // Workflow section
  workflowTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  workflowRow: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  workflowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  workflowStepTitle: { fontSize: 11, fontWeight: '700', color: CHARCOAL, textAlign: 'center' },
  workflowStepDesc: { fontSize: 8, color: MUTED, textAlign: 'center', marginTop: 2 },

  // Security Banner
  securityBanner: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start',
  },
  securityIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBannerTitle: { fontSize: 13, fontWeight: '700', color: GREEN },
  securityBannerText: { fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 16 },

  // Help Link row
  helpLinkRow: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  helpLinkText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },

  // Directory / FlatList
  directoryList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  directoryTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBox: {
    height: 140,
    backgroundColor: BG,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rejectReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },

  // Invite Link Bottom Sheet Styles
  inviteSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end',
  },
  inviteHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  inviteHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteSheetTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  inviteSheetSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  inviteCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteExplain: { fontSize: 12, color: MUTED, lineHeight: 18 },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inviteCodeLabel: { fontSize: 9, fontWeight: '700', color: GREEN, letterSpacing: 0.5 },
  inviteCodeText: { fontSize: 24, fontWeight: '900', color: CHARCOAL, letterSpacing: 4, marginTop: 2 },
  inviteRentRow: {
    paddingVertical: 4,
  },
  inviteRentLabel: { fontSize: 12, color: MUTED },
  inviteRentValue: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  inviteShareBtn: {
    flex: 1.5,
    height: 48,
    backgroundColor: GREEN,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteShareBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
  inviteRotateBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  inviteRotateBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  inviteDisableText: { fontSize: 12, color: Colors.danger, fontWeight: '700' },
  inviteEnableBtn: {
    height: 48,
    backgroundColor: GREEN,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteEnableBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
});
