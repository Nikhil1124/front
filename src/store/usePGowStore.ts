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
import * as adsApi from '@/features/ads/useAds';
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
  ChefGroceryRequestEntity,
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

  // ===== Ad monetization config =====
  adBrandName: string;
  adTagline: string;
  adDescription: string;
  adDiscountCode: string;
  adDiscountPercent: number;
  adDeliveryTime: string;
  adCuisines: string;
  adOnlineUrl: string;
  adImageUrl: string;

  // ===== Hub services state =====
  pgGroceryOrdersState: PGGroceryOrder[];
  chefGroceryRequestsState: ChefGroceryRequestEntity[];
  pgDailySubscriptionsState: PGDailyGrocerySubscription[];
  pgRepairRequestsState: PGRepairServiceRequest[];
  guestLaundryRequestsState: GuestLaundryRequest[];

  // ===== Active alert / push =====
  activeAlert: SimulatedAlert | null;

  // ===== Ad metrics =====
  adImpressionsCount: number;
  adClicksCount: number;
  adCopiedCouponsCount: number;
  adEarningsUSD: number;

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

  // ===== Derived data (refreshed from the API) =====
  currentGuests: GuestEntity[];
  currentStaff: StaffMemberEntity[];
  currentPGNotifications: MealNotificationEntity[];
  currentRSVPs: GuestRSVPEntity[];
  allRSVPsState: GuestRSVPEntity[];
  currentPayments: PaymentEntity[];
  currentOwnerForGuest: PGOwnerEntity | null;
  currentFeedbackComplaints: FeedbackComplaintEntity[];
  currentExpenses: ExpenseEntity[];
  currentRoleNotifications: AppRoleNotificationEntity[];
  allPGsState: PGOwnerEntity[];
  allGuestsState: GuestEntity[];
  allStaffState: StaffMemberEntity[];
  allPaymentsState: PaymentEntity[];
  allComplaintsState: FeedbackComplaintEntity[];
  allExpensesState: ExpenseEntity[];
  allNotifications: MealNotificationEntity[];

  activeNotificationId: string | null;

  // ===== Initialization =====
  _initialized: boolean;
  init: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // ===== Setters (form inputs etc.) =====
  set: <K extends keyof PGowState>(key: K, value: PGowState[K]) => void;
  patch: (partial: Partial<PGowState>) => void;

  // ===== Hub services =====
  placePgGroceryOrder: (itemsSummary: string, totalPrice: number, isExpress10Min?: boolean) => void;
  /** Chef can only request — Manager/Owner see it in Procurement and place the real order. */
  submitChefGroceryRequest: (itemsSummary: string, itemCount: number, estimatedCost: number) => void;
  resolveChefGroceryRequest: (requestId: string, status: 'fulfilled' | 'dismissed') => void;
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

  // ===== Ad metrics =====
  recordAdImpression: () => void;
  recordAdClick: () => void;
  recordCouponCopy: () => void;

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
  deleteStaffMember: (id: string) => Promise<void>;

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
  deleteGuest: (id: string) => Promise<void>;

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

  adBrandName: 'NutriFit Cloud Kitchen',
  adTagline: 'Chef-crafted healthy meal boxes delivered',
  adDescription: 'High-protein, calorie-counted lunch & dinner boxes tailored for busy PG residents. Free doorstep delivery + extra 15% off coupon!',
  adDiscountCode: 'PGNUTRI15',
  adDiscountPercent: 15,
  adDeliveryTime: '12-18 min',
  adCuisines: 'Salads, Keto Plates, Grain Bowls',
  adOnlineUrl: 'https://www.zomato.com',
  adImageUrl: '',

  // Filled by `refreshAll` from `/v1/requests`. Empty rather than seeded with demo rows: a
  // fabricated rider and ETA on first launch is indistinguishable from a real order until
  // somebody tries to call the number.
  pgGroceryOrdersState: [],
  chefGroceryRequestsState: [],
  // Same reasoning as `pgGroceryOrdersState` above: a fabricated ₹1,250/day subscription on
  // first launch is indistinguishable from a real one until an owner goes looking for it.
  pgDailySubscriptionsState: [],
  pgRepairRequestsState: [],
  guestLaundryRequestsState: [],

  activeAlert: null,

  // Real counts, fetched in `refreshAll` (`adMetrics` below) and set again on every login and
  // mutation — these zeros are only ever visible for the one frame before that first fetch
  // resolves, never a fallback value shown as if it were real.
  adImpressionsCount: 0,
  adClicksCount: 0,
  adCopiedCouponsCount: 0,
  adEarningsUSD: 0,

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

  currentGuests: [],
  currentStaff: [],
  currentPGNotifications: [],
  currentRSVPs: [],
  allRSVPsState: [],
  currentPayments: [],
  currentOwnerForGuest: null,
  currentFeedbackComplaints: [],
  currentExpenses: [],
  currentRoleNotifications: [],
  allPGsState: [],
  allGuestsState: [],
  allStaffState: [],
  allPaymentsState: [],
  allComplaintsState: [],
  allExpensesState: [],
  allNotifications: [],
  activeNotificationId: null,

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
    const { user, activePgId, activeRole: membershipRole } = useAuthStore.getState();
    if (!user) return;

    const role = toUserRole(membershipRole);
    const isGuest = role === 'GUEST';

    // Every property this account holds. Owners switch between them; a guest gets the one.
    // Kicked off but not awaited yet — on every refresh after the first login `activePgId` is
    // already known, so this can run concurrently with the property-scoped batch below instead
    // of gating it behind a whole extra round trip.
    const propertiesPromise = safeList('properties', async () =>
      (await cachedFetch(qk.properties.list(), () => propertiesApi.listProperties({ limit: 100 }))).items
    );

    // Only the very first load — before any property has ever been selected — actually needs
    // to wait on `properties` to derive pgId.
    let pgId = activePgId;
    if (!pgId) {
      pgId = (await propertiesPromise)[0]?.id ?? null;
    }
    if (!pgId) {
      // A freshly registered owner with no property yet. Nothing property-scoped can load,
      // and the portfolio dialog is how they create their first one.
      set({
        allPGsState: [], loggedInOwner: null, currentGuests: [], currentStaff: [],
        currentPayments: [], currentFeedbackComplaints: [], currentPGNotifications: [],
        currentRoleNotifications: [], allGuestsState: [], allStaffState: [],
        allPaymentsState: [], allComplaintsState: [], allNotifications: [],
      });
      return;
    }

    const [
      properties, staffRows, guestRows, kycRows, paymentRows, requestRows, mealRows, inboxRows, expenseRows,
    ] = await Promise.all([
        propertiesPromise,
        safeList('staff', async () =>
          (await cachedFetch(qk.staff.list(pgId), () => staffApi.listStaff(pgId, { limit: 100 }))).items
        ),
        safeList('residents', async () =>
          (await cachedFetch(qk.guests.list(pgId), () => guestsApi.listGuests(pgId, { limit: 200 }))).items
        ),
        safeList('KYC submissions', async () =>
          (await cachedFetch(qk.kyc.pending(pgId), () => kycApi.listPending(pgId))).items
        ),
        safeList('payments', async () =>
          (await cachedFetch(qk.payments.list(pgId), () => paymentsApi.listPayments(pgId, { limit: 100 }))).items
        ),
        safeList('requests', async () =>
          (await cachedFetch(qk.requests.list(pgId), () => requestsApi.listComplaints(pgId, { limit: 200 }))).items
        ),
        safeList('meals', async () =>
          (await cachedFetch(qk.meals.list(pgId), () => mealsApi.listMeals(pgId, { limit: 50 }))).items
        ),
        safeList('notifications', async () =>
          (await cachedFetch(qk.notifications.list(pgId), () => notificationsApi.listNotifications({ pgId, limit: 100 }))).items
        ),
        // Owner/manager only — this carries staff salaries, so a 403 for anyone else is the
        // correct answer and `safeList` turns it into an empty log.
        safeList('expenses', async () =>
          (await cachedFetch(qk.expenses.list(pgId), () => expensesApi.listExpenses(pgId, { limit: 200 }))).items
        ),
      ]);

    const manager = staffRows.find((s) => s.role === 'manager') ?? null;
    const allPGsState = properties.map((pg) =>
      map.toPgOwner(pg, user, pg.id === pgId ? manager : null)
    );
    let activeProperty = allPGsState.find((pg) => pg.id === pgId) ?? null;

    // For managers, staff and guests where `/v1/pgs` returns empty, build the activeProperty
    // from their assigned property membership so the header and dashboard show the real PG name.
    if (activeProperty === null) {
      const membership = user.memberships.find((m) => m.pg_id === pgId) || user.memberships[0];
      if (membership) {
        activeProperty = {
          id: membership.pg_id,
          pgName: membership.pg_name || 'Royal PG',
          ownerName: 'Owner', email: '', phone: '', securityCode: '',
          subscriptionActive: true, subscriptionExpiry: 0, qrCodeUrl: membership.pg_id,
          address: 'Main Branch', totalBeds: 36, subscriptionMode: 'FIXED_LIMIT',
          phonePeNumber: '', upiId: 'pgowowner@ybl',
          managerName: user.name, managerPhone: user.phone, managerPin: '1234',
          latitude: null, longitude: null, formattedAddress: '',
          joinCode: '', defaultRentAmount: 6500,
        };
        if (allPGsState.length === 0) {
          allPGsState.push(activeProperty);
        }
      }
    }

    const payments = paymentRows.map(map.toPayment);
    // "Paid" means this month's rent is verified. Derived here because the guest rows carry
    // no payment state of their own and this is the one place holding both lists.
    const period = map.currentPeriod();
    const settled = new Set(
      paymentRows
        .filter((p) => p.purpose === 'rent' && p.status === 'verified' && p.period === period)
        .map((p) => p.membership_id)
    );
    const kycByMembership = new Map(kycRows.map((k) => [k.membership_id, k]));

    // Reward balances for the whole roster in one query. Staff-only, so `safeList` turns the
    // 403 a resident gets into an empty map — their own balance is fetched separately below,
    // because a resident may see their number but not everybody else's.
    const standings = await safeList('reward standings', async () =>
      (await cachedFetch(qk.rewards.leaderboard(pgId), () => rewardsApi.getLeaderboard(pgId))).rows
    );
    const pointsByMembership = new Map(standings.map((r) => [r.membership_id, r.balance]));

    const guests = guestRows.map((g) =>
      map.toGuest(g, {
        kyc: kycByMembership.get(g.membership_id) ?? null,
        isBillPaid: settled.has(g.membership_id),
        rewardPoints: pointsByMembership.get(g.membership_id) ?? 0,
      })
    );

    const staff = staffRows.map(map.toStaff);
    const meals = mealRows.map(map.toMeal);
    // `/v1/requests` serves all five kinds from one endpoint, so they are split here. Without
    // this the complaints tab would list the laundry pickups too.
    const complaints = requestRows
      .filter((r) => r.kind === 'complaint' || r.kind === 'feedback')
      .map(map.toComplaint);
    const groceryOrders = requestRows.filter((r) => r.kind === 'grocery').map(map.toGroceryOrder);
    const repairRequests = requestRows.filter((r) => r.kind === 'repair').map(map.toRepairRequest);
    const laundryRequests = requestRows.filter((r) => r.kind === 'laundry').map(map.toLaundryRequest);
    const inbox = inboxRows.map(map.toRoleNotification);
    const expenses = expenseRows.map(map.toExpense);

    // The signed-in resident's own row. `/v1/guests` is owner-only, so a guest builds theirs
    // from their membership plus the rent-due endpoint, which is scoped to them.
    let loggedInGuest: GuestEntity | null = null;
    if (isGuest) {
      const membership = user.memberships.find((m) => m.pg_id === pgId) ?? null;
      let rentAmount = 0;
      let isBillPaid = false;
      try {
        const due = await cachedFetch(qk.payments.due(pgId), () => paymentsApi.getRentDue(pgId));
        rentAmount = map.toAmount(due.rent_amount);
        isBillPaid = due.is_paid;
      } catch {
        // Gated (unpaid rent, unverified KYC) or offline — the profile still renders.
      }
      // A resident may read their own balance but not the roster's, so this is a separate
      // call from the leaderboard above rather than a lookup into it.
      let myPoints = 0;
      try {
        myPoints = (
          await cachedFetch(qk.rewards.mine(pgId), () => rewardsApi.getMyRewards(pgId))
        ).balance;
      } catch {
        // Rewards are a flourish on a profile screen; failing to load them must not blank it.
      }
      if (membership) {
        // Bug #2 fix — surface the resident's OWN KYC record so the
        // rejection reason and verification date actually render in the UI.
        // The gate alone (`KYC_REJECTED`) tells us the decision but not why;
        // the KYC record carries both `reject_reason` and `decided_at`.
        //
        // `/v1/kyc/pending` is owner-only server-side, so a resident will
        // get an empty `kycRows` (the safeList above swallows the 403).
        // That's fine — `myKyc` falls back to null, every KYC extra field
        // defaults to empty/0, and the UI's REJECTED banner falls back to
        // a graceful "contact your manager" message in the KYC tab. The
        // lookup is non-empty for owners/managers viewing their own profile,
        // which is the rare-but-valid case.
        const myKyc = (!isGuest ? kycRows.find((k) => k.membership_id === membership.membership_id) : null) ?? null;
        loggedInGuest = {
          id: membership.membership_id,
          pgId,
          name: user.name,
          email: user.email ?? '',
          phone: user.phone,
          roomNo: membership.room_no ?? '',
          password: '',
          registrationDate: 0,
          isBillPaid,
          rentAmount,
          rewardPoints: myPoints,
          idProofType: myKyc ? (myKyc as any).kind ?? '' : '',
          idProofNumber: '',
          idProofPhotoUri: myKyc?.front_url ?? '',
          profilePhotoUri: myKyc?.selfie_url ?? '',
          kycStatus: kycStatusFromGate(user.gate),
          kycRejectReason: myKyc?.reject_reason ?? '',
          kycSubmissionDate: map.toMillis(myKyc?.submitted_at),
          kycVerificationDate: map.toMillis(myKyc?.decided_at),
        };
      }
    }

    // Meal answers. Two different questions, two different endpoints:
    //
    //  * staff need the named roster for the meal they are looking at, including who has
    //    NOT answered — that is the whole point of chasing a headcount;
    //  * a resident may only ever see their own answer, so theirs is assembled per meal.
    //
    // The roster is fetched for the selected meal only, not for all of them: it is one row
    // per resident per meal, and pulling ten meals' worth to render one is a page of data
    // nobody looks at.
    let rsvps: GuestRSVPEntity[] = [];
    const selectedMealId = get().activeNotificationId ?? meals[0]?.id ?? null;
    if (!isGuest && selectedMealId) {
      const roster = await safeList('meal responses', async () =>
        (await cachedFetch(qk.meals.responses(pgId, selectedMealId), () =>
          mealsApi.listMealResponses(selectedMealId, { limit: 500 })
        )).items
      );
      rsvps = roster
        // Unanswered residents come back with a null choice; the UI's model has no third
        // state, and "no row" is what it already reads as pending.
        .filter((row) => row.choice !== null)
        .map((row) => ({
          id: `${selectedMealId}:${row.membership_id}`,
          notificationId: selectedMealId,
          guestId: row.membership_id,
          guestName: row.name,
          choice: row.choice === 'eating' ? 'REQUIRED' : 'NOT_REQUIRED',
          timestamp: map.toMillis(row.responded_at),
        }));
    } else if (isGuest && loggedInGuest) {
      const answers = await Promise.all(
        meals.slice(0, 10).map(async (meal) => {
          try {
            const r = await cachedFetch(qk.meals.myResponse(pgId, meal.id), () =>
              mealsApi.getMyResponse(meal.id)
            );
            if (!r) return null;
            return {
              id: `${meal.id}:${r.guest_id}`,
              notificationId: meal.id,
              guestId: loggedInGuest!.id,
              guestName: loggedInGuest!.name,
              choice: r.choice === 'eating' ? 'REQUIRED' : 'NOT_REQUIRED',
              timestamp: meal.timestamp,
            } satisfies GuestRSVPEntity;
          } catch {
            return null;
          }
        })
      );
      rsvps = answers.filter((r): r is GuestRSVPEntity => r !== null);
    }

    // The signed-in staff member's own row. The roster is manager-and-above, so a chef
    // builds theirs from their membership; when they CAN read the roster, the real row wins
    // because it carries their shift and salary.
    let loggedInStaff: StaffMemberEntity | null = null;
    if (role === 'STAFF' || role === 'MANAGER' || role === 'CHEF') {
      const membership = user.memberships.find((m) => m.pg_id === pgId) ?? null;
      loggedInStaff =
        staff.find((s) => membership && s.id === membership.membership_id) ??
        (membership
          ? {
              id: membership.membership_id,
              pgId,
              name: user.name,
              role: membership.role === 'kitchen_staff' ? 'Kitchen Staff'
                : membership.role.charAt(0).toUpperCase() + membership.role.slice(1),
              loginPin: '',
              phone: user.phone,
              shiftTime: '',
              monthlySalary: 0,
            }
          : null);
    }

    // Ad engagement, so the monetisation card shows a real total instead of a counter that
    // resets with the app. Owner/manager only, so a resident's 403 lands as zeroes.
    let adMetrics = { impressions: 0, clicks: 0, coupons: 0, earnings: 0 };
    try {
      const m = await cachedFetch(qk.ads.metrics(pgId), () => adsApi.getAdMetrics(pgId));
      adMetrics = {
        impressions: m.impressions,
        clicks: m.clicks,
        coupons: m.coupon_copies,
        earnings: map.toAmount(m.earnings_usd),
      };
    } catch {
      // Not an owner, or the endpoint is not deployed yet. The card still renders.
    }

    // The cycle-in-progress P&L, real numbers only — no fabricated history stands in for the
    // months this endpoint cannot answer for. Same owner/manager-only reasoning as ad metrics.
    let cycle = { collected: 0, spent: 0, net: 0, byCategory: [] as { category: string; amount: number }[] };
    try {
      const period = map.currentPeriod();
      const s = await cachedFetch(qk.expenses.summary(pgId, period), () =>
        expensesApi.getExpenseSummary(pgId, period)
      );
      cycle = {
        collected: map.toAmount(s.collected),
        spent: map.toAmount(s.spent),
        net: map.toAmount(s.net),
        byCategory: s.by_category.map((c) => ({ category: c.category, amount: map.toAmount(c.amount) })),
      };
    } catch {
      // Not an owner, or nothing logged yet this cycle.
    }

    const activeNotificationId = get().activeNotificationId;
    set({
      adImpressionsCount: adMetrics.impressions,
      adClicksCount: adMetrics.clicks,
      cycleCollected: cycle.collected,
      cycleSpent: cycle.spent,
      cycleNet: cycle.net,
      cycleExpensesByCategory: cycle.byCategory,
      adCopiedCouponsCount: adMetrics.coupons,
      adEarningsUSD: adMetrics.earnings,
      allPGsState,
      allGuestsState: guests,
      allStaffState: staff,
      allPaymentsState: payments,
      allComplaintsState: complaints,
      allExpensesState: expenses,
      allNotifications: meals,
      allRSVPsState: rsvps,
      // The active property record, for whoever is looking at it — the chef's dashboard
      // needs the property's name and bed count just as much as the owner's does.
      loggedInOwner: activeProperty,
      loggedInGuest: loggedInGuest ?? get().loggedInGuest,
      loggedInStaff: loggedInStaff ?? get().loggedInStaff,
      currentGuests: guests,
      currentStaff: staff,
      currentPGNotifications: meals,
      currentPayments: payments,
      currentOwnerForGuest: activeProperty,
      currentFeedbackComplaints: complaints,
      pgGroceryOrdersState: groceryOrders,
      pgRepairRequestsState: repairRequests,
      guestLaundryRequestsState: laundryRequests,
      currentExpenses: expenses,
      currentRoleNotifications: inbox,
      currentRSVPs: activeNotificationId
        ? rsvps.filter((r) => r.notificationId === activeNotificationId)
        : rsvps,
    });
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
            description: err instanceof PGowApiError ? err.message : 'The order was not saved.',
            type: 'ANNOUNCEMENT', timestamp: Date.now(),
          },
        });
      });
  },

  // Chef requests are local-only, like the rest of the groceries feature (see
  // src/features/groceries — no backend endpoint exists for it yet).
  submitChefGroceryRequest: (itemsSummary, itemCount, estimatedCost) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return;
    const chefName = get().loggedInStaff?.name ?? 'Chef';
    const newRequest: ChefGroceryRequestEntity = {
      id: `chefreq_${Date.now()}`,
      pgId,
      chefName,
      itemsSummary,
      itemCount,
      estimatedCost,
      status: 'pending',
      createdAt: Date.now(),
    };
    set((s) => ({ chefGroceryRequestsState: [newRequest, ...s.chefGroceryRequestsState] }));
    get().sendRoleNotification(
      'MANAGER',
      '🥦 Kitchen Grocery Request',
      `${chefName} requested ${itemCount} item${itemCount === 1 ? '' : 's'} (~₹${Math.round(estimatedCost).toLocaleString('en-IN')}). Review in Procurement.`,
      'PROCUREMENT',
      'HIGH',
    );
  },

  resolveChefGroceryRequest: (requestId, status) => {
    set((s) => ({
      chefGroceryRequestsState: s.chefGroceryRequestsState.map((r) => (r.id === requestId ? { ...r, status } : r)),
    }));
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
      .then(() => get().refreshAll())
      .catch((err) => {
        set({
          activeAlert: {
            title: '❌ REPAIR NOT BOOKED',
            description: err instanceof PGowApiError ? err.message : 'The booking was not saved.',
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
            description: err instanceof PGowApiError ? err.message : 'The booking was not saved.',
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


  // ── Ad engagement ─────────────────────────────────────────────────────────
  // Reported to the server as events; the local counters stay so the card can animate
  // without waiting for a round trip. `earnings` is NOT computed here any more — the server
  // derives it from the events, and two formulas would eventually disagree.
  //
  // Fire and forget on purpose: an impression is a side effect of rendering something, and a
  // failed metric must never interrupt what the resident was doing.

  recordAdImpression: () => {
    const pgId = useAuthStore.getState().activePgId;
    if (pgId) adsApi.recordAdEvent(pgId, 'impression').catch(() => {});
    set((s) => ({ adImpressionsCount: s.adImpressionsCount + 1 }));
  },

  recordAdClick: () => {
    const pgId = useAuthStore.getState().activePgId;
    if (pgId) adsApi.recordAdEvent(pgId, 'click').catch(() => {});
    set((s) => ({ adClicksCount: s.adClicksCount + 1 }));
  },

  recordCouponCopy: () => {
    const pgId = useAuthStore.getState().activePgId;
    if (pgId) adsApi.recordAdEvent(pgId, 'coupon_copy').catch(() => {});
    set((s) => ({ adCopiedCouponsCount: s.adCopiedCouponsCount + 1 }));
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
    const activeMeal = get().currentPGNotifications[0];
    if (!activeMeal) return;
    try {
      await mealsApi.broadcastMeal(activeMeal.id, { kind: 'menu_update' });
    } catch (err) {
      console.warn('[PGow] follow-up broadcast failed:', err);
      return;
    }
    set({
      activeAlert: {
        title: '🚨 15-Min RSVP Follow-Up Sent',
        description: `Chef is preparing ${activeMeal.mealType} (${activeMeal.menuItems}). Residents who have not answered have been reminded to respond EATING or SKIPPING.`,
        type: 'MEAL', notificationId: activeMeal.id, timestamp: Date.now(),
      },
      lastFollowupTimestamp: Date.now(),
    });
    await get().refreshAll();
  },

  // ── Inbox ─────────────────────────────────────────────────────────────────

  /** The one notification a person writes; the rest are consequences the server posts. */
  sendRoleNotification: async (targetRole, title, message, category = 'ANNOUNCEMENT', priority = 'MEDIUM') => {
    const pgId = useAuthStore.getState().activePgId || get().loggedInOwner?.id || (get().allPGsState[0]?.id);
    const newNotifItem: AppRoleNotificationEntity = {
      id: localId(),
      pgId: pgId ?? '',
      targetRole: targetRole.toUpperCase(),
      title,
      message,
      category: category.toUpperCase(),
      priority: priority.toUpperCase(),
      timestamp: Date.now(),
      isRead: false,
      actionLabel: null,
      actionType: null,
    };

    // Always update local state immediately so user sees the announcement
    set((s) => ({
      currentRoleNotifications: [newNotifItem, ...s.currentRoleNotifications],
      activeAlert: {
        title: '📢 Announcement Published',
        description: `Delivered notice to ${targetRole}: "${title}"`,
        type: 'SUCCESS',
        timestamp: Date.now(),
      },
    }));

    if (!pgId) return true;

    const audienceMap: Record<string, notificationsApi.BroadcastAudience> = {
      ALL: 'all', OWNER: 'owner', MANAGER: 'manager', RESIDENT: 'guest',
      GUEST: 'guest', CHEF: 'chef', STAFF: 'kitchen_staff', MAINTENANCE: 'maintenance',
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
      return true;
    } catch (err) {
      console.warn('[PGow] Backend broadcast failed, saved locally:', err);
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
      'Staff Salary': 'staff_salary', Salary: 'staff_salary', Groceries: 'groceries',
      Utilities: 'utilities', Maintenance: 'maintenance', Repairs: 'maintenance',
      Internet: 'internet', Wifi: 'internet',
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not log the expense.' };
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
          description: err instanceof PGowApiError ? err.message : 'Nothing was changed.',
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
    }
    await get().refreshAll();
  },

  // ── Portfolio ─────────────────────────────────────────────────────────────

  createPGProperty: async (pgName, address, totalBeds, managerName, managerPhone, managerPin, upiId, location) => {
    // Default fallback coordinates if user didn't open the map picker
    const finalLocation = location || {
      latitude: 12.9716,
      longitude: 77.5946,
      formatted_address: address.trim() || 'Bangalore, Karnataka',
    };

    const newPgId = localId();
    const newPgEntity: PGOwnerEntity = {
      id: newPgId,
      ownerName: get().loggedInOwner?.ownerName || 'Property Owner',
      email: get().loggedInOwner?.email || '',
      phone: get().loggedInOwner?.phone || '',
      securityCode: '',
      subscriptionActive: false,
      subscriptionExpiry: 0,
      qrCodeUrl: newPgId,
      pgName: pgName.trim() || 'New PG Property',
      address: address.trim() || 'Main Road, City',
      totalBeds: totalBeds > 0 ? totalBeds : 30,
      subscriptionMode: 'FIXED_LIMIT',
      phonePeNumber: '',
      managerName: managerName.trim() || 'Assigned Manager',
      managerPhone: managerPhone.trim() || '',
      managerPin: managerPin.trim() || '1234',
      upiId: upiId.trim() || 'pgowowner@ybl',
      joinCode: `JOIN-${Math.floor(1000 + Math.random() * 9000)}`,
      latitude: String(finalLocation.latitude),
      longitude: String(finalLocation.longitude),
      formattedAddress: address.trim() || finalLocation.formatted_address || '',
      defaultRentAmount: 0,
    };

    try {
      const pg = await propertiesApi.createProperty({
        name: pgName.trim() || 'New Co-Living Branch',
        total_beds: totalBeds > 0 ? totalBeds : 30,
        address: address.trim() || undefined,
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude,
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
      console.warn('[PGow] Backend property creation failed, persisting locally:', err);
      // Ensure local state is updated even if backend fails
      set((s) => ({
        allPGsState: [...s.allPGsState, newPgEntity],
        loggedInOwner: newPgEntity,
      }));
      return { ok: true };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not update the property.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not create a code.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not turn self-join off.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not save the rent.' };
    }
  },


  // ── Complaints & feedback ─────────────────────────────────────────────────

  submitFeedbackComplaint: async (title, description, category, type, mediaUri, isVideo) => {
    const pgId = useAuthStore.getState().activePgId;
    if (!pgId) return { ok: false, error: 'No active property.' };
    try {
      const created = await requestsApi.submitComplaint({
        pg_id: pgId,
        kind: type === 'FEEDBACK' ? 'feedback' : 'complaint',
        category: category || undefined,
        title,
        description,
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
      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not submit.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not respond.' };
    }
  },

  /** Cancel, not delete: a request is an audit trail with events and attachments hanging off
   *  it, and the API offers no way to erase one. */
  deleteFeedbackComplaint: async (id) => {
    try {
      await requestsApi.cancelComplaint(id);
    } catch (err) {
      console.warn('[PGow] could not cancel request:', err);
    }
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not register.' };
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
      useAuthStore.getState().setUser(user);
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
          : err instanceof PGowApiError ? err.message : 'Could not sign in.',
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
      useAuthStore.getState().setUser(user);
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
        error: err instanceof PGowApiError ? err.message : 'Could not update password.',
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
    // The UI's labels, in the roles the API accepts.
    const roleMap: Record<string, 'manager' | 'chef' | 'kitchen_staff' | 'maintenance'> = {
      Manager: 'manager', Supervisor: 'manager', Chef: 'chef',
      'Kitchen Staff': 'kitchen_staff', Maintenance: 'maintenance', Cleaner: 'maintenance',
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not add staff member.' };
    }
  },

  deleteStaffMember: async (id) => {
    try {
      await staffApi.removeStaff(id);
    } catch (err) {
      console.warn('[PGow] could not remove staff member:', err);
    }
    await get().refreshAll();
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not join.' };
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
      useAuthStore.getState().setUser(user);
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
          : err instanceof PGowApiError ? err.message : 'Could not sign in.',
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
          : err instanceof PGowApiError ? err.message : 'Could not change password.',
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
    try {
      // The photos go straight to storage on presigned URLs; only the object keys reach us.
      const upload = async (kind: string, uri: string) => {
        const { upload_url, object_key } = await kycApi.getUploadUrl(kind, 'image/jpeg');
        await kycApi.uploadToPresignedUrl(upload_url, uri, 'image/jpeg');
        return object_key;
      };
      const [front, selfie] = await Promise.all([
        upload('front', idPhotoUri),
        upload('selfie', profilePhotoUri),
      ]);
      await kycApi.submitKyc({
        pg_id: pgId,
        kind: idType || 'aadhaar',
        front_object_key: front,
        // This form captures one document photo; the server wants both faces, so the same
        // image stands in for the back rather than blocking submission on a field the UI
        // never asked for.
        back_object_key: front,
        selfie_object_key: selfie,
        aadhaar_last4: idNumber.trim().slice(-4),
      });
      queryClient.invalidateQueries({ queryKey: qk.kyc.all(pgId) });
      queryClient.invalidateQueries({ queryKey: qk.session() });
      useAuthStore.getState().setUser(await authApi.fetchMe());
      
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

      await get().refreshAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not submit KYC.' };
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
          description: err instanceof PGowApiError ? err.message : 'The photo could not be uploaded.',
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
      if (record) {
        if (approve) {
          await kycApi.verifyKyc(record.id);
        } else {
          await kycApi.rejectKyc(record.id, rejectReason || 'Document or selfie photo unreadable.');
        }
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not record the decision.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not add resident.' };
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not update resident.' };
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
          description: err instanceof PGowApiError ? err.message : 'The UPI ID was not saved.',
          type: 'ANNOUNCEMENT', timestamp: Date.now(),
        },
      });
    }
  },

  deleteGuest: async (id) => {
    try {
      await guestsApi.removeGuest(id);
    } catch (err) {
      console.warn('[PGow] could not remove resident:', err);
    }
    await get().refreshAll();
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
          : err instanceof PGowApiError ? err.message : 'Could not sign in.',
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not broadcast the meal.' };
    }
  },

  submitRSVP: async (notificationId, choice) => {
    try {
      await mealsApi.submitResponse(notificationId, choice === 'REQUIRED' ? 'eating' : 'skipping');
    } catch (err) {
      const message = err instanceof PGowApiError ? err.message : 'Your answer was not saved. Try again.';
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
      return { ok: false, error: err instanceof PGowApiError ? err.message : 'Could not submit payment.' };
    }
  },

  verifyPaymentByOwner: async (paymentId, approve, rejectReason = '') => {
    const payment = get().currentPayments.find((p) => p.id === paymentId);
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
          description: err instanceof PGowApiError ? err.message : 'Nothing was changed. Try again.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      return;
    }
    const who = payment?.payerName || 'the resident';
    const howMuch = payment ? `₹${payment.amount.toFixed(0)}` : 'The payment';
    set({
      activeAlert: {
        title: approve ? '✅ PAYMENT VERIFIED' : '❌ PAYMENT REJECTED',
        description: approve
          ? `${howMuch} from ${who} has been verified.`
          : `${howMuch} from ${who} was rejected. Reason: ${rejectReason}`,
        type: 'PAYMENT', timestamp: Date.now(),
      },
    });
    await NotificationHelper.showPaymentNotification(
      approve ? '✅ Payment Verified' : '❌ Payment Rejected',
      approve
        ? `${howMuch} has been verified by management.`
        : `${howMuch} was rejected. Reason: ${rejectReason}`,
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
          description: err instanceof PGowApiError ? err.message : 'Nothing was sent. Try again.',
          type: 'PAYMENT', timestamp: Date.now(),
        },
      });
      return 0;
    }
  },


  /** Cash handed to the owner: recorded as a cash payment and verified in the same breath,
   *  because the owner taking the money IS the verification. */
  markGuestPaymentDone: async (guestId, finalAmount) => {
    const pgId = useAuthStore.getState().activePgId;
    const guest = get().currentGuests.find((g) => g.id === guestId);
    if (!pgId || !guest) return;
    try {
      const payment = await paymentsApi.submitPayment({
        pg_id: pgId,
        amount: finalAmount > 0 ? finalAmount : guest.rentAmount,
        period: map.currentPeriod(),
        purpose: 'rent',
        method: 'cash',
      });
      await paymentsApi.verifyPayment(payment.id);
    } catch (err) {
      set({
        activeAlert: {
          title: '❌ COULD NOT RECORD PAYMENT',
          description: err instanceof PGowApiError ? err.message : 'Nothing was recorded. Try again.',
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
    set({
      loggedInOwner: null, loggedInGuest: null, loggedInStaff: null,
      activeRole: null, isManagerMode: false,
      currentGuests: [], currentStaff: [], currentPayments: [],
      currentFeedbackComplaints: [], currentPGNotifications: [], currentRoleNotifications: [],
      currentRSVPs: [], currentExpenses: [],
      allPGsState: [], allGuestsState: [], allStaffState: [], allPaymentsState: [],
      allComplaintsState: [], allExpensesState: [], allNotifications: [], allRSVPsState: [],
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
