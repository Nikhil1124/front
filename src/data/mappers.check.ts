/**
 * Self-check for the DTO → entity mappers.
 *
 * These are the only place in the app where a server shape becomes a UI shape, and every
 * bug they can have is silent: a rent that renders as ₹NaN, a phone the API rejects, a
 * resolved ticket still showing as Open. Cheap to check, expensive to miss.
 *
 * Run it:  node src/data/mappers.check.ts
 * (Node strips the types; `mappers.ts` has no runtime imports, only `import type`.)
 */

import assert from "node:assert/strict";

import {
  currentPeriod,
  periodToMonthYear,
  toAmount,
  toComplaint,
  toE164,
  hubStatusToServer,
  toRepairRequest,
  toGroceryOrder,
  toGuest,
  toLaundryRequest,
  toMeal,
  toMillis,
  toPayment,
  toStaff,
} from "./mappers.ts";

// ─── Phone normalisation: the API's Phone pattern is ^\+[1-9][0-9]{7,14}$ ────
const E164 = /^\+[1-9][0-9]{7,14}$/;

assert.equal(toE164("9876543210"), "+919876543210", "bare 10-digit gets +91");
assert.equal(toE164("+91 98765 43210"), "+919876543210", "spaces stripped, + kept");
assert.equal(toE164("919876543210"), "+919876543210", "country code without the plus");
assert.equal(toE164("  9876543210  "), "+919876543210", "surrounding whitespace");
for (const input of ["9876543210", "+91 98765 43210", "919876543210"]) {
  assert.match(toE164(input), E164, `${input} must satisfy the server's pattern`);
}
// Nonsense is handed back untouched so the SERVER produces the error, not a bad guess here.
assert.equal(toE164("12345"), "12345", "too short is not silently prefixed");

// ─── Money: Decimal arrives as a JSON string ────────────────────────────────
assert.equal(toAmount("8500.00"), 8500, "decimal string parses");
assert.equal(toAmount(null), 0, "null is 0, never NaN");
assert.equal(toAmount("not-a-number"), 0, "garbage is 0, never NaN");
assert.equal(toAmount(1250.5), 1250.5, "a number passes through");

// ─── Dates ──────────────────────────────────────────────────────────────────
assert.equal(toMillis(null), 0, "null timestamp is 0, never NaN");
assert.equal(toMillis("nonsense"), 0, "unparseable timestamp is 0");
assert.equal(toMillis("2026-08-06T00:00:00Z"), Date.parse("2026-08-06T00:00:00Z"));

// ─── Periods ────────────────────────────────────────────────────────────────
assert.equal(periodToMonthYear("2026-08-01"), "August 2026");
assert.equal(periodToMonthYear("2026-01-01"), "January 2026", "month is not off by one");
assert.equal(currentPeriod(new Date(2026, 7, 6)), "2026-08-01", "always the 1st, zero-padded");
assert.match(currentPeriod(), /^\d{4}-\d{2}-01$/);

// ─── Guest ──────────────────────────────────────────────────────────────────
const guestDto = {
  membership_id: "m-1", user_id: "u-1", pg_id: "pg-1",
  name: "Rohan Sharma", phone: "+919876543210", email: null,
  room_no: "102", rent_amount: "8500.00",
  started_at: "2026-01-05T10:00:00Z", ended_at: null,
  kyc_status: null, kyc_reject_reason: null, kyc_submitted_at: null,
  kyc_decided_at: null, kyc_front_url: null, kyc_selfie_url: null,
};
const noKyc = toGuest(guestDto);
// The membership, not the user: every guest-scoped endpoint is addressed by membership.
assert.equal(noKyc.id, "m-1");
assert.equal(noKyc.rentAmount, 8500);
assert.equal(noKyc.email, "", "null email renders as empty, not the string 'null'");
assert.equal(noKyc.kycStatus, "NOT_SUBMITTED", "no KYC record means not submitted");
assert.equal(noKyc.isBillPaid, false, "unpaid by default — never hide a bill that is due");

const rejected = toGuest(guestDto, {
  kyc: {
    status: "rejected",
    reject_reason: "Selfie unreadable", submitted_at: "2026-02-01T00:00:00Z",
    decided_at: "2026-02-02T00:00:00Z", front_url: "https://x/f",
    selfie_url: "https://x/s",
  },
  isBillPaid: true,
});
assert.equal(rejected.kycStatus, "REJECTED");
assert.equal(rejected.kycRejectReason, "Selfie unreadable");
assert.equal(rejected.isBillPaid, true);

// ─── Staff ──────────────────────────────────────────────────────────────────
const staff = toStaff({
  membership_id: "s-1", user_id: "u-2", pg_id: "pg-1", name: "Suresh",
  phone: "+919000000000", email: null, role: "kitchen_staff",
  monthly_salary: "15000.00", shift_start: "08:00:00", shift_end: "16:00:00",
  has_pin: true, started_at: "2026-01-01T00:00:00Z", ended_at: null,
});
assert.equal(staff.role, "Kitchen Staff", "snake_case role becomes the UI's label");
assert.equal(staff.shiftTime, "08:00 - 16:00", "seconds trimmed off both ends");
assert.equal(staff.monthlySalary, 15000);
assert.equal(staff.loginPin, "", "a PIN must never come back from the server");

// ─── Meals ──────────────────────────────────────────────────────────────────
const meal = toMeal({
  id: "meal-1", pg_id: "pg-1", meal_type: "breakfast",
  menu_items: "Idli, Sambar", chef_note: "", service_at: "2026-08-06T08:30:00+05:30",
  response_closes_at: null, is_open: false, is_broadcast: true, created_by: "u-2",
});
assert.equal(meal.mealType, "Breakfast");
assert.equal(meal.isClosed, true, "is_open inverts into isClosed");
assert.equal(meal.isAlertSent, true);
assert.match(meal.serviceTime, /^\d{2}:\d{2}$/, "HH:mm, zero-padded");

// ─── Payments ───────────────────────────────────────────────────────────────
const verified = toPayment({
  id: "p-1", pg_id: "pg-1", membership_id: "m-1", guest_name: "Rohan Sharma",
  room_no: "102", period: "2026-08-01", purpose: "rent", amount: "8500.00",
  status: "verified", method: "upi_intent", upi_ref: "UTR123",
  rejection_reason: null, verified_at: "2026-08-03T09:00:00Z",
  created_at: "2026-08-02T09:00:00Z",
});
assert.equal(verified.paymentType, "GUEST_RENT");
assert.equal(verified.paymentMode, "ONLINE_PHONEPE");
assert.equal(verified.status, "VERIFIED");
assert.equal(verified.amount, 8500);
assert.equal(verified.monthYear, "August 2026");
assert.equal(verified.receiptId, "p-1", "a verified payment has a reference to quote");

const pending = toPayment({
  id: "p-2", pg_id: "pg-1", membership_id: "m-1", period: "2026-08-01",
  purpose: "rent", amount: "8500.00", status: "pending", method: "cash",
  created_at: "2026-08-02T09:00:00Z",
});
assert.equal(pending.receiptId, "", "an unverified payment must NOT show a receipt");
assert.equal(pending.paymentMode, "CASH_HANDOVER");
assert.equal(pending.payerName, "", "a missing guest_name is empty, not 'undefined'");

// ─── Requests ───────────────────────────────────────────────────────────────
const base = {
  id: "r-1", pg_id: "pg-1", raised_by: "m-1", resident_name: "Rohan",
  kind: "complaint" as const, title: "Tap leaking", description: "2nd floor",
  priority: "normal" as const, created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};
// A cancelled ticket must not read as Open, or it gets chased forever.
assert.equal(toComplaint({ ...base, status: "cancelled" }).status, "Resolved");
assert.equal(toComplaint({ ...base, status: "assigned" }).status, "In Progress");
assert.equal(toComplaint({ ...base, status: "in_progress" }).status, "In Progress");
assert.equal(toComplaint({ ...base, status: "open" }).status, "Open");
assert.equal(toComplaint({ ...base, status: "open", kind: "feedback" }).type, "FEEDBACK");

// The resolution note wins; otherwise the newest comment is what "did anyone reply?" means.
const withEvents = toComplaint({
  ...base,
  status: "open",
  events: [
    { id: "e1", pg_id: "pg-1", request_id: "r-1", event_type: "comment", body: "Looking into it", created_at: "2026-08-01T01:00:00Z" },
    { id: "e2", pg_id: "pg-1", request_id: "r-1", event_type: "comment", body: "Plumber booked", created_at: "2026-08-01T02:00:00Z" },
  ],
});
assert.equal(withEvents.adminResponse, "Plumber booked", "the LATEST comment, not the first");
assert.equal(
  toComplaint({ ...base, status: "resolved", resolution_note: "Washer replaced", events: withEvents.mediaUri ? [] : [] }).adminResponse,
  "Washer replaced",
  "a resolution note outranks any comment"
);

// ─── Hub services ───────────────────────────────────────────────────────────
const hubBase = {
  id: "r-9", pg_id: "pg-1", raised_by: "m-1", resident_name: "Rohan", room_no: "101",
  title: "Wash & Fold - 5 kg", description: "Separate the whites",
  priority: "normal" as const, created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

const laundry = toLaundryRequest({
  ...hubBase, kind: "laundry", status: "in_progress", amount: "195.00",
  details: {
    service_type: "Wash & Fold", weight_or_count: "5 kg",
    pickup_preference: "Room Doorstep Pickup", preferred_slot: "Morning (8 AM - 10 AM)",
    payment_status: "Added to Room Bill",
  },
});
assert.equal(laundry.totalCost, 195);
assert.equal(laundry.preferredSlot, "Morning (8 AM - 10 AM)");
assert.equal(laundry.roomNo, "101");
// The server has five statuses; each service calls them something different.
assert.equal(laundry.status, "Washing & Ironing");

const grocery = toGroceryOrder({
  ...hubBase, kind: "grocery", status: "in_progress", priority: "express", amount: 1250,
  details: { eta_minutes: 10, rider_name: "Vikram S.", rider_phone: "+919811233445" },
});
assert.equal(grocery.status, "Out for Delivery");
assert.equal(grocery.deliveryEtaMinutes, 10);
// Urgency is the request's priority, not a detail field — the server has a word for it.
assert.equal(grocery.isExpress10Min, true);
assert.equal(grocery.riderName, "Vikram S.");

const repair = toRepairRequest({
  ...hubBase, kind: "repair", category: "Plumbing", status: "assigned",
  assigned_name: "Rajesh Sharma", amount: "399.00",
  details: { urgency: "15-Min Express", eta_minutes: 12, technician_name: "Someone Else" },
});
assert.equal(repair.status, "Technician Assigned");
assert.equal(repair.estimatedCost, 399);
// Whoever the ticket is actually assigned to beats whatever was guessed at booking time.
assert.equal(repair.assignedTechnicianName, "Rajesh Sharma");

// Missing detail keys must not become "undefined" on screen.
const bare = toLaundryRequest({ ...hubBase, kind: "laundry", status: "open" });
assert.equal(bare.serviceType, "");
assert.equal(bare.totalCost, 0);
assert.equal(bare.status, "Pickup Scheduled");

// And the labels map back, so a tap becomes a real status transition.
assert.equal(hubStatusToServer("laundry", "Delivered"), "resolved");
assert.equal(hubStatusToServer("laundry", "washing & ironing"), "in_progress");
assert.equal(hubStatusToServer("grocery", "Cancelled"), "cancelled");
// An unknown label must not silently resolve a ticket.
assert.equal(hubStatusToServer("repair", "Nonsense"), "in_progress");

console.log("mappers.check.ts — all assertions passed");
