// Does the server the APK will talk to actually implement everything the APK calls?
//
import { API, BASE_URL } from "../src/config.ts";

const MARK = "__ID__";

// Path params differ in name between client and spec ({pg_id} vs the value we substitute),
// so both sides are normalised to `*` before comparing.
const pathOnly = (p) => p.split("?")[0];
const shape = (p) =>
  pathOnly(p).split("/").map((seg) => (seg === MARK || /^\{.*\}$/.test(seg) ? "*" : seg)).join("/");

const clientPaths = new Map();
for (const [name, value] of Object.entries(API)) {
  if (typeof value === "string") clientPaths.set(shape(value), name);
  else if (typeof value === "function") {
    // Path builders take opaque ids plus occasional query values. Supplying a stable set
    // keeps the contract check about route shape, not about JavaScript `undefined` strings.
    const built = value(MARK, MARK, MARK);
    clientPaths.set(shape(built), name);
  }
}

// `PGOW_SPEC=path/to/openapi.json` checks against a local build instead of the deployed one —
// which is the difference between "is this shipped yet" and "did I wire this correctly".
// Without it the answer conflates the two, and an endpoint written five minutes ago looks
// identical to one that was never written.
const specPath = process.env.PGOW_SPEC;
const source = specPath ?? `${BASE_URL}/openapi.json`;

let spec;
if (specPath) {
  const { readFileSync } = await import("node:fs");
  spec = JSON.parse(readFileSync(specPath, "utf8"));
} else {
  const res = await fetch(source);
  if (!res.ok) {
    console.error(`could not read ${source} — HTTP ${res.status}`);
    process.exit(2);
  }
  spec = await res.json();
}
const serverShapes = new Set(Object.keys(spec.paths ?? {}).map(shape));

const missing = [...clientPaths].filter(([s]) => !serverShapes.has(s));

console.log(`server   ${source}`);
console.log(`client   ${clientPaths.size} distinct endpoints`);
console.log(`server   ${serverShapes.size} distinct endpoints`);
console.log();
if (missing.length === 0) {
  console.log("✅ every endpoint the app calls exists on this server");
} else {
  console.log(`❌ ${missing.length} endpoint(s) the app calls are NOT on this server:`);
  for (const [s, name] of missing.sort()) console.log(`   ${name.padEnd(24)} ${s}`);
}

// Field-level: response shapes the app reads keys off. A missing key is not a crash — it
// reads as undefined — but it is a feature that silently does nothing, which is worse.
const expected = {
  PgResponse: ["join_code", "default_rent_amount", "subscription_active"],
};
console.log();
for (const [schema, fields] of Object.entries(expected)) {
  const props = spec.components?.schemas?.[schema]?.properties ?? {};
  const absent = fields.filter((f) => !(f in props));
  console.log(
    absent.length
      ? `❌ ${schema} is missing: ${absent.join(", ")}`
      : `✅ ${schema} carries every field the app reads`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Beyond route shape: the checks that would have caught what route shape didn't.
//
// Every endpoint below existed and matched on path, so the check above passed them all —
// while each was a guaranteed 422 in production:
//
//   * grocery checkout sent `payment_method: 'cash'` (server enum: card|upi|credit|cod)
//     plus two fields that do not exist, against a model with `extra="forbid"`.
//   * `usePortfolio`/`useGuests` asked `/v1/payments` for `limit: 200`; it caps at 100.
//   * approving a procurement order sent no body at all, against a required field.
//
// Path-only comparison cannot see any of that. These three checks can.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = new URL("../src/", import.meta.url).pathname;
const { readdirSync, readFileSync: readFile } = await import("node:fs");
const { join } = await import("node:path");

function sourceFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}
const files = sourceFiles(SRC);

// ── 1. Query caps ────────────────────────────────────────────────────────────
// A literal `limit: N` is attributed to the nearest `API.CONSTANT` above it in the same
// file — the shape every call site in this codebase actually uses.
const capByShape = new Map();
for (const [path, ops] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(ops)) {
    for (const param of op.parameters ?? []) {
      if (param.name === "limit" && param.schema?.maximum != null) {
        capByShape.set(`${method.toUpperCase()} ${shape(path)}`, param.schema.maximum);
      }
    }
  }
}
const shapeByConst = new Map();
for (const [s, name] of clientPaths) shapeByConst.set(name, s);

// Most `limit:` literals are not next to an `API.CONSTANT` — they sit at a CALL SITE for a
// helper defined in another file (`listPayments(pg.id, { limit: 200 })`), and the constant
// only appears inside that helper. Attributing by "nearest constant above" therefore missed
// the exact bug this check exists for. So: resolve exported helpers to their endpoint first,
// then attribute call sites through them.
const shapeByHelper = new Map();
for (const file of files) {
  const text = readFile(file, "utf8");
  const lines = text.split("\n");
  let current = null;
  lines.forEach((line) => {
    const fn = line.match(/export (?:async )?function ([A-Za-z0-9_]+)/);
    if (fn) current = fn[1];
    const c = line.match(/API\.([A-Z][A-Z0-9_]*)/);
    if (c && current && shapeByConst.has(c[1])) {
      // First constant seen inside the function wins — helpers hit one endpoint.
      if (!shapeByHelper.has(current)) shapeByHelper.set(current, shapeByConst.get(c[1]));
    }
  });
}

const capViolations = [];
for (const file of files) {
  const lines = readFile(file, "utf8").split("\n");
  let lastConst = null;
  lines.forEach((line, i) => {
    const c = line.match(/API\.([A-Z][A-Z0-9_]*)/);
    if (c) lastConst = c[1];
    const m = line.match(/\blimit[:=]\s*['"\`]?(\d+)/);
    if (!m) return;
    const asked = Number(m[1]);

    // Prefer the helper actually being called on this line; fall back to the nearest
    // constant for direct `apiFetch(API.X + "?limit=…")` sites.
    let shapes = [];
    for (const [helper, sh] of shapeByHelper) {
      if (new RegExp(`\\b${helper}\\s*\\(`).test(line)) shapes.push([helper, sh]);
    }
    if (!shapes.length && lastConst && shapeByConst.has(lastConst)) {
      shapes = [[lastConst, shapeByConst.get(lastConst)]];
    }

    for (const [label, sh] of shapes) {
      for (const [key, cap] of capByShape) {
        if (key.endsWith(` ${sh}`) && asked > cap) {
          capViolations.push(
            `${file.replace(SRC, "src/")}:${i + 1}  ${label} asks limit=${asked}, cap is ${cap}`
          );
        }
      }
    }
  });
}
console.log();
console.log(
  capViolations.length
    ? `❌ ${capViolations.length} query limit(s) above the server's cap — each is a 422:\n   ` +
        capViolations.join("\n   ")
    : "✅ every literal `limit:` is within the server's cap"
);

// ── 2. Enum drift ────────────────────────────────────────────────────────────
// Direction matters, and the first version of this check had it backwards. Asking "does the
// client mention every server value?" passes the exact bug it was written for: the dead
// checkout read `payment_method: mode === 'cod' ? 'cash' : 'upi'` — it mentions 'cod' quite
// happily, while *sending* 'cash', which the server has never accepted.
//
// So the question is the other way round: of the literals the client assigns to this field,
// is any one of them absent from the server's enum? That is the value that 422s.
//
// Declarative on purpose — matching TS unions to spec enums automatically guesses wrong far
// more often than it helps. Add a row when a new enum starts crossing the wire.
// Each rule is scoped to the files that actually call that endpoint. Without that scope,
// generic field names collide: `method` belongs to FOUR different server enums, so an
// unscoped rule flags the owner's own invoice screen (which correctly sends
// `bank_transfer`) against the TENANT invoice enum, which does not accept it. A checker
// that cries wolf gets muted, so precision here matters more than coverage.
const ENUMS = [
  { schema: "CreateOrderRequest", field: "payment_method", in: ["features/groceries/"] },
  { schema: "CreatePaymentRequest", field: "method", in: ["features/payments/"] },
  { schema: "PayInvoiceRequest", field: "method", in: ["features/billing/useBilling", "OwnerSubscriptionScreen"] },
  { schema: "PayTenantInvoiceRequest", field: "method", in: ["features/billing/useTenantInvoices", "GuestPaymentsTab"] },
  { schema: "ApproveProcurementOrderRequest", field: "payment_method", in: ["features/procurement/"] },
  { schema: "CreateBannerRequest", field: "link_type", in: ["features/ads/", "banners"] },
  { schema: "CreateRequestRequest", field: "kind", in: ["features/requests/"] },
  { schema: "CreateRequestRequest", field: "priority", in: ["features/requests/"] },
  { schema: "CreateRequestEventRequest", field: "to_status", in: ["features/requests/"] },
  { schema: "AdvanceOrderStatusRequest", field: "to_status", in: ["features/groceries/"] },
  { schema: "CompleteStopRequest", field: "outcome", in: ["features/staff/useTrips", "features/delivery/"] },
];

const enumProblems = [];
for (const rule of ENUMS) {
  const p2 = spec.components?.schemas?.[rule.schema]?.properties?.[rule.field];
  const serverEnum = p2?.enum ?? p2?.anyOf?.find((a) => a.enum)?.enum ?? null;
  if (!serverEnum) {
    enumProblems.push(`${rule.schema}.${rule.field} — no enum on the server (renamed?)`);
    continue;
  }
  const scoped = files.filter(
    (f) => rule.in.some((frag) => f.includes(frag)) && !f.includes(".check.")
  );
  for (const file of scoped) {
    readFile(file, "utf8").split("\n").forEach((line, i) => {
      const assign = line.match(new RegExp(`\\b${rule.field}\\s*:\\s*(.+)$`));
      if (!assign) return;
      // A type declaration (`method: "a" | "b"`) is a union, not a value being sent.
      if (/\|/.test(assign[1]) && !/\?/.test(assign[1])) return;
      const literals = [...assign[1].matchAll(/['"\`]([a-z_]+)['"\`]/g)].map((m) => m[1]);
      const bad = literals.filter((v) => !serverEnum.includes(v));
      if (bad.length) {
        enumProblems.push(
          `${file.replace(SRC, "src/")}:${i + 1}  ${rule.field} sends ${JSON.stringify(bad)}` +
            ` — ${rule.schema} accepts ${JSON.stringify(serverEnum)}`
        );
      }
    });
  }
}
console.log();
console.log(
  enumProblems.length
    ? `❌ ${enumProblems.length} enum value(s) the server will reject:\n   ` +
        enumProblems.join("\n   ")
    : "✅ every tracked enum field only ever sends values the server accepts"
);

// ── 3. extra=forbid awareness ────────────────────────────────────────────────
// Not a pass/fail — a standing reminder of the blast radius. On these models one stray
// field rejects the WHOLE request, so a "harmless extra field" is never harmless.
const forbid = Object.entries(spec.components?.schemas ?? {}).filter(
  ([, s]) => s.additionalProperties === false
).length;
console.log();
console.log(
  `ℹ️  ${forbid} request models reject unknown fields (extra="forbid") — on those, one` +
    ` stray key 422s the entire request.`
);


process.exit(missing.length || capViolations.length || enumProblems.length ? 1 : 0);
