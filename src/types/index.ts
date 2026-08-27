/**
 * Entity type definitions ported from Kotlin `data/Entities.kt`.
 * All Room entities map to TypeScript interfaces with the same fields & defaults.
 */

export interface PGOwnerEntity {
  id: string;
  pgName: string;
  ownerName: string;
  email: string;
  phone: string;
  securityCode: string;
  subscriptionActive: boolean;
  subscriptionExpiry: number;
  qrCodeUrl: string;
  address: string;
  totalBeds: number;
  subscriptionMode: string; // "FIXED_LIMIT" | "PAY_PER_USER"
  phonePeNumber: string;
  upiId: string;
  managerName: string;
  managerPhone: string;
  managerPin: string;
  // ── Location ──────────────────────────────────────────────────────────────
  // Decimal on the wire, so strings here too: parsing them to floats and back is a lossy
  // round trip on a value the map renders a pin from. Null together, always — the server
  // refuses half a coordinate.
  latitude: string | null;
  longitude: string | null;
  /** The map provider's canonical line. `address` above stays the owner's own. */
  formattedAddress: string;
  // ── Self-service joining ──────────────────────────────────────────────────
  /** The lobby code, or "" when self-join is off or the caller may not see it. */
  joinCode: string;
  /** What a resident who joins with the code is put on. 0 when unset. */
  defaultRentAmount: number;
}

export interface GuestEntity {
  id: string;
  pgId: string;
  name: string;
  email: string;
  phone: string;
  roomNo: string;
  password: string;
  registrationDate: number;
  isBillPaid: boolean;
  rentAmount: number;
  rewardPoints: number;
  idProofType: string;
  idProofNumber: string;
  idProofPhotoUri: string;
  profilePhotoUri: string;
  kycStatus: string; // "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED"
  kycRejectReason: string;
  kycSubmissionDate: number;
  kycVerificationDate: number;
}

export interface StaffMemberEntity {
  id: string;
  pgId: string;
  name: string;
  role: string;
  loginPin: string;
  phone: string;
  shiftTime: string;
  monthlySalary: number;
}

export interface MealNotificationEntity {
  id: string;
  pgId: string;
  mealType: string;
  menuItems: string;
  chefNote: string;
  timestamp: number;
  isClosed: boolean;
  serviceTime: string;
  isAlertSent: boolean;
}

export interface GuestRSVPEntity {
  id: string;
  notificationId: string;
  guestId: string;
  guestName: string;
  choice: string; // "REQUIRED" | "NOT_REQUIRED"
  timestamp: number;
}

export interface PaymentEntity {
  id: string;
  pgId: string;
  payerId: string;
  payerName: string;
  amount: number;
  paymentType: string; // "OWNER_SUBSCRIPTION" | "GUEST_RENT" | "GUEST_FOOD"
  transactionRef: string;
  timestamp: number;
  status: string; // "PENDING" | "VERIFIED" | "REJECTED"
  paymentMode: string; // "ONLINE_PHONEPE" | "SCAN_QR" | "PHONE_UPI" | "CASH_HANDOVER"
  utrRef: string;
  monthYear: string;
  receiptId: string;
  rejectReason: string;
  verificationDate: number;
}

export interface FeedbackComplaintEntity {
  id: string;
  pgId: string;
  guestId: string;
  guestName: string;
  roomNo: string | null;
  title: string;
  description: string;
  category: string;
  status: string; // "Open" | "In Progress" | "Resolved"
  type: string; // "COMPLAINT" | "FEEDBACK"
  timestamp: number;
  mediaUri: string | null;
  isVideo: boolean;
  adminResponse: string | null;
  /** Who this ticket is assigned to, or null when unassigned. The staff-facing "my tickets"
   *  filter matches this against the signed-in staffer's own membership id. */
  assignedMembershipId: string | null;
  mealRating: number;
  cleanlinessRating: number;
  managerRating: number;
  staffRating: number;
  otherRating: number;
  overallRating: number;
  /** From `details.severity` — a human urgency label ("Low"/"Medium"/"High") for tickets
   *  that carry one, e.g. maintenance-reported facility issues. The server's own `priority`
   *  enum (normal/express/scheduled) drives push urgency and doesn't map cleanly onto this
   *  3-way vocabulary, so it rides in `details` instead of overloading that field. */
  priorityLabel: string | null;
  /** From `details.location` — free-text location for a ticket raised by someone with no
   *  room of their own to fall back to (staff, not a resident). */
  location: string | null;
}

export interface ExpenseEntity {
  id: string;
  pgId: string;
  title: string;
  category: string;
  amount: number;
  dateLogged: number;
  loggedByRole: string; // "Manager" | "Owner"
  loggedByName: string;
  paymentMode: string;
  notes: string;
  monthYear: string;
  recipientName: string;
  status: string;
}

export interface AppRoleNotificationEntity {
  id: string;
  pgId: string;
  targetRole: string; // "ALL" | "OWNER" | "MANAGER" | "RESIDENT" | "CHEF"
  title: string;
  message: string;
  category: string;
  timestamp: number;
  isRead: boolean;
  priority: string; // "HIGH" | "MEDIUM" | "LOW"
  actionLabel: string | null;
  actionType: string | null;
  /** What `actionType` refers to — a request id, a payment id. Was silently dropped by the
   *  mapper even though the wire record carries it, which is why the inbox's own action
   *  button could mark a row read and nothing else: it had a verb ("View Ticket") and
   *  nothing to point it at. */
  actionId: string | null;
}

// ---- Non-Entity Data Classes ----

export interface PGGroceryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  isDailyEssential: boolean;
  iconName: string;
}

export interface PGGroceryOrder {
  id: string;
  pgId: string;
  itemsSummary: string;
  totalPrice: number;
  timestamp: number;
  status: string;
  deliveryEtaMinutes: number;
  isExpress10Min: boolean;
  riderName: string;
  riderPhone: string;
}

/** A grocery shopping list the Chef put together for the kitchen — Chef can
 *  only request, not buy; Manager/Owner review it and place the real order. */
export interface PGDailyGrocerySubscription {
  id: string;
  pgId: string;
  title: string;
  itemsSummary: string;
  dailyDeliveryTime: string;
  estimatedDailyCost: number;
  isActive: boolean;
  startDate: number;
}

export interface PGRepairServiceRequest {
  id: string;
  pgId: string;
  category: string;
  issueTitle: string;
  urgency: string;
  assignedTechnicianName: string;
  technicianPhone: string;
  technicianRating: number;
  estimatedCost: number;
  status: string;
  etaMinutes: number;
  timestamp: number;
}

export interface GuestLaundryRequest {
  id: string;
  guestId: string;
  guestName: string;
  roomNo: string;
  serviceType: string;
  weightOrCount: string;
  pickupPreference: string;
  preferredSlot: string;
  specialNotes: string;
  totalCost: number;
  paymentStatus: string;
  status: string;
  timestamp: number;
}

// ---- App-level helpers ----

export interface SimulatedAlert {
  title: string;
  description: string;
  type: string; // "MEAL" | "PAYMENT" | "KYC_VERIFIED" | "KYC_REJECTED" | "ANNOUNCEMENT"
  notificationId?: string | null;
  timestamp: number;
}

export type AppScreen =
  | 'WELCOME'
  | 'OWNER_REGISTER'
  | 'OWNER_LOGIN'
  | 'OWNER_SUBSCRIPTION'
  | 'OWNER_DASHBOARD'
  | 'GUEST_JOIN'
  | 'GUEST_DASHBOARD'
  | 'STAFF_LOGIN'
  | 'STAFF_DASHBOARD'
  // ── Task 8: new screens ─────────────────────────────────────────────────
  | 'PROCUREMENT_SCREEN'
  | 'STAFF_ATTENDANCE'
  // ── Cyber Mint hub-and-spoke drill-downs ─────────────────────────────────
  // Dedicated full-screen pages reached from the dashboard hubs via
  // pushScreen(). Each replaces what used to be a cramped in-tab section
  // and ships its own sticky back-button header (see HubScreenWrapper).
  | 'PNL_ANALYTICS'           // Owner: P&L 3m/6m/1y + CSV export
  | 'MANAGER_PROVISIONING'    // Owner: invite & reset managers
  | 'BED_VISUALIZER'          // Manager: floor → room → bed matrix
  | 'TENANT_LIST'             // Manager: tenant roster + KYC decisions
  | 'INVOICE_DETAIL'          // Resident: PDF invoice modal wrapper
  | 'TICKET_DETAIL'           // Resident: maintenance ticket tracker
  | 'OWNER_SERVICES'          // Owner/Manager: 10-min grocery, daily subs, repairs, procurement
  | 'GUEST_HUB_SERVICES'      // Resident: hub services & marketplace
  | 'UPI_SETTINGS'            // Owner: UPI handle configuration
  | 'MANAGE_PROPERTIES'       // Owner: portfolio list, switch/add/edit PGs
  | 'PORTFOLIO'               // Owner: cross-property totals + revenue/net by property
  | 'SETTINGS_SCREEN'         // Owner/Manager: account + UPI + logout
  // ── Groceries ────────────────────────────────────────────────────────────
  | 'GROCERIES_SCREEN'        // Owner/Manager/Chef/Guest: grocery catalog
  | 'GROCERY_CATEGORY'        // Category product listing
  | 'GROCERY_PRODUCT'         // Product detail
  | 'GROCERY_CART'            // Cart review
  | 'GROCERY_CHECKOUT'        // GST checkout
  | 'GROCERY_ORDERS'          // Order history
  | 'GROCERY_ORDER_DETAIL';   // Single order tracking

export type UserRole = 'OWNER' | 'GUEST' | 'STAFF' | 'MANAGER' | 'CHEF';

// ── Task 8: P&L interval selector — complements Task 7's PnLData type ──────────
export type PnLInterval = '3m' | '6m' | '1y';

export interface CloudKitchenAd {
  // Local, hard-coded ad inventory — never a server id.
  id: number;
  brandName: string;
  tagline: string;
  description: string;
  discountCode: string;
  discountPercent: number;
  rating: number;
  deliveryTime: string;
  cuisines: string;
  imageResId: string; // local asset key
}

export interface DailyTrend {
  dayName: string;
  yesCount: number;
  noCount: number;
  pendingCount: number;
  recommendation: string;
  wasteRisk: string;
}

export interface SimulatedMedia {
  id: string;
  name: string;
  isVideo: boolean;
  textRepresentation: string;
  mockIcon: string;
}

export interface VisualDishItem {
  name: string;
  icon: string;
  category: string;
  isVeg: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 7 — reusable-component support types.
// These describe the wire shapes the new owner/manager/staff screens will fetch
// from the property / meal / procurement / billing / panic / attendance modules.
// They live next to the legacy entity types so the screens subagent can import
// them from the single barrel `@/types`.
// ─────────────────────────────────────────────────────────────────────────────

/** Dietary preference stored on a `memberships` row. Mirrors the backend CHECK. */
export type DietaryPreference = 'veg' | 'non_veg' | 'eggitarian' | 'none';

/** A single bed inside a room. Status drives the seat-map color state. */
export interface BedResponse {
  id: string;
  bedNumber: string;
  status: 'vacant' | 'occupied' | 'reserved' | 'maintenance';
  /** Present only when `status === 'occupied'`. Used by the seat map tooltip
   *  and the manager action drawer. */
  tenant?: {
    membershipId: string;
    fullName: string;
    phone: string;
    dietaryPreference: DietaryPreference;
    allergies?: string;
    checkInDate?: string;
    kycStatus?: 'pending' | 'verified' | 'rejected';
  } | null;
}

/** A room aggregates its beds. `sharingType` is the headcount, not a label. */
export interface RoomResponse {
  id: string;
  floorNumber: number;
  roomNumber: string;
  sharingType: 1 | 2 | 3 | 4;
  baseRent?: number;
  beds: BedResponse[];
}

/** Full property floor/room/bed layout returned by `GET /v1/pgs/{id}/layout`. */
export interface PropertyLayoutResponse {
  pgId: string;
  propertyName: string;
  totalFloors: number;
  floors: Array<{
    floorNumber: number;
    rooms: RoomResponse[];
  }>;
}

/** Per-meal opt-in state shown by the MealToggleWidget. `nextCutoffMs` is a
 *  wall-clock ms timestamp; `null` means "no upcoming cutoff today". */
export interface MealToggleState {
  enabled: boolean;
  cutoffTime: string;
  nextCutoffMs: number | null;
  menuSummary: string;
}

/** A reusable catalog row for the procurement cart. */
export interface ProcurementCatalogItem {
  id: string;
  pgId: string | null;
  itemName: string;
  category: 'grocery' | 'supplies' | 'produce' | 'dairy' | 'cleaning' | 'toiletries' | 'hardware' | 'other';
  unit: string;
  defaultPrice: number;
  isActive: boolean;
}

/** A procurement order with its line items. Status drives the approval queue. */
export interface ProcurementOrder {
  id: string;
  pgId: string;
  managerId: string;
  orderType: 'grocery' | 'supplies' | 'emergency';
  status: 'draft' | 'pending_owner_approval' | 'approved' | 'rejected' | 'ordered' | 'delivered';
  totalCost: number;
  notes?: string;
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  items: Array<{
    id: string;
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    estimatedPrice: number;
    lineTotal: number;
  }>;
}

/** A staff SOS alert. Lifecycle: active → acknowledged → resolved. */
export interface PanicAlert {
  id: string;
  pgId: string;
  triggeredByMembershipId: string;
  triggeredByUserName: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

/** A staff member's shift on a given day. Off-days carry no times and no QR. */
export interface StaffShift {
  id: string;
  pgId: string;
  staffMembershipId: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  isOffDay: boolean;
  qrCodeHash?: string;
}

/** A single clock-in/out record against a shift. */
export interface AttendancePunch {
  id: string;
  pgId: string;
  staffMembershipId: string;
  shiftId: string;
  punchInAt: string;
  punchOutAt?: string;
  punchInMethod: 'qr' | 'geofence' | 'manual';
  punchOutMethod?: 'qr' | 'geofence' | 'manual';
  punchInLatitude?: number;
  punchInLongitude?: number;
  status: 'in_progress' | 'completed' | 'missed';
}

/** A tenant's monthly rent invoice. Lifecycle: unpaid → paid (or overdue). */
export interface TenantInvoice {
  id: string;
  pgId: string;
  tenantMembershipId: string;
  month: number;
  year: number;
  rentAmount: number;
  utilityAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  dueDate: string;
  status: 'paid' | 'unpaid' | 'overdue';
  paidAt?: string;
  pdfUrl?: string;
  createdAt: string;
}

/** P&L payload for the 3m/6m/1y chart. `monthly` is ordered oldest → newest. */
export interface PnLData {
  monthly: Array<{ period: string; revenue: number; expenses: number; net: number }>;
  totals: { revenue: number; expenses: number; net: number };
}

/** A day-of-week meal menu entry (breakfast/lunch/dinner). */
export interface MealMenu {
  id: string;
  pgId: string;
  dayOfWeek: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  menuItems: string[];
  servingTime: string;
  chefNote?: string;
}

/** A rating left on a meal. */
export interface MealFeedback {
  id: string;
  mealId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

/** Today's headcount split per meal, for the kitchen dashboard. */
export interface TodayMealSummary {
  breakfast?: MealTypeSummary;
  lunch?: MealTypeSummary;
  dinner?: MealTypeSummary;
}

export interface MealTypeSummary {
  totalAttending: number;
  vegCount: number;
  nonVegCount: number;
  eggitarianCount: number;
  allergyCount: number;
  totalSkip: number;
}

// ─── Supply & Operations ────────────────────────────────────────────────────────────

export * from './supply';


