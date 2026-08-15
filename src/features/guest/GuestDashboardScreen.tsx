/**
 * GuestDashboardScreen — PhonePe-style hub for the resident.
 *
 * Cyber Mint migration:
 *   - Light mint canvas, white surfaces, slate-900 text, teal accents.
 *   - Bottom dock uses a clean light style (active tab = teal pill).
 *
 * Hub-and-Spoke navigation:
 *   The resident's home tab is intentionally uncluttered: a hero "next
 *   meal" card with attending toggle + countdown pill, a 2×2 grid of
 *   quick action tiles, and a notices carousel. Each tile that needs more
 *   space (Invoice detail, Ticket detail, Full menu, Profile & KYC) is a
 *   dedicated drill-down reached via `pushScreen(...)`.
 *
 * Bug-fix impact:
 *   - The "Rent & Receipts" tile opens the existing payments tab where
 *     the receipt modal now has a working close button (Bug #1).
 *   - The "Profile & KYC" tile flips to the KYC tab whose status banners
 *     + dialog now correctly reflect state transitions (Bug #2).
 */
import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Pill } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { GuestRSVPsTab } from '@/features/guest/tabs/GuestRSVPsTab';
import { GuestPaymentsTab } from '@/features/guest/tabs/GuestPaymentsTab';
import { GuestFeedbackComplaintsTab } from '@/features/guest/tabs/GuestFeedbackComplaintsTab';
import { GuestSecurityTab } from '@/features/guest/tabs/GuestSecurityTab';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import type { AppScreen, MealNotificationEntity } from '@/types';

interface TabDef { label: string; icon: keyof any; }
const TABS: TabDef[] = [
  { label: 'Home',     icon: 'home' },
  { label: 'Meals',    icon: 'restaurant' },
  { label: 'Payments', icon: 'card' },
  { label: 'Support',  icon: 'chatbubble-ellipses' },
  { label: 'Profile',  icon: 'ribbon' },
];

interface QuickTile { label: string; desc: string; icon: keyof any; tint: string; tab?: number; screen?: AppScreen; }
const QUICK_TILES: QuickTile[] = [
  { label: 'Rent & Receipts',  desc: 'Pay • Download PDF',    icon: 'card',            tint: '#0D9488', tab: 2 },
  { label: 'Maintenance',      desc: 'Raise & track tickets',  icon: 'construct',       tint: '#D97706', tab: 3 },
  { label: 'Weekly Menu',      desc: '7-day menu',            icon: 'restaurant',       tint: '#10B981', tab: 1 },
  { label: 'Profile & KYC',    desc: 'Verify identity',       icon: 'shield-checkmark', tint: '#0284C7', tab: 4 },
  { label: 'Hub Services',     desc: 'Marketplace & laundry', icon: 'storefront',       tint: '#9333EA', screen: 'GUEST_HUB_SERVICES' },
];

// Countdown formatter — returns "⏰ Cut-off in 1h 15m" or "Closed" based on
// the meal's cutoff time. The cutoff hour is hard-coded per meal type, the
// same convention as GuestRSVPsTab.tsx (Breakfast=10, Lunch=14, Dinner=21).
const CUTOFF_HOURS: Record<string, number> = { BREAKFAST: 10, LUNCH: 14, DINNER: 21 };

function nextCutoffMs(mealType: string): number | null {
  const hour = CUTOFF_HOURS[(mealType ?? '').toUpperCase()];
  if (!hour) return null;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(hour, 0, 0, 0);
  // If the cutoff has already passed today, the next one is tomorrow's.
  return cutoff.getTime() < now.getTime() ? cutoff.getTime() + 24 * 60 * 60 * 1000 : cutoff.getTime();
}

function countdownPill(cutoffMs: number | null): { label: string; color: string } {
  if (!cutoffMs) return { label: '', color: Colors.textMuted };
  const remaining = cutoffMs - Date.now();
  if (remaining <= 0) return { label: 'Closed', color: Colors.danger };
  const mins = Math.floor(remaining / 60_000);
  if (mins < 60) return { label: `⏰ Cut-off in ${mins}m`, color: Colors.tertiary };
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { label: `⏰ Cut-off in ${hrs}h ${remMins}m`, color: Colors.warning };
}

export function GuestDashboardScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfilePhotoDialog, setShowProfilePhotoDialog] = useState(false);
  const [showKycDialog, setShowKycDialog] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  // `currentPGNotifications` carries the MealNotificationEntity list (the
  // store's name predates the dashboard rewrite — it's the active PG's
  // meal broadcast notifications, not generic notifications).
  const meals = usePGowStore((s) => s.currentPGNotifications);
  const rsvps = usePGowStore((s) => s.currentRSVPs);
  const logout = usePGowStore((s) => s.logout);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const updateProfilePhoto = usePGowStore((s) => s.updateGuestProfilePhoto);
  // The RSVP submission lives on the store — same one used by GuestRSVPsTab.
  // Using it here lets the home card's switch stay in sync with the meals tab.
  const submitRSVP = usePGowStore((s) => s.submitRSVP);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const paid = guest?.isBillPaid ?? false;
  const kycStatus = guest?.kycStatus ?? 'NOT_SUBMITTED';

  // Pick the next upcoming meal — the first whose cutoff hasn't passed.
  // Falls back to the most recent meal so the card never renders blank.
  const upcomingMeal: MealNotificationEntity | null = (() => {
    if (meals.length === 0) return null;
    const withCutoff = meals.map((m) => ({ m, c: nextCutoffMs(m.mealType) ?? 0 }));
    const upcoming = withCutoff.find(({ c }) => c > Date.now());
    return (upcoming?.m ?? meals[0]) ?? null;
  })();
  const cutoff = upcomingMeal ? nextCutoffMs(upcomingMeal.mealType) : null;
  const cutoffPill = countdownPill(cutoff);
  const cutoffPassed = cutoff ? cutoff - Date.now() <= 0 : false;
  // Has the resident already RSVP'd to this meal? The store carries the
  // full RSVP list; we look for a matching notificationId+guestId pair.
  const isAttending = !!(upcomingMeal && rsvps.find((r) => r.notificationId === upcomingMeal.id && r.guestId === guest?.id && r.choice === 'REQUIRED'));

  // Re-render every 30s so the countdown pill stays fresh without a
  // background timer. (Lightweight — the component is mounted at all times
  // while the user is on the home tab.)
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const switchTab = (idx: number) => {
    if (idx === activeTab) return;
    hapticSelect();
    setActiveTab(idx);
  };

  const handleTilePress = (tile: QuickTile) => {
    hapticSelect();
    if (tile.screen) pushScreen(tile.screen);
    else if (tile.tab != null) switchTab(tile.tab);
  };

  const toggleAttending = async () => {
    if (!upcomingMeal) return;
    if (cutoffPassed) {
      Alert.alert('Cut-off passed', 'The cut-off for this meal has passed. Please contact your manager directly.');
      return;
    }
    hapticSelect();
    // The store accepts 'REQUIRED' / 'NOT_REQUIRED' choice values.
    await submitRSVP(upcomingMeal.id, isAttending ? 'NOT_REQUIRED' : 'REQUIRED');
  };

  // Property notices carousel — top 3 notifications rendered as horizontal cards.
  const notices = roleNotifs.slice(0, 3);

  return (
    <View style={styles.root}>
      <View style={{ flex: 1, paddingBottom: 76 }}>
        {/* ── Header — own surface, separate from the scrollable body below ── */}
        <View style={styles.header}>
          <Row justify="space-between" align="center">
            <Row gap={12} style={{ flex: 1 }}>
              <AnimatedPress scale={0.9} hapticPattern="light" onPress={() => setShowProfilePhotoDialog(true)}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    {guest?.profilePhotoUri ? (
                      <Txt size={12}>📷</Txt>
                    ) : (
                      <Ionicons name="person" size={28} color={Colors.primary} />
                    )}
                  </View>
                  <View style={styles.cameraBadge}><Ionicons name="camera" size={10} color={Colors.primaryDark} /></View>
                </View>
              </AnimatedPress>
              <Col style={{ flex: 1 }}>
                <Row gap={6} align="center">
                  <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                  <Txt size={18} weight="800" color={Colors.primaryDark} numberOfLines={1}>Hello, {guest?.name ?? 'Guest'}</Txt>
                </Row>
                <Txt size={11} weight="600" color={Colors.textMuted} style={{ marginTop: 1 }}>
                  Room {guest?.roomNo ?? 'N/A'} • Premium Resident
                </Txt>
                <View style={[styles.billPill, { backgroundColor: paid ? '#ECFDF5' : '#FFFBEB', borderWidth: 1, borderColor: paid ? '#A7F3D0' : '#FDE68A' }]}>
                  <Ionicons name={paid ? 'checkmark-circle' : 'information-circle'} size={11} color={paid ? '#059669' : '#B45309'} />
                  <Txt size={10} weight="800" color={paid ? '#047857' : '#B45309'} style={{ marginLeft: 4 }}>
                    {paid ? 'Rent Paid' : 'Rent Pending'}
                  </Txt>
                </View>
              </Col>
            </Row>
            <Row gap={8}>
              <AnimatedPress scale={0.85} hapticPattern="light" onPress={() => setShowNotif(true)}>
                <View style={styles.bellBtn}>
                  <Ionicons name="notifications" size={18} color={Colors.primary} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>
              <AnimatedPress scale={0.85} hapticPattern="medium" onPress={() => { hapticSuccess(); logout(); }}>
                <View style={styles.bellBtn}>
                  <Ionicons name="exit" size={18} color={Colors.danger} />
                </View>
              </AnimatedPress>
            </Row>
          </Row>
        </View>

        {/* ── Active tab content ─────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <Animated.View
            key={activeTab}
            entering={SlideInRight.duration(220).springify().damping(18).stiffness(220)}
            style={{ flex: 1 }}
          >
            {activeTab === 0 ? (
              // ── Home tab = the new light HUB ─────────────────────────────
              <Animated.ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}
                showsVerticalScrollIndicator={false}
                entering={FadeIn.duration(180)}
              >
                {/* KYC Verification Status Banner */}
                {kycStatus !== 'VERIFIED' && (
                  <Card
                    containerColor={kycStatus === 'PENDING' ? '#FFFBEB' : '#FEF2F2'}
                    borderRadius={Layout.borderRadiusCard}
                    borderWidth={1}
                    borderColor={kycStatus === 'PENDING' ? '#FDE68A' : '#FECACA'}
                    padding={[14, 14]}
                  >
                    <Row justify="space-between" align="center">
                      <Row gap={10} align="center" style={{ flex: 1 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: kycStatus === 'PENDING' ? '#FEF3C7' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={kycStatus === 'PENDING' ? 'time' : 'document-text'} size={18} color={kycStatus === 'PENDING' ? '#D97706' : '#DC2626'} />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <Txt size={13} weight="800" color={kycStatus === 'PENDING' ? '#B45309' : '#991B1B'}>
                            {kycStatus === 'PENDING' ? 'KYC Under Review' : 'KYC Verification Required'}
                          </Txt>
                          <Txt size={11} color={kycStatus === 'PENDING' ? '#92400E' : '#7F1D1D'} style={{ marginTop: 2 }}>
                            {kycStatus === 'PENDING'
                              ? 'Your KYC documents are with the Manager for approval.'
                              : 'Upload ID proof & selfie to get full dashboard access.'}
                          </Txt>
                        </Col>
                      </Row>
                      {kycStatus !== 'PENDING' && (
                        <Btn
                          onPress={() => { hapticSelect(); setShowKycDialog(true); }}
                          containerColor={Colors.danger}
                          textColor={Colors.textInverse}
                          borderRadius={8}
                          height={32}
                          contentStyle={{ paddingHorizontal: 10 }}
                        >
                          <Txt size={11} weight="800" color={Colors.textInverse}>Upload</Txt>
                        </Btn>
                      )}
                    </Row>
                  </Card>
                )}

                {/* Hero next-meal card */}
                <Card
                  containerColor={Colors.surface}
                  borderRadius={Layout.borderRadiusCard}
                  borderWidth={1}
                  borderColor={Colors.borderSubtle}
                  padding={[16, 16]}
                >
                  <Row justify="space-between" align="flex-start">
                    <Col style={{ flex: 1 }}>
                      <Row gap={6} align="center">
                        <View style={[styles.mealIconBubble, { backgroundColor: Colors.surfaceElevated }]}>
                          <Ionicons name="restaurant" size={16} color={Colors.primary} />
                        </View>
                        <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>NEXT MEAL</Txt>
                      </Row>
                      <Txt size={16} weight="800" color={Colors.textPrimary} style={{ marginTop: 8 }}>
                        {upcomingMeal?.mealType ? `${upcomingMeal.mealType[0]}${upcomingMeal.mealType.slice(1).toLowerCase()}` : 'No meal scheduled'}
                      </Txt>
                      <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                        {upcomingMeal?.menuItems || 'Menu not announced yet'}
                      </Txt>
                    </Col>
                    {/* Countdown pill — amber when approaching, red when passed */}
                    {cutoff ? (
                      <Pill label={cutoffPill.label} color={cutoffPill.color} bg={`${cutoffPill.color}1A`} />
                    ) : null}
                  </Row>

                  <Spacer size={14} />
                  {/* Attending toggle */}
                  <Row gap={10}>
                    <Btn
                      onPress={toggleAttending}
                      containerColor={isAttending ? Colors.success : Colors.surfaceMuted}
                      textColor={isAttending ? Colors.textInverse : Colors.textSecondary}
                      borderRadius={Layout.borderRadiusButton}
                      height={42}
                      style={{ flex: 1 }}
                      disabled={!upcomingMeal || cutoffPassed}
                      testID="guest_attending_toggle"
                    >
                      <Ionicons name={isAttending ? 'checkmark-circle' : 'radio-button-off'} size={16} color={isAttending ? Colors.textInverse : Colors.textSecondary} />
                      <Txt size={13} weight="700" color={isAttending ? Colors.textInverse : Colors.textSecondary} style={{ marginLeft: 6 }}>
                        {isAttending ? 'Attending' : 'Not Attending'}
                      </Txt>
                    </Btn>
                    <OutlinedBtn
                      onPress={() => switchTab(1)} // jumps to the Meals tab for full RSVP / menu list
                      borderColor={Colors.borderMuted}
                      textColor={Colors.primary}
                      borderRadius={Layout.borderRadiusButton}
                      height={42}
                    >
                      <Ionicons name="list" size={14} color={Colors.primary} />
                      <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>All Meals</Txt>
                    </OutlinedBtn>
                  </Row>
                </Card>

                {/* Quick tiles grid (2×2) */}
                <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 4 }}>QUICK ACTIONS</Txt>
                <View style={styles.tileGrid}>
                  {QUICK_TILES.map((tile) => (
                    <AnimatedPress
                      key={tile.label}
                      scale={0.96}
                      hapticPattern="light"
                      onPress={() => handleTilePress(tile)}
                      style={{ flex: 1 }}
                    >
                      <Card
                        containerColor={Colors.surface}
                        borderRadius={Layout.borderRadiusCard}
                        borderWidth={1}
                        borderColor={Colors.borderSubtle}
                        padding={[14, 14]}
                      >
                        <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}1A` }]}>
                          <Ionicons name={tile.icon as any} size={20} color={tile.tint} />
                        </View>
                        <Txt size={13} weight="800" color={Colors.textPrimary} style={{ marginTop: 10 }}>{tile.label}</Txt>
                        <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>{tile.desc}</Txt>
                      </Card>
                    </AnimatedPress>
                  ))}
                </View>

                {/* Notices carousel */}
                <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 6 }}>PROPERTY NOTICES</Txt>
                {notices.length === 0 ? (
                  <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                    <Row gap={8} align="center">
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Txt size={12} color={Colors.textMuted}>No new notices right now.</Txt>
                    </Row>
                  </Card>
                ) : (
                  <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                    {notices.map((n) => (
                      <Card
                        key={n.id}
                        containerColor={Colors.surface}
                        borderRadius={Layout.borderRadiusCard}
                        borderWidth={1}
                        borderColor={Colors.borderSubtle}
                        padding={[12, 14]}
                        style={{ width: 260 }}
                      >
                        <Row gap={8} align="center">
                          <View style={[styles.noticeIconBubble, { backgroundColor: `${Colors.primary}1A` }]}>
                            <Ionicons name="megaphone" size={14} color={Colors.primary} />
                          </View>
                          <Col style={{ flex: 1 }}>
                            <Txt size={12} weight="800" color={Colors.textPrimary} numberOfLines={1}>{n.title}</Txt>
                            <Txt size={10} color={Colors.textMuted} numberOfLines={1}>{n.message}</Txt>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Animated.ScrollView>
                )}
              </Animated.ScrollView>
            ) : activeTab === 1 ? (
              <GuestRSVPsTab />
            ) : activeTab === 2 ? (
              <GuestPaymentsTab />
            ) : activeTab === 3 ? (
              <GuestFeedbackComplaintsTab />
            ) : (
              <GuestSecurityTab />
            )}
          </Animated.View>
        </View>
      </View>

      {/* ── Sticky bottom dock — clean light style ────────────────────────── */}
      <View style={styles.dockWrap}>
        <View style={styles.dock}>
          {TABS.map((t, idx) => {
            const sel = activeTab === idx;
            return (
              <AnimatedPress
                key={t.label}
                scale={sel ? 1 : 0.93}
                hapticPattern={null}
                onPress={() => switchTab(idx)}
                style={[styles.dockBtn, { backgroundColor: sel ? Colors.primary : 'transparent' }]}
              >
                <Ionicons name={t.icon as any} size={16} color={sel ? Colors.textInverse : Colors.textMuted} />
                <Txt size={10} weight={sel ? '900' : '700'} color={sel ? Colors.textInverse : Colors.textSecondary} style={{ marginTop: 2 }}>{t.label}</Txt>
              </AnimatedPress>
            );
          })}
        </View>
      </View>

      {showNotif && <RoleNotificationsCenterSheet roleTitle="RESIDENT" onDismiss={() => setShowNotif(false)} />}

      {/* Profile photo dialog */}
      <Modal visible={showProfilePhotoDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '92%' }}>
            <Row align="center" gap={8}>
              <Ionicons name="camera" size={22} color={Colors.primary} />
              <Txt size={18} weight="800" color={Colors.textPrimary}>Personalize Profile Photo</Txt>
            </Row>
            <Spacer size={18} />
            <Col align="center">
              <View style={styles.photoPreview}>
                {guest?.profilePhotoUri ? <Txt>📷</Txt> : <Ionicons name="person" size={50} color={Colors.textMuted} />}
              </View>
              <Txt size={12} color={Colors.textMuted}>{guest?.profilePhotoUri ? 'Current Profile Photo' : 'No profile photo set yet'}</Txt>
            </Col>
            <Spacer size={18} />
            <Btn onPress={() => { updateProfilePhoto(`sample:selfie_preset_${Math.floor(Math.random() * 5) + 1}`); Alert.alert('Success', 'Sample selfie selected!'); setShowProfilePhotoDialog(false); }} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={44} testID="take_camera_photo_btn">
              <Ionicons name="camera" size={18} color={Colors.textInverse} /><Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>Take Photo (Camera)</Txt>
            </Btn>
            <Spacer size={8} />
            <OutlinedBtn onPress={() => { updateProfilePhoto(`sample:selfie_preset_${Math.floor(Math.random() * 5) + 1}`); Alert.alert('Success', 'Sample photo loaded!'); setShowProfilePhotoDialog(false); }} borderColor={Colors.primary} textColor={Colors.primary} borderRadius={12} height={44} testID="choose_gallery_photo_btn">
              <Ionicons name="images" size={18} color={Colors.primary} /><Txt size={13} weight="700" color={Colors.primary} style={{ marginLeft: 8 }}>Choose from Gallery</Txt>
            </OutlinedBtn>
            <Spacer size={12} /><View style={{ height: 1, backgroundColor: Colors.borderMuted }} /><Spacer size={12} />
            <Txt size={12} weight="700" color={Colors.textPrimary}>Or select a Preset Avatar:</Txt>
            <Spacer size={8} />
            <Row gap={8} justify="space-between">
              {[1, 2, 3, 4, 5].map((i) => (
                <AnimatedPress key={i} scale={0.9} onPress={() => { updateProfilePhoto(`sample:avatar_preset_${i}`); Alert.alert('Success', `Avatar ${i} selected!`); setShowProfilePhotoDialog(false); }} style={styles.presetAvatar}>
                  <Ionicons name="happy" size={24} color={Colors.primary} />
                </AnimatedPress>
              ))}
            </Row>
            {guest?.profilePhotoUri ? (
              <>
                <Spacer size={12} />
                <AnimatedPress scale={0.95} onPress={() => { updateProfilePhoto(''); Alert.alert('Removed', 'Profile photo removed'); setShowProfilePhotoDialog(false); }}>
                  <Txt size={12} weight="700" color={Colors.danger}>Remove Photo</Txt>
                </AnimatedPress>
              </>
            ) : null}
            <Spacer size={12} />
            <Row gap={8}>
              <Btn onPress={() => { setActiveTab(4); setShowProfilePhotoDialog(false); }} containerColor={Colors.primaryDark} textColor={Colors.textInverse} borderRadius={10} height={36} contentStyle={{ paddingHorizontal: 12 }}>
                <Ionicons name="ribbon" size={14} color={Colors.textInverse} /><Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 4 }}>Profile & KYC</Txt>
              </Btn>
              <AnimatedPress scale={0.95} onPress={() => setShowProfilePhotoDialog(false)} style={{ padding: 8 }}><Txt size={12} color={Colors.textMuted}>Close</Txt></AnimatedPress>
            </Row>
          </Card>
        </View>
      </Modal>

      <KycUploadDialog
        visible={showKycDialog}
        onDismiss={() => setShowKycDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  billPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    marginTop: 4, alignSelf: 'flex-start',
  },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger,
  },
  mealIconBubble: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeIconBubble: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  dockWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    shadowColor: Layout.shadowFloatingBar.shadowColor as any,
    shadowOffset: Layout.shadowFloatingBar.shadowOffset as any,
    shadowOpacity: Layout.shadowFloatingBar.shadowOpacity,
    shadowRadius: Layout.shadowFloatingBar.shadowRadius,
    elevation: Layout.shadowFloatingBar.elevation,
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16, padding: 4, gap: 2,
  },
  dockBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center' },
  photoPreview: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 3, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  presetAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
});
