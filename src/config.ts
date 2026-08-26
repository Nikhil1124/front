// ─────────────────────────────────────────────────────────────────────────────
// PGow API configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where the API lives. Set `EXPO_PUBLIC_API_URL` — in `.env.local` for a local build, or in
 * the profile's `env` block in `eas.json` for a cloud build.
 *
 * The default is PRODUCTION, deliberately. It used to be `http://localhost:8000`, which is
 * the phone itself on a real device — so a release APK built without the variable set would
 * have shipped unable to reach anything, and the failure would have surfaced as "the app is
 * broken" rather than "someone forgot a config value". Defaulting the other way means the
 * worst case for a forgotten variable is a dev build pointing at production, which is loud
 * and immediate rather than silent and shipped.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://pgow.zoveyacms.in";



export const API = {
  // Auth
  REGISTER: "/v1/auth/register",
  LOGIN: "/v1/auth/login",
  PIN_LOGIN: "/v1/auth/login/pin",
  CHANGE_PASSWORD: "/v1/auth/password",
  REFRESH: "/v1/auth/refresh",
  LOGOUT: "/v1/auth/logout",

  // Identity
  ME: "/v1/me",

  // Properties
  PGS: "/v1/pgs",
  PG: (id: string) => `/v1/pgs/${id}`,
  // The lobby code that lets a resident sign themselves up. POST mints or rotates it —
  // rotation is revocation, since a property has exactly one — and DELETE turns self-join
  // off. Owner-only, because whoever holds the code can create an account here.
  PG_JOIN_CODE: (pgId: string) => `/v1/pgs/${pgId}/join-code`,
  // A property's UPI accounts — a list, at most one active. Owner-only on the server.
  PG_UPI_IDS: (pgId: string) => `/v1/pgs/${pgId}/upi-ids`,
  PG_UPI_ID: (pgId: string, upiId: string) => `/v1/pgs/${pgId}/upi-ids/${upiId}`,
  PG_UPI_ID_ACTIVATE: (pgId: string, upiId: string) => `/v1/pgs/${pgId}/upi-ids/${upiId}/activate`,

  // Staff
  STAFF: "/v1/staff",
  STAFF_MEMBER: (id: string) => `/v1/staff/${id}`,

  // Guests
  GUESTS: "/v1/guests",
  GUEST: (id: string) => `/v1/guests/${id}`,
  // The one guest route with no caller: self-signup against a property's join code. Returns
  // tokens, so the resident lands signed in.
  GUESTS_JOIN: "/v1/guests/join",

  // KYC
  KYC_UPLOAD_URL: "/v1/kyc/upload-url",
  KYC_SUBMIT: "/v1/kyc/submit",
  KYC_PENDING: "/v1/kyc/pending",
  KYC_VERIFY: (id: string) => `/v1/kyc/${id}/verify`,
  KYC_REJECT: (id: string) => `/v1/kyc/${id}/reject`,

  // Meals
  MEALS: "/v1/meals",
  MEAL: (id: string) => `/v1/meals/${id}`,
  MEAL_BROADCAST: (id: string) => `/v1/meals/${id}/broadcast`,
  MEAL_CLOSE: (id: string) => `/v1/meals/${id}/close`,
  MEAL_RESPONSE: (id: string) => `/v1/meals/${id}/response`,
  MEAL_SUMMARY: (id: string) => `/v1/meals/${id}/response-summary`,
  // Who answered what, and who has not — staff only. The summary above is the cheap poll;
  // this is the named list, because "17 eating" does not say which four people to go and ask.
  MEAL_RESPONSES: (id: string) => `/v1/meals/${id}/responses`,

  // Address autocomplete, proxied by our backend — no map key ships in this app.
  PLACES_AUTOCOMPLETE: "/v1/places/autocomplete",
  PLACES_REVERSE_GEOCODE: "/v1/places/reverse-geocode",
  PLACES_MAP_TILE: "/v1/places/map-tile",
  // The live map's style — vector tiles, sprite and glyphs all proxied through it too; see
  // `fetchMapStyle` (features/places/mapStyle.ts) for how the placeholders it returns get
  // filled in.
  PLACES_STYLE: "/v1/places/style.json",

  // Push (ADR-006)
  DEVICES: "/v1/devices",
  DEVICE: (id: string) => `/v1/devices/${id}`,

  // Payments (Flow #2)
  PAYMENTS: "/v1/payments",
  PAYMENT_DUE: "/v1/payments/due",
  // Reminds only the residents who owe this cycle. Per-resident on the server, so the owner
  // who presses it is never one of the recipients.
  PAYMENT_REMINDERS: "/v1/payments/reminders",
  PAYMENT_VERIFY: (id: string) => `/v1/payments/${id}/verify`,
  PAYMENT_REJECT: (id: string) => `/v1/payments/${id}/reject`,

  // Complaints & Requests (Flow #3)
  REQUESTS: "/v1/requests",
  REQUEST_DETAIL: (id: string) => `/v1/requests/${id}`,
  REQUEST_EVENTS: (id: string) => `/v1/requests/${id}/events`,
  REQUEST_ATTACHMENT_UPLOAD_URL: (id: string) => `/v1/requests/${id}/attachments/upload-url`,
  REQUEST_ATTACHMENTS: (id: string) => `/v1/requests/${id}/attachments`,
  REQUEST_ASSIGN: (id: string) => `/v1/requests/${id}/assign`,
  // "Book a technician": the property has decided this needs somebody it does not employ,
  // so the ticket goes up to the area manager who covers this property's area. Distinct
  // from ASSIGN above, which can only ever name existing staff at this same PG.
  REQUEST_ESCALATE: (id: string) => `/v1/requests/${id}/escalate`,
  // The other end of that handover — PGow ops reading what has been escalated to them.
  // Area-scoped server-side; a property role gets a 403, not an empty page.
  REQUESTS_ESCALATED: "/v1/requests/escalated",
  REQUEST_RESOLVE: (id: string) => `/v1/requests/${id}/resolve`,
  REQUEST_CANCEL: (id: string) => `/v1/requests/${id}/cancel`,

  // In-app inbox. Meal broadcasts are deliberately absent — the meals tab carries those.
  NOTIFICATIONS: "/v1/notifications",
  NOTIFICATIONS_UNREAD_COUNT: "/v1/notifications/unread-count",
  NOTIFICATION_READ: (id: string) => `/v1/notifications/${id}/read`,
  // Per-user dismissal behind a DELETE verb: one row reaches everyone it targets, so
  // removing it outright would take it from the other twenty-nine people.
  NOTIFICATION_DISMISS: (id: string) => `/v1/notifications/${id}`,
  NOTIFICATIONS_READ_ALL: "/v1/notifications/read-all",
  NOTIFICATIONS_TEST_PUSH: "/v1/notifications/test-push",
  // The only notification a human writes; everything else in the inbox is a consequence the
  // server posted on the way past. Owner/manager only, and rate limited.
  NOTIFICATIONS_BROADCAST: "/v1/notifications/broadcast",

  // Profile photo. Two steps, like KYC: presigned PUT, then PATCH /v1/me with the key.
  ME_AVATAR_UPLOAD_URL: "/v1/me/avatar/upload-url",

  // Ad engagement, recorded as events so the earnings figure is derived rather than a
  // counter that resets with the app.
  ADS_EVENTS: "/v1/ads/events",
  ADS_METRICS: "/v1/ads/metrics",

  // Staff sign in with a PIN their owner issued, so the owner can reissue it — without this
  // a forgotten PIN means deleting the person and losing their shift history. There is no
  // equivalent for residents: a resident's password is theirs, and CHANGE_PASSWORD above,
  // which asks for the current one, is the only way it moves.
  STAFF_RESET_CREDENTIALS: (membershipId: string) => `/v1/staff/${membershipId}/reset-credentials`,

  // Reward points, as a ledger. The balance is always `SUM(delta)` — there is no stored
  // total that could drift from the entries under it.
  REWARDS: "/v1/rewards",
  REWARDS_ME: "/v1/rewards/me",
  REWARDS_CLAIM_CHAMPION: "/v1/rewards/claim-champion",

  // Billing — owner → PGow, the mirror of resident rent one level up. PGow confirms these,
  // not the owner, for the same reason a resident cannot verify their own payment.
  BILLING_PLANS: "/v1/billing/plans",
  BILLING_QUOTE: "/v1/billing/quote",
  BILLING_SUBSCRIPTION: "/v1/billing/subscription",
  BILLING_SUBSCRIBE: "/v1/billing/subscribe",
  BILLING_INVOICES: "/v1/billing/invoices",
  BILLING_INVOICE_PAY: (id: string) => `/v1/billing/invoices/${id}/pay`,

  // Expenses (money out). Append-only: there is no PATCH and no DELETE, and a mistake is
  // corrected by logging a reversing entry that points at the original.
  EXPENSES: "/v1/expenses",
  EXPENSES_SUMMARY: "/v1/expenses/summary",
  EXPENSE_REVERSE: (id: string) => `/v1/expenses/${id}/reverse`,

  // Supply / groceries — the resident-facing catalog and cart flow.
  SUPPLY_CATEGORIES: "/v1/supply/categories",
  SUPPLY_ITEMS: "/v1/supply/items",
  SUPPLY_ORDERS: "/v1/supply/orders",
  SUPPLY_ORDER: (id: string) => `/v1/supply/orders/${id}`,
  SUPPLY_ORDER_CANCEL: (id: string) => `/v1/supply/orders/${id}/cancel`,
  SUPPLY_ORDER_TRACKING: (id: string) => `/v1/supply/orders/${id}/tracking`,
  SUPPLY_ORDER_PAYMENT_UPI: (id: string) => `/v1/supply/orders/${id}/payment/submit-upi`,

  // Supply / delivery agent — the agent's own view of their assigned trips.
  SUPPLY_TRIPS_MINE: "/v1/supply/trips/mine",
  SUPPLY_TRIP: (tripId: string) => `/v1/supply/trips/${tripId}`,
  SUPPLY_TRIP_STOP_COMPLETE: (tripId: string, orderId: string) =>
    `/v1/supply/trips/${tripId}/stops/${orderId}/complete`,
  SUPPLY_TRIP_STOP_PHOTO_UPLOAD_URL: (tripId: string, orderId: string) =>
    `/v1/supply/trips/${tripId}/stops/${orderId}/photo-upload-url`,

  // ── Planned/future endpoints ──────────────────────────────────────────────
  // These constants are intentionally kept even when the current backend does not implement
  // them yet. The compatibility check reports them as gaps; removing them would hide planned
  // frontend work instead of integrating it.
  PG_LAYOUT: (pgId: string) => `/v1/pgs/${pgId}/layout`,
  PG_BED_ASSIGN: (pgId: string, bedId: string) => `/v1/pgs/${pgId}/beds/${bedId}/assign`,
  PG_BED_VACATE: (pgId: string, bedId: string) => `/v1/pgs/${pgId}/beds/${bedId}/vacate`,

  PROCUREMENT_CATALOG: "/v1/procurement/catalog",
  PROCUREMENT_ORDERS: "/v1/procurement/orders",
  PROCUREMENT_ORDER_APPROVE: (id: string) => `/v1/procurement/orders/${id}/approve`,
  PROCUREMENT_ORDER_REJECT: (id: string) => `/v1/procurement/orders/${id}/reject`,

  MEAL_MENU: "/v1/meals/menu",
  MEAL_TODAY_SUMMARY: (pgId: string) => `/v1/meals/today-summary?pg_id=${pgId}`,
  MEAL_FEEDBACK: (mealId: string) => `/v1/meals/${mealId}/feedback`,
  MEAL_SAVINGS_ANALYTICS: (pgId: string, start: string, end: string) =>
    `/v1/meals/analytics/savings?pg_id=${pgId}&start_date=${start}&end_date=${end}`,

  // Billing — tenant invoices, the property-wide ledger, P&L over 3m/6m/1y,
  // CSV export, and the remind-unpaid fan-out.
  BILLING_TENANT_INVOICES: "/v1/billing/tenant-invoices",
  BILLING_TENANT_INVOICE_PAY: (id: string) => `/v1/billing/tenant-invoices/${id}/pay`,
  BILLING_TENANT_INVOICE_PDF: (id: string) => `/v1/billing/tenant-invoices/${id}/pdf`,
  BILLING_LEDGER: (pgId: string, start: string, end: string) =>
    `/v1/billing/ledger?pg_id=${pgId}&start_date=${start}&end_date=${end}`,
  BILLING_PNL: (pgId: string, interval: string) =>
    `/v1/billing/pnl?pg_id=${pgId}&interval=${interval}`,
  BILLING_EXPORT_CSV: (pgId: string, start: string, end: string) =>
    `/v1/billing/export-csv?pg_id=${pgId}&start_date=${start}&end_date=${end}`,
  BILLING_REMIND_UNPAID: "/v1/billing/remind-unpaid",
} as const;

// The five gate codes — switches on error.code, never error.message
export const GATE_CODES = [
  "PASSWORD_CHANGE_REQUIRED",
  "KYC_REQUIRED",
  "KYC_PENDING",
  "KYC_REJECTED",
  "RENT_UNPAID",
] as const;
export type GateCode = (typeof GATE_CODES)[number];
