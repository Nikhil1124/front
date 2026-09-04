/**
 * Self-check for the pure logic that decides where money goes and who gets in.
 *
 * Companion to `mappers.check.ts`, same shape and same reasoning: plain `node`, `node:assert`,
 * no test runner, no config, no mocks. Everything imported here is deliberately free of
 * runtime imports so it can be reached without a bundler — that constraint is why
 * `upiUri.ts`, `roles.ts` and `gateCodes.ts` exist as separate modules at all.
 *
 * These four were picked because their failure modes are silent and expensive: rent sent to a
 * stranger, the wrong dashboard, a resident locked out of meals with no explanation.
 *
 * Run it:  node src/data/logic.check.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildUpiUri } from "../features/payments/upiUri.ts";
import { toUserRole } from "../store/roles.ts";
import { GATE_CODES, gateCodeFrom } from "./gateCodes.ts";
// `config.ts` must stay free of runtime imports — `scripts/check-api-compatibility.mjs`
// reads it under plain node. Asserted below so a future re-export cannot quietly break it.
import { currentPeriod, periodToMonthYear, toAmount } from "./mappers.ts";

// ── UPI deep link ───────────────────────────────────────────────────────────
// The highest-consequence string this app builds. A VPA that is wrong — or worse, silently
// "completed" — sends a resident's rent to whoever really owns that address.
{
  const uri = buildUpiUri({ upiId: "owner@okhdfcbank", amount: 6500 });
  assert.ok(uri, "a complete VPA must produce a link");
  assert.ok(uri!.startsWith("upi://pay?"), "must be an NPCI intent, not a web URL");
  assert.ok(uri!.includes("pa=owner%40okhdfcbank"), "payee address is the VPA, encoded");
  assert.ok(uri!.includes("am=6500.00"), "amount carries two decimals — NPCI rejects '6500'");
  assert.ok(uri!.includes("cu=INR"), "currency is explicit");

  // The guard that matters. A partial VPA must refuse, never get a default handle appended:
  // 'nikhil' + '@ybl' is a real person's account, just not this owner's.
  assert.equal(buildUpiUri({ upiId: "nikhil", amount: 100 }), null, "no '@' → refuse");
  assert.equal(buildUpiUri({ upiId: "", amount: 100 }), null, "empty → refuse");
  assert.equal(buildUpiUri({ upiId: "   ", amount: 100 }), null, "whitespace → refuse");

  // Case and padding are normalised rather than rejected — banks treat VPAs case-insensitively
  // and a trailing space is a typing artefact, not a different account.
  assert.ok(buildUpiUri({ upiId: "  Owner@OKHDFCBANK ", amount: 1 })!.includes("pa=owner%40okhdfcbank"));

  // Characters NPCI's `pn`/`tn` fields don't accept are stripped, and stripping everything
  // must fall back to a label rather than sending an empty field.
  const odd = buildUpiUri({ upiId: "a@b", amount: 10, payeeName: "!!!", note: "###" })!;
  assert.ok(odd.includes("pn=PG%20Co%20Living"), "unusable payee name falls back");
  assert.ok(odd.includes("tn=PG%20Rent"), "unusable note falls back");

  // Fractional rent must not be truncated — ₹6500.5 is ₹6500.50, not ₹6500.
  assert.ok(buildUpiUri({ upiId: "a@b", amount: 6500.5 })!.includes("am=6500.50"));
}

// ── Role mapping ────────────────────────────────────────────────────────────
// Decides which dashboard a person lands on. Every backend role must resolve to something;
// a null here strands somebody on a blank screen (see app/index.tsx's routing).
{
  assert.equal(toUserRole("owner"), "OWNER");
  assert.equal(toUserRole("manager"), "MANAGER");
  assert.equal(toUserRole("guest"), "GUEST");
  assert.equal(toUserRole("chef"), "CHEF");

  // The catch-all: these three share the STAFF surfaces.
  assert.equal(toUserRole("kitchen_staff"), "STAFF");
  assert.equal(toUserRole("maintenance"), "STAFF");
  assert.equal(toUserRole("delivery_agent"), "STAFF");

  // Only "no membership" may produce null — that state is what `app/_layout.tsx` reads as
  // "probably a fresh owner mid-onboarding" and routes into the owner stack.
  assert.equal(toUserRole(null), null);

  // A role added server-side must land on STAFF, not null. If this ever fails, the new role
  // needs a deliberate decision here — not a blank screen.
  assert.equal(toUserRole("some_future_role" as never), "STAFF");
}

// ── ADR-004 gate codes ──────────────────────────────────────────────────────
// Whether a resident sees "pay to unlock meals" or an unexplained failure.
{
  assert.equal(gateCodeFrom(403, "RENT_UNPAID"), "RENT_UNPAID");
  assert.equal(gateCodeFrom(403, "KYC_REQUIRED"), "KYC_REQUIRED");
  assert.equal(gateCodeFrom(403, "KYC_PENDING"), "KYC_PENDING");
  assert.equal(gateCodeFrom(403, "KYC_REJECTED"), "KYC_REJECTED");

  // A 403 that is not a gate — a manager attempting an owner-only action — must fall through
  // to ordinary error handling rather than be dressed up as "submit your KYC".
  assert.equal(gateCodeFrom(403, "FORBIDDEN"), null);
  assert.equal(gateCodeFrom(403, undefined), null);

  // A gate code on any other status is a shape the server does not produce; honouring it
  // would mean trusting something we never agreed on.
  assert.equal(gateCodeFrom(200, "RENT_UNPAID"), null);
  assert.equal(gateCodeFrom(500, "KYC_REQUIRED"), null);

  // Every code the client knows must be one the rule accepts — otherwise a code could be
  // added to the list and silently never match.
  for (const code of GATE_CODES) {
    assert.equal(gateCodeFrom(403, code), code, `${code} must be recognised as a gate`);
  }
}

// ── Rent period ─────────────────────────────────────────────────────────────
// The rent gate compares a payment's period against the current one, so the two must agree on
// what "this month" means: the 1st, always. A mismatch gates a resident who has actually paid.
{
  const period = currentPeriod();
  assert.match(period, /^\d{4}-\d{2}-01$/, "a period is always pinned to the 1st");

  const now = new Date();
  const expectedMonth = String(now.getMonth() + 1).padStart(2, "0");
  assert.equal(period, `${now.getFullYear()}-${expectedMonth}-01`, "period is the local month");

  // Display round-trip: the label a resident reads must name the month they paid for.
  assert.equal(periodToMonthYear("2026-09-01"), "September 2026");
  assert.equal(periodToMonthYear("2026-01-01"), "January 2026");
  // December is the off-by-one month — a 0-indexed slip renders it as the wrong year's January.
  assert.equal(periodToMonthYear("2026-12-01"), "December 2026");

  // Money off the wire is a string. `toAmount` is what stops "8500.00" rendering as ₹NaN.
  assert.equal(toAmount("8500.00"), 8500);
  assert.equal(toAmount(null), 0);
  assert.equal(toAmount(undefined), 0);
}

// ── config.ts stays import-free ─────────────────────────────────────────────
// Not logic, but an invariant with teeth: `check-api-compatibility.mjs` imports config.ts
// directly under node, so one runtime import there turns the whole contract check into a
// module-resolution crash. That happened once; this is the tripwire.
{
  const src = readFileSync(new URL("../config.ts", import.meta.url), "utf8");
  const runtimeImports = src
    .split("\n")
    .filter((l) => /^import\s/.test(l) && !/^import\s+type\s/.test(l));
  assert.deepEqual(
    runtimeImports,
    [],
    "src/config.ts must have no runtime imports — scripts/check-api-compatibility.mjs "
      + "reads it under plain node. Put shared values in their own import-free module instead."
  );
}

console.log("logic.check.ts — all assertions passed");
