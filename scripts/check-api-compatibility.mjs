// Does the server the APK will talk to actually implement everything the APK calls?
//
import { API, BASE_URL } from "../src/config.ts";

const MARK = "__ID__";

// Path params differ in name between client and spec ({pg_id} vs the value we substitute),
// so both sides are normalised to `*` before comparing.
const shape = (p) =>
  p.split("/").map((seg) => (seg === MARK || /^\{.*\}$/.test(seg) ? "*" : seg)).join("/");

const clientPaths = new Map();
for (const [name, value] of Object.entries(API)) {
  if (typeof value === "string") clientPaths.set(shape(value), name);
  else if (typeof value === "function") {
    // Every path builder here takes 1-2 opaque ids.
    const built = value.length >= 2 ? value(MARK, MARK) : value(MARK);
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
process.exit(missing.length ? 1 : 0);
