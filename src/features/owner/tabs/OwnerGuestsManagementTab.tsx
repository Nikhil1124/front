import { useCallback, useMemo, useState } from 'react';
import { SectionList, View, StyleSheet, RefreshControl, Share, BackHandler } from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { EmptyState } from '@/components/EmptyState';
import { Colors, Palette, Radii } from '@/theme';
import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatINR } from '@/utils/format';
import type { GuestEntity } from '@/types';

const GREEN = Colors.primary;        // Deep Ocean Blue brand primary
const BG = Colors.canvas;            // Light Ice Canvas BG
const CHARCOAL = Colors.textPrimary; // Obsidian Navy primary text
const MUTED = Colors.textMuted;      // Ocean Muted text
const BORDER = Colors.borderSubtle;  // Ice Cyan subtle border
const WHITE = Colors.surface;        // Pure White surface
const LIGHT_GREEN = Colors.surfaceElevated; // Soft Ice Cyan active tint
const RADIUS = 22;            // Premium corner radius

import { useGuestsQuery, useAddGuestMutation } from '@/features/guests/useGuests';
import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';
import QRCode from 'react-native-qrcode-svg';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Btn, Card, Col, ListRow, ListSectionHeader, OutlinedBtn, OutlinedTextField, PGowDialog, RoomPicker, Row, Sheet, Spacer, Txt, type StatusTone } from '@/components/ui';
import { FormScroll } from '@/components/ui/FormScroll';

export function OwnerGuestsManagementTab() {
  const dockScroll = useDockScroll();
  const [subTab, setSubTab] = useState(0); // 0: Add Resident, 1: Directory
  const [showManualForm, setShowManualForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: guests = [], isLoading: guestsLoading, error: guestsError } = useGuestsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  const addGuestMutation = useAddGuestMutation(activePgId ?? undefined);
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
  const [errorField, setErrorField] = useState<'email' | 'phone' | 'rent' | null>(null);

  // Edit states

  // KYC review states
  const [rejecting, setRejecting] = useState<GuestEntity | null>(null);

  // Join code states
  const [rentInput, setRentInput] = useState('6500');
  const [busyJoinCode, setBusyJoinCode] = useState(false);

  // Detail sheets

  const activeRole = useAuthStore((s) => s.activeRole);
  const isManager = activeRole === 'manager';

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const pendingKyc = guests.filter((g) => g.kycStatus === 'PENDING');

  /**
   * Two groups, so the handful that need chasing sit above the many that do not — the owner
   * opens this screen to find those, and scanning 40 settled residents to spot 6 is the job
   * the screen should be doing for them. A section is dropped entirely when it is empty
   * rather than rendering a heading over nothing.
   */
  const sections = useMemo(() => {
    const needsAction = guests.filter((g) => g.kycStatus !== 'VERIFIED' || !g.isBillPaid);
    const settled = guests.filter((g) => g.kycStatus === 'VERIFIED' && g.isBillPaid);
    return [
      ...(needsAction.length ? [{ title: 'Needs action', data: needsAction }] : []),
      ...(settled.length ? [{ title: 'All good', data: settled }] : []),
    ];
  }, [guests]);

  // Override back navigation — this screen lives inside the tab navigator, not a stack,
  // so native back would leave ghost tab state. We force-replace with overview instead.
  //
  // Scoped to focus: `BackHandler` listeners are global and fire most-recently-added first,
  // so an unscoped one here answered back on top of any screen pushed FROM this tab and sent
  // the user to /overview instead of popping. Same fix as the staff tab.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/overview');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

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
        email: guestEmail.trim().toLowerCase() || undefined });
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

      toast('error', 'Could not register resident', errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleApprove = async (g: GuestEntity) => {
    await verifyGuestKycByOwner(g.id, true);
    toast('success', 'KYC Approved', `Notification sent to ${g.name}.`);
  };

  // The reason used to fall back to the canned string "Document or photo unreadable." when
  // left blank, so a resident whose ID was merely cropped was told the wrong thing and had to
  // guess. `required` on the dialog means there is always a real one.
  const handleReject = async (reason: string) => {
    if (!rejecting) return;
    await verifyGuestKycByOwner(rejecting.id, false, reason);
    toast('warning', 'KYC Rejected', 'Resident notified. They can re-upload documents.');
    setRejecting(null);
  };

  // Straight to the record. Detail, edit and KYC review are routes now — the three sheets
  // this tab used to stack were a persistent record, an 11-field form and a document viewer,
  // none of which is a temporary contextual panel.
  const openDetail = (g: GuestEntity) => {
    router.push(`/(owner)/resident/${g.id}` as never);
  };

  // Join Code actions
  const guardJoinCode = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busyJoinCode) return;
    setBusyJoinCode(true);
    const result = await run();
    setBusyJoinCode(false);
    if (!result?.ok) toast('error', "That didn't work", result?.error ?? 'Please try again.');
    return result;
  };

  const [rentError, setRentError] = useState<string | undefined>();
  const [joinCodeConfirm, setJoinCodeConfirm] = useState<'rotate' | 'disable' | null>(null);

  const handleEnableJoinCode = async () => {
    const amount = parseFloat(rentInput);
    if (!(amount > 0)) {
      setRentError('Enter the monthly rent a new resident starts on');
      return;
    }
    const saved = await guardJoinCode(() => setDefaultRent(amount));
    if (!saved?.ok) return;
    await guardJoinCode(rotateJoinCode);
  };

  const handleCopyCode = async () => {
    if (!owner?.joinCode) return;
    await Clipboard.setStringAsync(owner.joinCode);
    toast('success', 'Copied', `Code ${owner.joinCode} is on your clipboard.`);
  };

  const handleShareCode = async () => {
    if (!owner?.joinCode) return;
    try {
      await Share.share({
        message:
          `Join ${owner.pgName} on PGow.\n\nCode: ${owner.joinCode}\n\n` +
          'Open the app, choose "Join PG", and enter this code with your details.' });
    } catch {
      // Dismissed
    }
  };

  const handleRotateCode = () => setJoinCodeConfirm('rotate');
  const handleDisableCode = () => setJoinCodeConfirm('disable');

  return (
    <View style={styles.root}>
      {/* ── Segmented Tab Selector ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(0);
            }}
          >
            <Ionicons
              name="person-add"
              size={15}
              color={subTab === 0 ? WHITE : MUTED}
              style={{ marginRight: 6 }}
            />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 0 && styles.segBtnTextActive]}>
              Add Resident
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(1);
            }}
          >
            <Ionicons
              name="people"
              size={16}
              color={subTab === 1 ? WHITE : MUTED}
              style={{ marginRight: 6 }}
            />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.segBtnText, subTab === 1 && styles.segBtnTextActive]}>
              Directory
            </Txt>
          </AnimatedPress>
        </Row>
      </View>

      {/* ── Sub-tab Content ── */}
      {subTab === 0 ? (
        showManualForm ? (
          /* Manual Registration Form UI */
          <FormScroll
            {...dockScroll}
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
          >
            <Row align="center" gap={8} style={{ marginBottom: 12 }}>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button" onPress={() => setShowManualForm(false)} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={CHARCOAL} />
              </AnimatedPress>
              <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Manual Registration</Txt>
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
            <OutlinedTextField
              label="Phone"
              placeholder="9876543210"
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
              containerColor={WHITE}
              style={{ marginBottom: 12 }}
              unfocusedBorderColor={errorField === 'phone' ? Colors.danger : undefined}
            />
            <RoomPicker pgId={activePgId} value={guestRoom} onChange={setGuestRoom} label="Room *" testID="add_guest_room" />
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

            <AnimatedPress accessibilityRole="button"
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={isCreating}
            >
              <Ionicons name="person-add" size={16} color={WHITE} style={{ marginRight: 8 }} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.submitBtnText}>Register Resident ID & Password</Txt>
            </AnimatedPress>
          </FormScroll>
        ) : (
          /* Add Resident Options Roster */
          <FormScroll
            {...dockScroll}
            contentContainerStyle={styles.addRosterScroll}
            showsVerticalScrollIndicator={false}
          >
            <Txt maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Add a Resident</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.bodySub}>Choose how you want to add a new resident.</Txt>

            <Spacer size={16} />

            {/* Side-by-side Choice Cards */}
            <Row gap={12}>
              {/* Card 1: Invite Resident */}
              <View style={styles.choiceCard}>
                <View style={styles.choiceIconCircle}>
                  <Ionicons name="link-outline" size={20} color={GREEN} />
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.choiceTitle}>Invite Resident</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.choiceDesc}>
                  Share a secure sign-up link. Resident registers themselves.
                </Txt>
                <Spacer size={12} />
                <AnimatedPress accessibilityRole="button"
                  style={styles.choiceBtnSolid}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Txt maxFontSizeMultiplier={1.3} style={styles.choiceBtnSolidText}>Create Sign-Up Link</Txt>
                </AnimatedPress>
              </View>

              {/* Card 2: Add Manually */}
              <View style={styles.choiceCard}>
                <View style={styles.choiceIconCircle}>
                  <Ionicons name="person-add-outline" size={20} color={GREEN} />
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.choiceTitle}>Add Manually</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.choiceDesc}>
                  Enter resident details yourself and create their account.
                </Txt>
                <Spacer size={12} />
                <AnimatedPress accessibilityRole="button"
                  style={styles.choiceBtnOutline}
                  onPress={() => setShowManualForm(true)}
                >
                  <Txt maxFontSizeMultiplier={1.3} style={styles.choiceBtnOutlineText}>Add Manually</Txt>
                </AnimatedPress>
              </View>
            </Row>

            <Spacer size={24} />

            {/* Timeline Workflow Step */}
            <Txt maxFontSizeMultiplier={1.3} style={styles.workflowTitle}>How it works</Txt>
            <Spacer size={12} />
            <Row align="center" justify="space-between" style={styles.workflowRow}>
              {/* Step 1 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="link" size={16} color={GREEN} />
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Choose Method</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Invite or add manually</Txt>
              </Col>
              
              <Ionicons name="arrow-forward" size={14} color="#D0D6D2" style={{ marginHorizontal: 2 }} />

              {/* Step 2 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="person" size={16} color={GREEN} />
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Enter Details</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Provide required info</Txt>
              </Col>

              <Ionicons name="arrow-forward" size={14} color="#D0D6D2" style={{ marginHorizontal: 2 }} />

              {/* Step 3 */}
              <Col align="center" style={{ flex: 1 }}>
                <View style={styles.workflowIconBox}>
                  <Ionicons name="shield-checkmark" size={16} color={GREEN} />
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepTitle}>Account Ready</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.workflowStepDesc}>Account will be created</Txt>
              </Col>
            </Row>

            <Spacer size={20} />

            {/* Security Banner */}
            <Row gap={12} style={styles.securityBanner}>
              <View style={styles.securityIconBg}>
                <Ionicons name="shield-checkmark" size={18} color={GREEN} />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.securityBannerTitle}>Secure & Private</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.securityBannerText}>
                  Only you control who can join your PG. All data is encrypted and secure.
                </Txt>
              </Col>
            </Row>

            <Spacer size={16} />

            {/* Need Help Link — there's no residents-management help screen to send this to
                yet, so it acknowledges the tap honestly instead of doing nothing. */}
            <AnimatedPress accessibilityRole="button"
              style={styles.helpLinkRow}
              onPress={() => toast('info', 'Guide not available yet', 'A residents management guide is still being written. Contact PGow support if you have questions.')}
            >
              <Row justify="space-between" align="center" gap={8} style={{ width: '100%' }}>
                <Row gap={10} align="center" style={{ flex: 1, minWidth: 0 }}>
                  <Ionicons name="help-circle-outline" size={18} color={MUTED} />
                  <Txt maxFontSizeMultiplier={1.3} numberOfLines={2} style={[styles.helpLinkText, { flex: 1 }]}>
                    Need help? Learn more about managing residents
                  </Txt>
                </Row>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </Row>
            </AnimatedPress>
          </FormScroll>
        )
      ) : (
        /* Directory Roster Renders list of guests */
        <SectionList
          {...dockScroll}
          sections={sections}
          keyExtractor={(g) => g.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <ListSectionHeader title={section.title} count={section.data.length} />
          )}
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
              <AnimatedPress accessibilityRole="button"
                onPress={() => {
                  router.push('/bed-visualizer');
                }}
              >
                <Card
                  containerColor={WHITE}
                  borderRadius={Radii.card}
                  borderWidth={1}
                  borderColor={BORDER}
                  padding={[12, 14]}
                >
                  <Row justify="space-between" align="center">
                    <Row gap={10} align="center" style={{ flex: 1 }}>
                      <Ionicons name="bed-outline" size={18} color={GREEN} />
                      <Col style={{ flex: 1 }}>
                        <Txt size={13} weight="700" color={CHARCOAL}>
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
              </AnimatedPress>

              {pendingKyc.length > 0 && (
                <Card
                  containerColor={Palette.TintAmber}
                  borderRadius={Radii.card}
                  borderWidth={1}
                  borderColor={Palette.TintAmber}
                  padding={[14, 14]}
                >
                  <Row gap={8} align="center">
                    <Ionicons name="hourglass" size={20} color={Colors.warning} />
                    <Txt size={13} weight="700" color="#92400E">
                      Pending Resident KYC ({pendingKyc.length})
                    </Txt>
                  </Row>
                  <Spacer size={10} />
                  {pendingKyc.map((g) => (
                    <Card
                      key={g.id}
                      containerColor={WHITE}
                      borderRadius={Radii.card}
                      borderWidth={1}
                      borderColor={BORDER}
                      padding={[12, 12]}
                      style={{ marginBottom: 8 }}
                    >
                      <Row justify="space-between" align="center">
                        <Col style={{ flex: 1 }}>
                          <Txt variant="body" weight="700" color={CHARCOAL}>
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
                          onPress={() => router.push(`/(owner)/resident/${g.id}/kyc` as never)}
                          containerColor={LIGHT_GREEN}
                          textColor={GREEN}
                          borderRadius={Radii.control}
                          height={32}
                          contentStyle={{ paddingHorizontal: 10 }}
                        >
                          <Txt variant="caption" weight="700" color={GREEN}>
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
                          borderRadius={Radii.control}
                          height={34}
                          style={{ flex: 1 }}
                        >
                          <Txt variant="caption" weight="700" color={WHITE}>
                            ✅ Approve
                          </Txt>
                        </Btn>
                        <Btn
                          onPress={() => setRejecting(g)}
                          containerColor={Colors.danger}
                          textColor={WHITE}
                          borderRadius={Radii.control}
                          height={34}
                          style={{ flex: 1 }}
                        >
                          <Txt variant="caption" weight="700" color={WHITE}>
                            ❌ Reject
                          </Txt>
                        </Btn>
                      </Row>
                    </Card>
                  ))}
                </Card>
              )}

              <Row justify="space-between" align="center">
                <Txt maxFontSizeMultiplier={1.3} style={styles.directoryTitle}>Registered Residents</Txt>
                <View style={styles.countBadge}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.countBadgeText}>{guests.length} Guests</Txt>
                </View>
              </Row>

              {!isManager && (
                <AnimatedPress accessibilityRole="button" onPress={() => owner && router.push(`/(owner)/property/${owner.id}/edit` as never)}>
                  <Row gap={6} align="center">
                    <Ionicons name="bed-outline" size={14} color={MUTED} />
                    <Txt variant="caption" color={MUTED}>
                      {owner?.totalBeds ?? 0} total beds
                    </Txt>
                    <Txt variant="caption" weight="700" color={GREEN}>
                      Edit ›
                    </Txt>
                  </Row>
                </AnimatedPress>
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
          renderItem={({ item: g, index, section }) => (
            <ListRow
              title={g.name}
              meta={`Room ${g.roomNo || '—'}`}
              amount={g.isBillPaid ? undefined : formatINR(g.rentAmount)}
              status={residentStatus(g)}
              onPress={() => openDetail(g)}
              first={index === 0}
              last={index === section.data.length - 1}
              testID={`owner_resident_${g.id}`}
            />
          )}
        />
      )}

      {/* Resident Detail Bottom Sheet */}

      <TextPromptDialog
        visible={rejecting != null}
        title={`Reject KYC for ${rejecting?.name ?? 'this resident'}`}
        label="Reason for rejection"
        placeholder="ID photo is cropped — please re-upload the full card"
        helper="The resident re-uploads against this, so name the actual problem"
        confirmLabel="Reject"
        destructive
        required
        onCancel={() => setRejecting(null)}
        onSave={handleReject}
      />

      <PGowDialog
        visible={joinCodeConfirm != null}
        title={joinCodeConfirm === 'disable' ? 'Turn off self sign-up?' : 'Replace the code?'}
        message={
          joinCodeConfirm === 'disable'
            ? 'New residents will have to be added by you again.'
            : 'Anyone holding the current code — printed, photographed or forwarded — will no longer be able to join.'
        }
        confirmLabel={joinCodeConfirm === 'disable' ? 'Turn off' : 'Replace'}
        tone="destructive"
        busy={busyJoinCode}
        onConfirm={() => {
          const which = joinCodeConfirm;
          setJoinCodeConfirm(null);
          guardJoinCode(which === 'disable' ? disableJoinCode : rotateJoinCode);
        }}
        onCancel={() => setJoinCodeConfirm(null)}
      />

      {/* Invite Resident Sign-up Link Sheet / Modal */}
      {showInviteModal && owner && (
        <Sheet
          visible
          title="Resident sign-up link"
          subtitle="Let residents register themselves"
          icon="link"
          accent={GREEN}
          onDismiss={() => setShowInviteModal(false)}
        >

                {owner.joinCode ? (
                  <>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                      Residents who enter this code during self-registration will be added to your PG automatically. You will verify their KYC documents before they are approved.
                    </Txt>

                    <Spacer size={16} />

                    {/* The poster's whole job is to be scanned, so print the QR, not just the
                        letters. `react-native-qrcode-svg` was already a dependency and had
                        never been used — the "scan" flow on the join side used to open a modal
                        that asked you to type the code by hand. The payload is a deep link so
                        a phone's own camera app can open PGow straight onto the join form;
                        `QrScanner` also accepts the bare code for any other QR generator. */}
                    <View style={styles.inviteQrBox}>
                      <QRCode
                        value={`pgow://join/${owner.joinCode}`}
                        size={148}
                        color={Colors.primaryDark}
                        backgroundColor={Colors.surface}
                      />
                    </View>

                    <Spacer size={12} />

                    <AnimatedPress accessibilityRole="button" onPress={handleCopyCode} style={styles.inviteCodeBox}>
                      <Col>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.inviteCodeLabel}>LOBBY JOIN CODE</Txt>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.inviteCodeText}>{owner.joinCode}</Txt>
                      </Col>
                      <Ionicons name="copy-outline" size={20} color={GREEN} />
                    </AnimatedPress>

                    <Spacer size={12} />

                    <Row align="center" justify="space-between" style={styles.inviteRentRow}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.inviteRentLabel}>Monthly rent for self sign-ups</Txt>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.inviteRentValue}>
                        {owner.defaultRentAmount > 0 ? `₹${owner.defaultRentAmount.toLocaleString('en-IN')} / mo` : 'Not set'}
                      </Txt>
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
                            borderRadius={Radii.card}
                            height={52}
                            style={{ width: 88 }}
                          >
                            <Txt variant="caption" weight="700" color={GREEN}>
                              Save
                            </Txt>
                          </OutlinedBtn>
                        </Row>
                      </>
                    )}

                    <Spacer size={20} />

                    <Row gap={10}>
                      <AnimatedPress accessibilityRole="button"
                        style={styles.inviteShareBtn}
                        onPress={handleShareCode}
                      >
                        <Ionicons name="share-social-outline" size={18} color={WHITE} style={{ marginRight: 6 }} />
                        <Txt maxFontSizeMultiplier={1.3} style={styles.inviteShareBtnText}>Share Invitation</Txt>
                      </AnimatedPress>
                      {!isManager && (
                        <AnimatedPress accessibilityRole="button"
                          style={styles.inviteRotateBtn}
                          onPress={handleRotateCode}
                        >
                          <Txt maxFontSizeMultiplier={1.3} style={styles.inviteRotateBtnText}>New Code</Txt>
                        </AnimatedPress>
                      )}
                    </Row>

                    {!isManager && (
                      <>
                        <Spacer size={14} />
                        <AnimatedPress accessibilityRole="button" onPress={handleDisableCode} style={{ alignSelf: 'center' }}>
                          <Txt maxFontSizeMultiplier={1.3} style={styles.inviteDisableText}>Turn off self sign-up</Txt>
                        </AnimatedPress>
                      </>
                    )}
                  </>
                ) : (
                  /* Disabled state */
                  !isManager && (
                    <>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                        Self sign-up is currently off. Set the default monthly rent below to turn it on and generate a join code.
                      </Txt>
                      <Spacer size={14} />
                      <OutlinedTextField
                        label="Monthly rent for new residents (₹) *"
                        placeholder="6500"
                        value={rentInput}
                        onChangeText={(v) => { setRentInput(v); if (rentError) setRentError(undefined); }}
                        keyboardType="number-pad"
                        error={rentError}
                        style={{ marginBottom: 16 }}
                      />
                      <AnimatedPress accessibilityRole="button"
                        style={styles.inviteEnableBtn}
                        onPress={handleEnableJoinCode}
                      >
                        <Ionicons name="key-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
                        <Txt maxFontSizeMultiplier={1.3} style={styles.inviteEnableBtnText}>Turn on self sign-up</Txt>
                      </AnimatedPress>
                    </>
                  )
                )}

                {isManager && !owner.joinCode && (
                  <Txt maxFontSizeMultiplier={1.3} style={styles.inviteExplain}>
                    Self sign-up is currently disabled. Only the property owner can turn this on.
                  </Txt>
                )}
        </Sheet>
      )}
    </View>
  );
}

/**
 * The one thing a row says about a resident.
 *
 * A resident can be both unverified and unpaid; the row shows a single status, so this ranks
 * them. Identity first — an unverified resident is a problem regardless of whether this
 * month's rent happens to have landed.
 */
function residentStatus(g: GuestEntity): { label: string; tone: StatusTone } {
  if (g.kycStatus === 'REJECTED') return { label: 'KYC rejected', tone: 'danger' };
  if (g.kycStatus === 'NOT_SUBMITTED') return { label: 'No KYC', tone: 'warn' };
  if (g.kycStatus === 'PENDING') return { label: 'KYC pending', tone: 'warn' };
  if (!g.isBillPaid) return { label: 'Rent due', tone: 'warn' };
  return { label: 'Paid', tone: 'ok' };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header styles

  // Segmented Tab bar
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

  // Body Content
  addRosterScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32 },
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
    alignItems: 'flex-start' },
  choiceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radii.card,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10 },
  choiceTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  // `minHeight`, not `height`. The fixed 46 was there to keep the two side-by-side cards'
  // buttons on the same line, but it is a hard clip: at a larger font scale the description
  // needs a fourth line and simply lost it mid-sentence. A floor keeps the alignment at
  // normal scale and lets the card grow when the reader's text does.
  choiceDesc: { fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 15, minHeight: 46 },
  choiceBtnSolid: {
    height: 36,
    width: '100%',
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  choiceBtnSolidText: { fontSize: 11, fontWeight: '700', color: WHITE },
  choiceBtnOutline: {
    height: 36,
    width: '100%',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  choiceBtnOutlineText: { fontSize: 11, fontWeight: '700', color: GREEN },

  // Manual Form styles
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    borderWidth: 1,
    borderColor: BORDER },
  submitBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: Radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10 },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: WHITE },

  // Workflow section
  workflowTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  workflowRow: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 10 },
  workflowIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radii.control,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8 },
  workflowStepTitle: { fontSize: 11, fontWeight: '700', color: CHARCOAL, textAlign: 'center' },
  workflowStepDesc: { fontSize: 8, color: MUTED, textAlign: 'center', marginTop: 2 },

  // Security Banner
  securityBanner: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start' },
  securityIconBg: {
    width: 32,
    height: 32,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center' },
  securityBannerTitle: { fontSize: 13, fontWeight: '700', color: GREEN },
  securityBannerText: { fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 16 },

  // Help Link row
  helpLinkRow: {
    backgroundColor: WHITE,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14 },
  helpLinkText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },

  // Directory / FlatList
  // Inset past the tile so the eye follows the text column, not the full width.
  directoryList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40 },
  directoryTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.card,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: Radii.pill,
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4 },
  rejectReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.TintRed,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.control,
    marginTop: 4 },

  // Invite Link Bottom Sheet Styles
  inviteExplain: { fontSize: 12, color: MUTED, lineHeight: 18 },
  inviteQrBox: { alignItems: 'center', paddingVertical: 6 },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LIGHT_GREEN,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: Radii.card,
    paddingVertical: 12,
    paddingHorizontal: 16 },
  inviteCodeLabel: { fontSize: 9, fontWeight: '700', color: GREEN, letterSpacing: 0.5 },
  inviteCodeText: { fontSize: 24, fontWeight: '700', color: CHARCOAL, letterSpacing: 4, marginTop: 2 },
  inviteRentRow: {
    paddingVertical: 4 },
  inviteRentLabel: { fontSize: 12, color: MUTED },
  inviteRentValue: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  inviteShareBtn: {
    flex: 1.5,
    height: 48,
    backgroundColor: GREEN,
    borderRadius: Radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center' },
  inviteShareBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },
  inviteRotateBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  inviteRotateBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  inviteDisableText: { fontSize: 12, color: Colors.danger, fontWeight: '700' },
  inviteEnableBtn: {
    height: 48,
    backgroundColor: GREEN,
    borderRadius: Radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center' },
  inviteEnableBtnText: { fontSize: 13, fontWeight: '700', color: WHITE } });
