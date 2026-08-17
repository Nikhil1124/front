/**
 * In-memory demo data — the entire "backend" for this build.
 *
 * There is no server. Every array here is the mock database; `mockBackend.ts` reads and
 * mutates it in place. Shapes are raw snake_case wire DTOs — exactly what `mappers.ts`
 * expects from a real API response — so the rest of the app (screens, hooks, mappers)
 * never knows the difference.
 *
 * ── Demo sign-in ──────────────────────────────────────────────────────────────
 * Owner tab   — any phone + any password. Unrecognised phones auto-provision a fresh owner.
 * Resident tab (Login) — phone +919000000002, any password (Ananya Sharma, KYC verified).
 *   Other resident phones: +919000000012 (KYC pending), +919000000013 (KYC rejected),
 *   +919000000014 (KYC not submitted).
 * Manager tab — phone +919000000003, any PIN.
 * Kitchen/Staff tab — phone +919000000004 (chef), +919000000005 (kitchen staff),
 *   +919000000006 (maintenance) — any PIN. Unrecognised phone is rejected (401), same as a
 *   real backend — it used to silently sign you in as the demo chef instead, which is exactly
 *   as confusing as it sounds when you're actually trying to sign in as the manager.
 */

export const PG_ID = "pg_demo_1";
const PG_NAME = "Sunrise Residency PG";
// Two more dummy properties for the same owner — enough guests/payments/expenses on each
// to give the multi-PG Portfolio screen (see usePortfolioDetail) real numbers to roll up,
// not just zeros.
const PG2_ID = "pg_demo_2";
const PG2_NAME = "Lakeview PG";
const PG3_ID = "pg_demo_3";
const PG3_NAME = "Hillside Homes";

let seq = 1;
export function genId(prefix: string): string {
  return `${prefix}_${seq++}`;
}

export function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const DAY = 86_400_000;

// ─── Property ────────────────────────────────────────────────────────────────

export interface MockPg {
  id: string;
  name: string;
  address: string;
  total_beds: number;
  area_id: string | null;
  roles: string[];
  active_upi_vpa: string | null;
  latitude: string | null;
  longitude: string | null;
  formatted_address: string;
  map_image_url: string | null;
  join_code: string | null;
  default_rent_amount: string | null;
  subscription_active: boolean;
}

export const pgs: MockPg[] = [
  {
    id: PG_ID,
    name: PG_NAME,
    address: "Plot 42, Gachibowli Main Road",
    total_beds: 24,
    area_id: null,
    roles: ["owner"],
    active_upi_vpa: "sunrisepg@okhdfcbank",
    latitude: "17.440081",
    longitude: "78.348915",
    formatted_address: "Sunrise Residency PG, Gachibowli, Hyderabad, Telangana 500032",
    map_image_url: null,
    join_code: "SUNR2026",
    default_rent_amount: "8500.00",
    subscription_active: true,
  },
  {
    id: PG2_ID,
    name: PG2_NAME,
    address: "14-6-22, Lake Vista Road",
    total_beds: 18,
    area_id: null,
    roles: ["owner"],
    active_upi_vpa: "lakeviewpg@okhdfcbank",
    latitude: "17.412578",
    longitude: "78.443298",
    formatted_address: "Lakeview PG, Hussain Sagar, Hyderabad, Telangana 500080",
    map_image_url: null,
    join_code: "LAKE2026",
    default_rent_amount: "8000.00",
    subscription_active: true,
  },
  {
    id: PG3_ID,
    name: PG3_NAME,
    address: "7-1-58, Hillside Colony",
    total_beds: 20,
    area_id: null,
    roles: ["owner"],
    active_upi_vpa: "hillsidehomes@okaxis",
    latitude: "17.396789",
    longitude: "78.469821",
    formatted_address: "Hillside Homes, Banjara Hills, Hyderabad, Telangana 500034",
    map_image_url: null,
    join_code: "HILL2026",
    default_rent_amount: "7500.00",
    subscription_active: true,
  },
];

export const upiIds = [
  {
    id: "upi_1",
    pg_id: PG_ID,
    vpa_address: "sunrisepg@okhdfcbank",
    label: "Primary",
    is_active: true,
    created_at: nowIso(-90 * DAY),
  },
];

// ─── Memberships / users ────────────────────────────────────────────────────

export interface MockMembership {
  pg_id: string;
  pg_name: string;
  role: "owner" | "manager" | "chef" | "kitchen_staff" | "maintenance" | "guest";
  membership_id: string;
  room_no: string | null;
}

export interface MockUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  must_change_password: boolean;
  avatar_url: string | null;
  memberships: MockMembership[];
  platform_roles: never[];
  gate: "KYC_REQUIRED" | "KYC_PENDING" | "KYC_REJECTED" | "RENT_UNPAID" | null;
}

/** Every account this demo knows about, keyed by E.164 phone. Login/PIN-login/register all
 *  read and write this map, so a guest created via "Join PG" can log back in immediately. */
export const usersByPhone = new Map<string, MockUser>();

function addUser(u: MockUser) {
  usersByPhone.set(u.phone, u);
  return u;
}

addUser({
  id: "user_owner_1",
  name: "Rajesh Kumar",
  phone: "+919000000001",
  email: "rajesh.owner@pgow.demo",
  must_change_password: false,
  avatar_url: null,
  memberships: [
    { pg_id: PG_ID, pg_name: PG_NAME, role: "owner", membership_id: "mem_owner_1", room_no: null },
    { pg_id: PG2_ID, pg_name: PG2_NAME, role: "owner", membership_id: "mem_owner_2", room_no: null },
    { pg_id: PG3_ID, pg_name: PG3_NAME, role: "owner", membership_id: "mem_owner_3", room_no: null },
  ],
  platform_roles: [],
  gate: null,
});

addUser({
  id: "user_manager_1",
  name: "Deepika Rao",
  phone: "+919000000003",
  email: "deepika.manager@pgow.demo",
  must_change_password: false,
  avatar_url: null,
  memberships: [{ pg_id: PG_ID, pg_name: PG_NAME, role: "manager", membership_id: "mem_manager_1", room_no: null }],
  platform_roles: [],
  gate: null,
});

addUser({
  id: "user_chef_1",
  name: "Suresh Babu",
  phone: "+919000000004",
  email: null,
  must_change_password: false,
  avatar_url: null,
  memberships: [{ pg_id: PG_ID, pg_name: PG_NAME, role: "chef", membership_id: "mem_chef_1", room_no: null }],
  platform_roles: [],
  gate: null,
});

addUser({
  id: "user_kitchen_1",
  name: "Lakshmi Devi",
  phone: "+919000000005",
  email: null,
  must_change_password: false,
  avatar_url: null,
  memberships: [{ pg_id: PG_ID, pg_name: PG_NAME, role: "kitchen_staff", membership_id: "mem_kitchen_1", room_no: null }],
  platform_roles: [],
  gate: null,
});

addUser({
  id: "user_maint_1",
  name: "Ibrahim Sheikh",
  phone: "+919000000006",
  email: null,
  must_change_password: false,
  avatar_url: null,
  memberships: [{ pg_id: PG_ID, pg_name: PG_NAME, role: "maintenance", membership_id: "mem_maint_1", room_no: null }],
  platform_roles: [],
  gate: null,
});

/** Staff/manager PINs — `pin_login` checks phone only (any PIN succeeds), this just
 *  records what each demo account's real PIN "is" for anyone who wants to type it. */
export const staffPins = new Map<string, string>([
  ["+919000000003", "1234"],
  ["+919000000004", "1234"],
  ["+919000000005", "1234"],
  ["+919000000006", "1234"],
]);

// Residents ───────────────────────────────────────────────────────────────────

export interface MockGuest {
  membership_id: string;
  user_id: string;
  pg_id: string;
  name: string;
  phone: string;
  email: string | null;
  room_no: string;
  rent_amount: string | null;
  started_at: string;
  ended_at: string | null;
}

export const guests: MockGuest[] = [
  { membership_id: "mem_guest_1", user_id: "user_guest_1", pg_id: PG_ID, name: "Ananya Sharma", phone: "+919000000002", email: "ananya.sharma@example.com", room_no: "101", rent_amount: "8500.00", started_at: nowIso(-200 * DAY), ended_at: null },
  { membership_id: "mem_guest_2", user_id: "user_guest_2", pg_id: PG_ID, name: "Rohit Verma", phone: "+919000000012", email: "rohit.verma@example.com", room_no: "102", rent_amount: "8500.00", started_at: nowIso(-120 * DAY), ended_at: null },
  { membership_id: "mem_guest_3", user_id: "user_guest_3", pg_id: PG_ID, name: "Priya Nair", phone: "+919000000013", email: "priya.nair@example.com", room_no: "103", rent_amount: "9000.00", started_at: nowIso(-60 * DAY), ended_at: null },
  { membership_id: "mem_guest_4", user_id: "user_guest_4", pg_id: PG_ID, name: "Karthik Reddy", phone: "+919000000014", email: "karthik.reddy@example.com", room_no: "104", rent_amount: "8500.00", started_at: nowIso(-30 * DAY), ended_at: null },
  { membership_id: "mem_guest_5", user_id: "user_guest_5", pg_id: PG_ID, name: "Sneha Iyer", phone: "+919000000015", email: "sneha.iyer@example.com", room_no: "201", rent_amount: "9500.00", started_at: nowIso(-400 * DAY), ended_at: null },
  { membership_id: "mem_guest_6", user_id: "user_guest_6", pg_id: PG_ID, name: "Arjun Mehta", phone: "+919000000016", email: "arjun.mehta@example.com", room_no: "202", rent_amount: "8500.00", started_at: nowIso(-15 * DAY), ended_at: null },
  // Lakeview PG (PG2)
  { membership_id: "mem_guest_7", user_id: "user_guest_7", pg_id: PG2_ID, name: "Vikram Rao", phone: "+919000000020", email: "vikram.rao@example.com", room_no: "101", rent_amount: "8000.00", started_at: nowIso(-180 * DAY), ended_at: null },
  { membership_id: "mem_guest_8", user_id: "user_guest_8", pg_id: PG2_ID, name: "Divya Menon", phone: "+919000000021", email: "divya.menon@example.com", room_no: "102", rent_amount: "8000.00", started_at: nowIso(-90 * DAY), ended_at: null },
  { membership_id: "mem_guest_9", user_id: "user_guest_9", pg_id: PG2_ID, name: "Arjun Kapoor", phone: "+919000000022", email: "arjun.kapoor@example.com", room_no: "103", rent_amount: "8500.00", started_at: nowIso(-40 * DAY), ended_at: null },
  // Hillside Homes (PG3)
  { membership_id: "mem_guest_10", user_id: "user_guest_10", pg_id: PG3_ID, name: "Neha Joshi", phone: "+919000000023", email: "neha.joshi@example.com", room_no: "101", rent_amount: "7500.00", started_at: nowIso(-220 * DAY), ended_at: null },
  { membership_id: "mem_guest_11", user_id: "user_guest_11", pg_id: PG3_ID, name: "Rahul Nair", phone: "+919000000024", email: "rahul.nair@example.com", room_no: "102", rent_amount: "7500.00", started_at: nowIso(-100 * DAY), ended_at: null },
  { membership_id: "mem_guest_12", user_id: "user_guest_12", pg_id: PG3_ID, name: "Ayesha Khan", phone: "+919000000025", email: "ayesha.khan@example.com", room_no: "103", rent_amount: "8000.00", started_at: nowIso(-70 * DAY), ended_at: null },
  { membership_id: "mem_guest_13", user_id: "user_guest_13", pg_id: PG3_ID, name: "Manoj Pillai", phone: "+919000000026", email: "manoj.pillai@example.com", room_no: "104", rent_amount: "7500.00", started_at: nowIso(-10 * DAY), ended_at: null },
];

function gateForGuest(membershipId: string): MockUser["gate"] {
  const kyc = kycRecords.find((k) => k.membership_id === membershipId);
  if (!kyc) return "KYC_REQUIRED";
  if (kyc.status === "pending") return "KYC_PENDING";
  if (kyc.status === "rejected") return "KYC_REJECTED";
  return null;
}

/** Guests get their `/v1/me` User lazily (after `kycRecords` below exists) so `gate`
 *  reflects the seeded KYC state. */
export function registerGuestUser(guest: MockGuest): MockUser {
  const user: MockUser = {
    id: guest.user_id,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    must_change_password: false,
    avatar_url: null,
    memberships: [{ pg_id: guest.pg_id, pg_name: PG_NAME, role: "guest", membership_id: guest.membership_id, room_no: guest.room_no }],
    platform_roles: [],
    gate: gateForGuest(guest.membership_id),
  };
  return addUser(user);
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export const kycRecords = [
  { id: "kyc_1", pg_id: PG_ID, membership_id: "mem_guest_1", status: "verified" as const, reject_reason: null as string | null, submitted_at: nowIso(-190 * DAY), decided_at: nowIso(-188 * DAY), front_url: "https://picsum.photos/seed/kyc1front/400/260", back_url: "https://picsum.photos/seed/kyc1back/400/260", selfie_url: "https://picsum.photos/seed/kyc1selfie/300/300" },
  { id: "kyc_2", pg_id: PG_ID, membership_id: "mem_guest_2", status: "pending" as const, reject_reason: null as string | null, submitted_at: nowIso(-2 * DAY), decided_at: null as string | null, front_url: "https://picsum.photos/seed/kyc2front/400/260", back_url: "https://picsum.photos/seed/kyc2back/400/260", selfie_url: "https://picsum.photos/seed/kyc2selfie/300/300" },
  { id: "kyc_3", pg_id: PG_ID, membership_id: "mem_guest_3", status: "rejected" as const, reject_reason: "Aadhaar photo is blurry — please re-upload a clear copy.", submitted_at: nowIso(-10 * DAY), decided_at: nowIso(-9 * DAY), front_url: "https://picsum.photos/seed/kyc3front/400/260", back_url: "https://picsum.photos/seed/kyc3back/400/260", selfie_url: "https://picsum.photos/seed/kyc3selfie/300/300" },
  { id: "kyc_5", pg_id: PG_ID, membership_id: "mem_guest_5", status: "verified" as const, reject_reason: null as string | null, submitted_at: nowIso(-390 * DAY), decided_at: nowIso(-388 * DAY), front_url: "https://picsum.photos/seed/kyc5front/400/260", back_url: "https://picsum.photos/seed/kyc5back/400/260", selfie_url: "https://picsum.photos/seed/kyc5selfie/300/300" },
  { id: "kyc_6", pg_id: PG_ID, membership_id: "mem_guest_6", status: "verified" as const, reject_reason: null as string | null, submitted_at: nowIso(-14 * DAY), decided_at: nowIso(-13 * DAY), front_url: "https://picsum.photos/seed/kyc6front/400/260", back_url: "https://picsum.photos/seed/kyc6back/400/260", selfie_url: "https://picsum.photos/seed/kyc6selfie/300/300" },
  // mem_guest_4 has none — reads as NOT_SUBMITTED / KYC_REQUIRED.
];

// Now that kycRecords exists, register every guest's `/v1/me` user.
for (const g of guests) registerGuestUser(g);

// ─── Staff ───────────────────────────────────────────────────────────────────

export interface MockStaff {
  membership_id: string;
  user_id: string;
  pg_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: "manager" | "chef" | "kitchen_staff" | "maintenance" | "owner";
  monthly_salary: string | null;
  shift_start: string | null;
  shift_end: string | null;
  has_pin: boolean;
  started_at: string;
  ended_at: string | null;
}

export const staff: MockStaff[] = [
  { membership_id: "mem_manager_1", user_id: "user_manager_1", pg_id: PG_ID, name: "Deepika Rao", phone: "+919000000003", email: "deepika.manager@pgow.demo", role: "manager", monthly_salary: "22000.00", shift_start: "09:00:00", shift_end: "18:00:00", has_pin: true, started_at: nowIso(-300 * DAY), ended_at: null },
  { membership_id: "mem_chef_1", user_id: "user_chef_1", pg_id: PG_ID, name: "Suresh Babu", phone: "+919000000004", email: null, role: "chef", monthly_salary: "18000.00", shift_start: "06:00:00", shift_end: "14:00:00", has_pin: true, started_at: nowIso(-250 * DAY), ended_at: null },
  { membership_id: "mem_kitchen_1", user_id: "user_kitchen_1", pg_id: PG_ID, name: "Lakshmi Devi", phone: "+919000000005", email: null, role: "kitchen_staff", monthly_salary: "14000.00", shift_start: "07:00:00", shift_end: "15:00:00", has_pin: true, started_at: nowIso(-180 * DAY), ended_at: null },
  { membership_id: "mem_maint_1", user_id: "user_maint_1", pg_id: PG_ID, name: "Ibrahim Sheikh", phone: "+919000000006", email: null, role: "maintenance", monthly_salary: "15000.00", shift_start: "10:00:00", shift_end: "19:00:00", has_pin: true, started_at: nowIso(-90 * DAY), ended_at: null },
];

// ─── Payments ────────────────────────────────────────────────────────────────

export interface MockPayment {
  id: string;
  pg_id: string;
  membership_id: string;
  guest_name: string | null;
  room_no: string | null;
  period: string;
  purpose: "rent" | "food" | "service";
  amount: string | number;
  status: "pending" | "verified" | "rejected";
  method: "upi_intent" | "upi_manual" | "cash";
  upi_ref: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
}

function periodStr(monthsAgo = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export const payments: MockPayment[] = [
  { id: "pay_1", pg_id: PG_ID, membership_id: "mem_guest_1", guest_name: "Ananya Sharma", room_no: "101", period: periodStr(0), purpose: "rent", amount: "8500.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026080411231", rejection_reason: null, verified_at: nowIso(-2 * DAY), created_at: nowIso(-3 * DAY) },
  { id: "pay_2", pg_id: PG_ID, membership_id: "mem_guest_2", guest_name: "Rohit Verma", room_no: "102", period: periodStr(0), purpose: "rent", amount: "8500.00", status: "pending", method: "upi_manual", upi_ref: "UPI2026081099821", rejection_reason: null, verified_at: null, created_at: nowIso(-1 * DAY) },
  { id: "pay_3", pg_id: PG_ID, membership_id: "mem_guest_3", guest_name: "Priya Nair", room_no: "103", period: periodStr(0), purpose: "rent", amount: "9000.00", status: "rejected", method: "cash", upi_ref: null, rejection_reason: "Amount handed over did not match the receipt.", verified_at: null, created_at: nowIso(-4 * DAY) },
  // mem_guest_4/5/6 — no payment yet this cycle, i.e. rent is due.
  { id: "pay_4", pg_id: PG_ID, membership_id: "mem_guest_1", guest_name: "Ananya Sharma", room_no: "101", period: periodStr(1), purpose: "rent", amount: "8500.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026070811004", rejection_reason: null, verified_at: nowIso(-33 * DAY), created_at: nowIso(-34 * DAY) },
  { id: "pay_5", pg_id: PG_ID, membership_id: "mem_guest_5", guest_name: "Sneha Iyer", room_no: "201", period: periodStr(1), purpose: "rent", amount: "9500.00", status: "verified", method: "upi_manual", upi_ref: "UPI2026070677213", rejection_reason: null, verified_at: nowIso(-31 * DAY), created_at: nowIso(-32 * DAY) },
  { id: "pay_6", pg_id: PG_ID, membership_id: "mem_guest_6", guest_name: "Arjun Mehta", room_no: "202", period: periodStr(1), purpose: "rent", amount: "8500.00", status: "verified", method: "cash", upi_ref: null, rejection_reason: null, verified_at: nowIso(-30 * DAY), created_at: nowIso(-31 * DAY) },
  { id: "pay_7", pg_id: PG_ID, membership_id: "mem_guest_1", guest_name: "Ananya Sharma", room_no: "101", period: periodStr(0), purpose: "food", amount: "1200.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026081200331", rejection_reason: null, verified_at: nowIso(-1 * DAY), created_at: nowIso(-1 * DAY) },
  // Lakeview PG (PG2) — mem_guest_9 has no payment this cycle, i.e. rent is due.
  { id: "pay_8", pg_id: PG2_ID, membership_id: "mem_guest_7", guest_name: "Vikram Rao", room_no: "101", period: periodStr(0), purpose: "rent", amount: "8000.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026080422101", rejection_reason: null, verified_at: nowIso(-3 * DAY), created_at: nowIso(-4 * DAY) },
  { id: "pay_9", pg_id: PG2_ID, membership_id: "mem_guest_8", guest_name: "Divya Menon", room_no: "102", period: periodStr(0), purpose: "rent", amount: "8000.00", status: "verified", method: "upi_manual", upi_ref: "UPI2026080577310", rejection_reason: null, verified_at: nowIso(-5 * DAY), created_at: nowIso(-6 * DAY) },
  // Hillside Homes (PG3) — mem_guest_13 has no payment this cycle, i.e. rent is due.
  { id: "pay_10", pg_id: PG3_ID, membership_id: "mem_guest_10", guest_name: "Neha Joshi", room_no: "101", period: periodStr(0), purpose: "rent", amount: "7500.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026080699442", rejection_reason: null, verified_at: nowIso(-2 * DAY), created_at: nowIso(-3 * DAY) },
  { id: "pay_11", pg_id: PG3_ID, membership_id: "mem_guest_11", guest_name: "Rahul Nair", room_no: "102", period: periodStr(0), purpose: "rent", amount: "7500.00", status: "verified", method: "cash", upi_ref: null, rejection_reason: null, verified_at: nowIso(-7 * DAY), created_at: nowIso(-8 * DAY) },
  { id: "pay_12", pg_id: PG3_ID, membership_id: "mem_guest_12", guest_name: "Ayesha Khan", room_no: "103", period: periodStr(0), purpose: "rent", amount: "8000.00", status: "verified", method: "upi_intent", upi_ref: "UPI2026081133556", rejection_reason: null, verified_at: nowIso(-1 * DAY), created_at: nowIso(-2 * DAY) },
];

// ─── Meals ───────────────────────────────────────────────────────────────────

export interface MockMeal {
  id: string;
  pg_id: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  menu_items: string;
  chef_note: string;
  service_at: string;
  response_closes_at: string | null;
  is_open: boolean;
  is_broadcast: boolean;
  created_by: string;
}

function todayAt(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const meals: MockMeal[] = [
  { id: "meal_1", pg_id: PG_ID, meal_type: "breakfast", menu_items: "Idli, Sambar, Coconut Chutney, Filter Coffee", chef_note: "Extra chutney available on request.", service_at: todayAt(8, 0), response_closes_at: todayAt(7, 0), is_open: false, is_broadcast: true, created_by: "mem_chef_1" },
  { id: "meal_2", pg_id: PG_ID, meal_type: "lunch", menu_items: "Steamed Rice, Dal Tadka, Mixed Veg Curry, Curd, Papad", chef_note: "Jeera rice option for diabetic residents.", service_at: todayAt(13, 0), response_closes_at: todayAt(11, 0), is_open: true, is_broadcast: true, created_by: "mem_chef_1" },
  { id: "meal_3", pg_id: PG_ID, meal_type: "dinner", menu_items: "Chapati, Paneer Butter Masala, Jeera Rice, Salad", chef_note: "", service_at: todayAt(20, 30), response_closes_at: todayAt(18, 30), is_open: true, is_broadcast: false, created_by: "mem_chef_1" },
];

export const mealResponses: Array<{ meal_id: string; guest_id: string; choice: "eating" | "skipping" }> = [
  { meal_id: "meal_1", guest_id: "mem_guest_1", choice: "eating" },
  { meal_id: "meal_1", guest_id: "mem_guest_2", choice: "eating" },
  { meal_id: "meal_1", guest_id: "mem_guest_3", choice: "skipping" },
  { meal_id: "meal_2", guest_id: "mem_guest_1", choice: "eating" },
  { meal_id: "meal_2", guest_id: "mem_guest_5", choice: "eating" },
  { meal_id: "meal_2", guest_id: "mem_guest_6", choice: "skipping" },
];

const WEEKDAY_MENUS: Record<"breakfast" | "lunch" | "dinner", string[]> = {
  breakfast: ["Idli & Sambar", "Poha & Chai", "Upma & Coconut Chutney", "Aloo Paratha & Curd", "Dosa & Chutney", "Bread Omelette / Toast", "Puri Bhaji"],
  lunch: ["Rice, Dal, Mixed Veg", "Rice, Sambar, Beans Poriyal", "Roti, Chana Masala, Rice", "Rice, Rasam, Potato Fry", "Roti, Paneer Curry, Rice", "Biryani (Veg/Egg) & Raita", "Rice, Dal, Bhindi Fry"],
  dinner: ["Chapati, Paneer Curry", "Chapati, Egg Curry", "Fried Rice & Manchurian", "Chapati, Dal Fry, Rice", "Chapati, Aloo Gobi", "Curd Rice & Pickle", "Chapati, Mixed Veg, Rice"],
};

export const mealMenu = (Object.keys(WEEKDAY_MENUS) as Array<keyof typeof WEEKDAY_MENUS>).flatMap((mealType) =>
  WEEKDAY_MENUS[mealType].map((items, dayOfWeek) => ({
    id: `menu_${mealType}_${dayOfWeek}`,
    pg_id: PG_ID,
    day_of_week: dayOfWeek,
    meal_type: mealType,
    menu_items: items.split(", "),
    serving_time: mealType === "breakfast" ? "08:00" : mealType === "lunch" ? "13:00" : "20:30",
    chef_note: undefined as string | undefined,
  }))
);

export const mealFeedback = [
  { id: "mfb_1", meal_id: "meal_1", rating: 5, comment: "Best idli so far!", created_at: nowIso(-1 * DAY) },
  { id: "mfb_2", meal_id: "meal_1", rating: 4, comment: null as string | null, created_at: nowIso(-1 * DAY) },
];

// ─── Requests (complaints / feedback / grocery / repair / laundry) ─────────────

export interface MockRequestEvent {
  id: string;
  pg_id: string;
  request_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  event_type: "comment" | "status_change" | "assignment";
  body: string | null;
  from_status: string | null;
  to_status: string | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface MockRequest {
  id: string;
  pg_id: string;
  raised_by: string;
  resident_name: string | null;
  room_no: string | null;
  phone: string | null;
  kind: "complaint" | "feedback" | "grocery" | "repair" | "laundry";
  category: string | null;
  title: string;
  description: string;
  status: "open" | "assigned" | "in_progress" | "resolved" | "cancelled";
  priority: "normal" | "express" | "scheduled";
  assigned_membership_id: string | null;
  assigned_name: string | null;
  assigned_role: string | null;
  assigned_at: string | null;
  amount: number | string | null;
  service_date: string | null;
  details: Record<string, unknown>;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  events: MockRequestEvent[];
  attachments: never[];
  // Feedback star ratings — not on the wire `RequestRecord`, mock-only, read by
  // the request handlers below to compute averages the way the old demo did.
  ratings?: { overall: number; meal: number; cleanliness: number; manager: number; staff: number; other: number };
}

export const requests: MockRequest[] = [
  {
    id: "req_1", pg_id: PG_ID, raised_by: "mem_guest_2", resident_name: "Rohit Verma", room_no: "102", phone: "+919000000012",
    kind: "complaint", category: "Electrical", title: "Fan not working in room 102", description: "Ceiling fan makes a grinding noise and has stopped spinning.",
    status: "in_progress", priority: "normal", assigned_membership_id: "mem_maint_1", assigned_name: "Ibrahim Sheikh", assigned_role: "maintenance", assigned_at: nowIso(-1 * DAY),
    amount: null, service_date: null, details: {}, resolved_at: null, resolution_note: null, created_at: nowIso(-2 * DAY), updated_at: nowIso(-1 * DAY),
    events: [{ id: "evt_1", pg_id: PG_ID, request_id: "req_1", actor_user_id: "user_manager_1", actor_name: "Deepika Rao", actor_role: "manager", event_type: "comment", body: "Electrician scheduled for tomorrow morning.", from_status: null, to_status: null, is_ai_generated: false, created_at: nowIso(-1 * DAY) }],
    attachments: [],
  },
  {
    id: "req_2", pg_id: PG_ID, raised_by: "mem_guest_4", resident_name: "Karthik Reddy", room_no: "104", phone: "+919000000014",
    kind: "complaint", category: "Cleanliness", title: "Washroom on 1st floor needs cleaning", description: "Common washroom hasn't been cleaned in two days.",
    status: "open", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: null, service_date: null, details: {}, resolved_at: null, resolution_note: null, created_at: nowIso(-0.3 * DAY), updated_at: nowIso(-0.3 * DAY),
    events: [], attachments: [],
  },
  {
    id: "req_3", pg_id: PG_ID, raised_by: "mem_guest_1", resident_name: "Ananya Sharma", room_no: "101", phone: "+919000000002",
    kind: "feedback", category: "Meals", title: "Great lunch this week", description: "The Wednesday biryani was excellent, please keep it on rotation!",
    status: "resolved", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: null, service_date: null, details: {}, resolved_at: nowIso(-1 * DAY), resolution_note: "Thanks Ananya! Added biryani to the fortnightly rotation.", created_at: nowIso(-3 * DAY), updated_at: nowIso(-1 * DAY),
    events: [], attachments: [],
    ratings: { overall: 4.6, meal: 5, cleanliness: 4, manager: 5, staff: 4.5, other: 4 },
  },
  {
    id: "req_4", pg_id: PG_ID, raised_by: "mem_guest_5", resident_name: "Sneha Iyer", room_no: "201", phone: "+919000000015",
    kind: "feedback", category: "Staff", title: "Housekeeping is prompt", description: "Room cleaning has been on time every day this month.",
    status: "resolved", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: null, service_date: null, details: {}, resolved_at: nowIso(-5 * DAY), resolution_note: null, created_at: nowIso(-6 * DAY), updated_at: nowIso(-5 * DAY),
    events: [], attachments: [],
    ratings: { overall: 4.8, meal: 4, cleanliness: 5, manager: 4.5, staff: 5, other: 4.5 },
  },
  {
    id: "req_5", pg_id: PG_ID, raised_by: "mem_guest_1", resident_name: "Ananya Sharma", room_no: "101", phone: "+919000000002",
    kind: "grocery", category: null, title: "5x Milk Cans, 2x Bread, 100 Eggs Tray", description: "10-minute darkstore order",
    status: "in_progress", priority: "express", assigned_membership_id: null, assigned_name: "Vikram (DarkStore Rider)", assigned_role: null, assigned_at: nowIso(-0.05 * DAY),
    amount: 1690, service_date: null, details: { eta_minutes: 8, rider_phone: "+919812340099" }, resolved_at: null, resolution_note: null, created_at: nowIso(-0.06 * DAY), updated_at: nowIso(-0.05 * DAY),
    events: [], attachments: [],
  },
  {
    id: "req_6", pg_id: PG_ID, raised_by: "mem_guest_6", resident_name: "Arjun Mehta", room_no: "202", phone: "+919000000016",
    kind: "repair", category: "Plumbing", title: "Leaking tap in shared bathroom", description: "Tap in the 2nd floor bathroom keeps dripping.",
    status: "assigned", priority: "normal", assigned_membership_id: "mem_maint_1", assigned_name: "Ibrahim Sheikh", assigned_role: "maintenance", assigned_at: nowIso(-0.5 * DAY),
    amount: 350, service_date: null, details: { urgency: "Medium", technician_name: "Ibrahim Sheikh", technician_phone: "+919000000006", technician_rating: 4.7, eta_minutes: 25 }, resolved_at: null, resolution_note: null, created_at: nowIso(-0.6 * DAY), updated_at: nowIso(-0.5 * DAY),
    events: [], attachments: [],
  },
  {
    id: "req_7", pg_id: PG_ID, raised_by: "mem_guest_1", resident_name: "Ananya Sharma", room_no: "101", phone: "+919000000002",
    kind: "laundry", category: null, title: "Wash & Fold — 4kg", description: "Regular clothes, no delicates.",
    status: "in_progress", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: 180, service_date: null, details: { service_type: "Wash & Fold", weight_or_count: "4 kg", pickup_preference: "Doorstep", preferred_slot: "6 PM - 8 PM", payment_status: "Paid Online" }, resolved_at: null, resolution_note: null, created_at: nowIso(-0.4 * DAY), updated_at: nowIso(-0.2 * DAY),
    events: [], attachments: [],
  },
  // Older, still-open complaint — exercises the ">30 days unresolved" escalation banner
  // on the owner's Reviews tab, which the other seeded complaints (all under a week old)
  // never trigger on their own.
  {
    id: "req_8", pg_id: PG_ID, raised_by: "mem_guest_3", resident_name: "Priya Nair", room_no: "103", phone: "+919000000013",
    kind: "complaint", category: "Water", title: "No hot water in the mornings", description: "Geyser in the 1st floor common bathroom hasn't worked properly for weeks.",
    status: "open", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: null, service_date: null, details: {}, resolved_at: null, resolution_note: null, created_at: nowIso(-35 * DAY), updated_at: nowIso(-35 * DAY),
    events: [], attachments: [],
  },
  {
    id: "req_9", pg_id: PG_ID, raised_by: "mem_guest_2", resident_name: "Rohit Verma", room_no: "102", phone: "+919000000012",
    kind: "complaint", category: "WiFi", title: "WiFi drops every night after 10pm", description: "Internet disconnects almost every night, hard to get work done.",
    status: "in_progress", priority: "normal", assigned_membership_id: "mem_manager_1", assigned_name: "Deepika Rao", assigned_role: "manager", assigned_at: nowIso(-0.5 * DAY),
    amount: null, service_date: null, details: {}, resolved_at: null, resolution_note: null, created_at: nowIso(-1.5 * DAY), updated_at: nowIso(-0.5 * DAY),
    events: [{ id: "evt_2", pg_id: PG_ID, request_id: "req_9", actor_user_id: "user_manager_1", actor_name: "Deepika Rao", actor_role: "manager", event_type: "comment", body: "Raised a ticket with the ISP, technician visit scheduled.", from_status: null, to_status: null, is_ai_generated: false, created_at: nowIso(-0.5 * DAY) }],
    attachments: [],
  },
  {
    id: "req_10", pg_id: PG_ID, raised_by: "mem_guest_4", resident_name: "Karthik Reddy", room_no: "104", phone: "+919000000014",
    kind: "feedback", category: "Manager", title: "Manager sorted my fan issue same day", description: "Reported it in the morning, fixed by evening. Really appreciate the quick turnaround.",
    status: "resolved", priority: "normal", assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: null, service_date: null, details: {}, resolved_at: nowIso(-2 * DAY), resolution_note: null, created_at: nowIso(-2 * DAY), updated_at: nowIso(-2 * DAY),
    events: [], attachments: [],
    ratings: { overall: 5, meal: 4, cleanliness: 4.5, manager: 5, staff: 4.5, other: 4 },
  },
];

// ─── Notifications ──────────────────────────────────────────────────────────

export interface MockNotification {
  id: string;
  pg_id: string | null;
  category: "announcement" | "kyc" | "rent" | "complaint" | "finance" | "shift" | "service";
  priority: "high" | "normal" | "low";
  title: string;
  body: string;
  action_type: "request" | "payment" | "kyc" | "meal" | null;
  action_id: string | null;
  is_read: boolean;
  created_at: string;
  /** Which membership this row belongs to — mock-only routing, not on the real DTO. */
  recipient_membership_id: string;
}

export const notifications: MockNotification[] = [
  { id: "notif_1", pg_id: PG_ID, category: "rent", priority: "normal", title: "Rent payment verified", body: "Your rent for this month has been verified. Thank you!", action_type: "payment", action_id: "pay_1", is_read: false, created_at: nowIso(-2 * DAY), recipient_membership_id: "mem_guest_1" },
  { id: "notif_2", pg_id: PG_ID, category: "announcement", priority: "normal", title: "Water tank cleaning on Sunday", body: "Water supply will be interrupted 10 AM – 1 PM this Sunday for routine tank cleaning.", action_type: null, action_id: null, is_read: false, created_at: nowIso(-1 * DAY), recipient_membership_id: "mem_guest_1" },
  { id: "notif_3", pg_id: PG_ID, category: "kyc", priority: "high", title: "KYC rejected", body: "Your Aadhaar photo was unclear. Please re-upload.", action_type: "kyc", action_id: "kyc_3", is_read: false, created_at: nowIso(-9 * DAY), recipient_membership_id: "mem_guest_3" },
  { id: "notif_4", pg_id: PG_ID, category: "complaint", priority: "normal", title: "Maintenance update on your ticket", body: "Electrician has been scheduled for your fan complaint.", action_type: "request", action_id: "req_1", is_read: true, created_at: nowIso(-1 * DAY), recipient_membership_id: "mem_guest_2" },
  { id: "notif_5", pg_id: PG_ID, category: "finance", priority: "normal", title: "2 new payments awaiting verification", body: "Rohit Verma and 1 other resident submitted rent proof.", action_type: "payment", action_id: null, is_read: false, created_at: nowIso(-1 * DAY), recipient_membership_id: "mem_owner_1" },
  { id: "notif_6", pg_id: PG_ID, category: "shift", priority: "low", title: "Tomorrow's shift confirmed", body: "Your shift is 06:00–14:00 tomorrow.", action_type: null, action_id: null, is_read: true, created_at: nowIso(-0.5 * DAY), recipient_membership_id: "mem_chef_1" },
];

// ─── Expenses ───────────────────────────────────────────────────────────────

export interface MockExpense {
  id: string;
  pg_id: string;
  logged_by: string;
  logged_by_name: string | null;
  logged_by_role: string | null;
  title: string;
  category: "staff_salary" | "groceries" | "utilities" | "maintenance" | "internet" | "other";
  amount: string;
  period: string;
  spent_on: string;
  method: "upi" | "cash" | "bank_transfer";
  paid_to_membership_id: string | null;
  paid_to_name: string | null;
  recipient_name: string;
  request_id: string | null;
  reverses_expense_id: string | null;
  reversed_by_expense_id: string | null;
  notes: string;
  created_at: string;
}

export const expenses: MockExpense[] = [
  { id: "exp_1", pg_id: PG_ID, logged_by: "mem_owner_1", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Kitchen staff salary — Suresh", category: "staff_salary", amount: "18000.00", period: periodStr(0), spent_on: nowIso(-5 * DAY), method: "bank_transfer", paid_to_membership_id: "mem_chef_1", paid_to_name: "Suresh Babu", recipient_name: "Suresh Babu", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-5 * DAY) },
  { id: "exp_2", pg_id: PG_ID, logged_by: "mem_manager_1", logged_by_name: "Deepika Rao", logged_by_role: "manager", title: "Weekly grocery run", category: "groceries", amount: "6420.00", period: periodStr(0), spent_on: nowIso(-2 * DAY), method: "upi", paid_to_membership_id: null, paid_to_name: null, recipient_name: "Sri Venkateshwara Kirana", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "Rice, dal, vegetables, milk", created_at: nowIso(-2 * DAY) },
  { id: "exp_3", pg_id: PG_ID, logged_by: "mem_manager_1", logged_by_name: "Deepika Rao", logged_by_role: "manager", title: "Electricity bill", category: "utilities", amount: "9840.00", period: periodStr(0), spent_on: nowIso(-6 * DAY), method: "upi", paid_to_membership_id: null, paid_to_name: null, recipient_name: "TSSPDCL", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-6 * DAY) },
  { id: "exp_4", pg_id: PG_ID, logged_by: "mem_manager_1", logged_by_name: "Deepika Rao", logged_by_role: "manager", title: "Plumbing repair — 2nd floor tap", category: "maintenance", amount: "350.00", period: periodStr(0), spent_on: nowIso(-0.5 * DAY), method: "cash", paid_to_membership_id: "mem_maint_1", paid_to_name: "Ibrahim Sheikh", recipient_name: "Ibrahim Sheikh", request_id: "req_6", reverses_expense_id: null, reversed_by_expense_id: null, notes: "Washer replacement", created_at: nowIso(-0.5 * DAY) },
  { id: "exp_5", pg_id: PG_ID, logged_by: "mem_owner_1", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Broadband — WiFi router plan", category: "internet", amount: "1499.00", period: periodStr(0), spent_on: nowIso(-8 * DAY), method: "upi", paid_to_membership_id: null, paid_to_name: null, recipient_name: "ACT Fibernet", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-8 * DAY) },
  // Lakeview PG (PG2)
  { id: "exp_6", pg_id: PG2_ID, logged_by: "mem_owner_2", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Weekly grocery run", category: "groceries", amount: "4200.00", period: periodStr(0), spent_on: nowIso(-3 * DAY), method: "upi", paid_to_membership_id: null, paid_to_name: null, recipient_name: "Lakeview Kirana Store", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-3 * DAY) },
  { id: "exp_7", pg_id: PG2_ID, logged_by: "mem_owner_2", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Electricity bill", category: "utilities", amount: "6100.00", period: periodStr(0), spent_on: nowIso(-5 * DAY), method: "upi", paid_to_membership_id: null, paid_to_name: null, recipient_name: "TSSPDCL", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-5 * DAY) },
  // Hillside Homes (PG3)
  { id: "exp_8", pg_id: PG3_ID, logged_by: "mem_owner_3", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Housekeeping salary", category: "staff_salary", amount: "15000.00", period: periodStr(0), spent_on: nowIso(-6 * DAY), method: "bank_transfer", paid_to_membership_id: null, paid_to_name: null, recipient_name: "Housekeeping Staff", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-6 * DAY) },
  { id: "exp_9", pg_id: PG3_ID, logged_by: "mem_owner_3", logged_by_name: "Rajesh Kumar", logged_by_role: "owner", title: "Bathroom fitting repair", category: "maintenance", amount: "800.00", period: periodStr(0), spent_on: nowIso(-1 * DAY), method: "cash", paid_to_membership_id: null, paid_to_name: null, recipient_name: "Local plumber", request_id: null, reverses_expense_id: null, reversed_by_expense_id: null, notes: "", created_at: nowIso(-1 * DAY) },
];

// ─── Procurement ────────────────────────────────────────────────────────────

export const procurementCatalog = [
  { id: "cat_1", pg_id: null as string | null, item_name: "Full Cream Milk Cans (10L)", category: "dairy", unit: "10 Liters Can", default_price: 620, is_active: true },
  { id: "cat_2", pg_id: null as string | null, item_name: "Farm Fresh Eggs Tray (100)", category: "produce", unit: "100 Eggs Tray", default_price: 580, is_active: true },
  { id: "cat_3", pg_id: null as string | null, item_name: "Refined Cooking Oil (15L)", category: "grocery", unit: "15 Liters Tin", default_price: 1950, is_active: true },
  { id: "cat_4", pg_id: null as string | null, item_name: "Premium Basmati Rice (25kg)", category: "grocery", unit: "25 kg Bag", default_price: 1450, is_active: true },
  { id: "cat_5", pg_id: null as string | null, item_name: "Dishwash & Sanitation Pack", category: "cleaning", unit: "Commercial Pack", default_price: 380, is_active: true },
  { id: "cat_6", pg_id: null as string | null, item_name: "20L Mineral Water Cans (10)", category: "grocery", unit: "10 Cans Set", default_price: 350, is_active: true },
];

export const procurementOrders = [
  {
    id: "porder_1", pg_id: PG_ID, manager_id: "mem_manager_1", order_type: "grocery", status: "pending_owner_approval",
    total_cost: 3420, notes: "Restocking for the week", rejection_reason: undefined, approved_at: undefined, created_at: nowIso(-0.3 * DAY),
    items: [
      { id: "pitem_1", item_name: "Full Cream Milk Cans (10L)", category: "dairy", quantity: 3, unit: "10 Liters Can", estimated_price: 620, line_total: 1860 },
      { id: "pitem_2", item_name: "Premium Basmati Rice (25kg)", category: "grocery", quantity: 1, unit: "25 kg Bag", estimated_price: 1450, line_total: 1450 },
      { id: "pitem_3", item_name: "20L Mineral Water Cans (10)", category: "grocery", quantity: 1, unit: "10 Cans Set", estimated_price: 110, line_total: 110 },
    ],
  },
  {
    id: "porder_2", pg_id: PG_ID, manager_id: "mem_manager_1", order_type: "supplies", status: "approved",
    total_cost: 760, notes: "", rejection_reason: undefined, approved_at: nowIso(-2 * DAY), created_at: nowIso(-3 * DAY),
    items: [
      { id: "pitem_4", item_name: "Dishwash & Sanitation Pack", category: "cleaning", quantity: 2, unit: "Commercial Pack", estimated_price: 380, line_total: 760 },
    ],
  },
];

// ─── Panic ──────────────────────────────────────────────────────────────────

export const panicAlerts: Array<{
  id: string; pg_id: string; triggered_by_membership_id: string; triggered_by_user_name: string;
  latitude?: number; longitude?: number; message?: string; status: "active" | "acknowledged" | "resolved";
  acknowledged_by?: string; acknowledged_at?: string; resolved_at?: string; resolution_note?: string; created_at: string;
}> = [
  { id: "panic_1", pg_id: PG_ID, triggered_by_membership_id: "mem_kitchen_1", triggered_by_user_name: "Lakshmi Devi", latitude: 17.4402, longitude: 78.3487, message: "Gas cylinder leak smell in kitchen", status: "resolved", acknowledged_by: "Deepika Rao", acknowledged_at: nowIso(-20 * DAY + 60_000), resolved_at: nowIso(-20 * DAY + 20 * 60_000), resolution_note: "Cylinder valve was loose — fixed and aired out the kitchen.", created_at: nowIso(-20 * DAY) },
];

// ─── Attendance ─────────────────────────────────────────────────────────────

export const staffShifts = staff.map((s, i) => ({
  id: `shift_${s.membership_id}`,
  pg_id: PG_ID,
  staff_membership_id: s.membership_id,
  shift_date: new Date().toISOString().slice(0, 10),
  shift_start: s.shift_start,
  shift_end: s.shift_end,
  is_off_day: false,
  qr_code_hash: `QR${i + 1000}`,
}));

export const attendancePunches: Array<{
  id: string; pg_id: string; staff_membership_id: string; shift_id: string;
  punch_in_at: string; punch_out_at?: string; punch_in_method: "qr" | "geofence" | "manual"; punch_out_method?: "qr" | "geofence" | "manual";
  punch_in_latitude?: number; punch_in_longitude?: number; status: "in_progress" | "completed" | "missed";
}> = [
  { id: "punch_1", pg_id: PG_ID, staff_membership_id: "mem_chef_1", shift_id: "shift_mem_chef_1", punch_in_at: todayAt(6, 5), punch_in_method: "qr", status: "in_progress" },
];

// ─── Tenant invoices (owner → resident billing) ────────────────────────────

export const tenantInvoices = guests.slice(0, 4).map((g, i) => {
  const now = new Date();
  const rent = parseFloat(g.rent_amount ?? "0");
  return {
    id: `inv_${g.membership_id}`,
    pg_id: PG_ID,
    tenant_membership_id: g.membership_id,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    rent_amount: rent,
    utility_amount: 500,
    penalty_amount: i === 2 ? 200 : 0,
    total_amount: rent + 500 + (i === 2 ? 200 : 0),
    due_date: nowIso(5 * DAY),
    status: i === 0 ? "paid" : i === 2 ? "overdue" : "unpaid",
    paid_at: i === 0 ? nowIso(-2 * DAY) : undefined,
    pdf_url: undefined,
    created_at: nowIso(-3 * DAY),
  };
});

// ─── PGow's own billing (owner → PGow) ─────────────────────────────────────

export const billingPlans = [
  { id: "plan_starter", code: "starter", name: "Starter", price: "999.00", billing_period: "monthly", bed_limit: 15, unit_price: null as string | null, included_units: 0 },
  { id: "plan_growth", code: "growth", name: "Growth", price: "2499.00", billing_period: "monthly", bed_limit: 50, unit_price: null as string | null, included_units: 0 },
  { id: "plan_payperuser", code: "pay_per_user", name: "Pay Per Resident", price: "0.00", billing_period: "usage", bed_limit: null as number | null, unit_price: "75.00", included_units: 5 },
  { id: "plan_onetime_bed", code: "one_time_bed", name: "One-Time Per Bed", price: "0.00", billing_period: "one_time", bed_limit: null as number | null, unit_price: "50.00", included_units: 0 },
];

export const billingSubscription = {
  id: "sub_1", pg_id: PG_ID, plan_id: "plan_growth", plan_code: "growth", plan_name: "Growth", price: "2499.00",
  status: "active" as const, current_period_start: nowIso(-15 * DAY), current_period_end: nowIso(15 * DAY), cancelled_at: null as string | null,
};

export const billingInvoices = [
  { id: "binv_1", pg_id: PG_ID, subscription_id: "sub_1", period: periodStr(0), amount: "2499.00", status: "paid" as const, method: "upi_intent" as const, upi_ref: "PGOWBILL2026081", issued_at: nowIso(-15 * DAY), due_at: nowIso(-8 * DAY), paid_at: nowIso(-14 * DAY) },
  { id: "binv_2", pg_id: PG_ID, subscription_id: "sub_1", period: periodStr(1), amount: "2499.00", status: "paid" as const, method: "upi_intent" as const, upi_ref: "PGOWBILL2026070", issued_at: nowIso(-45 * DAY), due_at: nowIso(-38 * DAY), paid_at: nowIso(-44 * DAY) },
];

// ─── PnL ────────────────────────────────────────────────────────────────────

export function buildPnL(months: number) {
  const monthly = Array.from({ length: months }).map((_, i) => {
    const idx = months - 1 - i;
    const revenue = 46000 + (idx % 4) * 3200 - i * 400;
    const exp = 28000 + (idx % 3) * 1800;
    const d = new Date();
    d.setMonth(d.getMonth() - idx);
    return {
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: Math.round(revenue),
      expenses: Math.round(exp),
      net: Math.round(revenue - exp),
    };
  });
  const totals = monthly.reduce(
    (acc, m) => ({ revenue: acc.revenue + m.revenue, expenses: acc.expenses + m.expenses, net: acc.net + m.net }),
    { revenue: 0, expenses: 0, net: 0 }
  );
  return { monthly_breakdown: monthly, totals };
}

// ─── Rewards ────────────────────────────────────────────────────────────────

export const rewardsLedger: Record<string, Array<{ id: string; delta: number; reason: string; ref_type: string | null; ref_id: string | null; created_at: string }>> = {
  mem_guest_1: [
    { id: "rw_1", delta: 20, reason: "Skipped dinner — kitchen saved a portion", ref_type: "meal_response", ref_id: "meal_1", created_at: nowIso(-2 * DAY) },
    { id: "rw_2", delta: 10, reason: "On-time rent payment", ref_type: "payment", ref_id: "pay_1", created_at: nowIso(-2 * DAY) },
  ],
};

// ─── Ads ────────────────────────────────────────────────────────────────────

export const adsMetrics = { impressions: 412, clicks: 37, coupon_copies: 9, earnings_usd: "6.85" };

// ─── Places ─────────────────────────────────────────────────────────────────

export const placeSuggestions = [
  { place_id: "place_gachibowli", primary: "Gachibowli", secondary: "Hyderabad, Telangana, India" },
  { place_id: "place_madhapur", primary: "Madhapur", secondary: "Hyderabad, Telangana, India" },
  { place_id: "place_kondapur", primary: "Kondapur", secondary: "Hyderabad, Telangana, India" },
];
