/**
 * The combined notifications+notices inbox for every role (KYC approvals, payment decisions,
 * announcements, requests; a broadcast composer and a Reviews subtab for owner/manager) —
 * reachable at `/notifications` (see app/notifications/index.tsx) from any role's header bell.
 *
 * ── Row weight (X1) ──────────────────────────────────────────────────────────────────────────
 * Every item sorts into one of three bands, and the band — not priority guesswork — decides
 * how much space it gets:
 *
 *   decision  A real, currently-open decision: a pending KYC submission, a payment awaiting
 *             verification, a procurement request awaiting approval. Rendered as a full card
 *             with its typed body and its own buttons, always at the top, regardless of read
 *             state — a decision does not stop needing you because you have seen it.
 *   unread    Everything else not yet opened: a normal row, one snippet line, a time.
 *   read      Opened already: a dense single line — icon, title, time — so a long history
 *             takes less scroll than a long list of duplicated real estate. Its ACTIONS still
 *             render: reading a notification does not answer the meal it is asking about or
 *             dispatch the ticket it is reporting.
 *
 * ── The pinned strip (X4) ───────────────────────────────────────────────────────────────────
 * When one or more decisions are open, an amber strip sits above the filter chips and stays
 * there no matter which chip is active — "survives every filter" — naming the count and
 * jumping to the Decisions chip on tap.
 *
 * ── Typed shapes (W2) ───────────────────────────────────────────────────────────────────────
 * A payment-flavoured item (rent category, or the server's own `actionType: "payment"`) reads
 * as a receipt: a dashed tear line over a tabular amount when the amount is actually known.
 * A pending KYC decision is an ID card: the resident's own two document photos, inline, via
 * the same `KycDocumentsCard` the detail sheet already used. An announcement carries a small
 * pin glyph rather than the generic bell. Nothing else gets a bespoke shape — request/shift/
 * service notifications stay a plain row, because inventing a shape nobody asked for is not
 * this pass's job.
 *
 * ── What is real, and what only redirects ──────────────────────────────────────────────────
 * KYC and payment decisions act right here — `verifyGuestKycByOwner`, `useVerifyPaymentMutation`
 * / `useRejectPaymentMutation` — same mutations the Guests and Payments tabs use, so verifying
 * from the inbox and verifying from the tab are the same action, not a parallel one. Procurement
 * only ever redirects: approving needs a payment method chosen on the real Procurement screen,
 * and the server sends that notification with no `actionId` to act on directly. A payment
 * notification is only ever treated as a live decision when its `actionId` is still in the
 * OWNER'S OWN pending-payments list — the notification row itself never updates once you act
 * on the same payment elsewhere, so trusting its static shape alone would show a Verify button
 * on money someone already verified from the Payments tab.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, useWindowDimensions, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useRouter, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Colors, Radii, DeckTints } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useSubmitResponseMutation } from '@/features/meals/useMeals';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatTimeAgo, formatDateTime } from '@/utils/format';
import type { GuestEntity, PaymentEntity, AppRoleNotificationEntity } from '@/types';
import { OwnerReviewsTab } from './OwnerReviewsTab';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';

const PRIMARY = Colors.primary;
const BG = Colors.canvas;
const SURFACE = Colors.surface;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textMuted;
const DIVIDER = Colors.separator;
/** Same duration-based spring the press feedback and the sheets use. */
const FAB_SPRING = { duration: 260, dampingRatio: 0.85 } as const;

import {
  useRoleNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDismissNotificationMutation,
  useDismissAllNotificationsMutation,
  useBroadcastNotificationMutation,
  BROADCAST_AUDIENCE_MAP } from '@/features/notifications/useNotifications';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useAllPaymentsQuery, useVerifyPaymentMutation, useRejectPaymentMutation } from '@/features/payments/usePayments';
import { useAuthStore } from '@/store/authStore';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, Btn, Card, Col, OutlinedTextField, PGowDialog, Row, Sheet, Spacer, StatusChip, Txt } from '@/components/ui';

// ── Classification ───────────────────────────────────────────────────────────────────────────

type InboxKind = 'KYC' | 'PAYMENT' | 'ANNOUNCEMENT' | 'REQUEST' | 'PROCUREMENT' | 'MEAL' | 'OTHER';
type InboxWeight = 'decision' | 'unread' | 'read';

/** The kinds that have their own filter chip. Anything else falls into "Other". */
const CHIPPED_KINDS = new Set<InboxKind>(['PAYMENT', 'REQUEST', 'ANNOUNCEMENT']);

interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  desc: string;
  timestamp: number;
  isRead: boolean;
  weight: InboxWeight;
  icon: keyof typeof Ionicons.glyphMap;
  /** Present only for the synthetic per-guest KYC decision. */
  guest?: GuestEntity;
  /** Present for every item sourced from a real notification row (everything but the KYC
   *  decision, which is built straight from the guest roster — see the file header for why
   *  the server's own "New KYC submission" row for the same guest is filtered out below). */
  notif?: AppRoleNotificationEntity;
  /** Payment decisions only — the live record, looked up by `notif.actionId` in the owner's
   *  own pending list, which is what makes the amount on the card real rather than guessed. */
  payment?: PaymentEntity;
  /**
   * The row points at a real ticket, so it can be opened and escalated.
   *
   * This used to be `isMaintenanceFlavoured`, gated on `/repair|maintenance/i.test(title)`.
   * A resident's complaint is titled in their own words — "Leaking tap", "Water not coming"
   * — so the test never passed on the exact rows the button existed for, and the owner never
   * saw it. `kind === 'REQUEST'` already means `category === 'COMPLAINT'`; the only extra
   * thing needed to act on one is the id of the ticket to act on.
   */
  isTicket?: boolean;
}

/** Categorises off the server's own `category`/`actionType`, not text-sniffed guesses.
 *  The one exception is procurement: the server posts that notification with neither field
 *  set (approving needs a payment method chosen on the real screen, so there is nothing to
 *  point `actionId` at), so its exact, fixed title is genuinely the only signal there is. */
function kindOf(n: AppRoleNotificationEntity): InboxKind {
  if (n.category === 'KYC') return 'KYC';
  if (n.category === 'RENT' || n.actionType === 'payment') return 'PAYMENT';
  if (n.category === 'ANNOUNCEMENT') return 'ANNOUNCEMENT';
  if (n.category === 'COMPLAINT') return 'REQUEST';
  // `action_type="meal"` is what `meal/service.py` stamps on both the roster push and the
  // timed reminder, and `actionId` is the meal — everything the Eat/Skip buttons need.
  if (n.actionType === 'meal') return 'MEAL';
  if (n.title.toLowerCase().includes('procurement request awaiting approval')) return 'PROCUREMENT';
  // FINANCE (an expense logged — recorded, not awaiting anything), SHIFT (a delivery trip
  // assignment) and SERVICE (a supply-order status change) are all real, all informational,
  // and none of them was asked for a bespoke shape — a plain row is the honest one.
  return 'OTHER';
}

function iconFor(kind: InboxKind, notif?: AppRoleNotificationEntity): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'KYC': return 'shield-checkmark-outline';
    case 'PAYMENT': return 'receipt-outline';
    case 'ANNOUNCEMENT': return 'pin-outline';
    case 'REQUEST': return 'construct-outline';
    case 'PROCUREMENT': return 'cart-outline';
    case 'MEAL': return 'restaurant-outline';
    default:
      if (notif?.category === 'FINANCE') return 'cash-outline';
      if (notif?.category === 'SHIFT') return 'bicycle-outline';
      if (notif?.category === 'SERVICE') return 'cube-outline';
      return 'notifications-outline';
  }
}

const weightRank: Record<InboxWeight, number> = { decision: 0, unread: 1, read: 2 };

// ── Row (unread + read tiers) ───────────────────────────────────────────────────────────────

/** Not `ListRow`: that component deliberately carries no status/snippet-plus-time combination
 *  and no dense variant — it is the roster/payment-list shape, not the inbox shape. Same
 *  reasoning as `MetricRow` existing beside it. */
/**
 * Escalate one complaint to a technician.
 *
 * The owner group's `book-technician/[id]` fetches THIS ticket and posts
 * `/v1/requests/{id}/escalate`, handing it to the area manager. Two things used to happen
 * instead, neither of them that:
 *
 *   - the row button pushed `{ pathname: '/book-technician', params: { id } }`. That pathname
 *     has no `[id]` segment, so the id degraded to a query param and the route resolved to
 *     the RESIDENT's create-a-new-request screen, which ignores it.
 *   - the sheet button never navigated at all: it called `bookPgRepairService`, which POSTs a
 *     brand-new `kind: 'repair'` ticket. The complaint it was raised from stayed open, a
 *     duplicate appeared beside it, and the toast said "Technician assigned" for an assignment
 *     the store explicitly does not make.
 *
 * Group-qualified for the same reason `routeFromPushData` qualifies its paths: `ticket/[id]`
 * and `book-technician` both exist in more than one group.
 */
function bookTechnicianFor(ticketId: string) {
  router.push(`/(owner)/book-technician/${ticketId}` as never);
}

/**
 * The actions that belong ON a notification rather than one tap inside it.
 *
 * A meal notification is a question ("are you eating?") and a maintenance request has one
 * obvious next step, so making the reader open a detail sheet to answer is a tap they should
 * not have to spend — the OS push already offers Eat/Skip inline, and the in-app inbox
 * offering less than the push notification is backwards.
 *
 * Deliberately narrow: only kinds with a single unambiguous next action get a button here.
 * Payments and KYC are decisions with a reject path and a reason to read the detail first,
 * so those stay inside the sheet where the evidence is.
 */
function InboxRowActions({ item, dense = false }: { item: InboxItem; dense?: boolean }) {
  // React Query, not the store's `submitRSVP`: this is server data, which is the ADR's split,
  // and the mutation invalidates the three meal keys precisely instead of the store action's
  // blanket `refreshAll()`.
  const activePgId = useAuthStore((s) => s.activePgId);
  const submitResponse = useSubmitResponseMutation(activePgId ?? undefined);
  const [answered, setAnswered] = useState<'eating' | 'skipping' | null>(null);
  const busy = submitResponse.isPending ? submitResponse.variables?.choice ?? null : null;

  if (item.kind === 'MEAL' && item.notif?.actionId) {
    // `actionId` on a meal notification is the MEAL id — `PUT /v1/meals/{id}/response` is
    // what answers it. (The store's `submitRSVP` names this parameter `notificationId`,
    // which it has never been.)
    const mealId = item.notif.actionId;
    const answer = async (choice: 'eating' | 'skipping') => {
      if (submitResponse.isPending) return;
      try {
        await submitResponse.mutateAsync({ mealId, choice });
        setAnswered(choice);
      } catch {
        // The mutation holds the error; the buttons stay live so it can be retried.
      }
    };
    return (
      <Row gap={8} style={dense ? styles.rowActionsDense : styles.rowActions}>
        {(['eating', 'skipping'] as const).map((choice) => {
          const isEat = choice === 'eating';
          const picked = answered === choice;
          return (
            <Btn
              key={choice}
              onPress={() => answer(choice)}
              disabled={busy !== null}
              containerColor={picked ? Colors.primary : Colors.surfaceMuted}
              textColor={picked ? Colors.textInverse : Colors.textPrimary}
              borderRadius={Radii.control}
              height={36}
              style={{ flex: 1 }}
            >
              <Txt variant="button" color={picked ? Colors.textInverse : Colors.textPrimary}>
                {busy === choice ? 'Saving…' : isEat ? "I'll eat" : 'Skip'}
              </Txt>
            </Btn>
          );
        })}
      </Row>
    );
  }

  if (item.kind === 'REQUEST' && item.isTicket) {
    return (
      <Row style={dense ? styles.rowActionsDense : styles.rowActions}>
        <Btn
          onPress={() => bookTechnicianFor(item.notif!.actionId!)}
          containerColor={Colors.surfaceMuted}
          textColor={Colors.textPrimary}
          borderRadius={Radii.control}
          height={36}
          style={{ flex: 1 }}
        >
          <Txt variant="button" color={Colors.textPrimary}>Book a technician</Txt>
        </Btn>
      </Row>
    );
  }

  return null;
}

function InboxRow({ item, onPress, onDismiss }: { item: InboxItem; onPress: () => void; onDismiss?: () => void }) {
  const dense = item.weight === 'read';
  const tileTone = item.kind === 'PAYMENT' ? DeckTints.brand : item.kind === 'ANNOUNCEMENT' ? DeckTints.amber : undefined;

  return (
    <AnimatedPress accessibilityRole="button" onPress={onPress} style={[styles.row, dense && styles.rowDense]}>
      <Row gap={12} align={dense ? 'center' : 'flex-start'}>
        <View style={[styles.iconTile, tileTone && { backgroundColor: tileTone.fill }, dense && styles.iconTileDense]}>
          <Ionicons name={item.icon} size={dense ? 14 : 18} color={tileTone ? tileTone.ink : PRIMARY} />
        </View>
        {dense ? (
          <>
            <Txt size={12.5} weight="500" color={TEXT_SECONDARY} numberOfLines={1} style={{ flex: 1 }}>{item.title}</Txt>
            <Txt size={10.5} color={TEXT_SECONDARY}>{formatTimeAgo(item.timestamp)}</Txt>
          </>
        ) : (
          <Col style={{ flex: 1 }}>
            <Row justify="space-between" align="center">
              <Row align="center" gap={6}>
                {!item.isRead && <View style={styles.unreadDot} />}
                <Txt size={10.5} weight="700" color={PRIMARY} style={{ letterSpacing: 0.4 }}>{item.kind}</Txt>
              </Row>
              <Txt size={11} color={TEXT_SECONDARY}>{formatTimeAgo(item.timestamp)}</Txt>
            </Row>
            <Spacer size={3} />
            <Txt size={14.5} weight={item.isRead ? '600' : '700'} color={TEXT_PRIMARY} numberOfLines={1}>{item.title}</Txt>
            <Spacer size={2} />
            <Txt size={13} color={TEXT_SECONDARY} numberOfLines={2} style={{ lineHeight: 18 }}>{item.desc}</Txt>
          </Col>
        )}
        {onDismiss && !dense ? (
          <AnimatedPress accessibilityLabel="Dismiss" accessibilityRole="button" onPress={(e) => { e.stopPropagation(); onDismiss(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginTop: 2 }}>
            <Ionicons name="close" size={16} color={TEXT_SECONDARY} />
          </AnimatedPress>
        ) : null}
      </Row>
      {/* NOT gated on `dense`. It used to be, and that made every action on this screen
          disappear the moment you tapped the row — `handleOpenItem` marks a notification read,
          read rows render dense, and dense rows dropped their buttons. Opening a notification
          to look at it is the ordinary thing to do, so in practice Eat/Skip and Book-a-
          technician were only ever visible until first glance.

          Read state is about how much room a row deserves, not about whether its action still
          applies: an unanswered meal still needs answering and an open ticket still needs
          dispatching after you have read about them. `InboxRowActions` returns null for the
          kinds that have no action, so this stays empty on everything else. */}
      <InboxRowActions item={item} dense={dense} />
    </AnimatedPress>
  );
}

// ── Receipt shape (W2) ──────────────────────────────────────────────────────────────────────

/** The tear line's "cut" circles are `Colors.surface` — verified equal to `Colors.canvas`
 *  (both `#FFFFFF`) in colors.ts, which is what makes them read correctly whether this sits
 *  directly on the screen or inside a white modal sheet, without matching a parent colour by
 *  hand at each call site. */
function ReceiptDivider() {
  return (
    <View style={styles.receiptDivider}>
      <View style={styles.receiptDash} />
      <View style={[styles.receiptNotch, { left: -13 }]} />
      <View style={[styles.receiptNotch, { right: -13 }]} />
    </View>
  );
}

/** A payment item only ever carries a live `payment` record while it is still pending — see
 *  `isPaymentDecision` above — so this only ever reads the notification's own fixed title
 *  (never arbitrary user text) for the three states that have already been resolved. */
function paymentToneFor(item: InboxItem): string {
  if (item.payment) return 'Pending';
  if (item.title.includes('verified')) return 'Verified';
  if (item.title.includes('due')) return 'Due';
  if (item.title.includes('attention')) return 'Rejected';
  return 'Submitted';
}

function ReceiptBody({ title, payment, tone }: { title: string; payment?: PaymentEntity; tone: string }) {
  return (
    <View>
      <Row justify="space-between" align="center">
        <Txt size={13} weight="700" color={TEXT_PRIMARY}>{title}</Txt>
        <StatusChip label={tone} variant="dot" />
      </Row>
      {payment ? (
        <>
          <ReceiptDivider />
          <Row justify="space-between" align="center">
            <Col>
              <Txt size={10.5} color={TEXT_SECONDARY}>{payment.payerName} · {payment.paymentType.replace(/_/g, ' ')}</Txt>
              <Txt size={10} color={TEXT_SECONDARY}>{payment.paymentMode.replace(/_/g, ' ')}</Txt>
            </Col>
            <Txt size={19} weight="700" color={TEXT_PRIMARY} tabular>₹{payment.amount.toLocaleString('en-IN')}</Txt>
          </Row>
        </>
      ) : null}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────────────────

export function OwnerAnnouncementsTab() {
  const router = useRouter();
  const activePgId = useAuthStore((s) => s.activePgId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const canManage = activeRole === 'owner' || activeRole === 'manager';
  // Owner/manager alone has the `(owner)` route group's `/ticket/[id]` in its own stack;
  // staff roles (chef/kitchen_staff/maintenance/delivery_agent) share `(staff)`, which has
  // no ticket-detail route at all — a "View ticket" button there would push to a route
  // nobody mounted. See app/_layout.tsx's `isStaffRole` for the exact role list this reads.
  const canOpenTicket = canManage || activeRole === 'guest';

  const { data: roleNotifs = [], isLoading: inboxLoading, error: inboxError, refetch: refetchInbox } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(canManage ? (activePgId ?? undefined) : undefined);
  // Cache-shared with the bottom nav's own C3 signal (HeadlessDockTabButton calls this exact
  // hook with these exact args) — not an extra round trip in practice, and it is what tells a
  // stale "New payment submitted" row apart from one already resolved from the Payments tab.
  const { data: pendingPayments = [] } = useAllPaymentsQuery(canManage ? (activePgId ?? undefined) : undefined, 'pending');

  const markReadMutation = useMarkNotificationReadMutation(activePgId ?? undefined);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(activePgId ?? undefined);
  const dismissMutation = useDismissNotificationMutation(activePgId ?? undefined);
  const dismissAllMutation = useDismissAllNotificationsMutation(activePgId ?? undefined);
  const broadcastMutation = useBroadcastNotificationMutation(activePgId ?? undefined);
  const verifyPaymentMutation = useVerifyPaymentMutation(activePgId ?? undefined);
  const rejectPaymentMutation = useRejectPaymentMutation(activePgId ?? undefined);
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'DECISIONS' | 'PAYMENTS' | 'REQUESTS' | 'ANNOUNCEMENTS' | 'OTHER' | 'REVIEWS'>('ALL');

  // Notifications is always reached by pushing from a role's own header bell, so there is
  // always somewhere real to return to — `router.back()` is the same convention every other
  // screen's `onBack` already uses. The previous handler hardcoded '/overview', which is an
  // owner-only route: a resident or staff member pressing the hardware back button here was
  // sent to a screen their role cannot even see.
  // Scoped to focus — see the staff tab for why an unscoped global listener swallows the
  // back press of any screen pushed on top of this one.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => { router.back(); return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedInboxItem, setSelectedInboxItem] = useState<InboxItem | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<InboxItem | null>(null);
  const [rejectingKyc, setRejectingKyc] = useState<InboxItem | null>(null);
  const [duplicatePayment, setDuplicatePayment] = useState<{ paymentId: string; message: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeErrors, setNoticeErrors] = useState<{ title?: string; message?: string }>({});
  const [noticeAudience, setNoticeAudience] = useState<'all' | 'guest' | 'staff' | 'manager'>('all');
  const [isPublishing, setIsPublishing] = useState(false);

  const pendingPaymentById = useMemo(() => new Map(pendingPayments.map((p) => [p.id, p])), [pendingPayments]);

  const inboxItems = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = [];

    guests.filter((g: GuestEntity) => g.kycStatus === 'PENDING').forEach((g: GuestEntity) => {
      items.push({
        id: `kyc_${g.id}`,
        kind: 'KYC',
        title: 'New resident joined',
        desc: `Room ${g.roomNo} · identity documents ready for review`,
        timestamp: g.kycSubmissionDate || Date.now(),
        isRead: false,
        weight: 'decision',
        icon: iconFor('KYC'),
        guest: g,
      });
    });

    roleNotifs.forEach((n) => {
      const kind = kindOf(n);
      // The server also posts this exact event as a real notification row ("New KYC
      // submission", category KYC) to the same owner/manager the guest roster above already
      // covers — with richer data (the guest's own photos) than the bare row could ever
      // carry. Without this, every pending resident would show up twice.
      if (kind === 'KYC' && canManage && n.title.startsWith('New KYC submission')) return;

      const isPaymentDecision = kind === 'PAYMENT' && !!n.actionId && pendingPaymentById.has(n.actionId);
      const isProcurementDecision = kind === 'PROCUREMENT';
      const isDecision = isPaymentDecision || isProcurementDecision;

      items.push({
        id: `notif_${n.id}`,
        kind,
        title: n.title,
        desc: n.message,
        timestamp: n.timestamp,
        isRead: n.isRead,
        weight: isDecision ? 'decision' : n.isRead ? 'read' : 'unread',
        icon: iconFor(kind, n),
        notif: n,
        payment: isPaymentDecision ? pendingPaymentById.get(n.actionId!) : undefined,
        isTicket: kind === 'REQUEST' && !!n.actionId,
      });
    });

    return items.sort((a, b) => weightRank[a.weight] - weightRank[b.weight] || b.timestamp - a.timestamp);
  }, [guests, roleNotifs, pendingPaymentById, canManage]);

  const totalCount = inboxItems.length;
  const decisionItems = useMemo(() => inboxItems.filter((i) => i.weight === 'decision'), [inboxItems]);
  const paymentCount = useMemo(() => inboxItems.filter((i) => i.kind === 'PAYMENT').length, [inboxItems]);
  const requestCount = useMemo(() => inboxItems.filter((i) => i.kind === 'REQUEST').length, [inboxItems]);
  const announcementCount = useMemo(() => inboxItems.filter((i) => i.kind === 'ANNOUNCEMENT').length, [inboxItems]);
  /**
   * Everything no other chip claims — KYC, meals, procurement, and whatever kind is added
   * next. The filters were Payments / Requests / Announcements only, so a KYC notification
   * sat in All and in nothing else: its counts did not add up to the total and there was no
   * way to reach it by filtering. A catch-all beats a chip per kind, because the next `kind`
   * added to `InboxKind` lands here on its own instead of quietly disappearing again.
   */
  const otherItems = useMemo(
    () => inboxItems.filter((i) => !CHIPPED_KINDS.has(i.kind)),
    [inboxItems],
  );
  const unreadInformationalCount = useMemo(() => inboxItems.filter((i) => i.weight === 'unread').length, [inboxItems]);

  const displayedItems = useMemo(() => {
    if (activeSubTab === 'DECISIONS') return decisionItems;
    if (activeSubTab === 'PAYMENTS') return inboxItems.filter((i) => i.kind === 'PAYMENT');
    if (activeSubTab === 'REQUESTS') return inboxItems.filter((i) => i.kind === 'REQUEST');
    if (activeSubTab === 'ANNOUNCEMENTS') return inboxItems.filter((i) => i.kind === 'ANNOUNCEMENT');
    if (activeSubTab === 'OTHER') return otherItems;
    return inboxItems;
  }, [inboxItems, activeSubTab, decisionItems, otherItems]);

  const handleApproveKyc = async (item: InboxItem) => {
    if (!item.guest) return;
    await verifyKyc(item.guest.id, true);
    toast('success', 'KYC Approved', `${item.guest.name} is now verified.`);
    setSelectedInboxItem(null);
  };

  // Was a yes/no alert that then sent the canned string "Documents unreadable or incomplete."
  // no matter what was actually wrong — so a resident whose selfie was fine but whose ID was
  // cropped got told the wrong thing, and had to guess. The rejection reason is the only
  // explanation they ever see (kyc/service.py posts it straight to them), so it is worth
  // typing. Same dialog the payment rejection uses.
  const handleRejectKyc = (item: InboxItem) => {
    if (!item.guest) return;
    setRejectingKyc(item);
  };

  const submitRejectKyc = async (reason: string) => {
    if (!rejectingKyc?.guest) return;
    await verifyKyc(rejectingKyc.guest.id, false, reason);
    toast('warning', 'KYC Rejected', 'Resident notified.');
    setRejectingKyc(null);
    setSelectedInboxItem(null);
  };

  const handleVerifyPayment = async (item: InboxItem) => {
    if (!item.notif?.actionId) return;
    try {
      await verifyPaymentMutation.mutateAsync(item.notif.actionId);
      toast('success', 'Payment Verified', 'The resident has been notified.');
      setSelectedInboxItem(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      const isDuplicateError = msg.toLowerCase().includes('already been verified') || msg.toLowerCase().includes('duplicate');
      
      if (isDuplicateError) {
        setDuplicatePayment({ paymentId: item.notif.actionId, message: msg });
      } else {
        toast('error', 'Could not verify', msg);
      }
    }
  };

  const rejectDuplicatePayment = () => {
    if (!duplicatePayment) return;
    rejectPaymentMutation.mutate({ paymentId: duplicatePayment.paymentId, reason: 'Duplicate payment request' }, {
      onSuccess: () => {
        toast('success', 'Duplicate Rejected', 'The duplicate request was removed.');
        setDuplicatePayment(null);
        setSelectedInboxItem(null);
      },
      onError: (rejectErr) => {
        setDuplicatePayment(null);
        toast('error', 'Could not reject', rejectErr instanceof Error ? rejectErr.message : 'Please try again.');
      } });
  };

  const openRejectPayment = (item: InboxItem) => setRejectingPayment(item);

  const submitRejectPayment = async (reason: string) => {
    if (!rejectingPayment?.notif?.actionId) return;
    try {
      await rejectPaymentMutation.mutateAsync({ paymentId: rejectingPayment.notif.actionId, reason });
      toast('warning', 'Payment Rejected', 'The resident has been notified.');
      setRejectingPayment(null);
      setSelectedInboxItem(null);
    } catch (err) {
      toast('error', 'Could not reject', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleReviewProcurement = (_item: InboxItem) => {
    setSelectedInboxItem(null);
    router.push('/procurement');
  };

  const handleViewTicket = (item: InboxItem) => {
    if (!item.notif?.actionId) return;
    setSelectedInboxItem(null);
    // `ticket/[id]` exists in BOTH `(owner)` and `(guest)`, and they are different screens.
    // `routeFromPushData` already resolves that ambiguity by writing the group into the path;
    // this call site was relying on whichever group happened to be current. `canOpenTicket`
    // has already restricted us to owner/manager/guest by the time this runs.
    const group = canManage ? '(owner)' : '(guest)';
    router.push(`/${group}/ticket/${item.notif.actionId}` as never);
  };

  const handleBookService = (item: InboxItem) => {
    if (!item.notif?.actionId) return;
    setSelectedInboxItem(null);
    bookTechnicianFor(item.notif.actionId);
  };

  const handlePublishNotice = async () => {
    // Inline, on the fields, rather than the `Alert.alert('Validation', …)` this used to
    // throw: a popup that blocks the screen to describe in prose which of the fields behind
    // it is empty, then disappears. See OutlinedTextField's header for the rest of that.
    const nextErrors = {
      title: noticeTitle.trim() ? undefined : 'Give the notice a title',
      message: noticeMessage.trim() ? undefined : 'Say what the notice is about',
    };
    setNoticeErrors(nextErrors);
    if (nextErrors.title || nextErrors.message) return;
    if (!activePgId) {
      toast('error', 'No active property', 'Pick a property before publishing a notice.');
      return;
    }
    // `?? 'all'` used to close this expression. An audience label that isn't in the map —
    // a renamed chip, a new option added to the picker without a mapping — silently
    // widened the notice from one role to EVERYONE at the property. The failure direction
    // matters: over-broadcasting a notice is not recoverable once phones have buzzed.
    const targetRole = BROADCAST_AUDIENCE_MAP[noticeAudience.toUpperCase()];
    if (!targetRole) {
      toast('error', 'Pick an audience', `"${noticeAudience}" isn't an audience this notice can target.`);
      return;
    }

    setIsPublishing(true);
    try {
      await broadcastMutation.mutateAsync({
        pg_id: activePgId,
        target_role: targetRole,
        title: noticeTitle.trim(),
        body: noticeMessage.trim(),
        category: 'announcement',
        priority: 'normal' });
      toast('success', 'Announcement Published', `Broadcast delivered to target ${noticeAudience}.`);
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeErrors({});
      setShowBroadcastModal(false);
    } catch (err) {
      toast('error', 'Could not publish', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenItem = (item: InboxItem) => {
    setSelectedInboxItem(item);
    if (item.notif && !item.notif.isRead) markReadMutation.mutate(item.notif.id);
  };

  const tabs = [
    { id: 'ALL', label: 'All', count: totalCount },
    ...(canManage ? [{ id: 'DECISIONS', label: 'Decisions', count: decisionItems.length }] : []),
    { id: 'PAYMENTS', label: 'Payments', count: paymentCount },
    { id: 'REQUESTS', label: 'Requests', count: requestCount },
    { id: 'ANNOUNCEMENTS', label: 'Announcements', count: announcementCount },
    // Hidden when empty: an "Other 0" chip on a tidy inbox is noise.
    ...(otherItems.length > 0 ? [{ id: 'OTHER', label: 'Other', count: otherItems.length }] : []),
    ...(canManage ? [{ id: 'REVIEWS', label: 'Reviews' }] : []),
  ];

  return (
    <View style={styles.root}>
      <AppHeader title="Notifications" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.mainScroll, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <Txt size={13} color={TEXT_SECONDARY}>{totalCount} updates · {decisionItems.length} decision{decisionItems.length === 1 ? '' : 's'}</Txt>
        <Spacer size={14} />

        {/* X4 — survives every filter, so it renders above the chips, not the list. */}
        {decisionItems.length > 0 && (
          <>
            <AnimatedPress accessibilityRole="button" onPress={() => setActiveSubTab('DECISIONS')} style={styles.pinnedStrip}>
              <Ionicons name="alert-circle" size={16} color={DeckTints.amber.ink} />
              <Txt size={12.5} weight="700" color={DeckTints.amber.ink} style={{ flex: 1, marginLeft: 8 }}>
                {decisionItems.length} still need{decisionItems.length === 1 ? 's' : ''} your decision
              </Txt>
              <Ionicons name="chevron-forward" size={14} color={DeckTints.amber.sub} />
            </AnimatedPress>
            <Spacer size={12} />
          </>
        )}

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {tabs.map((tab) => (
              <AnimatedPress accessibilityRole="button" key={tab.id} onPress={() => setActiveSubTab(tab.id as any)} style={[styles.filterChip, activeSubTab === tab.id && styles.filterChipActive]}>
                <Txt maxFontSizeMultiplier={1.3} style={[styles.filterChipText, activeSubTab === tab.id && styles.filterChipTextActive]}>
                  {tab.label}{tab.count !== undefined ? ` ${tab.count}` : ''}
                </Txt>
              </AnimatedPress>
            ))}
          </ScrollView>
        </View>

        {activeSubTab !== 'REVIEWS' && (unreadInformationalCount > 0 || totalCount > decisionItems.length) && (
          <>
            <Spacer size={10} />
            <Row gap={16} align="center" justify="flex-end">
              {unreadInformationalCount > 0 && (
                <AnimatedPress accessibilityRole="button" onPress={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} style={[styles.markAllReadBtn, { alignSelf: 'auto' }]}>
                  <Ionicons name="checkmark-done" size={15} color={PRIMARY} />
                  <Txt maxFontSizeMultiplier={1.3} style={styles.markAllReadText}>
                    {markAllReadMutation.isPending ? 'Marking…' : `Mark all ${unreadInformationalCount} as read`}
                  </Txt>
                </AnimatedPress>
              )}
              {totalCount > decisionItems.length && (
                <AnimatedPress 
                  accessibilityRole="button" 
                  onPress={() => {
                    setConfirmClearAll(true);
                  }} 
                  disabled={dismissAllMutation.isPending} 
                  style={[styles.markAllReadBtn, { alignSelf: 'auto', opacity: dismissAllMutation.isPending ? 0.5 : 1 }]}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  <Txt maxFontSizeMultiplier={1.3} style={[styles.markAllReadText, { color: Colors.danger }]}>
                    {dismissAllMutation.isPending ? 'Clearing…' : 'Clear all'}
                  </Txt>
                </AnimatedPress>
              )}
            </Row>
          </>
        )}
        <Spacer size={16} />

        {activeSubTab === 'REVIEWS' ? (
          <View style={{ marginHorizontal: -20 }}>
            <OwnerReviewsTab />
          </View>
        ) : inboxLoading || inboxError || displayedItems.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title={inboxError ? 'Could not load the inbox' : "You're all caught up"}
            subtitle={inboxError ? undefined : 'No new notifications right now.'}
            loading={inboxLoading}
            error={inboxError}
            onRetry={refetchInbox}
          />
        ) : (
          <View>
            {/* Decision cards — always their own full-width surface, always first (the sort
                above already put them there), never demoted no matter how the list re-sorts. */}
            {displayedItems.filter((i) => i.weight === 'decision').map((item) => (
              <DecisionCard
                key={item.id}
                item={item}
                onPress={() => handleOpenItem(item)}
                onApproveKyc={() => handleApproveKyc(item)}
                onRejectKyc={() => handleRejectKyc(item)}
                onVerifyPayment={() => handleVerifyPayment(item)}
                onRejectPayment={() => openRejectPayment(item)}
                onReviewProcurement={() => handleReviewProcurement(item)}
              />
            ))}

            {displayedItems.some((i) => i.weight !== 'decision') && (
              <View style={styles.listContainer}>
                {displayedItems.filter((i) => i.weight !== 'decision').map((item, index, arr) => (
                  <View key={item.id}>
                    <InboxRow
                      item={item}
                      onPress={() => handleOpenItem(item)}
                      onDismiss={item.notif ? () => dismissMutation.mutate(item.notif!.id) : undefined}
                    />
                    {index < arr.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {canManage && <NotificationFAB onPress={() => { setShowBroadcastModal(true); }} />}

      {/* ── Inbox Item Detail Modal ── */}
      {selectedInboxItem && (
        <Sheet
          visible
          title={selectedInboxItem.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}
          subtitle={formatDateTime(selectedInboxItem.timestamp)}
          icon={selectedInboxItem.icon}
          onDismiss={() => setSelectedInboxItem(null)}
        >

              {selectedInboxItem.kind === 'PAYMENT' ? (
                <View style={[styles.detailMessageCard, { backgroundColor: SURFACE }]}>
                  <ReceiptBody title={selectedInboxItem.title} payment={selectedInboxItem.payment} tone={paymentToneFor(selectedInboxItem)} />
                  {!selectedInboxItem.payment && (
                    <>
                      <Spacer size={10} />
                      <Txt maxFontSizeMultiplier={1.3} style={styles.detailDescText}>{selectedInboxItem.desc}</Txt>
                    </>
                  )}
                </View>
              ) : selectedInboxItem.kind === 'ANNOUNCEMENT' ? (
                <View style={[styles.detailMessageCard, styles.pinnedNoticeCard]}>
                  <Ionicons name="pin" size={16} color={Colors.textMuted} style={styles.pinnedGlyph} />
                  <Txt maxFontSizeMultiplier={1.3} style={styles.detailDescText}>{selectedInboxItem.desc}</Txt>
                </View>
              ) : (
                <View style={styles.detailMessageCard}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.detailDescText}>{selectedInboxItem.desc}</Txt>
                </View>
              )}

              <Spacer size={32} />

              {selectedInboxItem.kind === 'KYC' && selectedInboxItem.guest && (
                <View style={styles.actionBlockBox}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockLabel}>Identity Verification Required</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockDesc}>Verify {selectedInboxItem.guest.name}'s identity documents.</Txt>
                  <Spacer size={16} />
                  <KycDocumentsCard
                    idPhotoUri={selectedInboxItem.guest.idProofPhotoUri}
                    selfieUri={selectedInboxItem.guest.profilePhotoUri}
                    emptyHint="No document photos uploaded yet."
                  />
                  <Spacer size={16} />
                  <Row gap={12}>
                    <AnimatedPress accessibilityRole="button" style={styles.actionApproveBtn} onPress={() => handleApproveKyc(selectedInboxItem)}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Verify</Txt>
                    </AnimatedPress>
                    <AnimatedPress accessibilityRole="button" style={styles.actionRejectBtn} onPress={() => handleRejectKyc(selectedInboxItem)}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.actionRejectText}>Reject</Txt>
                    </AnimatedPress>
                  </Row>
                </View>
              )}

              {selectedInboxItem.kind === 'PAYMENT' && selectedInboxItem.payment && (
                <View style={styles.actionBlockBox}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockLabel}>Payment Awaiting Verification</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockDesc}>Confirm the money actually arrived before verifying.</Txt>
                  <Spacer size={16} />
                  <Row gap={12}>
                    <AnimatedPress accessibilityRole="button" style={styles.actionApproveBtn} onPress={() => handleVerifyPayment(selectedInboxItem)}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Verify</Txt>
                    </AnimatedPress>
                    <AnimatedPress accessibilityRole="button" style={styles.actionRejectBtn} onPress={() => openRejectPayment(selectedInboxItem)}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.actionRejectText}>Reject</Txt>
                    </AnimatedPress>
                  </Row>
                </View>
              )}

              {selectedInboxItem.kind === 'PROCUREMENT' && (
                <View style={styles.actionBlockBox}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockLabel}>Awaiting Your Approval</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockDesc}>Choose a payment method and approve or reject on the Procurement screen.</Txt>
                  <Spacer size={16} />
                  <AnimatedPress accessibilityRole="button" style={styles.actionApproveBtn} onPress={() => handleReviewProcurement(selectedInboxItem)}>
                    <Row gap={8} align="center">
                      <Ionicons name="cart" size={16} color={SURFACE} />
                      <Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Review in Procurement</Txt>
                    </Row>
                  </AnimatedPress>
                </View>
              )}

              {selectedInboxItem.kind === 'REQUEST' && (
                <View style={styles.actionBlockBox}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockLabel}>{selectedInboxItem.isTicket ? 'Resolve this issue' : 'Follow up'}</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.actionBlockDesc}>
                    {canOpenTicket ? 'Open the full ticket for history and photos.' : 'A resolution here needs someone with access to the ticket.'}
                  </Txt>
                  <Spacer size={16} />
                  <Row gap={12}>
                    {canOpenTicket && (
                      <AnimatedPress accessibilityRole="button" style={styles.actionApproveBtn} onPress={() => handleViewTicket(selectedInboxItem)}>
                        <Row gap={8} align="center">
                          <Ionicons name="document-text" size={16} color={SURFACE} />
                          <Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>View Ticket</Txt>
                        </Row>
                      </AnimatedPress>
                    )}
                    {canManage && selectedInboxItem.isTicket && (
                      <AnimatedPress accessibilityRole="button" style={styles.actionRejectBtn} onPress={() => handleBookService(selectedInboxItem)}>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.actionRejectText}>Book Service</Txt>
                      </AnimatedPress>
                    )}
                  </Row>
                </View>
              )}

        </Sheet>
      )}

      {/* ── Reject payment reason ── */}
      {/* Centered, not a bottom sheet: this stopped you mid-decision, and the reason it
          collects cannot live in a native alert because `Alert.prompt` is iOS-only. */}
      <TextPromptDialog
        visible={!!rejectingKyc}
        title="Reject these documents"
        label="Reason"
        placeholder="The ID photo is cropped — please re-upload the full card"
        helper={`${rejectingKyc?.guest?.name ?? 'The resident'} sees this and re-uploads against it`}
        confirmLabel="Reject"
        destructive
        required
        onCancel={() => setRejectingKyc(null)}
        onSave={submitRejectKyc}
      />

      <TextPromptDialog
        visible={!!rejectingPayment}
        title="Reject payment"
        label="Reason"
        placeholder="Amount doesn't match the UTR reference"
        helper="The resident sees this, so say what was actually wrong"
        confirmLabel="Reject payment"
        destructive
        required
        busy={rejectPaymentMutation.isPending}
        onCancel={() => setRejectingPayment(null)}
        onSave={submitRejectPayment}
      />

      <PGowDialog
        visible={!!duplicatePayment}
        title="Could not verify"
        message={duplicatePayment?.message}
        confirmLabel="Reject duplicate"
        cancelLabel="Dismiss"
        tone="destructive"
        busy={rejectPaymentMutation.isPending}
        onConfirm={rejectDuplicatePayment}
        onCancel={() => setDuplicatePayment(null)}
      />

      <PGowDialog
        visible={confirmClearAll}
        title="Clear all notifications?"
        message="Every notification leaves your inbox. Open decisions stay open — they just stop being listed here."
        confirmLabel="Clear all"
        tone="destructive"
        busy={dismissAllMutation.isPending}
        onConfirm={() => { setConfirmClearAll(false); dismissAllMutation.mutate(); }}
        onCancel={() => setConfirmClearAll(false)}
      />

      {/* ── Publish New Notice Dialog ── */}
      {showBroadcastModal && (
        <Sheet
          visible
          title="New announcement"
          subtitle="Everyone you pick gets this on their phone"
          icon="megaphone-outline"
          onDismiss={() => setShowBroadcastModal(false)}
          footer={
            <Row gap={12}>
              <AnimatedPress accessibilityRole="button" style={styles.publishBtn} onPress={handlePublishNotice} disabled={isPublishing}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.publishBtnText}>{isPublishing ? 'Publishing…' : 'Publish'}</Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button" style={styles.publishCancelBtn} onPress={() => setShowBroadcastModal(false)}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.publishCancelText}>Cancel</Txt>
              </AnimatedPress>
            </Row>
          }
        >
                <OutlinedTextField
                  label="Title"
                  required
                  placeholder="Water cut on Tuesday"
                  value={noticeTitle}
                  // Clears the moment they start fixing it, rather than making them submit
                  // again to find out whether it counted.
                  onChangeText={(t) => { setNoticeTitle(t); if (noticeErrors.title) setNoticeErrors((e) => ({ ...e, title: undefined })); }}
                  error={noticeErrors.title}
                />
                <Spacer size={12} />
                <OutlinedTextField
                  label="Message"
                  required
                  multiline
                  placeholder="Supply is off from 10am to 2pm."
                  helper="Everyone you pick below gets this on their phone"
                  value={noticeMessage}
                  onChangeText={(t) => { setNoticeMessage(t); if (noticeErrors.message) setNoticeErrors((e) => ({ ...e, message: undefined })); }}
                  error={noticeErrors.message}
                />
                <Spacer size={16} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Target Audience</Txt>
                <Spacer size={8} />
                <Row gap={8}>
                  {(['all', 'guest', 'staff', 'manager'] as const).map((aud) => (
                    <AnimatedPress accessibilityRole="button" key={aud} style={[styles.smallChip, noticeAudience === aud && styles.smallChipActive]} onPress={() => setNoticeAudience(aud)}>
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.smallChipText, noticeAudience === aud && styles.smallChipTextActive]}>
                        {aud === 'all' ? 'All' : aud === 'guest' ? 'Residents' : aud === 'staff' ? 'Staff' : 'Managers'}
                      </Txt>
                    </AnimatedPress>
                  ))}
                </Row>
        </Sheet>
      )}
    </View>
  );
}

// ── Decision card (X1 "decisions as cards with buttons") ───────────────────────────────────

function DecisionCard({
  item, onPress, onApproveKyc, onRejectKyc, onVerifyPayment, onRejectPayment, onReviewProcurement,
}: {
  item: InboxItem;
  onPress: () => void;
  onApproveKyc: () => void;
  onRejectKyc: () => void;
  onVerifyPayment: () => void;
  onRejectPayment: () => void;
  onReviewProcurement: () => void;
}) {
  // Amber reads as "money or approval waiting" — the same tint C3 tints a nav tab with for
  // the identical reason. KYC gets the cooler brand tint: a document review, not overdue
  // money, and conflating the two would blunt amber's meaning everywhere else it appears.
  const tint = item.kind === 'KYC' ? DeckTints.brand : DeckTints.amber;

  return (
    <Card containerColor={tint.fill} borderColor={tint.fill} padding={16} style={{ marginBottom: 12 }}>
      <AnimatedPress accessibilityRole="button" onPress={onPress}>
        <Row gap={8} align="center">
          <Ionicons name={item.icon} size={16} color={tint.ink} />
          <Txt size={11} weight="700" color={tint.ink} style={{ letterSpacing: 0.4, flex: 1 }}>{item.kind} · NEEDS YOUR DECISION</Txt>
          <Txt size={11} color={tint.sub}>{formatTimeAgo(item.timestamp)}</Txt>
        </Row>
        <Spacer size={8} />
        <Txt size={15} weight="700" color={tint.ink}>{item.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}</Txt>
        <Spacer size={4} />
        <Txt size={12.5} color={tint.sub}>{item.desc}</Txt>
      </AnimatedPress>

      {item.kind === 'KYC' && item.guest && (
        <>
          <Spacer size={12} />
          <KycDocumentsCard idPhotoUri={item.guest.idProofPhotoUri} selfieUri={item.guest.profilePhotoUri} emptyHint="No document photos uploaded yet." />
        </>
      )}

      {item.kind === 'PAYMENT' && item.payment && (
        <>
          <Spacer size={12} />
          <View style={{ backgroundColor: SURFACE, borderRadius: Radii.control, padding: 12 }}>
            <ReceiptBody title="Submitted for review" payment={item.payment} tone={paymentToneFor(item)} />
          </View>
        </>
      )}

      <Spacer size={14} />
      {item.kind === 'KYC' && (
        <Row gap={10}>
          <AnimatedPress accessibilityRole="button" style={styles.cardApproveBtn} onPress={onApproveKyc}><Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Verify</Txt></AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.cardRejectBtn} onPress={onRejectKyc}><Txt maxFontSizeMultiplier={1.3} style={[styles.actionRejectText, { color: Colors.danger }]}>Reject</Txt></AnimatedPress>
        </Row>
      )}
      {item.kind === 'PAYMENT' && (
        <Row gap={10}>
          <AnimatedPress accessibilityRole="button" style={styles.cardApproveBtn} onPress={onVerifyPayment}><Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Verify</Txt></AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.cardRejectBtn} onPress={onRejectPayment}><Txt maxFontSizeMultiplier={1.3} style={[styles.actionRejectText, { color: Colors.danger }]}>Reject</Txt></AnimatedPress>
        </Row>
      )}
      {item.kind === 'PROCUREMENT' && (
        <AnimatedPress accessibilityRole="button" style={styles.cardApproveBtn} onPress={onReviewProcurement}>
          <Row gap={6} align="center" justify="center"><Ionicons name="cart" size={14} color={SURFACE} /><Txt maxFontSizeMultiplier={1.3} style={styles.actionApproveText}>Review in Procurement</Txt></Row>
        </AnimatedPress>
      )}
    </Card>
  );
}

/**
 * The composer button, draggable so it can be moved off whatever it happens to be covering.
 *
 * Was the app's last `PanResponder`, and the only animation left that predated Reanimated. It
 * also had no bounds at all: a fling sent it off-screen with no way back short of restarting
 * the app, because nothing clamped it and nothing persisted it either. It is gesture-handler
 * and Reanimated now — the same stack the chart scrub uses — and it springs back inside the
 * screen on release rather than keeping wherever the finger let go.
 *
 * The position is still deliberately not persisted. Somewhere to put it while reading one long
 * notice is the entire use; remembering that choice forever is a different feature, and one
 * nobody asked for.
 */
const NotificationFAB = ({ onPress }: { onPress: () => void }) => {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const size = useSharedValue({ w: 190, h: 48 });

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const drag = Gesture.Pan()
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((e) => {
      offsetX.value = startX.value + e.translationX;
      offsetY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      // Clamped against the FAB's own measured box rather than a guessed one, so a long label
      // cannot be dragged half off the left edge. Spring, not timing: the finger was driving
      // this a frame ago, and it should decelerate the way the drag did.
      const minX = -(screenW - size.value.w - 20);
      const maxY = insets.bottom + 60;
      const minY = -(screenH - size.value.h - 140);
      offsetX.value = withSpring(Math.min(0, Math.max(minX, offsetX.value)), FAB_SPRING);
      offsetY.value = withSpring(Math.min(maxY, Math.max(minY, offsetY.value)), FAB_SPRING);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        onLayout={(e) => { size.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
        style={[styles.fab, { bottom: Math.max(insets.bottom + 80, 80) }, style]}
      >
        <AnimatedPress accessibilityRole="button" onPress={onPress} style={styles.fabInner}>
          <Ionicons name="megaphone-outline" size={18} color={SURFACE} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.fabText}>New Announcement</Txt>
        </AnimatedPress>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  // Indented to clear the icon tile, so the buttons read as belonging to this row's text.
  rowActions: { marginTop: 10, marginLeft: 48 },
  rowActionsDense: { marginTop: 8, marginLeft: 34 },
  root: { flex: 1, backgroundColor: BG },
  mainScroll: { paddingHorizontal: 20, paddingTop: 12 },

  pinnedStrip: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 14, borderRadius: Radii.control, backgroundColor: DeckTints.amber.fill },

  markAllReadBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, paddingVertical: 4, paddingHorizontal: 4 },
  markAllReadText: { fontSize: 12.5, fontWeight: '700', color: PRIMARY },

  filterScrollContent: { paddingRight: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.sheet, backgroundColor: SURFACE, borderWidth: 1, borderColor: DIVIDER, marginRight: 8 },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  filterChipTextActive: { color: SURFACE },

  listContainer: { backgroundColor: SURFACE, borderRadius: Radii.card, borderWidth: 1, borderColor: DIVIDER, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: SURFACE },
  rowDense: { paddingVertical: 9 },
  divider: { height: 1, backgroundColor: DIVIDER },

  iconTile: { width: 36, height: 36, borderRadius: Radii.control, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  iconTileDense: { width: 22, height: 22, borderRadius: Radii.badge },
  unreadDot: { width: 6, height: 6, borderRadius: Radii.pill, backgroundColor: PRIMARY },

  fab: { position: 'absolute', right: 20, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  fabInner: { height: 48, paddingHorizontal: 16, borderRadius: Radii.sheet, backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 14, fontWeight: '700', color: SURFACE, marginLeft: 8 },




  detailMessageCard: { backgroundColor: '#F9FAFB', padding: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: DIVIDER },
  detailDescText: { fontSize: 15, color: '#374151', lineHeight: 24 },
  pinnedNoticeCard: { backgroundColor: Colors.surfaceMuted, paddingTop: 26 },
  pinnedGlyph: { position: 'absolute', top: 10, left: 16, transform: [{ rotate: '-18deg' }] },

  actionBlockBox: { backgroundColor: SURFACE, borderWidth: 1, borderColor: PRIMARY, borderRadius: Radii.card, padding: 20 },
  actionBlockLabel: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  actionBlockDesc: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  actionApproveBtn: { flex: 1, height: 48, backgroundColor: Colors.success, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' },
  actionApproveText: { fontSize: 15, fontWeight: '700', color: SURFACE },
  actionRejectBtn: { flex: 1, height: 48, backgroundColor: Colors.danger, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' },
  actionRejectText: { fontSize: 15, fontWeight: '700', color: SURFACE },

  cardApproveBtn: { flex: 1, height: 44, backgroundColor: Colors.success, borderRadius: Radii.control, alignItems: 'center', justifyContent: 'center' },
  cardRejectBtn: { flex: 1, height: 44, backgroundColor: SURFACE, borderWidth: 1, borderColor: Colors.danger, borderRadius: Radii.control, alignItems: 'center', justifyContent: 'center' },


  inputLabelStyle: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  smallChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.control, backgroundColor: SURFACE, borderWidth: 1, borderColor: DIVIDER },
  smallChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  smallChipText: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY },
  smallChipTextActive: { color: SURFACE },
  publishBtn: { flex: 2, height: 48, backgroundColor: PRIMARY, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' },
  publishBtnText: { fontSize: 15, fontWeight: '700', color: SURFACE },
  publishCancelBtn: { flex: 1, height: 48, borderWidth: 1, borderColor: DIVIDER, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  publishCancelText: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },

  receiptDivider: { height: 12, justifyContent: 'center', marginVertical: 4 },
  receiptDash: { height: 1, borderWidth: 1, borderColor: DIVIDER, borderStyle: 'dashed' },
  receiptNotch: { position: 'absolute', top: -1, width: 14, height: 14, borderRadius: Radii.pill, backgroundColor: SURFACE, borderWidth: 1, borderColor: DIVIDER },
});
