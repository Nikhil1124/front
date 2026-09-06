/**
 * Server DTO → app entity.
 *
 * The screens were written against a local Room-style schema (camelCase, one flat row per
 * thing). The API speaks snake_case, splits some of those rows across several endpoints, and
 * has no concept at all of a few fields the UI reads. Rather than rename fields in 36 screen
 * files, every difference is absorbed here, in one place, where each compromise is visible
 * and can be checked against the backend.
 *
 * Where the server has no equivalent the mapper fills a value and says why. Those are the
 * spots to revisit when the backend grows the missing concept — not silent defaults.
 */

import type { ExpenseRecord } from "../features/expenses/useExpenses";
import type { GuestMember } from "../features/guests/useGuests";
import type { KycRecord } from "../features/kyc/useKyc";
import type { MealOut } from "../features/meals/useMeals";
import type { NotificationRecord } from "../features/notifications/useNotifications";
import type { PaymentRecord } from "../features/payments/usePayments";
import type { PgResponse } from "../features/properties/useProperties";
import type { RequestRecord } from "../features/requests/useComplaints";
import type { StaffMember } from "../features/staff/useStaff";
import type { User } from "../store/authStore";
import type {
  AppRoleNotificationEntity,
  ExpenseEntity,
  FeedbackComplaintEntity,
  GuestEntity,
  GuestLaundryRequest,
  MealNotificationEntity,
  PGGroceryOrder,
  PGOwnerEntity,
  PGRepairServiceRequest,
  PaymentEntity,
  StaffMemberEntity,
  // ── Task 8: new wire-shape types (Task 7-defined) ──────────────────────
  PropertyLayoutResponse,
  ProcurementCatalogItem,
  ProcurementOrder,
  TenantInvoice,
  PnLData,
} from "../types";

// ─── Small shared conversions ────────────────────────────────────────────────

/** ISO 8601 → epoch millis. Returns 0 for null/unparseable rather than NaN, which renders
 *  as "Invalid Date" in every date helper this app has. */
export function toMillis(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Pydantic serialises Decimal to a JSON string ("8500.00"). Arithmetic on that is string
 *  concatenation, so every money field goes through here. */
export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * To E.164, which is the only shape the API's `Phone` accepts (`^\+[1-9][0-9]{7,14}$`).
 *
 * The forms let people type "9876543210" or "+91 98765 43210" — both are what an Indian
 * user actually writes. A bare 10-digit number gets +91; anything already carrying a country
 * code keeps it. Returns the stripped input unchanged when it fits no known shape, so the
 * server's own validation produces the error rather than this guessing further.
 */
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (hadPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  // "919876543210" — a country code typed without the plus.
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return trimmed;
}

/**
 * The period the payments API keys rent on: the first of the current month, "YYYY-MM-01".
 *
 * Pinned to India, not to the device. The server does the same (`app/core/clock.py`: "Every
 * *date* this product stores is a date in India ... while the servers run in UTC"), and the
 * two have to agree — `period` is sent in the body of `POST /v1/payments` and trusted there.
 * Read off the device clock, a phone anywhere west of IST returns the *previous* month for
 * the first 5½ hours of the 1st, so a resident paying then files their rent against the cycle
 * that just closed: the owner still sees the month unpaid, the resident sees "recorded".
 *
 * A fixed +5:30 offset rather than `Intl`: IST has never observed DST, so the offset is exact
 * and this keeps working if the JS engine ships without full ICU data.
 */
const IST_OFFSET_MINUTES = 330;

export function currentPeriod(date = new Date()): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** "2026-08-01" → "August 2026", which is what the receipts and payment rows display. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function periodToMonthYear(period: string): string {
  const [y, m] = period.split("-");
  const index = parseInt(m, 10) - 1;
  return MONTHS[index] ? `${MONTHS[index]} ${y}` : period;
}

const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * `PGOwnerEntity` is three server concepts in one row: the property, the owner's identity,
 * and a subscription. Only the first exists as an endpoint, so the caller passes the signed-in
 * user for the second, and the third is filled below.
 */
export function toPgOwner(
  pg: PgResponse,
  user: User | null,
  manager?: StaffMember | null
): PGOwnerEntity {
  return {
    id: pg.id,
    pgName: pg.name,
    ownerName: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    // No server concept. It was the demo's shared secret for owner login; real auth is
    // phone + password, so nothing should read this for authentication ever again.
    securityCode: "",
    // Real now: `/v1/billing` derives this from the property's live subscription. It used to
    // be hardcoded true because there was no billing module to ask, which meant the app could
    // not tell a paying property from a lapsed one.
    subscriptionActive: pg.subscription_active,
    // The renewal date lives on the subscription, not the property, so it comes from
    // GET /v1/billing/subscription rather than here.
    subscriptionExpiry: 0,
    // Was the QR join code. The backend has no self-join: residents are created by their
    // owner through POST /v1/guests. The property id at least identifies the right property
    // to whoever is looking at it.
    qrCodeUrl: pg.id,
    address: pg.formatted_address || pg.address,
    totalBeds: pg.total_beds,
    subscriptionMode: "FIXED_LIMIT",
    phonePeNumber: "",
    upiId: pg.active_upi_vpa ?? "",
    managerName: manager?.name ?? "",
    managerPhone: manager?.phone ?? "",
    // Never leaves the server — `has_pin` is all the API exposes, by design.
    managerPin: "",
    latitude: pg.latitude,
    longitude: pg.longitude,
    formattedAddress: pg.formatted_address,
    // Null for anyone who does not manage the property: possession of this string is what
    // lets a stranger create an account there, so the server withholds it from everyone else.
    joinCode: pg.join_code ?? "",
    defaultRentAmount: toAmount(pg.default_rent_amount),
  };
}

// ─── Guest ───────────────────────────────────────────────────────────────────

const KYC_STATUS: Record<KycRecord["status"], string> = {
  pending: "PENDING",
  verified: "VERIFIED",
  rejected: "REJECTED",
};

export function toGuest(
  g: GuestMember,
  extras: { kyc?: KycRecord | null; isBillPaid?: boolean; rewardPoints?: number } = {}
): GuestEntity {
  const kyc = extras.kyc ?? null;
  const statusRaw = kyc?.status ?? g.kyc_status ?? null;
  const statusStr = statusRaw ? KYC_STATUS[statusRaw as keyof typeof KYC_STATUS] ?? "NOT_SUBMITTED" : "NOT_SUBMITTED";

  return {
    // The membership, not the user: a person can hold memberships in several properties and
    // every guest-scoped endpoint here is addressed by membership.
    id: g.membership_id,
    pgId: g.pg_id,
    name: g.name,
    email: g.email ?? "",
    phone: g.phone,
    roomNo: g.room_no,
    // Write-only on the server, as it should be.
    password: "",
    registrationDate: toMillis(g.started_at),
    // Derived from this month's verified rent payment by the caller, which is the only
    // place that has the payment list. Defaults to unpaid: showing a due bill that is
    // already settled is a smaller error than hiding one that is not.
    isBillPaid: extras.isBillPaid ?? false,
    rentAmount: toAmount(g.rent_amount),
    // `SUM(delta)` from the rewards ledger, supplied by the caller — it comes from a
    // different endpoint, and fetching it per resident here would be an N+1 across the whole
    // roster.
    rewardPoints: extras.rewardPoints ?? 0,
    // Empty, not "Aadhaar Card". `GuestResponse` has no `kind` field — the roster reports
    // kyc_status and the image urls, never which document it is — so this used to label
    // every submission Aadhaar, including a passport. Callers show the document itself now.
    idProofType: "",
    idProofNumber: "",
    // Presigned and short-lived; re-read from the KYC record rather than persisted.
    idProofPhotoUri: kyc?.front_url ?? g.kyc_front_url ?? "",
    profilePhotoUri: kyc?.selfie_url ?? g.kyc_selfie_url ?? "",
    kycStatus: statusStr as any,
    kycRejectReason: kyc?.reject_reason ?? g.kyc_reject_reason ?? "",
    kycSubmissionDate: toMillis(kyc?.submitted_at ?? g.kyc_submitted_at),
    kycVerificationDate: toMillis(kyc?.decided_at ?? g.kyc_decided_at),
  };
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function toStaff(s: StaffMember): StaffMemberEntity {
  const shift =
    s.shift_start && s.shift_end
      ? `${s.shift_start.slice(0, 5)} - ${s.shift_end.slice(0, 5)}`
      : "";
  return {
    id: s.membership_id,
    pgId: s.pg_id,
    name: s.name,
    // "kitchen_staff" → "Kitchen Staff": the UI matches on 'Manager' and 'Chef'.
    role: titleCase(s.role),
    // Hashed server-side; `has_pin` is the only thing the API reveals, so PIN comparison in
    // the client is gone for good — PIN login goes through POST /v1/auth/login/pin.
    loginPin: "",
    phone: s.phone,
    shiftTime: shift,
    monthlySalary: toAmount(s.monthly_salary),
  };
}

// ─── Meals ───────────────────────────────────────────────────────────────────

export function toMeal(m: MealOut): MealNotificationEntity {
  const serviceAt = new Date(toMillis(m.service_at));
  return {
    id: m.id,
    pgId: m.pg_id,
    mealType: titleCase(m.meal_type),
    menuItems: m.menu_items,
    dietaryType: m.dietary_type,
    chefNote: m.chef_note,
    timestamp: toMillis(m.service_at),
    isClosed: !m.is_open,
    // The UI's "HH:mm" 24h field, taken from the meal's service time in local time.
    serviceTime: `${String(serviceAt.getHours()).padStart(2, "0")}:${String(
      serviceAt.getMinutes()
    ).padStart(2, "0")}`,
    isAlertSent: !!m.is_broadcast,
  };
}

// ─── Payments ────────────────────────────────────────────────────────────────

const PAYMENT_TYPE: Record<PaymentRecord["purpose"], string> = {
  rent: "GUEST_RENT",
  food: "GUEST_FOOD",
  service: "GUEST_SERVICE",
};

const PAYMENT_MODE: Record<PaymentRecord["method"], string> = {
  upi_intent: "ONLINE_PHONEPE",
  upi_manual: "PHONE_UPI",
  cash: "CASH_HANDOVER",
};

export function toPayment(p: PaymentRecord): PaymentEntity {
  return {
    id: p.id,
    pgId: p.pg_id,
    payerId: p.membership_id,
    payerName: p.guest_name ?? "",
    amount: toAmount(p.amount),
    paymentType: PAYMENT_TYPE[p.purpose] ?? "GUEST_RENT",
    transactionRef: p.upi_ref ?? "",
    timestamp: toMillis(p.created_at),
    status: p.status.toUpperCase(),
    paymentMode: PAYMENT_MODE[p.method] ?? "PHONE_UPI",
    utrRef: p.upi_ref ?? "",
    monthYear: periodToMonthYear(p.period),
    // The server issues no receipt number; the payment id is the stable reference a
    // resident can quote and an owner can look up.
    receiptId: p.status === "verified" ? p.id : "",
    rejectReason: p.rejection_reason ?? "",
    verificationDate: toMillis(p.verified_at),
    verifiedByName: p.verified_by_name ?? "",
  };
}

// ─── Complaints & feedback ───────────────────────────────────────────────────

/** The UI's status labels. `assigned` and `in_progress` are both work-in-flight. `cancelled`
 *  is closed but it is NOT resolved — it used to map onto "Resolved", which told a resident
 *  their withdrawn ticket had been dealt with and told an owner the same thing. Both are
 *  closed for the purpose of "stop chasing this"; only one of them means the problem went
 *  away. Anything counting open work must therefore exclude both, not just "Resolved". */
const REQUEST_STATUS: Record<RequestRecord["status"], string> = {
  open: "Open",
  assigned: "In Progress",
  in_progress: "In Progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

/** The closed set, so callers stop hand-writing `status !== 'Resolved'` and silently
 *  counting cancelled tickets as open work. */
export const CLOSED_REQUEST_STATUSES = ["Resolved", "Cancelled"] as const;
export function isRequestOpen(status: string): boolean {
  return !CLOSED_REQUEST_STATUSES.includes(status as (typeof CLOSED_REQUEST_STATUSES)[number]);
}

export function toComplaint(r: RequestRecord): FeedbackComplaintEntity {
  const photo = r.attachments?.find((a) => a.url) ?? null;
  // The resolution note if there is one, otherwise the most recent staff comment — which is
  // what "has anyone answered me?" actually means to a resident.
  const lastComment = r.events
    ?.filter((e) => e.event_type === "comment" && e.body)
    .slice(-1)[0];
  return {
    id: r.id,
    pgId: r.pg_id,
    guestId: r.raised_by,
    guestName: r.resident_name ?? "",
    roomNo: r.room_no ?? null,
    title: r.title,
    description: r.description,
    category: r.category ?? "",
    status: REQUEST_STATUS[r.status] ?? "Open",
    type: r.kind === "feedback" ? "FEEDBACK" : "COMPLAINT",
    timestamp: toMillis(r.created_at),
    mediaUri: photo?.url ?? null,
    isVideo: !!photo?.content_type?.startsWith("video/"),
    adminResponse: r.resolution_note ?? lastComment?.body ?? null,
    assignedMembershipId: r.assigned_membership_id ?? null,
    // Carried in `details` by submitFeedbackComplaint — see the note there on why that is
    // the extension point rather than a dedicated reviews endpoint. A ticket with no scores
    // (every complaint, and any feedback filed before this shipped) reads as 0, which every
    // consumer already treats as "unrated" and filters out.
    mealRating: detailNum(r, "meal_rating"),
    cleanlinessRating: detailNum(r, "cleanliness_rating"),
    managerRating: detailNum(r, "manager_rating"),
    staffRating: detailNum(r, "staff_rating"),
    otherRating: detailNum(r, "other_rating"),
    // Averaged over the scores actually given, never over silent zeros — a resident who
    // rated only their meals must not be recorded as having given the manager a 0.
    overallRating: (() => {
      const given = [
        detailNum(r, "meal_rating"),
        detailNum(r, "cleanliness_rating"),
        detailNum(r, "manager_rating"),
        detailNum(r, "staff_rating"),
        detailNum(r, "other_rating"),
      ].filter((v) => v > 0);
      return given.length ? given.reduce((a, b) => a + b, 0) / given.length : 0;
    })(),
    priorityLabel: detailStr(r, "severity") || null,
    location: detailStr(r, "location") || null,
  };
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

export function toRoleNotification(n: NotificationRecord): AppRoleNotificationEntity {
  return {
    id: n.id,
    pgId: n.pg_id ?? "",
    // The server addresses a person, not a role — it has already decided this row belongs to
    // the caller, so there is no role left to filter on client-side.
    targetRole: "ALL",
    title: n.title,
    message: n.body,
    category: n.category.toUpperCase(),
    timestamp: toMillis(n.created_at),
    isRead: n.is_read,
    priority: n.priority.toUpperCase(),
    actionLabel: n.action_type ? titleCase(n.action_type) : null,
    actionType: n.action_type ?? null,
    actionId: n.action_id ?? null,
  };
}

// ─── Hub services ────────────────────────────────────────────────────────────
// Grocery, laundry and repairs are `requests` with a `kind`. Everything specific to one of
// them — the rider, the ETA, the pickup slot — rides in the `details` JSONB rather than
// becoming a column three of the five kinds would leave null.

/**
 * The server tracks five states; each hub service calls them something different.
 *
 * A lookup rather than a `display_status` string saved into `details`: a label written at
 * booking time goes stale the moment the status changes, and then two fields disagree about
 * the same fact.
 */
const HUB_STATUS: Record<string, Record<RequestRecord["status"], string>> = {
  grocery: {
    open: "Order Placed",
    assigned: "Packing at DarkStore",
    in_progress: "Out for Delivery",
    resolved: "Delivered",
    cancelled: "Cancelled",
  },
  repair: {
    open: "Technician Requested",
    assigned: "Technician Assigned",
    in_progress: "En-Route",
    resolved: "Completed",
    cancelled: "Cancelled",
  },
  laundry: {
    open: "Pickup Scheduled",
    assigned: "Picked Up",
    in_progress: "Washing & Ironing",
    resolved: "Delivered",
    cancelled: "Cancelled",
  },
};

/** Reverse of the above, so a tap on "Delivered" becomes a real status transition. */
export function hubStatusToServer(
  kind: "grocery" | "repair" | "laundry",
  label: string
): RequestRecord["status"] {
  const table = HUB_STATUS[kind];
  const found = (Object.keys(table) as RequestRecord["status"][]).find(
    (status) => table[status].toLowerCase() === label.toLowerCase()
  );
  return found ?? "in_progress";
}

const detailStr = (r: RequestRecord, key: string, fallback = ""): string => {
  const value = (r.details ?? {})[key];
  return typeof value === "string" ? value : fallback;
};

const detailNum = (r: RequestRecord, key: string, fallback = 0): number => {
  const value = (r.details ?? {})[key];
  return typeof value === "number" ? value : fallback;
};

export function toGroceryOrder(r: RequestRecord): PGGroceryOrder {
  return {
    id: r.id,
    pgId: r.pg_id,
    itemsSummary: r.title,
    totalPrice: toAmount(r.amount),
    timestamp: toMillis(r.created_at),
    status: HUB_STATUS.grocery[r.status] ?? "Order Placed",
    deliveryEtaMinutes: detailNum(r, "eta_minutes"),
    // `express` is the priority the request was raised at, not a detail field — the server
    // already has a word for "this is urgent".
    isExpress10Min: r.priority === "express",
    riderName: r.assigned_name ?? detailStr(r, "rider_name"),
    riderPhone: detailStr(r, "rider_phone"),
  };
}

export function toRepairRequest(r: RequestRecord): PGRepairServiceRequest {
  return {
    id: r.id,
    pgId: r.pg_id,
    category: r.category ?? "",
    issueTitle: r.title,
    urgency: detailStr(r, "urgency"),
    // Whoever the ticket is actually assigned to wins over whatever was guessed at booking.
    assignedTechnicianName: r.assigned_name ?? detailStr(r, "technician_name"),
    technicianPhone: detailStr(r, "technician_phone"),
    technicianRating: detailNum(r, "technician_rating"),
    estimatedCost: toAmount(r.amount),
    status: HUB_STATUS.repair[r.status] ?? "Technician Requested",
    etaMinutes: detailNum(r, "eta_minutes"),
    timestamp: toMillis(r.created_at),
  };
}

export function toLaundryRequest(r: RequestRecord): GuestLaundryRequest {
  return {
    id: r.id,
    guestId: r.raised_by,
    guestName: r.resident_name ?? "",
    roomNo: r.room_no ?? "",
    serviceType: detailStr(r, "service_type"),
    weightOrCount: detailStr(r, "weight_or_count"),
    pickupPreference: detailStr(r, "pickup_preference"),
    preferredSlot: detailStr(r, "preferred_slot"),
    specialNotes: r.description,
    totalCost: toAmount(r.amount),
    paymentStatus: detailStr(r, "payment_status"),
    status: HUB_STATUS.laundry[r.status] ?? "Pickup Scheduled",
    timestamp: toMillis(r.created_at),
  };
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export function toExpense(e: ExpenseRecord): ExpenseEntity {
  return {
    id: e.id,
    pgId: e.pg_id,
    title: e.title,
    category: titleCase(e.category),
    // Negative on a reversal, deliberately: that is how a correction nets out of the total
    // without a status column anyone has to remember to filter on.
    amount: toAmount(e.amount),
    dateLogged: toMillis(e.created_at),
    loggedByRole: e.logged_by_role ? titleCase(e.logged_by_role) : "",
    loggedByName: e.logged_by_name ?? "",
    paymentMode: titleCase(e.method),
    notes: e.notes,
    monthYear: periodToMonthYear(e.period),
    // Either the staff member a salary went to, or the free-text vendor for everything else.
    recipientName: e.paid_to_name ?? e.recipient_name,
    // The UI's one status field. `expenses` has no status column — an entry either stands or
    // has been reversed — so this reports which.
    status: e.reverses_expense_id
      ? "REVERSAL"
      : e.reversed_by_expense_id
        ? "REVERSED"
        : "LOGGED",
  };
}

// ─── Task 8 — new module mappers ────────────────────────────────────────────
//
// Each mapper takes a raw server DTO (`any`) and returns the matching wire-shape
// type from `@/types`. They are defensive in the same way the legacy mappers
// above are: a missing field yields the zero value of its TS type rather than
// throwing, so a partially-shaped response (e.g. a panic alert with no
// location) renders as "—" rather than crashing the screen.

/** Safe accessor for snake_case keys that may be missing on the wire. */
function str(v: any, fallback = ""): string {
  if (v == null) return fallback;
  return typeof v === "string" ? v : String(v);
}
function num(v: any, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}
function bool(v: any, fallback = false): boolean {
  if (v == null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

// ─── Property layout (rooms / beds / floors) ────────────────────────────────

export function toPropertyLayout(dto: any): PropertyLayoutResponse {
  const floors = Array.isArray(dto?.floors)
    ? dto.floors.map((f: any) => ({
        floorNumber: num(f?.floor_number ?? f?.floorNumber, 0),
        rooms: Array.isArray(f?.rooms)
          ? f.rooms.map((r: any) => ({
              id: str(r?.id),
              floorNumber: num(r?.floor_number ?? r?.floorNumber, 0),
              roomNumber: str(r?.room_number ?? r?.roomNumber),
              sharingType: (num(r?.sharing_type ?? r?.sharingType, 1) as 1 | 2 | 3 | 4),
              baseRent: r?.base_rent != null ? num(r.base_rent) : r?.baseRent,
              beds: Array.isArray(r?.beds)
                ? r.beds.map((b: any) => ({
                    id: str(b?.id),
                    bedNumber: str(b?.bed_number ?? b?.bedNumber),
                    status: (str(b?.status, "vacant") as
                      | "vacant"
                      | "occupied"
                      | "reserved"
                      | "maintenance"),
                    tenant: b?.tenant
                      ? {
                          membershipId: str(b.tenant?.membership_id ?? b.tenant?.membershipId),
                          fullName: str(b.tenant?.full_name ?? b.tenant?.fullName),
                          phone: str(b.tenant?.phone),
                          dietaryPreference: (str(b.tenant?.dietary_preference ?? b.tenant?.dietaryPreference, "none") as
                            | "veg"
                            | "non_veg"
                            | "eggitarian"
                            | "none"),
                          allergies: b.tenant?.allergies != null ? str(b.tenant.allergies) : undefined,
                          checkInDate: b.tenant?.check_in_date != null ? str(b.tenant.check_in_date) : undefined,
                          kycStatus: b.tenant?.kyc_status != null
                            ? (str(b.tenant.kyc_status) as "pending" | "verified" | "rejected")
                            : undefined,
                        }
                      : null,
                  }))
                : [],
            }))
          : [],
      }))
    : [];

  return {
    pgId: str(dto?.pg_id ?? dto?.pgId),
    propertyName: str(dto?.property_name ?? dto?.propertyName ?? dto?.pg_name),
    totalFloors: num(dto?.total_floors ?? dto?.totalFloors, floors.length),
    floors,
  };
}

// ─── Procurement ────────────────────────────────────────────────────────────

export function toProcurementCatalogItem(dto: any): ProcurementCatalogItem {
  return {
    id: str(dto?.id),
    pgId: dto?.pg_id != null ? str(dto.pg_id) : null,
    itemName: str(dto?.item_name ?? dto?.itemName),
    category: (str(dto?.category, "other") as ProcurementCatalogItem["category"]),
    unit: str(dto?.unit),
    defaultPrice: num(dto?.default_price ?? dto?.defaultPrice),
    isActive: bool(dto?.is_active ?? dto?.isActive, true),
  };
}

export function toProcurementOrder(dto: any): ProcurementOrder {
  return {
    id: str(dto?.id),
    pgId: str(dto?.pg_id ?? dto?.pgId),
    managerId: str(dto?.manager_id ?? dto?.managerId),
    orderType: (str(dto?.order_type ?? dto?.orderType, "grocery") as ProcurementOrder["orderType"]),
    status: (str(dto?.status, "pending_owner_approval") as ProcurementOrder["status"]),
    totalCost: num(dto?.total_cost ?? dto?.totalCost),
    notes: dto?.notes != null ? str(dto.notes) : undefined,
    rejectionReason: dto?.rejection_reason != null ? str(dto.rejection_reason) : undefined,
    approvedAt: dto?.approved_at != null ? str(dto.approved_at) : undefined,
    createdAt: str(dto?.created_at ?? dto?.createdAt),
    items: Array.isArray(dto?.items)
      ? dto.items.map((it: any) => ({
          id: str(it?.id),
          itemName: str(it?.item_name ?? it?.itemName),
          category: str(it?.category),
          quantity: num(it?.quantity),
          unit: str(it?.unit),
          estimatedPrice: num(it?.estimated_price ?? it?.estimatedPrice),
          lineTotal: num(it?.line_total ?? it?.lineTotal),
        }))
      : [],
  };
}

// ─── Tenant invoices ────────────────────────────────────────────────────────

export function toTenantInvoice(dto: any): TenantInvoice {
  return {
    id: str(dto?.id),
    pgId: str(dto?.pg_id ?? dto?.pgId),
    tenantMembershipId: str(dto?.tenant_membership_id ?? dto?.tenantMembershipId),
    month: num(dto?.month),
    year: num(dto?.year),
    rentAmount: num(dto?.rent_amount ?? dto?.rentAmount),
    utilityAmount: num(dto?.utility_amount ?? dto?.utilityAmount),
    penaltyAmount: num(dto?.penalty_amount ?? dto?.penaltyAmount),
    totalAmount: num(dto?.total_amount ?? dto?.totalAmount),
    dueDate: str(dto?.due_date ?? dto?.dueDate),
    status: (str(dto?.status, "unpaid") as TenantInvoice["status"]),
    paidAt: dto?.paid_at != null ? str(dto.paid_at) : undefined,
    pdfUrl: dto?.pdf_url != null ? str(dto.pdf_url) : undefined,
    createdAt: str(dto?.created_at ?? dto?.createdAt),
  };
}

// ─── PnL ────────────────────────────────────────────────────────────────────

export function toPnLData(dto: any): PnLData {
  const rawMonthly = Array.isArray(dto?.monthly_breakdown)
    ? dto.monthly_breakdown
    : Array.isArray(dto?.monthly)
      ? dto.monthly
      : [];

  const revenue = num(dto?.totals?.revenue ?? dto?.total_revenue ?? dto?.totalCollected ?? dto?.revenue);
  const expenses = num(dto?.totals?.expenses ?? dto?.total_expenses ?? dto?.totalSpent ?? dto?.expenses);
  const net = num(
    dto?.totals?.net ??
    dto?.net_profit ??
    dto?.total_net ??
    dto?.totalNet ??
    dto?.net ??
    (revenue - expenses)
  );

  return {
    monthly: rawMonthly.map((m: any) => {
      const mRev = num(m?.revenue ?? m?.collected);
      const mExp = num(m?.expenses ?? m?.spent);
      const mNet = num(m?.net ?? m?.net_profit ?? (mRev - mExp));
      return {
        period: str(m?.period ?? m?.month),
        revenue: mRev,
        expenses: mExp,
        net: mNet,
      };
    }),
    totals: {
      revenue,
      expenses,
      net,
    },
  };
}
