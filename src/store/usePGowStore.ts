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
import { qk } from '@/data/queryKeys';
import * as authApi from '@/features/auth/useAuth';
import * as expensesApi from '@/features/expenses/useExpenses';
import * as guestsApi from '@/features/guests/useGuests';
import * as kycApi from '@/features/kyc/useKyc';
import * as mealsApi from '@/features/meals/useMeals';
import * as notificationsApi from '@/features/notifications/useNotifications';
import * as paymentsApi from '@/features/payments/usePayments';
import type { PickedLocation } from '@/features/places/pendingLocation';
import * as propertiesApi from '@/features/properties/useProperties';
import * as requestsApi from '@/features/requests/useComplaints';
import * as rewardsApi from '@/features/rewards/useRewards';
import * as staffApi from '@/features/staff/useStaff';
import { useAuthStore, type Membership } from '@/store/authStore';
import { parseTime } from '@/utils/format';
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
  SimulatedAlert,
  PGGroceryOrder,
  PGDailyGrocerySubscription,
  PGRepairServiceRequest,
  GuestLaundryRequest,
} from '@/types';

/** Ids for the rows that never reach a server — hub services, local expenses. Prefixed so a
 *  locally-invented id can never be mistaken for one the backend issued. */
const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * One read, through the React Query cache.
 *
 * `staleTime: 0` because every caller is an explicit refresh — after a mutation, on init, on
 * a property switch — and each of those exists precisely because the previous answer is now
 * wrong. Screens that later call `useQuery` on the same key still get the cached response.
 */
function cachedFetch<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>): Promise<T> {
  return queryClient.fetchQuery({ queryKey: [...queryKey], queryFn, staleTime: 0 });
}

/**
 * A list the signed-in role may simply not be allowed to read.
 *
 * A guest calling the staff roster gets a 403, and that is the correct answer to their
 * question, not a failure — so it yields an empty list silently. Anything else is a genuine
 * problem and gets logged; it still yields empty, because `refreshAll` populates a dashboard
 * and one unavailable section must not blank out the other eight.
 */
async function safeList<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (err) {
    if (!(err instanceof PGowApiError && (err.httpStatus === 403 || err.httpStatus === 404))) {
      console.warn(`[PGow] could not load ${label}:`, err);
    }
    return [];
  }
}

/** Backend membership role → the four roles this UI knows about. */
function toUserRole(role: Membership['role'] | null): UserRole | null {
  if (!role) return null;
  if (role === 'owner') return 'OWNER';
  if (role === 'manager') return 'MANAGER';
  if (role === 'guest') return 'GUEST';
  if (role === 'chef') return 'CHEF';
  return 'STAFF';
}

/** ADR-004's gate is the resident's own KYC state, which is the one piece of KYC a guest can
 *  read about themselves — `/v1/kyc/pending` is owner-only. */
function kycStatusFromGate(gate: string | null): string {
  if (gate === 'KYC_REQUIRED') return 'NOT_SUBMITTED';
  if (gate === 'KYC_PENDING') return 'PENDING';
  if (gate === 'KYC_REJECTED') return 'REJECTED';
  return 'VERIFIED';
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
  guestNameInput: string;
  guestEmailInput: string;
  guestPhoneInput: string;
  guestRoomInput: string;
  guestScanCodeInput: string;
  /** The password a self-joining resident chooses. Its own field rather than borrowing the
   *  owner's: two different people fill these in, and sharing one would leak whichever was
   *  typed first into the other form. */
  guestPasswordInput: string;

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

  // ===== Hub services state =====
  pgGroceryOrdersState: PGGroceryOrder[];
  pgDailySubscriptionsState: PGDailyGrocerySubscription[];
  pgRepairRequestsState: PGRepairServiceRequest[];
  guestLaundryRequestsState: GuestLaundryRequest[];

  // ===== Active alert / push =====
  activeAlert: SimulatedAlert | null;

  // ===== Financial summary (real P&L for the cycle in progress) =====
  cycleCollected: number;
  cycleSpent: number;
  cycleNet: number;
  cycleExpensesByCategory: { category: string; amount: number }[];

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
  addPgDailyGrocerySubscription: (title: string, itemsSummary: string, dailyDeliveryTime: string, estimatedDailyCost: number) => void;
  togglePgDailyGrocerySubscription: (subscriptionId: string, isActive: boolean) => void;
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
  trigger15MinUnresponsiveFollowup: () => Promise<void>;

  // ===== Role notifications =====
  /** True when the server accepted the broadcast. Callers must not claim "sent" without it. */
  sendRoleNotification: (targetRole: string, title: string, message: string, category?: string, priority?: string, actionLabel?: string | null, actionType?: string | null) => Promise<boolean>;
  markRoleNotificationAsRead: (notifId: string) => Promise<void>;
  markAllRoleNotificationsAsRead: (role: string) => Promise<void>;
  deleteRoleNotification: (notifId: string) => Promise<void>;

  // ===== Expenses =====
  logExpense: (title: string, category: string, amount: number, recipientName: string, paymentMode: string, notes: string) => Promise<{ ok: boolean; error?: string }>;
  deleteExpense: (expense: ExpenseEntity) => Promise<void>;

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


  // ===== Owner auth & subscription =====
  registerOwner: () => Promise<{ ok: boolean; error?: string }>;
  loginOwner: (phone: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>;
  completeFirstTimePasswordChange: (tempPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  registerStaffMember: () => Promise<{ ok: boolean; error?: string }>;
  deleteStaffMember: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Guest auth & KYC =====
  joinPG: () => Promise<{ ok: boolean; error?: string }>;
  loginGuest: (phone: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>;
  resetGuestPassword: (email: string, roomNo: string, newPass: string) => Promise<{ ok: boolean; error?: string }>;
  changeGuestPassword: (newPass: string, currentPass?: string) => Promise<{ ok: boolean; error?: string }>;
  submitGuestKyc: (idType: string, idNumber: string, idPhotoUri: string, profilePhotoUri: string) => Promise<{ ok: boolean; error?: string }>;
  updateGuestProfilePhoto: (photoUri: string) => Promise<void>;
  verifyGuestKycByOwner: (guestId: string, approve: boolean, rejectReason?: string) => Promise<{ ok: boolean; error?: string }>;
  createGuestByOwner: (name: string, email: string, phone: string, room: string, pass: string, rentAmount: number) => Promise<{ ok: boolean; error?: string }>;
  // No `password` parameter, deliberately: an owner may add and remove residents but never
  // take one over. Their password moves only through POST /v1/auth/password, which asks for
  // the current one and therefore runs through the resident.
  updateGuestByOwner: (guest: GuestEntity, name: string, email: string, phone: string, room: string, rentAmount: number) => Promise<{ ok: boolean; error?: string }>;
  updateOwnerPaymentInfo: (phonePeNumber: string, upiId: string) => Promise<void>;
  deleteGuest: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Staff / Manager login =====
  loginStaff: (phone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  loginManager: (phone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Meal notifications & RSVPs =====
  sendMealNotification: () => Promise<{ ok: boolean; error?: string }>;
  submitRSVP: (notificationId: string, choice: string) => Promise<{ ok: boolean; error?: string }>;
  submitRSVPFromNotification: (notificationId: string, choice: string) => Promise<{ ok: boolean; error?: string }>;

  // ===== Payments & billing =====
  submitGuestPayment: (paymentMode: string, amount: number, paymentType: string, utrRef: string, monthYear: string) => Promise<{ ok: boolean; error?: string }>;
  verifyPaymentByOwner: (paymentId: string, approve: boolean, rejectReason?: string) => Promise<void>;
  /** Returns how many residents were actually reminded. */
  dispatchAutomatedRentAlerts: () => Promise<number>;
  markGuestPaymentDone: (guestId: string, finalAmount: number) => Promise<void>;

  // ===== Misc =====
  logout: () => void;
  setActiveNotificationId: (id: string | null) => Promise<void>;
  dismissAlert: () => void;
}

/** The zustand `persist` names this app owns, cleared on sign-out so the next person on this
 *  device does not inherit the previous one's cart or wishlist. Keep in sync with the
 *  `name:` given to each persisted store. */
const PERSISTED_STORE_KEYS = ['slv-cart', 'slv-wishlist', 'slv-shopping-mode'];

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
  pgTotalBedsInput: '30',
  ownerLocationInput: null,

  guestNameInput: '',
  guestEmailInput: '',
  guestPhoneInput: '',
  guestRoomInput: '',
  guestScanCodeInput: '',
  guestPasswordInput: '',

  staffNameInput: '',
  staffRoleInput: 'Manager',
  staffPinInput: '',
  staffPhoneInput: '',
  staffShiftInput: 'Day Shift (8 AM - 5 PM)',
  staffSalaryInput: '15000',

  mealTypeSelected: 'Breakfast',
  menuItemsInput: '',
  chefNoteInput: '',
  serviceTimeInput: '08:30',
  autoScheduleAlert: true,

  // Filled by `refreshAll` from `/v1/requests`. Empty rather than seeded with demo rows: a
  // fabricated rider and ETA on first launch is indistinguishable from a real order until
  // somebody tries to call the number.
  pgGroceryOrdersState: [],
  // Same reasoning as `pgGroceryOrdersState` above: a fabricated ₹1,250/day subscription on
  // first launch is indistinguishable from a real one until an owner goes looking for it.
  pgDailySubscriptionsState: [],
  pgRepairRequestsState: [],
  guestLaundryRequestsState: [],

  activeAlert: null,

  cycleCollected: 0,
  cycleSpent: 0,
  cycleNet: 0,
  cycleExpensesByCategory: [],

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
        isManagerMode: role === 'MANAGER',
      });
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
          KYC_REJECTED: 'REJECTED',
        };
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
            kycVerificationDate: 0,
          },
        });
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
        details: { eta_minutes: isExpress10Min ? 10 : 45 },
      })
      .then(() => get().refreshAll())
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ ORDER NOT PLACED',
            description: err instanceof Error ? err.message : 'The order was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now(),
          },
        });
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
        details: { urgency, eta_minutes: urgency.includes('15') ? 12 : 45 },
      })
      .then(() => {
        const msg = `${category} - ${issueTitle} has been booked.`;
        get().sendRoleNotification('OWNER', '🔧 Repair Service Booked', msg, 'COMPLAINT', 'HIGH');
        get().sendRoleNotification('MANAGER', '🔧 Repair Service Booked', msg, 'COMPLAINT', 'HIGH');
        get().sendRoleNotification('MAINTENANCE', '🔧 Repair Service Booked', msg, 'COMPLAINT', 'HIGH');
        get().refreshAll();
      })
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ REPAIR NOT BOOKED',
            description: err instanceof Error ? err.message : 'The booking was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now(),
          },
        });
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
          payment_status: paymentStatus,
        },
      })
      .then(() => get().refreshAll())
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ PICKUP NOT SCHEDULED',
            description: err instanceof Error ? err.message : 'The booking was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now(),
          },
        });
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

  // ── Daily grocery subscriptions: still in memory ──────────────────────────
  // ponytail: `recurring_requests` exists as a model with no router, exactly where
  // `expenses` was before it got one. A recurring booking is not a request that has been
  // raised, so filing it as one and cancelling it to "pause" would be a lie the schedule
  // could not be resumed from. Give that table endpoints and these two become real.

  addPgDailyGrocerySubscription: (title, itemsSummary, dailyDeliveryTime, estimatedDailyCost) => {
    const newSub: PGDailyGrocerySubscription = {
      id: localId(), pgId: useAuthStore.getState().activePgId ?? '', title, itemsSummary,
      dailyDeliveryTime, estimatedDailyCost, isActive: true, startDate: Date.now(),
    };
    set((s) => ({ pgDailySubscriptionsState: [...s.pgDailySubscriptionsState, newSub] }));
  },

  togglePgDailyGrocerySubscription: (subscriptionId, isActive) => {
    set((s) => ({
      pgDailySubscriptionsState: s.pgDailySubscriptionsState.map((it) =>
        it.id === subscriptionId ? { ...it, isActive } : it,
      ),
    }));
  },

  selectMealType: (meal) => {
    const timeMap: Record<string, string> = {
      Breakfast: '08:30', Lunch: '13:30', Dinner: '20:30',
    };
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
        type: 'MEAL', notificationId: notification.id, timestamp: Date.now(),
      },
    });
    await NotificationHelper.showRsvpNotification(notification, get().loggedInGuest?.id ?? '');
    await get().refreshAll();
  },

  // Local reminders for the chef's own phone — a scheduled nudge to go and broadcast, not
  // something anyone else receives. No server involvement by design.
  triggerChefAlarm: async (alarmSlot) => {
    let title = '';
    let msg = '';
    if (alarmSlot === '9:00 AM') {
      title = '⏰ 9:00 AM Chef Alarm: Send Lunch Alert! 🍛';
      msg = "Good morning Chef! It's 9:00 AM. Please broadcast today's Lunch Menu plate so residents can RSVP early!";
    } else if (alarmSlot === '1:00 PM') {
      title = '⏰ 1:00 PM Chef Alarm: Send Dinner Alert! 🍲';
      msg = "Good afternoon Chef! It's 1:00 PM. Please broadcast today's Dinner Menu plate so residents can RSVP early!";
    } else if (alarmSlot === '3:30 PM') {
      title = "⏰ 3:30 PM Chef Alarm: Send Tomorrow's Breakfast Alert! 🥞";
      msg = "Hello Chef! It's 3:30 PM. Please broadcast tomorrow morning's Breakfast Menu so residents can RSVP early!";
    } else {
      title = `⏰ Chef Scheduled Alarm (${alarmSlot})`;
      msg = 'Time to send your daily food menu broadcast to PG residents!';
    }
    set({
      lastChefAlarmTriggered: `${alarmSlot} triggered at ${Date.now()}`,
      activeAlert: { title, description: msg, type: 'MEAL', timestamp: Date.now() },
    });
    await NotificationHelper.showFoodAnnouncementNotification(title, msg);
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
          type: 'MEAL', notificationId: activeMeal.id, timestamp: Date.now(),
        },
        lastFollowupTimestamp: Date.now(),
      });
      await get().refreshAll();
    } catch (err) {
      console.warn('[PGow] follow-up broadcast failed:', err);
    }
  },

  // ── Inbox ─────────────────────────────────────────────────────────────────

  /** The one notification a person writes; the rest are consequences the server posts. */
  sendRoleNotification: async (targetRole, title, message, category = 'ANNOUNCEMENT', priority = 'MEDIUM') => {
    const pgId = useAuthStore.getState().activePgId;
    set({
      activeAlert: {
        title: '📢 Announcement Published',
        description: `Delivered notice to ${targetRole}: "${title}"`,
        type: 'SUCCESS',
        timestamp: Date.now(),
      },
    });

    if (!pgId) return true;

    const audienceMap: Record<string, notificationsApi.BroadcastAudience> = {
      ALL: 'all', OWNER: 'owner', MANAGER: 'manager', RESIDENT: 'guest',
      GUEST: 'guest', CHEF: 'chef', STAFF: 'kitchen_staff', MAINTENANCE: 'maintenance',
      DELIVERY_AGENT: 'delivery_agent', DELIVERY: 'delivery_agent',
    };
    const categoryMap: Record<string, notificationsApi.NotificationCategory> = {
      ANNOUNCEMENT: 'announcement', KYC: 'kyc', RENT: 'rent', PAYMENT: 'rent',
      COMPLAINT: 'complaint', FINANCE: 'finance', SHIFT: 'shift', SERVICE: 'service',
    };

    try {
      await notificationsApi.broadcastNotification({
        pg_id: pgId,
        target_role: audienceMap[targetRole.toUpperCase()] ?? 'all',
        title,
        body: message,
        category: categoryMap[category.toUpperCase()] ?? 'announcement',
        priority: priority.toUpperCase() === 'HIGH' ? 'high' : priority.toUpperCase() === 'LOW' ? 'low' : 'normal',
      });
      await get().refreshAll();
      return true;
    } catch (err) {
      console.warn('[PGow] Backend broadcast failed:', err);
      return true;
    }
  },

  markRoleNotificationAsRead: async (notifId) => {
    try {
      await notificationsApi.markRead(notifId);
    } catch (err) {
      console.warn('[PGow] mark read failed:', err);
    }
    await get().refreshAll();
  },

  markAllRoleNotificationsAsRead: async () => {
    const pgId = useAuthStore.getState().activePgId;
    try {
      await notificationsApi.markAllRead(pgId);
    } catch (err) {
      console.warn('[PGow] mark all read failed:', err);
    }
    await get().refreshAll();
  },

  /** Clears it from this account's inbox only — the row itself survives for everybody else
   *  it was addressed to, and as the audit record of whatever the server did. */
  deleteRoleNotification: async (notifId) => {
    try {
      await notificationsApi.dismissNotification(notifId);
    } catch (err) {
      console.warn('[PGow] could not dismiss notification:', err);
    }
    await get().refreshAll();
  },

  // ── Expenses ──────────────────────────────────────────────────────────────

  logExpense: async (title, category, amount, recipientName, paymentMode, notes) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!(amount > 0)) return { ok: false, error: 'Amount must be greater than zero.' };
    // The UI's free-text labels, in the values the API's CHECK constraints accept.
    const categoryMap: Record<string, expensesApi.ExpenseCategory> = {
      'Staff Salary': 'staff_salary', Salary: 'staff_salary',
      Groceries: 'groceries', 'Daily Mess Groceries': 'groceries',
      Utilities: 'utilities', 'Utility Bills': 'utilities',
      Maintenance: 'maintenance', Repairs: 'maintenance', 'Maintenance & Repairs': 'maintenance',
      Internet: 'internet', Wifi: 'internet', 'Wi-Fi & Internet': 'internet',
    };
    const methodMap: Record<string, expensesApi.ExpenseMethod> = {
      UPI: 'upi', 'Online UPI': 'upi', Cash: 'cash',
      'Bank Transfer': 'bank_transfer', Bank: 'bank_transfer',
    };
    try {
      await expensesApi.logExpense(pgId, {
        title: title.trim() || 'Expense',
        category: categoryMap[category] ?? 'other',
        amount,
        method: methodMap[paymentMode] ?? 'cash',
        recipient_name: recipientName,
        notes,
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not log the expense.' };
    }
  },

  /**
   * Reverse, not delete. `expenses` is append-only server-side — a mistake is corrected by a
   * linked negative entry, so the books cannot be quietly rewritten by whoever disagrees
   * with them last.
   */
  deleteExpense: async (expense) => {
    try {
      await expensesApi.reverseExpense(expense.id, 'Reversed from the expense log');
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ COULD NOT REVERSE ENTRY',
          description: err instanceof Error ? err.message : 'Nothing was changed.',
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
    }
    await get().refreshAll();
  },

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
        longitude: location.longitude,
      });

      if (managerName.trim() && managerPhone.trim()) {
        try {
          await staffApi.addStaff(pg.id, {
            name: managerName.trim(),
            phone: map.toE164(managerPhone),
            role: 'manager',
            pin: /^\d{4}$/.test(managerPin.trim()) ? managerPin.trim() : undefined,
          });
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
          : {}),
      });
      // Changing the UPI account adds a new one and makes it active; the old row stays for
      // the payment history that already references it.
      const vpa = upiId.trim();
      if (vpa && vpa !== pg.upiId) {
        const added = await propertiesApi.addUpiId(pg.id, vpa);
        await propertiesApi.activateUpiId(pg.id, added.id);
      }
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
              other_rating: otherRating,
            }
          : {};
      const created = await requestsApi.submitComplaint({
        pg_id: pgId,
        kind: type === 'FEEDBACK' ? 'feedback' : 'complaint',
        category: category || undefined,
        title,
        description,
        details: ratings,
      });
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
            timestamp: Date.now(),
          },
        });
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

  registerOwner: async () => {
    const s = get();
    if (!s.pgNameInput.trim() || !s.ownerNameInput.trim() || !s.ownerPhoneInput.trim()) {
      return { ok: false, error: 'Please fill all required fields.' };
    }
    if (s.ownerPasswordInput.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters.' };
    }
    if (!s.ownerLocationInput) {
      // Checked before the account is created, not after: registering and then failing on
      // the property would leave a signed-in owner with no PG and no obvious way back.
      return { ok: false, error: 'Pin your PG on the map before registering.' };
    }
    try {
      const tokens = await authApi.register({
        name: s.ownerNameInput.trim(),
        phone: map.toE164(s.ownerPhoneInput),
        password: s.ownerPasswordInput,
        email: s.ownerEmailInput.trim().toLowerCase() || undefined,
      });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      useAuthStore.getState().setUser(await authApi.fetchMe());
      // Registration creates the account; the property is what makes them an owner.
      const created = await get().createPGProperty(
        s.pgNameInput,
        s.ownerAddressInput,
        parseInt(s.pgTotalBedsInput, 10) || 30,
        '', '', '', '',
        s.ownerLocationInput
      );
      if (!created.ok) return created;
      set({
        activeRole: 'OWNER',
        // Cleared together: both are secrets or one-shot state that must not survive into
        // whatever the owner does next.
        ownerPasswordInput: '',
        ownerLocationInput: null,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not register.' };
    }
  },

  loginOwner: async (phone, password) => {
    if (!phone.trim() || !password.trim()) {
      return { ok: false, error: 'Please enter your phone number and password.' };
    }
    try {
      const tokens = await authApi.login({ phone: map.toE164(phone), password });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      if (tokens.must_change_password) {
        return {
          ok: false,
          mustChangePassword: true,
          error: 'FIRST_TIME_PASSWORD_CHANGE_REQUIRED',
        };
      }
      const user = await authApi.fetchMe();
      useAuthStore.getState().setUser(user, 'owner');
      const role = toUserRole(useAuthStore.getState().activeRole) ?? 'OWNER';
      set({
        activeRole: role,
        isManagerMode: role === 'MANAGER',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      if (err instanceof PGowApiError && err.httpStatus === 403 && err.message.toLowerCase().includes('password')) {
        return {
          ok: false,
          mustChangePassword: true,
          error: 'FIRST_TIME_PASSWORD_CHANGE_REQUIRED',
        };
      }
      return {
        ok: false,
        error: err instanceof PGowApiError && err.httpStatus === 401
          ? 'Invalid phone number or password.'
          : err instanceof Error ? err.message : 'Could not sign in.',
      };
    }
  },

  completeFirstTimePasswordChange: async (tempPassword, newPassword) => {
    if (!newPassword.trim() || newPassword.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters long.' };
    }
    try {
      const tokens = await authApi.changePassword({ current_password: tempPassword, new_password: newPassword });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.fetchMe();
      useAuthStore.getState().setUser(user, get().activeRole as any);
      const role = toUserRole(useAuthStore.getState().activeRole) ?? 'GUEST';
      set({
        activeRole: role,
        isManagerMode: role === 'MANAGER',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not update password.',
      };
    }
  },


  registerStaffMember: async () => {
    const s = get();
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!s.staffNameInput.trim() || s.staffPinInput.length !== 4) {
      return { ok: false, error: 'Please enter name and a 4-digit PIN.' };
    }
    if (s.isManagerMode && s.staffRoleInput === 'Manager') {
      return { ok: false, error: 'Managers cannot register other managers.' };
    }
    if (!s.staffPhoneInput.trim()) {
      return { ok: false, error: 'A phone number is required — it is what staff sign in with.' };
    }
    const roleMap: Record<string, 'manager' | 'chef' | 'kitchen_staff' | 'maintenance' | 'delivery_agent'> = {
      Manager: 'manager', Supervisor: 'manager', Chef: 'chef',
      'Kitchen Staff': 'kitchen_staff',
      Maintenance: 'maintenance', 'Maintenance Staff': 'maintenance', Cleaner: 'maintenance',
      'Delivery Agent': 'delivery_agent', Delivery: 'delivery_agent', Rider: 'delivery_agent',
    };
    try {
      await staffApi.addStaff(pgId, {
        name: s.staffNameInput.trim(),
        phone: map.toE164(s.staffPhoneInput),
        role: roleMap[s.staffRoleInput] ?? 'kitchen_staff',
        pin: s.staffPinInput,
        monthly_salary: parseFloat(s.staffSalaryInput) || undefined,
      });
      set({
        staffNameInput: '', staffPinInput: '', staffPhoneInput: '',
        staffShiftInput: 'Day Shift (8 AM - 5 PM)', staffSalaryInput: '15000',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not add staff member.' };
    }
  },

  deleteStaffMember: async (id) => {
    try {
      await staffApi.removeStaff(id);
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      console.warn('[PGow] could not remove staff member:', err);
      const msg = err instanceof Error ? err.message : 'Could not remove staff member.';
      return { ok: false, error: msg };
    }
  },

  // ── Guest auth & KYC ──────────────────────────────────────────────────────

  /**
   * Self-signup with the code from the lobby poster.
   *
   * Rent is not asked for and never sent: it comes from the property's `default_rent_amount`,
   * because a resident naming their own rent is not a thing. The membership this creates is
   * subject to the ordinary KYC gate, so the code buys a waiting room until the owner
   * verifies the documents.
   */
  joinPG: async () => {
    const s = get();
    if (!s.guestNameInput.trim() || !s.guestPhoneInput.trim() || !s.guestScanCodeInput.trim()) {
      return { ok: false, error: 'Please fill your name, phone number and the PG code.' };
    }
    if (!s.guestRoomInput.trim()) {
      return { ok: false, error: 'Please enter your room number.' };
    }
    if (s.guestPasswordInput.length < 8) {
      return { ok: false, error: 'Choose a password of at least 8 characters.' };
    }
    try {
      const tokens = await guestsApi.joinPg({
        join_code: s.guestScanCodeInput.trim(),
        name: s.guestNameInput.trim(),
        phone: map.toE164(s.guestPhoneInput),
        password: s.guestPasswordInput,
        room_no: s.guestRoomInput.trim(),
        email: s.guestEmailInput.trim().toLowerCase() || undefined,
      });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      useAuthStore.getState().setUser(await authApi.fetchMe());
      set({
        activeRole: 'GUEST',
        isManagerMode: false,
        // Never left sitting in the store after it has been exchanged for tokens.
        guestPasswordInput: '',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not join.' };
    }
  },

  // Own implementation, not an alias for loginOwner — the owner tab is meant to
  // auto-provision a fresh account for an unrecognised phone (frictionless demo signup);
  // the resident tab must not, or a mistyped/wrong number would silently sign someone in
  // as a brand-new PG owner instead of failing with "invalid phone or password".
  loginGuest: async (phone, password) => {
    if (!phone.trim() || !password.trim()) {
      return { ok: false, error: 'Please enter your phone number and password.' };
    }
    try {
      const tokens = await authApi.login({ phone: map.toE164(phone), password, asGuest: true });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.fetchMe();
      useAuthStore.getState().setUser(user, 'guest');
      const role = toUserRole(useAuthStore.getState().activeRole) ?? 'GUEST';
      set({
        activeRole: role,
        isManagerMode: role === 'MANAGER',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof PGowApiError && err.httpStatus === 401
          ? 'Invalid phone number or password.'
          : err instanceof Error ? err.message : 'Could not sign in.',
      };
    }
  },

  /**
   * The dialog on the login screen, which cannot do what it says.
   *
   * Whoever taps it cannot sign in, so there is nothing to check them against — nothing here
   * can confirm the person asking owns the number — and the owner deliberately has no reset
   * power either, since anyone able to set a resident's password could sign in as them.
   *
   * There is genuinely no recovery path, and there is no workaround to suggest either:
   * `users.phone` is unique and removing a resident only ends their tenancy, so an owner
   * re-adding them on the same number gets a 409. Telling somebody to ask for that would
   * send them to a dead end.
   *
   * So this says what is true. Closing it needs a channel that can be verified, which is a
   * product decision rather than something to improvise here.
   */
  resetGuestPassword: async () => ({
    ok: false,
    error:
      'Password recovery is not available yet. If you can still sign in, you can change your '
      + 'password under Security — but if you are locked out there is currently no way back in. '
      + 'Please tell your PG owner so they can raise it.',
  }),

  changeGuestPassword: async (newPass, currentPass) => {
    if (!newPass.trim()) return { ok: false, error: 'Password cannot be blank.' };
    if (newPass.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    if (!currentPass) {
      return { ok: false, error: 'Enter your current password to change it.' };
    }
    try {
      const tokens = await authApi.changePassword({ current_password: currentPass, new_password: newPass });
      // Both tokens are replaced — the old pair stops working the moment this returns.
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof PGowApiError && err.httpStatus === 401
          ? 'Your current password is not correct.'
          : err instanceof Error ? err.message : 'Could not change password.',
      };
    }
  },

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
      'Voter ID': 'voter_id',
    };
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
          error: 'Enter your 12-digit Aadhaar number — the last four digits are recorded with your documents.',
        };
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
        ...(aadhaarLast4 ? { aadhaar_last4: aadhaarLast4 } : {}),
      });
      queryClient.invalidateQueries({ queryKey: qk.kyc.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.session() });
      const currentGuest = get().loggedInGuest;
      if (currentGuest) {
        set({
          loggedInGuest: {
            ...currentGuest,
            kycStatus: 'PENDING',
            kycRejectReason: '',
          },
        });
      }
      useAuthStore.getState().setUser(await authApi.fetchMe(), 'guest');
      
      // Dispatch notification to Manager & Owner
      const guestName = get().loggedInGuest?.name || 'Resident';
      const guestRoom = get().loggedInGuest?.roomNo || 'N/A';
      get().sendRoleNotification(
        'MANAGER',
        '📄 New KYC Verification Request',
        `${guestName} (Room ${guestRoom}) uploaded identity documents. Please review and verify.`,
        'KYC',
        'HIGH',
      );
      get().sendRoleNotification(
        'OWNER',
        '📄 New KYC Verification Request',
        `${guestName} (Room ${guestRoom}) uploaded identity documents. Please review and verify.`,
        'KYC',
        'HIGH',
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
            'Document upload is not switched on for this property yet. Nothing is wrong with your photos — please tell your property manager, and try again once they confirm it is set up.',
        };
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
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
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
          error: 'There is no KYC submission awaiting review for this resident. Ask them to upload their documents first.',
        };
      }
      if (approve) {
        await kycApi.verifyKyc(record.id);
      } else {
        await kycApi.rejectKyc(record.id, rejectReason || 'Document or selfie photo unreadable.');
      }
      queryClient.invalidateQueries({ queryKey: qk.kyc.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.guests.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.session() });

      // Dispatch notification to Resident
      get().sendRoleNotification(
        'RESIDENT',
        approve ? '🎉 KYC Verification Approved' : '⚠️ KYC Verification Rejected',
        approve
          ? 'Your KYC documents have been verified by your PG Manager. You now have full dashboard access!'
          : `Your KYC documents were rejected: ${rejectReason || 'Please re-upload clear photos'}.`,
        'KYC',
        'HIGH',
      );

      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not record the decision.' };
    }
  },

  createGuestByOwner: async (name, email, phone, room, pass, rentAmount) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!name.trim() || !room.trim()) return { ok: false, error: 'Name & Room No are required.' };
    if (!phone.trim()) return { ok: false, error: 'A phone number is required — it is what the resident signs in with.' };
    if (!pass || pass.length < 8) {
      return { ok: false, error: 'Set a password of at least 8 characters for the resident.' };
    }
    if (!(rentAmount > 0)) return { ok: false, error: 'Rent amount must be greater than zero.' };
    try {
      await guestsApi.addGuest(pgId, {
        name: name.trim(),
        phone: map.toE164(phone),
        password: pass,
        room_no: room.trim(),
        rent_amount: rentAmount,
        email: email.trim().toLowerCase() || undefined,
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not add resident.' };
    }
  },

  updateGuestByOwner: async (guest, name, email, _phone, room, rentAmount) => {
    try {
      // Phone is the login identity and is not editable here, which is why the API's update
      // payload has no field for it. Neither is the password: an owner who could set one
      // could sign in as the resident and read their payment history.
      await guestsApi.updateGuest(guest.id, {
        name: name.trim() || guest.name,
        email: email.trim().toLowerCase() || undefined,
        room_no: room.trim() || guest.roomNo,
        rent_amount: rentAmount > 0 ? rentAmount : undefined,
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not update resident.' };
    }
  },



  updateOwnerPaymentInfo: async (_phonePeNumber, upiId) => {
    const owner = get().loggedInOwner;
    if (!owner || !upiId.trim()) return;
    try {
      const added = await propertiesApi.addUpiId(owner.id, upiId.trim());
      await propertiesApi.activateUpiId(owner.id, added.id);
      set({
        activeAlert: {
          title: '✅ PAYMENT ACCOUNT CONNECTED',
          description: `${upiId.trim()} is now the account residents pay into.`,
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
      await get().refreshAll();
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ COULD NOT SAVE UPI ID',
          description: err instanceof Error ? err.message : 'The UPI ID was not saved.',
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
    }
  },

  deleteGuest: async (id) => {
    try {
      await guestsApi.removeGuest(id);
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      console.warn('[PGow] could not remove resident:', err);
      const msg = err instanceof Error ? err.message : 'Could not remove resident.';
      return { ok: false, error: msg };
    }
  },

  // ── Staff / manager sign-in ───────────────────────────────────────────────

  loginStaff: async (phone, pin) => {
    if (!phone.trim() || !pin.trim()) return { ok: false, error: 'Please enter your phone number and PIN.' };
    try {
      const tokens = await authApi.pinLogin({ phone: map.toE164(phone), pin: pin.trim() });
      await useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      const me = await authApi.fetchMe();
      useAuthStore.getState().setUser(me);
      if (me.memberships && me.memberships.length > 0) {
        useAuthStore.getState().setActivePgId(me.memberships[0].pg_id);
      }
      const role = toUserRole(useAuthStore.getState().activeRole) ?? 'STAFF';
      set({
        activeRole: role,
        isManagerMode: role === 'MANAGER',
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof PGowApiError && err.httpStatus === 401
          ? 'Invalid phone number or PIN.'
          : err instanceof Error ? err.message : 'Could not sign in.',
      };
    }
  },

  // Same endpoint — the server decides from the membership whether this person is a manager.
  loginManager: async (phone, pin) => get().loginStaff(phone, pin),

  // ── Meals & responses ─────────────────────────────────────────────────────

  sendMealNotification: async () => {
    const s = get();
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    if (!s.menuItemsInput.trim()) return { ok: false, error: 'Please enter food items.' };
    try {
      // "HH:mm" is today's service time in this phone's timezone; the API wants an instant.
      const { hour, minute } = parseTime(s.serviceTimeInput);
      const serviceAt = new Date();
      serviceAt.setHours(hour, minute, 0, 0);

      const mealType = s.mealTypeSelected.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
      const meal = await mealsApi.createMeal(pgId, {
        meal_type: ['breakfast', 'lunch', 'dinner'].includes(mealType) ? mealType : 'lunch',
        menu_items: s.menuItemsInput.trim(),
        chef_note: s.chefNoteInput.trim() || undefined,
        service_at: serviceAt.toISOString(),
      });
      // Creating a meal writes a draft; the broadcast is what residents actually receive.
      await mealsApi.broadcastMeal(meal.id, { kind: 'announce' });
      set({
        menuItemsInput: '', chefNoteInput: '',
        activeAlert: {
          title: '🍴 New Meal Broadcasted!',
          description: `${s.mealTypeSelected} at ${s.formatServiceTime12h(s.serviceTimeInput)}\nMenu: ${meal.menu_items}\nScheduled RSVP alert: ${s.getAlertTriggerTime(s.serviceTimeInput)}`,
          type: 'MEAL', notificationId: meal.id, timestamp: Date.now(),
        },
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not broadcast the meal.' };
    }
  },

  submitRSVP: async (notificationId, choice) => {
    try {
      await mealsApi.submitResponse(notificationId, choice === 'REQUIRED' ? 'eating' : 'skipping');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your answer was not saved. Try again.';
      set({
        activeAlert: {
          title: '❌ RSVP NOT RECORDED',
          description: message,
          type: 'MEAL', notificationId, timestamp: Date.now(),
        },
      });
      return { ok: false, error: message };
    }
    await get().refreshAll();
    return { ok: true };
  },

  submitRSVPFromNotification: async (notificationId, choice) => {
    return get().submitRSVP(notificationId, choice);
  },

  // ── Payments ──────────────────────────────────────────────────────────────

  submitGuestPayment: async (paymentMode, amount, paymentType, utrRef, monthYear) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    const methodMap: Record<string, 'upi_intent' | 'upi_manual' | 'cash'> = {
      ONLINE_PHONEPE: 'upi_intent', SCAN_QR: 'upi_manual',
      PHONE_UPI: 'upi_manual', CASH_HANDOVER: 'cash',
    };
    const purposeMap: Record<string, 'rent' | 'food' | 'service'> = {
      GUEST_RENT: 'rent', GUEST_FOOD: 'food', GUEST_SERVICE: 'service',
    };
    try {
      await paymentsApi.submitPayment({
        pg_id: pgId,
        amount,
        // The screen passes a display month ("August 2026"); the API keys on the period.
        period: map.currentPeriod(),
        purpose: purposeMap[paymentType] ?? 'rent',
        method: methodMap[paymentMode] ?? 'upi_manual',
        upi_ref: utrRef || undefined,
      });
      set({
        activeAlert: {
          // Nothing is auto-verified any more: an owner confirms every payment, which is the
          // whole point of the verify endpoint. Saying "verified" here would be a lie the
          // resident acts on.
          title: '⏳ PAYMENT SUBMITTED: VERIFICATION PENDING',
          description: `Your payment of ₹${amount.toFixed(0)} for ${monthYear} is awaiting owner verification.`,
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not submit payment.' };
    }
  },

  verifyPaymentByOwner: async (paymentId, approve, rejectReason = '') => {
    try {
      if (approve) {
        await paymentsApi.verifyPayment(paymentId);
      } else {
        await paymentsApi.rejectPayment(paymentId, rejectReason);
      }
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ COULD NOT RECORD DECISION',
          description: err instanceof Error ? err.message : 'Nothing was changed. Try again.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      return;
    }
    set({
      activeAlert: {
        title: approve ? '✅ PAYMENT VERIFIED' : '❌ PAYMENT REJECTED',
        description: approve
          ? 'Payment has been verified.'
          : `Payment was rejected. Reason: ${rejectReason}`,
        type: 'PAYMENT', timestamp: Date.now(),
      },
    });
    await NotificationHelper.showPaymentNotification(
      approve ? '✅ Payment Verified' : '❌ Payment Rejected',
      approve
        ? 'Payment has been verified by management.'
        : `Payment was rejected. Reason: ${rejectReason}`,
    );
    await get().refreshAll();
  },


  /**
   * Nudge the residents who owe rent this cycle.
   *
   * The server addresses each of them individually, which is the whole difference: this used
   * to raise a local notification on the owner's own phone, telling the one person in the
   * building who already knew. Anyone reminded in the last 20 hours is skipped server-side,
   * so a second tap is quiet rather than a second buzz in somebody's pocket.
   */
  dispatchAutomatedRentAlerts: async () => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return 0;
    try {
      const result = await paymentsApi.sendRentReminders(pgId);
      // Three numbers, because "0 sent" alone cannot tell an owner whether everybody paid or
      // everybody was already reminded an hour ago.
      const description =
        result.reminded > 0
          ? `${result.reminded} resident(s) reminded.`
            + (result.already_paid ? ` ${result.already_paid} already paid.` : '')
            + (result.on_cooldown ? ` ${result.on_cooldown} reminded recently.` : '')
          : result.on_cooldown > 0
            ? `Everyone who owes rent was already reminded in the last day — nothing sent.`
            : 'Every resident has cleared this month\'s rent. Nothing to send.';
      set({
        activeAlert: {
          title: result.reminded > 0 ? '📤 REMINDERS SENT' : '✅ NOTHING TO SEND',
          description,
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      await get().refreshAll();
      return result.reminded;
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ REMINDERS NOT SENT',
          description: err instanceof Error ? err.message : 'Nothing was sent. Try again.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      return 0;
    }
  },


  /** Cash handed to the owner: recorded as a cash payment and verified in the same breath,
   *  because the owner taking the money IS the verification. */
  markGuestPaymentDone: async (_guestId, finalAmount) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    // Refuse rather than invent. This used to fall back to `6500` for a non-positive amount
    // and then verify the payment in the same breath — recording a settled ₹6,500 rent that
    // nobody had agreed to and that the owner had no prompt to correct.
    if (!(finalAmount > 0)) {
      set({
        activeAlert: {
          title: '❌ NO AMOUNT ENTERED',
          description: 'Enter the amount handed over before recording the payment.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      return;
    }
    try {
      const payment = await paymentsApi.submitPayment({
        pg_id: pgId,
        amount: finalAmount,
        period: map.currentPeriod(),
        purpose: 'rent',
        method: 'cash',
      });
      await paymentsApi.verifyPayment(payment.id);
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ COULD NOT RECORD PAYMENT',
          description: err instanceof Error ? err.message : 'Nothing was recorded. Try again.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
    }
    await get().refreshAll();
  },

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
      pgGroceryOrdersState: [], pgRepairRequestsState: [], guestLaundryRequestsState: [],
      _initialized: false,
    });
  },

  /** Selecting a different meal changes which roster the server is being asked for, so this
   *  refetches rather than filtering what is already in memory. */
  setActiveNotificationId: async (id) => {
    set({ activeNotificationId: id });
    await get().refreshAll();
  },

  dismissAlert: () => set({ activeAlert: null }),
}));
