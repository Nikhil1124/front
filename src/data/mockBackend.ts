/**
 * The mock backend. Every network request the app makes lands here instead of a real
 * server — see `fetchWithTimeout` in `apiClient.ts`, the one place that calls this.
 *
 * Route table is checked top to bottom, so a literal path (`/v1/meals/menu`) must be listed
 * before the `:id` pattern it would otherwise be swallowed by (`/v1/meals/:id`).
 */

import { BASE_URL } from "../config";
import * as db from "./mockData";

// ─── URL parsing (no `URL` global — not polyfilled in this RN app) ───────────

function parseUrl(fullUrl: string): { pathname: string; search: URLSearchParams } {
  const qIdx = fullUrl.indexOf("?");
  const withoutQuery = qIdx === -1 ? fullUrl : fullUrl.slice(0, qIdx);
  const query = qIdx === -1 ? "" : fullUrl.slice(qIdx + 1);
  const schemeEnd = withoutQuery.indexOf("://");
  const pathStart = schemeEnd === -1 ? 0 : withoutQuery.indexOf("/", schemeEnd + 3);
  const pathname = pathStart === -1 ? "/" : withoutQuery.slice(pathStart);
  return { pathname, search: new URLSearchParams(query) };
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const pParts = pattern.split("/").filter(Boolean);
  const uParts = pathname.split("/").filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(":")) params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    else if (pParts[i] !== uParts[i]) return null;
  }
  return params;
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function noContent(): Response {
  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
}
function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function pageOf<T>(items: T[]): { items: T[]; next_cursor: null } {
  return { items, next_cursor: null };
}

// ─── Auth tokens ────────────────────────────────────────────────────────────
// No real signing — the user id rides in the token string, which is fine for a mock that
// never leaves the device and never needs to resist tampering.

function issueTokens(userId: string, mustChangePassword = false) {
  const rand = Math.random().toString(36).slice(2);
  return {
    access_token: `mockat:${userId}:${rand}`,
    refresh_token: `mockrt:${userId}:${rand}`,
    token_type: "bearer",
    must_change_password: mustChangePassword,
  };
}

function userIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.replace(/^Bearer\s+/i, "").split(":");
  return parts.length === 3 ? parts[1] : null;
}

function bearerFrom(init: RequestInit): string | null {
  const headers = (init.headers ?? {}) as Record<string, string>;
  const auth = headers["Authorization"] ?? headers["authorization"];
  return auth ? auth.replace(/^Bearer\s+/i, "") : null;
}

function currentUser(init: RequestInit): db.MockUser | null {
  const userId = userIdFromToken(bearerFrom(init));
  if (!userId) return null;
  for (const u of db.usersByPhone.values()) if (u.id === userId) return u;
  return null;
}

function provisionOwner(phone: string): db.MockUser {
  const existing = db.usersByPhone.get(phone);
  if (existing) return existing;
  const id = db.genId("user_owner");
  const membershipId = db.genId("mem_owner");
  const user: db.MockUser = {
    id,
    name: "New Owner",
    phone,
    email: null,
    must_change_password: false,
    avatar_url: null,
    memberships: [{ pg_id: db.PG_ID, pg_name: db.pgs[0].name, role: "owner", membership_id: membershipId, room_no: null }],
    platform_roles: [],
    gate: null,
  };
  db.usersByPhone.set(phone, user);
  return user;
}

// ─── Small body/query readers ─────────────────────────────────────────────────

function readBody(init: RequestInit): any {
  if (!init.body) return {};
  try {
    return JSON.parse(init.body as string);
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Route handlers, grouped by resource. Each returns a Response.
// ═══════════════════════════════════════════════════════════════════════════

type Ctx = { params: Record<string, string>; q: URLSearchParams; body: any; init: RequestInit };
type Handler = (ctx: Ctx) => Response;

const routes: Array<{ method: string; pattern: string; handler: Handler }> = [];
function route(method: string, pattern: string, handler: Handler) {
  routes.push({ method, pattern, handler });
}

// ── Auth ──────────────────────────────────────────────────────────────────

route("POST", "/v1/auth/register", ({ body }) => {
  const phone = String(body.phone ?? "");
  if (db.usersByPhone.has(phone)) return fail(409, "ALREADY_EXISTS", "An account with this phone already exists.");
  const id = db.genId("user_owner");
  const user: db.MockUser = {
    id,
    name: String(body.name ?? "New Owner"),
    phone,
    email: body.email ?? null,
    must_change_password: false,
    avatar_url: null,
    memberships: [],
    platform_roles: [],
    gate: null,
  };
  db.usersByPhone.set(phone, user);
  return ok(issueTokens(id));
});

route("POST", "/v1/auth/login", ({ body }) => {
  const phone = String(body.phone ?? "");
  const guest = Array.from(db.usersByPhone.values()).find((u) => u.phone === phone && u.memberships[0]?.role === "guest");
  // The resident tab must match an existing invited guest — unlike the owner tab, an
  // unrecognised phone here is not a new signup, it's a wrong number.
  if (body.as_guest) {
    if (!guest) return fail(401, "UNAUTHENTICATED", "Invalid phone number or password.");
    return ok(issueTokens(guest.id));
  }
  const user = guest ?? provisionOwner(phone);
  return ok(issueTokens(user.id));
});

route("POST", "/v1/auth/login/pin", ({ body }) => {
  const phone = String(body.phone ?? "");
  const staffUser = Array.from(db.usersByPhone.values()).find(
    (u) => u.phone === phone && ["manager", "chef", "kitchen_staff", "maintenance", "delivery_agent"].includes(u.memberships[0]?.role ?? "")
  );
  if (!staffUser) return fail(401, "UNAUTHENTICATED", "Invalid phone number or PIN.");
  return ok(issueTokens(staffUser.id));
});

route("POST", "/v1/auth/password", ({ init }) => {
  const user = currentUser(init);
  if (!user) return fail(401, "UNAUTHENTICATED", "Session expired.");
  user.must_change_password = false;
  return ok(issueTokens(user.id));
});

route("POST", "/v1/auth/refresh", ({ body }) => {
  const userId = userIdFromToken(String(body.refresh_token ?? ""));
  if (!userId) return fail(401, "INVALID_TOKEN", "Refresh token is invalid.");
  return ok(issueTokens(userId));
});

route("POST", "/v1/auth/logout", () => noContent());

route("GET", "/v1/me", ({ init }) => {
  const user = currentUser(init);
  if (!user) return fail(401, "UNAUTHENTICATED", "Session expired.");
  return ok(user);
});

route("PATCH", "/v1/me", ({ init, body }) => {
  const user = currentUser(init);
  if (!user) return fail(401, "UNAUTHENTICATED", "Session expired.");
  if (body.name != null) user.name = body.name;
  if (body.email != null) user.email = body.email;
  if ("avatar_object_key" in body) user.avatar_url = body.avatar_object_key ? "https://picsum.photos/seed/avatar/200/200" : null;
  return ok(user);
});

route("POST", "/v1/me/avatar/upload-url", () => ok({ upload_url: "mock://upload/avatar", object_key: `avatar_${db.genId("obj")}` }));

// ── Properties ───────────────────────────────────────────────────────────

route("GET", "/v1/pgs", () => ok(pageOf(db.pgs)));

route("POST", "/v1/pgs", ({ init, body }) => {
  const user = currentUser(init);
  const pg = {
    id: db.genId("pg"),
    name: String(body.name ?? "New PG"),
    address: String(body.address ?? ""),
    total_beds: Number(body.total_beds ?? 0),
    area_id: null as string | null,
    roles: ["owner"],
    active_upi_vpa: null as string | null,
    latitude: body.latitude != null ? String(body.latitude) : null,
    longitude: body.longitude != null ? String(body.longitude) : null,
    formatted_address: String(body.address ?? ""),
    map_image_url: null as string | null,
    join_code: Math.random().toString(36).slice(2, 10).toUpperCase(),
    default_rent_amount: null as string | null,
    subscription_active: false,
  };
  db.pgs.push(pg);
  if (user && !user.memberships.some((m) => m.pg_id === pg.id)) {
    user.memberships.push({ pg_id: pg.id, pg_name: pg.name, role: "owner", membership_id: db.genId("mem_owner"), room_no: null });
  }
  return ok(pg, 201);
});

route("GET", "/v1/pgs/:id/layout", ({ params }) => {
  const pg = db.pgs.find((p) => p.id === params.id);
  const guestsHere = db.guests.filter((g) => g.pg_id === params.id);
  const roomsMap = new Map<string, typeof guestsHere>();
  for (const g of guestsHere) {
    const floor = g.room_no.charAt(0);
    const key = `${floor}|${g.room_no}`;
    if (!roomsMap.has(key)) roomsMap.set(key, []);
    roomsMap.get(key)!.push(g);
  }
  const floors: Record<number, any[]> = {};
  for (const [key, occupants] of roomsMap) {
    const [floorStr, roomNumber] = key.split("|");
    const floorNumber = Number(floorStr) || 1;
    if (!floors[floorNumber]) floors[floorNumber] = [];
    const beds: any[] = occupants.map((g, i) => ({
      id: `bed_${g.membership_id}`,
      bed_number: String.fromCharCode(65 + i),
      status: "occupied",
      tenant: {
        membership_id: g.membership_id,
        full_name: g.name,
        phone: g.phone,
        dietary_preference: "none",
        check_in_date: g.started_at,
        kyc_status: db.kycRecords.find((k) => k.membership_id === g.membership_id)?.status ?? "pending",
      },
    }));
    // One extra vacant bed per room so the seat map shows capacity, not just occupancy.
    beds.push({ id: `bed_${key}_vacant`, bed_number: String.fromCharCode(65 + beds.length), status: "vacant", tenant: null });
    floors[floorNumber].push({ id: `room_${roomNumber}`, floor_number: floorNumber, room_number: roomNumber, sharing_type: beds.length, base_rent: pg?.default_rent_amount ? Number(pg.default_rent_amount) : 8500, beds });
  }
  return ok({
    pg_id: params.id,
    property_name: pg?.name ?? "",
    total_floors: Object.keys(floors).length,
    floors: Object.entries(floors).map(([floorNumber, rooms]) => ({ floor_number: Number(floorNumber), rooms })),
  });
});

route("POST", "/v1/pgs/:pgId/beds/:bedId/assign", ({ params }) => {
  // The layout is derived from `guests` each time, so "assigning" a bed has nothing
  // durable to change here beyond acknowledging it — the seat map re-derives on refetch.
  return ok({ ok: true, bedId: params.bedId });
});
route("POST", "/v1/pgs/:pgId/beds/:bedId/vacate", ({ params }) => ok({ ok: true, bedId: params.bedId }));

route("POST", "/v1/pgs/:id/join-code", ({ params }) => {
  const pg = db.pgs.find((p) => p.id === params.id);
  if (!pg) return fail(404, "NOT_FOUND", "Property not found.");
  pg.join_code = Math.random().toString(36).slice(2, 10).toUpperCase();
  return ok({ pg_id: pg.id, join_code: pg.join_code });
});
route("DELETE", "/v1/pgs/:id/join-code", ({ params }) => {
  const pg = db.pgs.find((p) => p.id === params.id);
  if (pg) pg.join_code = null;
  return noContent();
});

route("GET", "/v1/pgs/:id/upi-ids", ({ params }) => ok(db.upiIds.filter((u) => u.pg_id === params.id)));
route("POST", "/v1/pgs/:id/upi-ids", ({ params, body }) => {
  const upi = { id: db.genId("upi"), pg_id: params.id, vpa_address: String(body.vpa_address ?? ""), label: body.label ?? null, is_active: db.upiIds.length === 0, created_at: db.nowIso() };
  db.upiIds.push(upi);
  return ok(upi, 201);
});
route("POST", "/v1/pgs/:pgId/upi-ids/:upiId/activate", ({ params }) => {
  for (const u of db.upiIds) u.is_active = u.pg_id === params.pgId && u.id === params.upiId;
  return ok(db.upiIds.find((u) => u.id === params.upiId));
});
route("DELETE", "/v1/pgs/:pgId/upi-ids/:upiId", ({ params }) => {
  const idx = db.upiIds.findIndex((u) => u.id === params.upiId);
  if (idx >= 0) db.upiIds.splice(idx, 1);
  return noContent();
});

route("GET", "/v1/pgs/:id", ({ params }) => {
  const pg = db.pgs.find((p) => p.id === params.id);
  return pg ? ok(pg) : fail(404, "NOT_FOUND", "Property not found.");
});
route("PATCH", "/v1/pgs/:id", ({ params, body }) => {
  const pg = db.pgs.find((p) => p.id === params.id);
  if (!pg) return fail(404, "NOT_FOUND", "Property not found.");
  Object.assign(pg, {
    ...(body.name != null && { name: body.name }),
    ...(body.address != null && { address: body.address, formatted_address: body.address }),
    ...(body.total_beds != null && { total_beds: body.total_beds }),
    ...(body.latitude != null && { latitude: String(body.latitude) }),
    ...(body.longitude != null && { longitude: String(body.longitude) }),
    ...(body.default_rent_amount != null && { default_rent_amount: String(body.default_rent_amount) }),
  });
  return ok(pg);
});

// ── Staff ────────────────────────────────────────────────────────────────

route("GET", "/v1/staff", ({ q }) => ok(pageOf(db.staff.filter((s) => s.pg_id === (q.get("pg_id") ?? db.PG_ID)))));
route("POST", "/v1/staff", ({ q, body }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const membershipId = db.genId("mem_staff");
  const userId = db.genId("user_staff");
  const phone = String(body.phone ?? "");
  const member: db.MockStaff = {
    membership_id: membershipId, user_id: userId, pg_id: pgId, name: String(body.name ?? ""), phone,
    email: null, role: body.role ?? "kitchen_staff", monthly_salary: body.monthly_salary != null ? String(body.monthly_salary) : null,
    shift_start: null, shift_end: null, has_pin: !!body.pin, started_at: db.nowIso(), ended_at: null,
  };
  db.staff.push(member);
  if (body.pin) db.staffPins.set(phone, String(body.pin));
  db.usersByPhone.set(phone, {
    id: userId, name: member.name, phone, email: null, must_change_password: false, avatar_url: null,
    memberships: [{ pg_id: pgId, pg_name: db.pgs.find((p) => p.id === pgId)?.name ?? "", role: member.role, membership_id: membershipId, room_no: null }],
    platform_roles: [], gate: null,
  });
  return ok(member, 201);
});
route("POST", "/v1/staff/:id/reset-credentials", ({ params, body }) => {
  const member = db.staff.find((s) => s.membership_id === params.id);
  if (member && body.pin) db.staffPins.set(member.phone, String(body.pin));
  return ok({ ok: true });
});
route("GET", "/v1/staff/:id", ({ params }) => {
  const member = db.staff.find((s) => s.membership_id === params.id);
  return member ? ok(member) : fail(404, "NOT_FOUND", "Staff member not found.");
});
route("PATCH", "/v1/staff/:id", ({ params, body }) => {
  const member = db.staff.find((s) => s.membership_id === params.id);
  if (!member) return fail(404, "NOT_FOUND", "Staff member not found.");
  Object.assign(member, {
    ...(body.name != null && { name: body.name }),
    ...(body.role != null && { role: body.role }),
    ...(body.monthly_salary != null && { monthly_salary: String(body.monthly_salary) }),
    ...(body.shift_start != null && { shift_start: body.shift_start }),
    ...(body.shift_end != null && { shift_end: body.shift_end }),
  });
  return ok(member);
});
route("DELETE", "/v1/staff/:id", ({ params }) => {
  const idx = db.staff.findIndex((s) => s.membership_id === params.id);
  const removed = idx >= 0 ? db.staff.splice(idx, 1)[0] : null;
  return removed ? ok(removed) : fail(404, "NOT_FOUND", "Staff member not found.");
});

// ── Guests ───────────────────────────────────────────────────────────────

route("GET", "/v1/guests", ({ q }) => ok(pageOf(db.guests.filter((g) => g.pg_id === (q.get("pg_id") ?? db.PG_ID)))));
route("POST", "/v1/guests", ({ q, body }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const membershipId = db.genId("mem_guest");
  const userId = db.genId("user_guest");
  const guest: db.MockGuest = {
    membership_id: membershipId, user_id: userId, pg_id: pgId, name: String(body.name ?? ""),
    phone: String(body.phone ?? ""), email: body.email ?? null, room_no: String(body.room_no ?? ""),
    rent_amount: body.rent_amount != null ? String(body.rent_amount) : null, started_at: db.nowIso(), ended_at: null,
  };
  db.guests.push(guest);
  db.registerGuestUser(guest);
  return ok(guest, 201);
});
route("POST", "/v1/guests/join", ({ body }) => {
  const pg = db.pgs.find((p) => p.join_code && p.join_code.toUpperCase() === String(body.join_code ?? "").toUpperCase());
  if (!pg) return fail(404, "NOT_FOUND", "That PG code was not found.");
  const membershipId = db.genId("mem_guest");
  const userId = db.genId("user_guest");
  const guest: db.MockGuest = {
    membership_id: membershipId, user_id: userId, pg_id: pg.id, name: String(body.name ?? ""),
    phone: String(body.phone ?? ""), email: body.email ?? null, room_no: String(body.room_no ?? ""),
    rent_amount: pg.default_rent_amount, started_at: db.nowIso(), ended_at: null,
  };
  db.guests.push(guest);
  const user = db.registerGuestUser(guest);
  return ok(issueTokens(user.id));
});
route("GET", "/v1/guests/:id", ({ params }) => {
  const guest = db.guests.find((g) => g.membership_id === params.id);
  return guest ? ok(guest) : fail(404, "NOT_FOUND", "Resident not found.");
});
route("PATCH", "/v1/guests/:id", ({ params, body }) => {
  const guest = db.guests.find((g) => g.membership_id === params.id);
  if (!guest) return fail(404, "NOT_FOUND", "Resident not found.");
  Object.assign(guest, {
    ...(body.name != null && { name: body.name }),
    ...(body.email != null && { email: body.email }),
    ...(body.room_no != null && { room_no: body.room_no }),
    ...(body.rent_amount != null && { rent_amount: String(body.rent_amount) }),
  });
  return ok(guest);
});
route("DELETE", "/v1/guests/:id", ({ params }) => {
  const idx = db.guests.findIndex((g) => g.membership_id === params.id);
  const removed = idx >= 0 ? db.guests.splice(idx, 1)[0] : null;
  return removed ? ok(removed) : fail(404, "NOT_FOUND", "Resident not found.");
});

// ── KYC ──────────────────────────────────────────────────────────────────

route("POST", "/v1/kyc/upload-url", ({ body }) => ok({ upload_url: "mock://upload/kyc", object_key: `kyc_${body.kind ?? "doc"}_${db.genId("obj")}` }));
route("POST", "/v1/kyc/submit", ({ init, body }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id ?? "";
  const existing = db.kycRecords.find((k) => k.membership_id === membershipId);
  const record = {
    id: existing?.id ?? db.genId("kyc"), pg_id: body.pg_id ?? db.PG_ID, membership_id: membershipId,
    status: "pending" as const, reject_reason: null, submitted_at: db.nowIso(), decided_at: null,
    front_url: "https://picsum.photos/seed/kycfront/400/260", back_url: "https://picsum.photos/seed/kycback/400/260", selfie_url: "https://picsum.photos/seed/kycselfie/300/300",
  };
  if (existing) Object.assign(existing, record);
  else db.kycRecords.push(record);
  if (user) user.gate = "KYC_PENDING";
  return ok(record, 201);
});
route("GET", "/v1/kyc/pending", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const pending = db.kycRecords.filter((k) => k.pg_id === pgId && k.status === "pending");
  return ok(pageOf(pending));
});
route("POST", "/v1/kyc/:id/verify", ({ params }) => {
  const record = db.kycRecords.find((k) => k.id === params.id);
  if (!record) return fail(404, "NOT_FOUND", "KYC record not found.");
  (record as any).status = "verified";
  (record as any).decided_at = db.nowIso();
  const guestUser = Array.from(db.usersByPhone.values()).find((u) => u.memberships[0]?.membership_id === record.membership_id);
  if (guestUser) guestUser.gate = null;
  return ok(record);
});
route("POST", "/v1/kyc/:id/reject", ({ params, body }) => {
  const record = db.kycRecords.find((k) => k.id === params.id);
  if (!record) return fail(404, "NOT_FOUND", "KYC record not found.");
  (record as any).status = "rejected";
  (record as any).decided_at = db.nowIso();
  (record as any).reject_reason = body.reason ?? "Documents unclear.";
  const guestUser = Array.from(db.usersByPhone.values()).find((u) => u.memberships[0]?.membership_id === record.membership_id);
  if (guestUser) guestUser.gate = "KYC_REJECTED";
  return ok(record);
});

// ── Meals ────────────────────────────────────────────────────────────────

route("GET", "/v1/meals/menu", () => ok(db.mealMenu));
route("GET", "/v1/meals/today-summary", () => {
  const summarize = (mealId: string) => {
    const responses = db.mealResponses.filter((r) => r.meal_id === mealId);
    const eating = responses.filter((r) => r.choice === "eating").length;
    return { total_attending: eating, veg_count: Math.round(eating * 0.7), non_veg_count: Math.round(eating * 0.2), eggitarian_count: Math.round(eating * 0.1), allergy_count: eating > 3 ? 1 : 0, total_skip: responses.filter((r) => r.choice === "skipping").length };
  };
  return ok({
    breakfast: summarize("meal_1"),
    lunch: summarize("meal_2"),
    dinner: summarize("meal_3"),
  });
});
route("GET", "/v1/meals/analytics/savings", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const start = q.get("start_date");
  const end = q.get("end_date");
  // No real per-plate cost is tracked yet — same ₹45 assumption the P&L estimate uses.
  const costPerPlate = 45;
  const inRange = db.meals.filter((m) =>
    m.pg_id === pgId &&
    (!start || m.service_at >= start) &&
    (!end || m.service_at <= end)
  );
  const daily = inRange.map((m) => {
    const skipped = db.mealResponses.filter((r) => r.meal_id === m.id && r.choice === "skipping").length;
    return { date: m.service_at, meal_type: m.meal_type, skipped_portions: skipped, saved: skipped * costPerPlate };
  });
  const totalSkippedPortions = daily.reduce((sum, d) => sum + d.skipped_portions, 0);
  return ok({
    daily,
    total_skipped_portions: totalSkippedPortions,
    total_saved: totalSkippedPortions * costPerPlate,
    cost_per_plate: costPerPlate,
  });
});
route("POST", "/v1/meals/:id/feedback", ({ params, body }) => {
  const fb = { id: db.genId("mfb"), meal_id: params.id, rating: Number(body.rating ?? 5), comment: body.comment ?? null, created_at: db.nowIso() };
  db.mealFeedback.push(fb);
  return ok(fb, 201);
});
route("GET", "/v1/meals", ({ q }) => ok(pageOf(db.meals.filter((m) => m.pg_id === (q.get("pg_id") ?? db.PG_ID)))));
route("POST", "/v1/meals", ({ q, body }) => {
  const meal: db.MockMeal = {
    id: db.genId("meal"), pg_id: q.get("pg_id") ?? db.PG_ID, meal_type: body.meal_type, menu_items: body.menu_items ?? "",
    chef_note: body.chef_note ?? "", service_at: body.service_at ?? db.nowIso(), response_closes_at: null, is_open: true, is_broadcast: false, created_by: "mem_chef_1",
  };
  db.meals.push(meal);
  return ok(meal, 201);
});
route("POST", "/v1/meals/:id/broadcast", ({ params, body }) => {
  const meal = db.meals.find((m) => m.id === params.id);
  if (!meal) return fail(404, "NOT_FOUND", "Meal not found.");
  meal.is_broadcast = true;
  if (body.response_closes_at) meal.response_closes_at = body.response_closes_at;
  return ok(meal);
});
route("POST", "/v1/meals/:id/close", ({ params }) => {
  const meal = db.meals.find((m) => m.id === params.id);
  if (!meal) return fail(404, "NOT_FOUND", "Meal not found.");
  meal.is_open = false;
  return ok(meal);
});
route("PUT", "/v1/meals/:id/response", ({ params, body, init }) => {
  const user = currentUser(init);
  const guestId = user?.memberships[0]?.membership_id ?? "unknown";
  const existing = db.mealResponses.find((r) => r.meal_id === params.id && r.guest_id === guestId);
  if (existing) {
    existing.choice = body.choice;
  } else {
    db.mealResponses.push({ meal_id: params.id, guest_id: guestId, choice: body.choice });
    // Reward points for responding — only on the first response to a given meal, not on every
    // edit, so switching an answer back and forth can't be used to farm points. Skipping is
    // worth more than eating: it's the response that actually helps the kitchen (less over-prep,
    // less waste), which is also why the seed data's own reward entries frame it that way.
    const meal = db.meals.find((m) => m.id === params.id);
    const mealLabel = meal ? meal.meal_type[0].toUpperCase() + meal.meal_type.slice(1) : "Meal";
    const isSkipping = body.choice === "skipping";
    const ledger = db.rewardsLedger[guestId] ?? (db.rewardsLedger[guestId] = []);
    ledger.push({
      id: db.genId("rw"),
      delta: isSkipping ? 20 : 5,
      reason: isSkipping
        ? `Skipped ${mealLabel.toLowerCase()} — kitchen saved a portion`
        : `Responded to ${mealLabel.toLowerCase()} RSVP`,
      ref_type: "meal_response",
      ref_id: params.id,
      created_at: db.nowIso(),
    });
  }
  return ok({ meal_id: params.id, guest_id: guestId, choice: body.choice });
});
route("GET", "/v1/meals/:id/response-summary", ({ params }) => {
  const responses = db.mealResponses.filter((r) => r.meal_id === params.id);
  return ok({ eating: responses.filter((r) => r.choice === "eating").length, skipping: responses.filter((r) => r.choice === "skipping").length });
});
route("GET", "/v1/meals/:id/responses", ({ params }) => {
  const responses = db.mealResponses.filter((r) => r.meal_id === params.id);
  const rows = db.guests.map((g) => {
    const r = responses.find((x) => x.guest_id === g.membership_id);
    return { membership_id: g.membership_id, name: g.name, room_no: g.room_no, choice: r?.choice ?? null, responded_at: r ? db.nowIso() : null };
  });
  return ok(pageOf(rows));
});
route("GET", "/v1/meals/:id/response", ({ params, init }) => {
  const user = currentUser(init);
  const guestId = user?.memberships[0]?.membership_id;
  const r = db.mealResponses.find((x) => x.meal_id === params.id && x.guest_id === guestId);
  return ok(r ?? null);
});
route("GET", "/v1/meals/:id", ({ params }) => {
  const meal = db.meals.find((m) => m.id === params.id);
  return meal ? ok(meal) : fail(404, "NOT_FOUND", "Meal not found.");
});
route("PATCH", "/v1/meals/:id", ({ params, body }) => {
  const meal = db.meals.find((m) => m.id === params.id);
  if (!meal) return fail(404, "NOT_FOUND", "Meal not found.");
  Object.assign(meal, { ...(body.menu_items != null && { menu_items: body.menu_items }), ...(body.chef_note != null && { chef_note: body.chef_note }), ...(body.service_at != null && { service_at: body.service_at }) });
  return ok(meal);
});

// ── Places ───────────────────────────────────────────────────────────────

route("GET", "/v1/places/autocomplete", ({ q }) => {
  const query = (q.get("q") ?? "").toLowerCase();
  const results = query ? db.placeSuggestions.filter((p) => p.primary.toLowerCase().includes(query)) : db.placeSuggestions;
  return ok(results);
});
route("GET", "/v1/places/reverse-geocode", ({ q }) => ok({ formatted_address: `Near ${q.get("lat")}, ${q.get("lng")}, Hyderabad, Telangana`, place_id: "place_reverse" }));
route("GET", "/v1/places/map-tile", () => new Response(null, { status: 204 }));
route("GET", "/v1/places/style.json", () => ok({ version: 8, sources: {}, layers: [] }));

// ── Devices ──────────────────────────────────────────────────────────────

route("POST", "/v1/devices", ({ body }) => ok({ id: db.genId("device"), platform: body.platform ?? "android", app_version: null, subscribed: false, last_seen_at: db.nowIso(), created_at: db.nowIso() }, 201));
route("DELETE", "/v1/devices/:id", () => noContent());

// ── Payments ─────────────────────────────────────────────────────────────

route("GET", "/v1/payments/due", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const pg = db.pgs.find((p) => p.id === pgId);
  return ok({ pg_id: pgId, pg_name: pg?.name ?? "", owner_upi_vpa: pg?.active_upi_vpa ?? null, rent_amount: pg?.default_rent_amount ?? "8500.00", current_period: new Date().toISOString().slice(0, 8) + "01", is_paid: false, pending_payment: null });
});
route("POST", "/v1/payments/reminders", ({ q }) => ok({ pg_id: q.get("pg_id") ?? db.PG_ID, period: new Date().toISOString().slice(0, 8) + "01", reminded: 3, already_paid: 1, on_cooldown: 0 }));
route("POST", "/v1/payments", ({ init, body }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id ?? "unknown";
  const guest = db.guests.find((g) => g.membership_id === membershipId);
  const payment: db.MockPayment = {
    id: db.genId("pay"), pg_id: body.pg_id ?? db.PG_ID, membership_id: membershipId, guest_name: guest?.name ?? null, room_no: guest?.room_no ?? null,
    period: body.period, purpose: body.purpose ?? "rent", amount: body.amount, status: "pending", method: body.method ?? "upi_intent",
    upi_ref: body.upi_ref ?? null, rejection_reason: null, verified_at: null, created_at: db.nowIso(),
  };
  db.payments.push(payment);
  return ok(payment, 201);
});
route("GET", "/v1/payments", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const status = q.get("status");
  let rows = db.payments.filter((p) => p.pg_id === pgId);
  if (status) rows = rows.filter((p) => p.status === status);
  return ok(pageOf(rows));
});
route("POST", "/v1/payments/:id/verify", ({ params }) => {
  const payment = db.payments.find((p) => p.id === params.id);
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found.");
  payment.status = "verified";
  payment.verified_at = db.nowIso();
  return ok(payment);
});
route("POST", "/v1/payments/:id/reject", ({ params, body }) => {
  const payment = db.payments.find((p) => p.id === params.id);
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found.");
  payment.status = "rejected";
  payment.rejection_reason = body.reason ?? "Could not verify this payment.";
  return ok(payment);
});

// ── Requests (complaints / feedback / hub services) ─────────────────────

route("GET", "/v1/requests", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  let rows = db.requests.filter((r) => r.pg_id === pgId);
  const kind = q.get("kind"); if (kind) rows = rows.filter((r) => r.kind === kind);
  const status = q.get("status"); if (status) rows = rows.filter((r) => r.status === status);
  return ok(pageOf(rows));
});
route("POST", "/v1/requests", ({ init, body }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id ?? "unknown";
  const guest = db.guests.find((g) => g.membership_id === membershipId);
  const request: db.MockRequest = {
    id: db.genId("req"), pg_id: body.pg_id ?? db.PG_ID, raised_by: membershipId, resident_name: guest?.name ?? user?.name ?? null,
    room_no: guest?.room_no ?? null, phone: user?.phone ?? null, kind: body.kind ?? "complaint", category: body.category ?? null,
    title: body.title, description: body.description ?? "", status: "open", priority: body.priority ?? "normal",
    assigned_membership_id: null, assigned_name: null, assigned_role: null, assigned_at: null,
    amount: body.amount ?? null, service_date: body.service_date ?? null, details: body.details ?? {},
    resolved_at: null, resolution_note: null, created_at: db.nowIso(), updated_at: db.nowIso(), events: [], attachments: [],
  };
  db.requests.push(request);
  return ok(request, 201);
});
route("POST", "/v1/requests/:id/attachments/upload-url", () => ok({ upload_url: "mock://upload/attachment", object_key: `attachment_${db.genId("obj")}` }));
route("POST", "/v1/requests/:id/attachments", ({ params, body }) => ok({ id: db.genId("att"), content_type: body.content_type ?? "image/jpeg", size_bytes: body.size_bytes ?? null, created_at: db.nowIso(), url: "https://picsum.photos/seed/attachment/500/500" }, 201));
route("POST", "/v1/requests/:id/events", ({ params, body }) => {
  const request = db.requests.find((r) => r.id === params.id);
  if (!request) return fail(404, "NOT_FOUND", "Ticket not found.");
  request.events.push({ id: db.genId("evt"), pg_id: request.pg_id, request_id: request.id, actor_user_id: null, actor_name: "You", actor_role: null, event_type: "comment", body: body.body ?? "", from_status: null, to_status: body.to_status ?? null, is_ai_generated: false, created_at: db.nowIso() });
  if (body.to_status) { request.status = body.to_status; request.resolution_note = body.body ?? request.resolution_note; }
  request.updated_at = db.nowIso();
  return ok(request);
});
route("POST", "/v1/requests/:id/assign", ({ params, body }) => {
  const request = db.requests.find((r) => r.id === params.id);
  if (!request) return fail(404, "NOT_FOUND", "Ticket not found.");
  const member = db.staff.find((s) => s.membership_id === body.assigned_membership_id);
  request.status = "assigned";
  request.assigned_membership_id = body.assigned_membership_id;
  request.assigned_name = member?.name ?? null;
  request.assigned_role = member?.role ?? null;
  request.assigned_at = db.nowIso();
  request.updated_at = db.nowIso();
  return ok(request);
});
route("POST", "/v1/requests/:id/resolve", ({ params, body }) => {
  const request = db.requests.find((r) => r.id === params.id);
  if (!request) return fail(404, "NOT_FOUND", "Ticket not found.");
  request.status = "resolved";
  request.resolution_note = body.resolution_note ?? null;
  request.resolved_at = db.nowIso();
  request.updated_at = db.nowIso();
  return ok(request);
});
route("POST", "/v1/requests/:id/cancel", ({ params }) => {
  const request = db.requests.find((r) => r.id === params.id);
  if (!request) return fail(404, "NOT_FOUND", "Ticket not found.");
  request.status = "cancelled";
  request.updated_at = db.nowIso();
  return ok(request);
});
route("GET", "/v1/requests/:id", ({ params }) => {
  const request = db.requests.find((r) => r.id === params.id);
  return request ? ok(request) : fail(404, "NOT_FOUND", "Ticket not found.");
});

// ── Notifications ────────────────────────────────────────────────────────

route("GET", "/v1/notifications/unread-count", ({ init }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id;
  const count = db.notifications.filter((n) => n.recipient_membership_id === membershipId && !n.is_read).length;
  return ok({ unread: count });
});
route("POST", "/v1/notifications/read-all", ({ init }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id;
  let marked = 0;
  for (const n of db.notifications) if (n.recipient_membership_id === membershipId && !n.is_read) { n.is_read = true; marked++; }
  return ok({ marked });
});
route("POST", "/v1/notifications/test-push", () => ok({ push_configured: false, devices_found: 0, pushed: 0 }));
route("POST", "/v1/notifications/broadcast", ({ body }) => {
  const notif: db.MockNotification = {
    id: db.genId("notif"), pg_id: body.pg_id ?? db.PG_ID, category: body.category ?? "announcement", priority: body.priority ?? "normal",
    title: body.title, body: body.body ?? "", action_type: null, action_id: null, is_read: false, created_at: db.nowIso(), recipient_membership_id: "*",
  };
  const targets = body.target_role && body.target_role !== "all"
    ? [...db.guests.map((g) => g.membership_id), ...db.staff.map((s) => s.membership_id)].filter((id) => {
        const role = db.staff.find((s) => s.membership_id === id)?.role;
        return role ? role === body.target_role : body.target_role === "guest";
      })
    : [...db.guests.map((g) => g.membership_id), ...db.staff.map((s) => s.membership_id), "mem_owner_1"];
  for (const membershipId of targets) db.notifications.push({ ...notif, id: db.genId("notif"), recipient_membership_id: membershipId });
  return ok(notif, 201);
});
route("POST", "/v1/notifications/:id/read", ({ params }) => {
  const notif = db.notifications.find((n) => n.id === params.id);
  if (notif) notif.is_read = true;
  return noContent();
});
route("DELETE", "/v1/notifications/:id", ({ params }) => {
  const idx = db.notifications.findIndex((n) => n.id === params.id);
  if (idx >= 0) db.notifications.splice(idx, 1);
  return noContent();
});
route("GET", "/v1/notifications", ({ q, init }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id;
  let rows = db.notifications.filter((n) => n.recipient_membership_id === membershipId);
  if (q.get("unread_only") === "true") rows = rows.filter((n) => !n.is_read);
  return ok(pageOf(rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))));
});

// ── Ads ──────────────────────────────────────────────────────────────────

route("POST", "/v1/ads/events", ({ body }) => {
  if (body.event_type === "impression") db.adsMetrics.impressions++;
  if (body.event_type === "click") db.adsMetrics.clicks++;
  if (body.event_type === "coupon_copy") db.adsMetrics.coupon_copies++;
  return noContent();
});
route("GET", "/v1/ads/metrics", ({ q }) => ok({ pg_id: q.get("pg_id") ?? db.PG_ID, period: q.get("period"), ...db.adsMetrics }));

// ── Rewards ──────────────────────────────────────────────────────────────

route("GET", "/v1/rewards/me", ({ q, init }) => {
  const user = currentUser(init);
  const membershipId = user?.memberships[0]?.membership_id ?? "";
  const recent = db.rewardsLedger[membershipId] ?? [];
  return ok({ pg_id: q.get("pg_id") ?? db.PG_ID, membership_id: membershipId, balance: recent.reduce((s, r) => s + r.delta, 0), recent });
});
route("GET", "/v1/rewards", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const rows = db.guests.filter((g) => g.pg_id === pgId).map((g) => ({
    membership_id: g.membership_id, name: g.name, room_no: g.room_no,
    balance: (db.rewardsLedger[g.membership_id] ?? []).reduce((s, r) => s + r.delta, 0),
  })).sort((a, b) => b.balance - a.balance);
  return ok({ pg_id: pgId, rows });
});

// ── Billing (PGow → owner) ───────────────────────────────────────────────

route("GET", "/v1/billing/plans", () => ok(db.billingPlans));
route("GET", "/v1/billing/quote", ({ q }) => {
  const planCode = q.get("plan_code");
  const plan = db.billingPlans.find((p) => p.code === planCode);
  return ok({ plan_code: planCode, amount_due_now: plan?.price ?? "0.00", explanation: plan ? `${plan.name} — billed ${plan.billing_period}.` : "Unknown plan." });
});
route("GET", "/v1/billing/subscription", ({ q }) => (q.get("pg_id") ? ok(db.billingSubscription) : ok(null)));
route("POST", "/v1/billing/subscribe", ({ body }) => {
  const plan = db.billingPlans.find((p) => p.code === body.plan_code);
  if (plan) { db.billingSubscription.plan_id = plan.id; db.billingSubscription.plan_code = plan.code; db.billingSubscription.plan_name = plan.name; db.billingSubscription.price = plan.price; db.billingSubscription.status = "active"; }
  const pg = db.pgs.find((p) => p.id === body.pg_id);
  if (pg) pg.subscription_active = true;
  return ok(db.billingSubscription);
});
route("GET", "/v1/billing/invoices", () => ok(pageOf(db.billingInvoices)));
route("POST", "/v1/billing/invoices/:id/pay", ({ params, body }) => {
  const invoice = db.billingInvoices.find((i) => i.id === params.id);
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found.");
  (invoice as any).status = "paid";
  (invoice as any).method = body.method;
  (invoice as any).upi_ref = body.upi_ref ?? null;
  (invoice as any).paid_at = db.nowIso();
  return ok(invoice);
});

route("GET", "/v1/billing/tenant-invoices", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const tenantId = q.get("tenant_membership_id");
  const status = q.get("status");
  let rows = db.tenantInvoices.filter((i) => i.pg_id === pgId);
  if (tenantId) rows = rows.filter((i) => i.tenant_membership_id === tenantId);
  if (status) rows = rows.filter((i) => i.status === status);
  return ok(pageOf(rows));
});
route("POST", "/v1/billing/tenant-invoices/:id/pay", ({ params, body }) => {
  const invoice = db.tenantInvoices.find((i) => i.id === params.id);
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found.");
  (invoice as any).status = "paid";
  (invoice as any).paid_at = db.nowIso();
  return ok(invoice);
});
route("GET", "/v1/billing/tenant-invoices/:id/pdf", () => ok({ url: "https://picsum.photos/seed/invoice/600/800" }));
route("GET", "/v1/billing/ledger", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const rows = [
    ...db.payments.filter((p) => p.pg_id === pgId).map((p) => ({ type: "payment", ...p })),
    ...db.expenses.filter((e) => e.pg_id === pgId).map((e) => ({ type: "expense", ...e })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok(pageOf(rows));
});
route("GET", "/v1/billing/pnl", ({ q }) => {
  const interval = q.get("interval");
  const months = interval === "1y" ? 12 : interval === "6m" ? 6 : 3;
  return ok(db.buildPnL(months));
});
route("GET", "/v1/billing/export-csv", () => new Response("period,revenue,expenses,net\n", { status: 200, headers: { "Content-Type": "text/csv" } }));
route("POST", "/v1/billing/remind-unpaid", () => ok({ reminded: db.tenantInvoices.filter((i) => i.status !== "paid").length }));

// ── Expenses ─────────────────────────────────────────────────────────────

route("GET", "/v1/expenses/summary", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  const rows = db.expenses.filter((e) => e.pg_id === pgId);
  const spent = rows.reduce((s, e) => s + parseFloat(e.amount), 0);
  const collected = db.payments.filter((p) => p.pg_id === pgId && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of rows) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + parseFloat(e.amount));
  return ok({
    pg_id: pgId, period: q.get("period") ?? "", collected: collected.toFixed(2), spent: spent.toFixed(2), net: (collected - spent).toFixed(2),
    by_category: Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount: amount.toFixed(2) })),
  });
});
route("GET", "/v1/expenses", ({ q }) => {
  const pgId = q.get("pg_id") ?? db.PG_ID;
  let rows = db.expenses.filter((e) => e.pg_id === pgId);
  const category = q.get("category"); if (category) rows = rows.filter((e) => e.category === category);
  return ok(pageOf(rows));
});
route("POST", "/v1/expenses", ({ q, init, body }) => {
  const user = currentUser(init);
  const expense: db.MockExpense = {
    id: db.genId("exp"), pg_id: q.get("pg_id") ?? db.PG_ID, logged_by: user?.memberships[0]?.membership_id ?? "", logged_by_name: user?.name ?? null,
    logged_by_role: user?.memberships[0]?.role ?? null, title: body.title, category: body.category, amount: String(body.amount),
    period: body.period ?? new Date().toISOString().slice(0, 8) + "01", spent_on: body.spent_on ?? db.nowIso(), method: body.method,
    paid_to_membership_id: body.paid_to_membership_id ?? null, paid_to_name: db.staff.find((s) => s.membership_id === body.paid_to_membership_id)?.name ?? null,
    recipient_name: body.recipient_name ?? "", request_id: body.request_id ?? null, reverses_expense_id: null, reversed_by_expense_id: null,
    notes: body.notes ?? "", created_at: db.nowIso(),
  };
  db.expenses.push(expense);
  return ok(expense, 201);
});
route("POST", "/v1/expenses/:id/reverse", ({ params, body }) => {
  const original = db.expenses.find((e) => e.id === params.id);
  if (!original) return fail(404, "NOT_FOUND", "Expense not found.");
  const reversal: db.MockExpense = { ...original, id: db.genId("exp"), amount: String(-parseFloat(original.amount)), reverses_expense_id: original.id, reversed_by_expense_id: null, notes: body.reason ?? "Reversed", created_at: db.nowIso() };
  original.reversed_by_expense_id = reversal.id;
  db.expenses.push(reversal);
  return ok(reversal, 201);
});

// ── Procurement ──────────────────────────────────────────────────────────

route("GET", "/v1/procurement/catalog", () => ok(db.procurementCatalog));
route("GET", "/v1/procurement/orders", ({ q }) => {
  let rows = db.procurementOrders.filter((o) => o.pg_id === (q.get("pg_id") ?? db.PG_ID));
  const status = q.get("status"); if (status) rows = rows.filter((o) => o.status === status);
  return ok(rows);
});
route("POST", "/v1/procurement/orders", ({ init, body }) => {
  const user = currentUser(init);
  const items = (body.items ?? []).map((it: any, i: number) => ({ id: db.genId("pitem"), item_name: it.item_name, category: it.category, quantity: it.quantity, unit: it.unit, estimated_price: it.estimated_price, line_total: it.estimated_price * it.quantity }));
  const order = {
    id: db.genId("porder"), pg_id: body.pg_id ?? db.PG_ID, manager_id: user?.memberships[0]?.membership_id ?? "", order_type: body.order_type ?? "grocery",
    status: "pending_owner_approval", total_cost: items.reduce((s: number, it: any) => s + it.line_total, 0), notes: body.notes, rejection_reason: undefined, approved_at: undefined,
    created_at: db.nowIso(), items,
  };
  db.procurementOrders.push(order as any);
  return ok(order, 201);
});
route("POST", "/v1/procurement/orders/:id/approve", ({ params }) => {
  const order = db.procurementOrders.find((o) => o.id === params.id);
  if (!order) return fail(404, "NOT_FOUND", "Order not found.");
  (order as any).status = "approved";
  (order as any).approved_at = db.nowIso();
  return ok(order);
});
route("POST", "/v1/procurement/orders/:id/reject", ({ params, body }) => {
  const order = db.procurementOrders.find((o) => o.id === params.id);
  if (!order) return fail(404, "NOT_FOUND", "Order not found.");
  (order as any).status = "rejected";
  (order as any).rejection_reason = body.reason;
  return ok(order);
});
route("POST", "/v1/procurement/flag-low-stock", () => ok({ flagged: true }));

// ═══════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_LATENCY_MS = 250;

export async function mockFetch(fullUrl: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));

  const { pathname, search } = parseUrl(fullUrl);
  const method = (init.method ?? "GET").toUpperCase();

  for (const r of routes) {
    if (r.method !== method) continue;
    const params = matchPath(r.pattern, pathname);
    if (!params) continue;
    try {
      return r.handler({ params, q: search, body: readBody(init), init });
    } catch (err) {
      return fail(500, "MOCK_ERROR", err instanceof Error ? err.message : "Mock backend error.");
    }
  }

  return fail(404, "NOT_FOUND", `No mock route for ${method} ${pathname}`);
}

export const MOCK_BASE_URL = BASE_URL;
