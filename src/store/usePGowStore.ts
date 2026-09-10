/**
 * PGowViewModel — the app's single view-model.
 *
 * Every screen reads this store, so its shape is the app's UI contract and is deliberately
 * unchanged. What changed is underneath: it used to sit on an AsyncStorage database seeded
 * with demo rows, and now sits on the real API. Requests go out through the domain modules
 * in `features/*`, wrapped in `queryClient.fetchQuery` so React Query owns the cache and any
 * screen that later calls `useQuery` with the same key shares these exact responses instead
 * of fetching a second copy.
 *
 * What the backend still has no endpoint for is called out where it appears rather than
 * quietly faked: daily grocery subscriptions stay in memory, and the demo/simulation actions
 * say so instead of writing invented rows.
 */
import { create } from 'zustand';

import { PGowApiError } from '@/data/apiClient';
import * as map from '@/data/mappers';
import { NotificationHelper } from '@/data/notificationHelper';
import { queryClient } from '@/data/queryClient';
import { hapticCaution, hapticSuccess } from '@/utils/haptics';
import { qk } from '@/data/queryKeys';
import * as authApi from '@/features/auth/useAuth';
import * as kycApi from '@/features/kyc/useKyc';
import * as mealsApi from '@/features/meals/useMeals';
import * as notificationsApi from '@/features/notifications/useNotifications';
import * as paymentsApi from '@/features/payments/usePayments';
import type { PickedLocation } from '@/features/places/pendingLocation';
import * as propertiesApi from '@/features/properties/useProperties';
import * as requestsApi from '@/features/requests/useComplaints';
import * as staffApi from '@/features/staff/useStaff';
import { useAuthStore } from '@/store/authStore';
// Re-exported so `toUserRole` keeps its established import path (SignInScreen and
// others import it from this store); the implementation lives in a module a plain
// `node` check can reach.
import { toUserRole } from '@/store/roles';

export { toUserRole };
import type {
  UserRole,
  PGOwnerEntity,
  GuestEntity,
  StaffMemberEntity,
  MealNotificationEntity,
  GuestRSVPEntity,
  PaymentEntity,
  FeedbackComplaintEntity,
  ExpenseEntity,
  AppRoleNotificationEntity,
  SimulatedAlert } from '@/types';


// ─── Reads ───────────────────────────────────────────────────────────────────



/**
 * Side-notify someone other than the person whose action triggered this — a repair booking
 * telling the owner/manager/maintenance, a KYC submission telling the manager/owner, a KYC
 * decision telling the resident. Silent on failure: this is a courtesy heads-up riding along
 * on an action that already succeeded, not the thing the caller is waiting on. Deliberately
 * does not set `activeAlert` — that is user-facing feedback for the actor's OWN action, and
 * would otherwise show whoever just booked a repair a stray "📢 Announcement Published" toast
 * about a notification meant for someone else.
 */
function notifyRole(
  targetRole: string,
  title: string,
  body: string,
  category: notificationsApi.NotificationCategory
): void {
  const pgId = useAuthStore.getState().activePgId;
  if (!pgId) return;
  // `?? 'all'` used to close this expression. Every caller passes a role constant, so an
  // unmapped value means a bug — and the old fallback turned that bug into a property-wide
  // push. A courtesy heads-up that cannot be addressed correctly is not worth sending to
  // everyone instead.
  const audience = notificationsApi.BROADCAST_AUDIENCE_MAP[targetRole.toUpperCase()];
  if (!audience) {
    console.warn(`[PGow] no broadcast audience mapped for role "${targetRole}" — not sending.`);
    return;
  }
  notificationsApi
    .broadcastNotification({
      pg_id: pgId,
      target_role: audience,
      title,
      body,
      category,
      priority: 'high' })
    .catch((err) => console.warn('[PGow] side notification failed:', err));
}


export interface PGowState {
  activeRole: UserRole | null;

  // ===== Logged-in entities =====
  loggedInOwner: PGOwnerEntity | null;
  loggedInGuest: GuestEntity | null;
  loggedInStaff: StaffMemberEntity | null;
  isManagerMode: boolean;

  // ===== Owner registration form =====
  pgNameInput: string;
  ownerNameInput: string;
  ownerEmailInput: string;
  ownerPhoneInput: string;
  ownerPasswordInput: string;
  ownerAddressInput: string;
  pgTotalBedsInput: string;
  /** Where the owner dropped the pin during signup. The API requires a location to create a
   *  property, and a typed address alone is not one. */
  ownerLocationInput: PickedLocation | null;

  // ===== Guest registration form =====
  /** The password a self-joining resident chooses. Its own field rather than borrowing the
   *  owner's: two different people fill these in, and sharing one would leak whichever was
   *  typed first into the other form. */

  // ===== Staff registration form =====
  staffNameInput: string;
  staffRoleInput: string;
  staffPinInput: string;
  staffPhoneInput: string;
  staffShiftInput: string;
  staffSalaryInput: string;

  // ===== Meal notification form =====
  mealTypeSelected: string;
  menuItemsInput: string;
  chefNoteInput: string;
  serviceTimeInput: string;
  autoScheduleAlert: boolean;
  /** Chef-confirmed dietary tag for the meal about to be broadcast — see broadcast.tsx's
   *  veg/non-veg selector, auto-set from selected dishes but always overridable. */
  mealDietaryTypeSelected: 'veg' | 'non_veg' | 'pure_veg';

  // ===== Active alert / push =====
  activeAlert: SimulatedAlert | null;

  // ===== Chef alarms =====
  chefAlarm9amEnabled: boolean;
  chefAlarm1pmEnabled: boolean;
  chefAlarm330pmEnabled: boolean;
  lastChefAlarmTriggered: string | null;
  auto15MinFollowupEnabled: boolean;
  lastFollowupTimestamp: number;

  // ===== UI / Selected Active Item =====
  activeNotificationId: string | null;
  isQuickActionsExpanded: boolean;

  // ===== Initialization =====
  _initialized: boolean;
  init: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // ===== Setters (form inputs etc.) =====
  set: <K extends keyof PGowState>(key: K, value: PGowState[K]) => void;
  patch: (partial: Partial<PGowState>) => void;

  // ===== Hub services =====
  placePgGroceryOrder: (itemsSummary: string, totalPrice: number, isExpress10Min?: boolean) => void;
  bookPgRepairService: (category: string, issueTitle: string, urgency: string, estimatedCost: number) => void;
  bookGuestLaundryService: (
    guestId: string, guestName: string, roomNo: string, serviceType: string, weightOrCount: string,
    pickupPreference: string, preferredSlot: string, specialNotes: string, totalCost: number, paymentStatus: string,
  ) => void;
  updateLaundryStatus: (laundryId: string, newStatus: string) => void;

  // ===== Meal / time helpers =====
  selectMealType: (meal: string) => void;
  getAlertTriggerTime: (serviceTime: string) => string;
  formatServiceTime12h: (serviceTime: string) => string;
  triggerSimulated2HourAlert: (notification: MealNotificationEntity) => Promise<void>;

  // ===== Chef alarms =====
  triggerChefAlarm: (alarmSlot: string) => Promise<void>;
  /** Schedules the real daily-recurring version of `triggerChefAlarm`'s notification, under
   *  a fixed `identifier` so calling this again (a toggle flipped back on, a tab remount)
   *  replaces the existing schedule instead of stacking a duplicate. */
  scheduleChefAlarm: (identifier: string, alarmSlot: string, hour: number, minute: number) => Promise<void>;
  trigger15MinUnresponsiveFollowup: () => Promise<void>;

  // ===== Multi-PG portfolio =====
  // `location` is required on create and optional on update, mirroring the API: a property
  // nobody can find on a map is not much use to the resident deciding whether to move in,
  // but a PATCH that omits it must keep the existing pin rather than be rejected.
  createPGProperty: (pgName: string, address: string, totalBeds: number, managerName: string, managerPhone: string, managerPin: string, upiId: string, location?: PickedLocation | null) => Promise<{ ok: boolean; error?: string }>;
  updatePGProperty: (pg: PGOwnerEntity, pgName: string, address: string, totalBeds: number, managerName: string, managerPhone: string, managerPin: string, upiId: string, location?: PickedLocation | null) => Promise<{ ok: boolean; error?: string }>;
  switchActivePG: (pg: PGOwnerEntity) => Promise<void>;
  // Self-service joining. No screen drives these yet — the endpoints and the store are
  // ready, so surfacing them is a panel in the property dialog whenever you want it.
  rotateJoinCode: () => Promise<{ ok: boolean; joinCode?: string; error?: string }>;
  disableJoinCode: () => Promise<{ ok: boolean; error?: string }>;
  setDefaultRent: (amount: number) => Promise<{ ok: boolean; error?: string }>;

  // ===== Feedback / complaints =====
  submitFeedbackComplaint: (
    title: string, description: string, category: string, type: string, mediaUri: string | null, isVideo: boolean,
    mealRating: number, cleanlinessRating: number, managerRating: number, staffRating: number, otherRating: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  respondToFeedbackComplaint: (id: string, response: string, newStatus: string) => Promise<{ ok: boolean; error?: string }>;
  deleteFeedbackComplaint: (id: string) => Promise<void>;


  // ===== Guest auth & KYC =====
  submitGuestKyc: (idType: string, idNumber: string, idPhotoUri: string, profilePhotoUri: string) => Promise<{ ok: boolean; error?: string }>;
  updateGuestProfilePhoto: (photoUri: string) => Promise<void>;
  verifyGuestKycByOwner: (guestId: string, approve: boolean, rejectReason?: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Meal notifications & RSVPs =====
  submitRSVP: (notificationId: string, choice: string) => Promise<{ ok: boolean; error?: string }>;
  submitRSVPFromNotification: (notificationId: string, choice: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Misc =====
  logout: () => void;
  setActiveNotificationId: (id: string | null) => Promise<void>;
  dismissAlert: () => void;
}

/** The zustand `persist` names this app owns, cleared on sign-out so the next person on this
 *  device does not inherit the previous one's cart or wishlist. Keep in sync with the
 *  `name:` given to each persisted store. */
const PERSISTED_STORE_KEYS = ['slv-cart', 'slv-wishlist', 'slv-shopping-mode'];

/** Shared by the manual "trigger now" bell and the real daily-scheduled version of the same
 *  alarm, so the two never drift into showing different copy for the same slot. */
function chefAlarmContent(alarmSlot: string): { title: string; msg: string } {
  if (alarmSlot === '9:00 AM') {
    return {
      title: '⏰ 9:00 AM Chef Alarm: Send Lunch Alert! 🍛',
      msg: "Good morning Chef! It's 9:00 AM. Please broadcast today's Lunch Menu plate so residents can RSVP early!" };
  }
  if (alarmSlot === '1:00 PM') {
    return {
      title: '⏰ 1:00 PM Chef Alarm: Send Dinner Alert! 🍲',
      msg: "Good afternoon Chef! It's 1:00 PM. Please broadcast today's Dinner Menu plate so residents can RSVP early!" };
  }
  if (alarmSlot === '3:30 PM') {
    return {
      title: "⏰ 3:30 PM Chef Alarm: Send Tomorrow's Breakfast Alert! 🥞",
      msg: "Hello Chef! It's 3:30 PM. Please broadcast tomorrow morning's Breakfast Menu so residents can RSVP early!" };
  }
  return {
    title: `⏰ Chef Scheduled Alarm (${alarmSlot})`,
    msg: 'Time to send your daily food menu broadcast to PG residents!' };
}

export const usePGowStore = create<PGowState>((set, get) => ({
  activeRole: null,

  loggedInOwner: null,
  loggedInGuest: null,
  loggedInStaff: null,
  isManagerMode: false,

  pgNameInput: '',
  ownerNameInput: '',
  ownerEmailInput: '',
  ownerPhoneInput: '',
  ownerPasswordInput: '',
  ownerAddressInput: '',
  // Empty, not '30'. A prefilled bed count is one the owner accepts without reading, and it
  // drives credit limit, billing, room capacity and the admission cap downstream.
  pgTotalBedsInput: '',
  ownerLocationInput: null,

  staffNameInput: '',
  staffRoleInput: 'Manager',
  staffPinInput: '',
  staffPhoneInput: '',
  staffShiftInput: 'Day Shift (8 AM - 5 PM)',
  // Empty, not '15000'. This is written to the staff member's real `monthly_salary` and
  // then drives salary expenses — a prefilled figure is one nobody consciously stated.
  staffSalaryInput: '',

  mealTypeSelected: 'Breakfast',
  menuItemsInput: '',
  mealDietaryTypeSelected: 'veg',
  chefNoteInput: '',
  serviceTimeInput: '08:30',
  autoScheduleAlert: true,

  activeAlert: null,

  chefAlarm9amEnabled: true,
  chefAlarm1pmEnabled: true,
  chefAlarm330pmEnabled: true,
  lastChefAlarmTriggered: null,
  auto15MinFollowupEnabled: true,
  lastFollowupTimestamp: 0,

  activeNotificationId: null,
  isQuickActionsExpanded: false,

  _initialized: false,

  init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });
    // Tokens are hydrated by the root layout before this runs. No token means no session to
    // restore, and the (auth) route group's Stack.Protected guard is already showing Welcome.
    if (!useAuthStore.getState().accessToken) return;
    try {
      const user = await authApi.fetchMe();
      useAuthStore.getState().setUser(user);
      const role = toUserRole(useAuthStore.getState().activeRole);
      // Navigation reacts to activeRole/isManagerMode on its own now (see app/_layout.tsx's
      // Stack.Protected guards) — no screen/stack to set here anymore.
      set({
        activeRole: role,
        isManagerMode: role === 'MANAGER' });
      await get().refreshAll();
    } catch {
      // An unusable stored token: the client already cleared it on a refused refresh, so
      // there is nothing to do but stay on WELCOME.
    }
  },

  refreshAll: async () => {
    const { user, activePgId, activeRole } = useAuthStore.getState();
    if (!user) return;

    await queryClient.invalidateQueries();

    if (!activePgId) return;
    const mem = user.memberships.find((m) => m.pg_id === activePgId);
    if (!mem) return;

    if (activeRole === 'guest') {
      // NOT `guestsApi.getGuest(...)`. That endpoint is owner/manager-only — verified against
      // production: a resident reading their OWN membership gets 403 "Only the owner or a
      // manager may do this." So calling it here fired a guaranteed-failing request on every
      // refresh and always fell through to this path anyway.
      //
      // Everything the resident's own screens need is readable by the resident:
      //   • name / room            → /v1/me (already in hand)
      //   • rent amount / is_paid  → /v1/payments/due
      //   • KYC status             → /v1/me's `gate`, which IS the authoritative answer.
      //     `guest_access_state` (pg-backend deps/gates.py) returns the KYC states strictly
      //     BEFORE it ever returns RENT_UNPAID, so a gate of RENT_UNPAID or null proves KYC
      //     is verified. This is derivation from the source of truth, not a guess.
      const rentDue = await paymentsApi.getRentDue(mem.pg_id).catch(() => null);
      {
        const kycFromGate: Record<string, string> = {
          KYC_REQUIRED: 'NOT_SUBMITTED',
          KYC_PENDING: 'PENDING',
          KYC_REJECTED: 'REJECTED' };
        set({
          loggedInGuest: {
            id: mem.membership_id,
            pgId: mem.pg_id,
            name: user.name,
            email: user.email ?? '',
            phone: user.phone,
            roomNo: mem.room_no ?? '',
            password: '',
            registrationDate: 0,
            isBillPaid: rentDue?.is_paid ?? false,
            rentAmount: rentDue ? map.toAmount(rentDue.rent_amount) : 0,
            rewardPoints: 0,
            idProofType: '',
            idProofNumber: '',
            idProofPhotoUri: '',
            profilePhotoUri: user.avatar_url ?? '',
            kycStatus: (user.gate && kycFromGate[user.gate] ? kycFromGate[user.gate] : 'VERIFIED') as GuestEntity['kycStatus'],
            kycRejectReason: '',
            kycSubmissionDate: 0,
            kycVerificationDate: 0 } });
      }
      return;
    }

    if (activeRole && ['manager', 'chef', 'kitchen_staff', 'maintenance', 'delivery_agent'].includes(activeRole)) {
      const staff = await staffApi.getStaff(mem.membership_id).catch(() => null);
      if (staff) set({ loggedInStaff: map.toStaff(staff) });
    }
  },

  // Navigation lives in Expo Router now (see app/_layout.tsx's Stack.Protected guards and
  // each screen's own router.push/router.back calls) — this store no longer owns any of it.

  set: (key, value) => set({ [key]: value } as any),
  patch: (partial) => set(partial as any),

  // ── Hub services ──────────────────────────────────────────────────────────
  // Grocery, laundry and repairs are `requests` with a `kind`. The rider, the ETA, the
  // pickup slot and the technician's rating ride in the `details` JSONB, so none of them
  // needed a column that the other four kinds would leave null.
  //
  // Every booking below is optimistic: the row goes into local state immediately so the
  // sheet can close, and `refreshAll` replaces it with what the server actually stored.

  placePgGroceryOrder: (itemsSummary, totalPrice, isExpress10Min = true) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    requestsApi
      .submitComplaint({
        pg_id: pgId,
        kind: 'grocery',
        title: itemsSummary,
        description: 'Grocery order placed from the hub.',
        // `express` is the server's own word for urgent, so the 10-minute option is a
        // priority rather than another detail field.
        priority: isExpress10Min ? 'express' : 'normal',
        amount: totalPrice,
        details: { eta_minutes: isExpress10Min ? 10 : 45 } })
      .then(() => get().refreshAll())
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ ORDER NOT PLACED',
            description: err instanceof Error ? err.message : 'The order was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now() } });
      });
  },

  bookPgRepairService: (category, issueTitle, urgency, estimatedCost) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    requestsApi
      .submitComplaint({
        pg_id: pgId,
        kind: 'repair',
        category,
        title: issueTitle,
        description: `${category} — ${urgency}`,
        priority: urgency.includes('15') ? 'express' : 'normal',
        amount: estimatedCost,
        // No technician is named here: assigning one is the owner's action on the ticket,
        // and inventing a name at booking time would put a stranger's details on screen.
        details: { urgency, eta_minutes: urgency.includes('15') ? 12 : 45 } })
      .then(() => {
        const msg = `${category} - ${issueTitle} has been booked.`;
        notifyRole('OWNER', '🔧 Repair Service Booked', msg, 'complaint');
        notifyRole('MANAGER', '🔧 Repair Service Booked', msg, 'complaint');
        notifyRole('MAINTENANCE', '🔧 Repair Service Booked', msg, 'complaint');
        get().refreshAll();
      })
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ REPAIR NOT BOOKED',
            description: err instanceof Error ? err.message : 'The booking was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now() } });
      });
  },

  bookGuestLaundryService: (
    _guestId, _guestName, _roomNo, serviceType, weightOrCount,
    pickupPreference, preferredSlot, specialNotes, totalCost, paymentStatus,
  ) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    // The resident's name, id and room are not sent: the server takes them from whoever is
    // authenticated, which is the only version that cannot be spoofed by a client.
    requestsApi
      .submitComplaint({
        pg_id: pgId,
        kind: 'laundry',
        title: `${serviceType} — ${weightOrCount}`,
        description: specialNotes || 'No special instructions.',
        amount: totalCost,
        details: {
          service_type: serviceType,
          weight_or_count: weightOrCount,
          pickup_preference: pickupPreference,
          preferred_slot: preferredSlot,
          payment_status: paymentStatus } })
      .then(() => get().refreshAll())
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ PICKUP NOT SCHEDULED',
            description: err instanceof Error ? err.message : 'The booking was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now() } });
      });
  },

  /** Moves the ticket, rather than relabelling a local row. */
  updateLaundryStatus: (laundryId, newStatus) => {
    const target = map.hubStatusToServer('laundry', newStatus);
    const move =
      target === 'resolved'
        ? requestsApi.resolveComplaint(laundryId, newStatus)
        : target === 'cancelled'
          ? requestsApi.cancelComplaint(laundryId, newStatus)
          : requestsApi.addComment(laundryId, `Status: ${newStatus}`, target);
    move.then(() => get().refreshAll()).catch((err) => {
      console.warn('[PGow] could not update laundry status:', err);
    });
  },

  // Daily grocery subscriptions moved to the real backend — `/v1/supply/subscriptions`,
  // consumed via features/subscriptions/useSubscriptions.ts (React Query, not this store),
  // the same split every other server-backed list in this app already draws.

  selectMealType: (meal) => {
    const timeMap: Record<string, string> = {
      Breakfast: '08:30', Lunch: '13:30', Dinner: '20:30' };
    set({ mealTypeSelected: meal, serviceTimeInput: timeMap[meal] ?? '13:00' });
  },

  getAlertTriggerTime: (serviceTime) => {
    try {
      const parts = serviceTime.split(':');
      if (parts.length === 2) {
        let hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        hour = (hour - 2 + 24) % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
      }
    } catch (e) { /* fall through */ }
    return '2 hours before service';
  },

  formatServiceTime12h: (serviceTime) => {
    try {
      const parts = serviceTime.split(':');
      if (parts.length === 2) {
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
      }
    } catch (e) { /* fall through */ }
    return serviceTime;
  },

  /** The real "tell everyone about this meal" action: a broadcast, which is what actually
   *  fans out to residents' devices. The local banner stays as immediate feedback. */
  triggerSimulated2HourAlert: async (notification) => {
    try {
      await mealsApi.broadcastMeal(notification.id, { kind: 'announce' });
    } catch (err) {
      console.warn('[PGow] meal broadcast failed:', err);
    }
    set({
      activeAlert: {
        title: '⏰ RSVP REMINDER: 2h Until Service!',
        description: `Meal: ${notification.mealType} at ${get().formatServiceTime12h(notification.serviceTime)}\nMenu: ${notification.menuItems}\n\nPlease submit your RSVP now to avoid food wastage!`,
        type: 'MEAL', notificationId: notification.id, timestamp: Date.now() } });
    await NotificationHelper.showRsvpNotification(notification, get().loggedInGuest?.id ?? '');
    await get().refreshAll();
  },

  // Local reminders for the chef's own phone — a scheduled nudge to go and broadcast, not
  // something anyone else receives. No server involvement by design.
  triggerChefAlarm: async (alarmSlot) => {
    const { title, msg } = chefAlarmContent(alarmSlot);
    set({
      lastChefAlarmTriggered: `${alarmSlot} triggered at ${Date.now()}`,
      activeAlert: { title, description: msg, type: 'MEAL', timestamp: Date.now() } });
    await NotificationHelper.showFoodAnnouncementNotification(title, msg);
  },

  scheduleChefAlarm: async (identifier, alarmSlot, hour, minute) => {
    const { title, msg } = chefAlarmContent(alarmSlot);
    await NotificationHelper.scheduleDailyReminder(identifier, hour, minute, title, msg);
  },

  /**
   * Re-broadcast the open meal as a menu update, which is the one server action that reaches
   * residents who have not answered. Who has and has not answered is deliberately not
   * computed here: the API exposes only counts, so a per-resident list would be invented.
   */
  trigger15MinUnresponsiveFollowup: async () => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    try {
      const meals = await mealsApi.listMeals(pgId, { limit: 1 });
      const activeMeal = meals.items[0];
      if (!activeMeal) return;
      await mealsApi.broadcastMeal(activeMeal.id, { kind: 'menu_update' });
      set({
        activeAlert: {
          title: '🚨 15-Min RSVP Follow-Up Sent',
          description: `Chef is preparing ${activeMeal.meal_type} (${activeMeal.menu_items}). Residents who have not answered have been reminded to respond EATING or SKIPPING.`,
          type: 'MEAL', notificationId: activeMeal.id, timestamp: Date.now() },
        lastFollowupTimestamp: Date.now() });
      await get().refreshAll();
    } catch (err) {
      console.warn('[PGow] follow-up broadcast failed:', err);
    }
  },

  // ── Inbox ─────────────────────────────────────────────────────────────────
  // Broadcast/mark-read/mark-all-read/dismiss moved to useBroadcastNotificationMutation/
  // useMarkNotificationReadMutation/useMarkAllNotificationsReadMutation/
  // useDismissNotificationMutation in useNotifications.ts, called directly from
  // OwnerAnnouncementsTab and kitchen.tsx.

  // ── Expenses ──────────────────────────────────────────────────────────────
  // Log/reverse moved to useLogExpenseMutation/useReverseExpenseMutation in useExpenses.ts,
  // called directly from OwnerPaymentsTab.

  // ── Portfolio ─────────────────────────────────────────────────────────────

  createPGProperty: async (pgName, address, totalBeds, managerName, managerPhone, managerPin, upiId, location) => {
    // The backend requires a real name and a real location (place_id or lat/lng) to create a
    // property — surfacing that here as a validation error is the honest failure; silently
    // substituting a fake name or a fake Bangalore pin would create a real, permanent property
    // record with fabricated data instead.
    if (!pgName.trim()) {
      return { ok: false, error: 'Enter a property name.' };
    }
    if (!location) {
      return { ok: false, error: 'Pick the property’s location on the map before creating it.' };
    }

    try {
      const pg = await propertiesApi.createProperty({
        name: pgName.trim(),
        total_beds: totalBeds > 0 ? totalBeds : 30,
        address: address.trim() || undefined,
        latitude: location.latitude,
        longitude: location.longitude });

      if (managerName.trim() && managerPhone.trim()) {
        try {
          await staffApi.addStaff(pg.id, {
            name: managerName.trim(),
            phone: map.toE164(managerPhone),
            role: 'manager',
            pin: /^\d{4}$/.test(managerPin.trim()) ? managerPin.trim() : undefined });
        } catch (err) {
          console.warn('[PGow] property created but manager was not:', err);
        }
      }
      if (upiId.trim()) {
        try {
          await propertiesApi.addUpiId(pg.id, upiId.trim());
        } catch (err) {
          console.warn('[PGow] property created but UPI id was not:', err);
        }
      }

      useAuthStore.getState().setUser(await authApi.fetchMe());
      await useAuthStore.getState().setActivePgId(pg.id);
      // Screens on `usePropertiesQuery`/`usePropertiesEntitiesQuery` (both keyed under
      // `qk.properties.list()`) would otherwise keep showing the pre-creation list until
      // something unrelated happened to refetch it — `refreshAll()` only repopulates this
      // store's own mirrors, never the React Query cache these hooks actually read from.
      queryClient.invalidateQueries({ queryKey: qk.properties.list() });
      queryClient.invalidateQueries({ queryKey: qk.properties.all() });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      // Report the real failure rather than faking success with a property that only exists
      // in local state — the owner would otherwise believe they have a working listing with a
      // real UPI ID and PIN that the server has never heard of.
      return { ok: false, error: err instanceof Error ? err.message : 'Could not create the property.' };
    }
  },

  updatePGProperty: async (pg, pgName, address, totalBeds, _managerName, _managerPhone, _managerPin, upiId, location) => {
    try {
      await propertiesApi.updateProperty(pg.id, {
        name: pgName.trim() || pg.pgName,
        address: address.trim() || pg.address,
        total_beds: totalBeds > 0 ? totalBeds : pg.totalBeds,
        // Omitted when the owner did not touch the map, so the existing pin survives a
        // rename — sending the old values back would be a no-op write that still costs a
        // re-geocode and a fresh static-map fetch server-side.
        ...(location
          ? { latitude: location.latitude, longitude: location.longitude }
          : {}) });
      // Changing the UPI account adds a new one and makes it active; the old row stays for
      // the payment history that already references it.
      const vpa = upiId.trim();
      if (vpa && vpa !== pg.upiId) {
        const added = await propertiesApi.addUpiId(pg.id, vpa);
        await propertiesApi.activateUpiId(pg.id, added.id);
      }
      queryClient.invalidateQueries({ queryKey: qk.properties.list() });
      queryClient.invalidateQueries({ queryKey: qk.properties.detail(pg.id) });
      queryClient.invalidateQueries({ queryKey: qk.properties.all() });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not update the property.' };
    }
  },

  switchActivePG: async (pg) => {
    await useAuthStore.getState().setActivePgId(pg.id);
    set({ loggedInOwner: pg });
    await get().refreshAll();
  },

  /**
   * Mint a fresh lobby code, replacing any existing one.
   *
   * Rotation is revocation: a property has exactly one code, so issuing a new one kills every
   * printed copy of the old. Residents already joined keep their tenancy.
   */
  rotateJoinCode: async () => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    try {
      const { join_code } = await propertiesApi.rotateJoinCode(pgId);
      await get().refreshAll();
      return { ok: true, joinCode: join_code };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not create a code.' };
    }
  },

  disableJoinCode: async () => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    try {
      await propertiesApi.disableJoinCode(pgId);
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not turn self-join off.' };
    }
  },

  /** What a resident who joins with the code is put on. Self-join is refused until this is
   *  set, because rent is the owner's number and never the joiner's. */
  setDefaultRent: async (amount) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!(amount > 0)) return { ok: false, error: 'Rent must be greater than zero.' };
    try {
      await propertiesApi.updateProperty(pgId, { default_rent_amount: amount });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not save the rent.' };
    }
  },


  // ── Complaints & feedback ─────────────────────────────────────────────────

  submitFeedbackComplaint: async (
    title, description, category, type, mediaUri, isVideo,
    mealRating, cleanlinessRating, managerRating, staffRating, otherRating,
  ) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    try {
      // The five scores the feedback form collects used to stop here: this action took them
      // as parameters and then never referenced them, so a resident rated their meals, room,
      // manager and staff and none of it left the device — while `toComplaint` filled the
      // same fields back in as 0, making the owner's Reviews tab permanently empty.
      //
      // `pg_reviews` exists in the database but has no router yet, so there is no ratings
      // endpoint to post to. `details` is the request API's own documented extension point
      // for exactly this ("free-form on purpose", see CreateRequestRequest), it round-trips
      // through RequestResponse.details, and it is where toComplaint now reads them from.
      // Move these to the real endpoint when /v1/reviews lands.
      const ratings =
        type === 'FEEDBACK'
          ? {
              meal_rating: mealRating,
              cleanliness_rating: cleanlinessRating,
              manager_rating: managerRating,
              staff_rating: staffRating,
              other_rating: otherRating }
          : {};
      const created = await requestsApi.submitComplaint({
        pg_id: pgId,
        kind: type === 'FEEDBACK' ? 'feedback' : 'complaint',
        category: category || undefined,
        title,
        description,
        details: ratings });
      if (mediaUri) {
        // Best effort: a ticket that exists without its photo is far better than one the
        // resident believes they filed and did not.
        try {
          const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
          const { upload_url, object_key } = await requestsApi.getAttachmentUploadUrl(created.id, contentType);
          await requestsApi.uploadAttachment(upload_url, mediaUri, contentType);
          await requestsApi.addAttachment(created.id, { object_key, content_type: contentType });
        } catch (err) {
          console.warn('[PGow] complaint filed but attachment failed:', err);
        }
      }

      // Owner, manager (and maintenance, for a repair/maintenance category) are ALREADY
      // notified server-side — `create_request` in pg-backend calls `notify()` for exactly
      // this ticket, with a real push, the correct `action_id` pointing at it, and the same
      // role targeting this used to redo by hand. The manual `sendRoleNotification` calls
      // that were here fired a SECOND, generic broadcast for every single complaint — every
      // owner and manager got two pushes for one ticket, and the hand-rolled one carried no
      // action_id, so tapping it could not deep-link to the ticket at all.
      if (get().activeRole === 'GUEST') {
        set({
          activeAlert: {
            title: '✅ Issue Reported',
            description: 'Your property manager has been notified.',
            type: 'SUCCESS',
            timestamp: Date.now() } });
      }

      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not submit.' };
    }
  },

  respondToFeedbackComplaint: async (id, response, newStatus) => {
    try {
      if (newStatus === 'Resolved') {
        await requestsApi.resolveComplaint(id, response);
      } else {
        await requestsApi.addComment(id, response, newStatus === 'In Progress' ? 'in_progress' : undefined);
      }
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not respond.' };
    }
  },

  /** Cancel, not delete: a request is an audit trail with events and attachments hanging off
   *  it, and the API offers no way to erase one. Rethrows on failure (e.g. the server's
   *  "already closed" conflict) instead of swallowing it — the caller shows the real error. */
  deleteFeedbackComplaint: async (id) => {
    await requestsApi.cancelComplaint(id);
    await get().refreshAll();
  },


  // ── Owner auth ────────────────────────────────────────────────────────────
  // Login/register/password-change moved to React Query hooks in useAuth.ts, called
  // directly from SignInScreen/OwnerRegisterScreen — see useTokenLanding there for
  // what replaces the token/role bookkeeping that used to live in this store.
  // Staff add/update/remove moved to useAddStaffMutation/useUpdateStaffMutation/
  // useRemoveStaffMutation in useStaff.ts, called directly from StaffManagementTab.

  // ── Guest auth & KYC ──────────────────────────────────────────────────────
  // Join/login/password-change/reset moved to React Query hooks (useJoinPgMutation in
  // useGuests.ts, useLogin/useChangePassword/useRequestPasswordResetMutation/
  // useConfirmPasswordResetMutation in useAuth.ts), called directly from
  // SignInScreen/GuestSecurityTab/app/(auth)/reset-password.tsx.

  submitGuestKyc: async (idType, idNumber, idPhotoUri, profilePhotoUri) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!idNumber.trim()) return { ok: false, error: 'Please enter your ID document number.' };
    if (!idPhotoUri || !profilePhotoUri) {
      return { ok: false, error: 'Both an ID photo and a selfie are required.' };
    }
    const kycKindMap: Record<string, string> = {
      'Aadhaar Card': 'aadhaar',
      'PAN Card': 'pan',
      'Passport': 'passport',
      'Driving License': 'dl',
      'Voter ID': 'voter_id' };
    try {
      const mappedKind = kycKindMap[idType] || 'aadhaar';
      // The photos go straight to storage on presigned URLs; only the object keys reach us.
      const upload = async (kind: string, uri: string) => {
        const { upload_url, object_key } = await kycApi.getUploadUrl(kind, 'image/jpeg');
        await kycApi.uploadToPresignedUrl(upload_url, uri, 'image/jpeg');
        return object_key;
      };
      const [front, selfie] = await Promise.all([
        upload(mappedKind, idPhotoUri),
        upload('selfie', profilePhotoUri),
      ]);
      // `aadhaar_last4` used to be sent unconditionally as `idNumber.trim().slice(-4)`.
      // The server rejects that outright for anything but an Aadhaar —
      // `_last4_only_for_aadhaar` in kyc/schemas.py — so choosing PAN, Passport, Driving
      // License or Voter ID produced a guaranteed 422, surfaced to the resident as the
      // opaque "Request validation failed."
      //
      // The rule is two-sided, and the DB half is stricter than the Pydantic half:
      // `user_documents_last4_only_for_aadhaar` requires last4 to MATCH ^[0-9]{4}$ when the
      // kind is aadhaar — null is not allowed there either. Pydantic would happily accept a
      // null and let the insert fail as a 500, so an Aadhaar whose digits we cannot read has
      // to be refused here, before the request goes out, with something the resident can act
      // on.
      const last4 = idNumber.trim().replace(/\D/g, '').slice(-4);
      if (mappedKind === 'aadhaar' && !/^[0-9]{4}$/.test(last4)) {
        return {
          ok: false,
          error: 'Enter your 12-digit Aadhaar number — the last four digits are recorded with your documents.' };
      }
      const aadhaarLast4 = mappedKind === 'aadhaar' ? last4 : undefined;
      await kycApi.submitKyc({
        pg_id: pgId,
        kind: mappedKind,
        front_object_key: front,
        // This form captures one document photo; the server wants both faces, so the same
        // image stands in for the back rather than blocking submission on a field the UI
        // never asked for.
        back_object_key: front,
        selfie_object_key: selfie,
        ...(aadhaarLast4 ? { aadhaar_last4: aadhaarLast4 } : {}) });
      queryClient.invalidateQueries({ queryKey: qk.kyc.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.session() });
      const currentGuest = get().loggedInGuest;
      if (currentGuest) {
        set({
          loggedInGuest: {
            ...currentGuest,
            kycStatus: 'PENDING',
            kycRejectReason: '' } });
      }
      useAuthStore.getState().setUser(await authApi.fetchMe(), 'guest');
      
      // Dispatch notification to Manager & Owner
      const guestName = get().loggedInGuest?.name || 'Resident';
      const guestRoom = get().loggedInGuest?.roomNo || 'N/A';
      notifyRole(
        'MANAGER',
        '📄 New KYC Verification Request',
        `${guestName} (Room ${guestRoom}) uploaded identity documents. Please review and verify.`,
        'kyc',
      );
      notifyRole(
        'OWNER',
        '📄 New KYC Verification Request',
        `${guestName} (Room ${guestRoom}) uploaded identity documents. Please review and verify.`,
        'kyc',
      );

      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      // The server self-disables document upload when `KYC_BUCKET` is unset (s3.configured()
      // in pg-backend), answering 503 DEPENDENCY_UNAVAILABLE. That is a deployment setting,
      // not something the resident did or can retry their way out of — telling them to "try
      // again" sends them round the same loop forever. Say who can actually fix it.
      if (err instanceof PGowApiError && err.code === 'DEPENDENCY_UNAVAILABLE') {
        return {
          ok: false,
          error:
            'Document upload is not switched on for this property yet. Nothing is wrong with your photos — please tell your property manager, and try again once they confirm it is set up.' };
      }
      // uploadToPresignedUrl throws plain Error (not PGowApiError) for a failed S3 PUT or a
      // missing photo — those messages are the actual diagnostic ("Upload failed: 403 — …"),
      // so narrowing to PGowApiError here was discarding them in favor of a useless generic
      // string. Any Error's .message is real; only a non-Error throw falls back.
      return { ok: false, error: err instanceof Error ? err.message : 'Could not submit KYC.' };
    }
  },

  /**
   * Set the caller's profile photo.
   *
   * Two steps, like KYC: the picked image goes straight to storage on a presigned URL and
   * never passes through our server, then `PATCH /v1/me` records the key. Distinct from the
   * KYC selfie, which is evidence for a verification decision rather than a picture somebody
   * chose.
   */
  updateGuestProfilePhoto: async (photoUri) => {
    const guest = get().loggedInGuest;
    // Optimistic: the picture appears immediately and is corrected by the refresh below if
    // the upload fails. A profile photo is not worth a spinner.
    if (guest) set({ loggedInGuest: { ...guest, profilePhotoUri: photoUri } });
    try {
      const { upload_url, object_key } = await authApi.avatarUploadUrl('image/jpeg');
      await kycApi.uploadToPresignedUrl(upload_url, photoUri, 'image/jpeg');
      const user = await authApi.updateMe({ avatar_object_key: object_key });
      useAuthStore.getState().setUser(user);
      if (guest) {
        set({ loggedInGuest: { ...guest, profilePhotoUri: user.avatar_url ?? photoUri } });
      }
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ PHOTO NOT SAVED',
          description: err instanceof Error ? err.message : 'The photo could not be uploaded.',
          type: 'ANNOUNCEMENT', timestamp: Date.now() } });
      await get().refreshAll();
    }
  },

  verifyGuestKycByOwner: async (guestId, approve, rejectReason = '') => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    try {
      const pending = await kycApi.listPending(pgId);
      const record = pending.items.find((k) => k.membership_id === guestId);
      // `if (record) { ... }` with no else used to fall straight through to `return {ok:true}`
      // — so pressing Verify on a resident with nothing pending reported success AND pushed
      // them a "🎉 KYC Verification Approved" notification, while the server was never
      // asked to do anything and their status never changed.
      if (!record) {
        return {
          ok: false,
          error: 'There is no KYC submission awaiting review for this resident. Ask them to upload their documents first.' };
      }
      if (approve) {
        await kycApi.verifyKyc(record.id);
        hapticSuccess();
      } else {
        await kycApi.rejectKyc(record.id, rejectReason || 'Document or selfie photo unreadable.');
        hapticCaution();
      }
      queryClient.invalidateQueries({ queryKey: qk.kyc.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.guests.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.session() });

      // Dispatch notification to Resident
      notifyRole(
        'RESIDENT',
        approve ? '🎉 KYC Verification Approved' : '⚠️ KYC Verification Rejected',
        approve
          ? 'Your KYC documents have been verified by your PG Manager. You now have full dashboard access!'
          : `Your KYC documents were rejected: ${rejectReason || 'Please re-upload clear photos'}.`,
        'kyc',
      );

      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not record the decision.' };
    }
  },

  // Add/update/remove-resident moved to useAddGuestMutation/useUpdateGuestMutation/
  // useRemoveGuestMutation in useGuests.ts, called directly from OwnerGuestsManagementTab.


  // ── Staff / manager sign-in ───────────────────────────────────────────────
  // Moved to usePinLogin() in useAuth.ts, called directly from SignInScreen — the
  // same endpoint for both, since the server decides from the membership whether this
  // person is a manager.

  // ── Meals & responses ─────────────────────────────────────────────────────
  // Create/update/broadcast moved to useCreateMealMutation/useUpdateMealMutation/
  // useBroadcastMealMutation in useMeals.ts, composed directly in broadcast.tsx.

  submitRSVP: async (notificationId, choice) => {
    try {
      await mealsApi.submitResponse(notificationId, choice === 'REQUIRED' ? 'eating' : 'skipping');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your answer was not saved. Try again.';
      set({
        activeAlert: {
          title: '❌ RSVP NOT RECORDED',
          description: message,
          type: 'MEAL', notificationId, timestamp: Date.now() } });
      return { ok: false, error: message };
    }
    await get().refreshAll();
    return { ok: true };
  },

  submitRSVPFromNotification: async (notificationId, choice) => {
    return get().submitRSVP(notificationId, choice);
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  // Submit/verify/reject/remind moved to useSubmitPaymentMutation/useVerifyPaymentMutation/
  // useRejectPaymentMutation/useSendRentRemindersMutation in usePayments.ts, called directly
  // from GuestPaymentsTab/OwnerPaymentsTab/overview.tsx.
  //
  // No owner-side "record cash payment for a resident" action: `POST /v1/payments` resolves
  // whose payment it is from the caller's own guest membership (payment/service.py's
  // `submit_payment`), with no field to name a different resident — an owner calling it 404s
  // every time. The real path is two-sided: the resident submits with method=cash, the owner
  // verifies it (both already wired, in GuestPaymentsTab and OwnerPaymentsTab's Pending tab).

  logout: () => {
    // Fire and forget: the local session is cleared either way, and nobody should be held on
    // a dashboard waiting for a network round trip to sign out.
    authApi.logoutEverywhere().catch(() => {});
    queryClient.clear();
    // The (auth) route group's guard is `!accessToken` (see app/_layout.tsx) — without
    // clearing it here too, this action used to rely entirely on `currentScreen` to look
    // like a sign-out while the real session token sat untouched in authStore/SecureStore.
    useAuthStore.getState().logout();
    // Named keys, not AsyncStorage.clear(). `clear()` empties the whole app-wide bucket —
    // every other library's data along with ours — for what only needs to be this app's own
    // persisted zustand slices.
    import('@react-native-async-storage/async-storage')
      .then((m) => m.default.multiRemove(PERSISTED_STORE_KEYS).catch(() => {}))
      .catch(() => {});
    set({
      loggedInOwner: null, loggedInGuest: null, loggedInStaff: null,
      activeRole: null, isManagerMode: false,
      activeNotificationId: null,
      _initialized: false });
  },

  /** Selecting a different meal changes which roster the server is being asked for, so this
   *  refetches rather than filtering what is already in memory. */
  setActiveNotificationId: async (id) => {
    set({ activeNotificationId: id });
    await get().refreshAll();
  },

  dismissAlert: () => set({ activeAlert: null }) }));
