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
import { toneFor } from "../components/ui/statusTone.ts";
import { ALERT_ORDER, centreOut, NAV_PROFILES, pickAlert } from "./navTabs.ts";

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

  // The month in India, not on this machine. `app/core/clock.py` pins the server the same
  // way; if these two ever disagree, a resident's payment is filed against the wrong cycle.
  const ist = new Date(Date.now() + 330 * 60_000);
  const expectedMonth = String(ist.getUTCMonth() + 1).padStart(2, "0");
  assert.equal(period, `${ist.getUTCFullYear()}-${expectedMonth}-01`, "period is the IST month");

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

// ── Status tone ─────────────────────────────────────────────────────────────
// One mapper now decides the colour of every status in the app, so a status it does not
// recognise goes grey everywhere at once rather than on one screen. The server vocabularies
// disagree with each other on purpose (`pending` vs `pending_owner_approval`), and the
// casing and separators vary by module, so those are the cases worth pinning.
{
  const cases: Array<[string, string]> = [
    ["VERIFIED", "ok"], ["Paid", "ok"], ["delivered", "ok"], ["active", "ok"],
    ["PENDING", "warn"], ["pending_owner_approval", "warn"], ["In Progress", "warn"], ["Due", "warn"],
    ["REJECTED", "danger"], ["Overdue", "danger"], ["cancelled", "danger"],
    ["ordered", "info"], ["Open", "info"],
    ["NOT_SUBMITTED", "neutral"], ["Paused", "neutral"], ["", "neutral"],
  ];
  for (const [status, expected] of cases) {
    assert.equal(toneFor(status), expected, `toneFor(${JSON.stringify(status)}) should be ${expected}`);
  }
  assert.equal(toneFor(null), "neutral", "a missing status is neutral, not a crash");
  assert.equal(toneFor(undefined), "neutral", "an absent status is neutral, not a crash");
}

// ── Bottom bar: frequency ranking → physical slots ──────────────────────────
// The ordering rule is the whole reason the nav tables are written by rank rather than by
// position, and it is invisible when wrong: a bar with the right five tabs in the wrong slots
// still looks fine, it just puts the most-used destination under the least reachable thumb.
{
  assert.deepEqual(
    centreOut([1, 2, 3, 4, 5]),
    [4, 2, 1, 3, 5],
    "rank 1 takes the centre, 2 and 3 flank it, 4 and 5 take the hard-to-reach ends",
  );
  assert.deepEqual(centreOut([1, 2, 3]), [2, 1, 3], "three slots: rank 1 is still the middle");
  assert.deepEqual(centreOut([1]), [1]);
  assert.deepEqual(centreOut([]), [], "an empty profile must not throw");
  assert.equal(
    centreOut([1, 2, 3, 4])[2],
    1,
    "even lengths have no true centre — rank 1 goes right of the middle, the better half for a thumb",
  );

  for (const [profile, dests] of Object.entries(NAV_PROFILES)) {
    assert.ok(dests.length <= 5, `${profile}: a bottom bar caps at five destinations`);
    assert.ok(dests.length >= 3, `${profile}: fewer than three destinations is not a tab bar`);
    assert.equal(
      new Set(dests.map((d) => d.name)).size,
      dests.length,
      `${profile}: two triggers with the same name would collide in the navigator`,
    );
    for (const d of dests) {
      assert.ok(d.label.length <= 11, `${profile}/${d.label}: too long for a five-up label row`);
      assert.equal(d.href, `/${d.name}`, `${profile}/${d.name}: href and trigger name must agree`);
    }
    // Every signal the alert order names has to belong to a destination, or the strip would
    // fire with nowhere to send you.
    for (const key of ALERT_ORDER[profile as keyof typeof ALERT_ORDER]) {
      assert.ok(dests.some((d) => d.signal === key), `${profile}: no destination owns "${key}"`);
    }
  }

  assert.equal(pickAlert("owner", {}), null, "nothing waiting ⇒ no strip");
  assert.equal(pickAlert("owner", { complaintsOpen: 0 }), null, "an empty queue is not an alert");
  assert.equal(
    pickAlert("owner", { complaintsOpen: 9, paymentsPending: 1 })?.key,
    "paymentsPending",
    "unverified money outranks a bigger pile of complaints — cost, not size",
  );
  assert.equal(pickAlert("owner", { paymentsPending: 1 })?.text, "1 payment waiting to be verified");
  assert.equal(pickAlert("owner", { paymentsPending: 4 })?.text, "4 payments waiting to be verified");
  assert.equal(pickAlert("chef", { paymentsPending: 3 }), null, "a profile with no alerts stays silent");
}


// ── shortLocation ───────────────────────────────────────────────────────────
// The owner header's place label. The bug this replaced took the FIRST two segments, which
// on a real address is the building name and the door number.
{
  const { shortLocation } = await import("../utils/format.ts");
  assert.equal(
    shortLocation(
      "SS Geosynthetic Lining Company, Do.No:15-109, Near Mahalakshmitemple, Kothapet, " +
      "Ibrahimpatnam, Andhra Pradesh, 521456, India"
    ),
    "Ibrahimpatnam"
  );
  // Already short, no country or PIN to drop.
  assert.equal(shortLocation("Electronic City, Bangalore"), "Electronic City");
  assert.equal(shortLocation("Bangalore"), "Bangalore");
  // A PIN alone is not a place; a door number that contains letters is kept.
  assert.equal(shortLocation("Flat 4B, Whitefield, Bangalore, 560066"), "Whitefield");
  // Nothing usable must not become "undefined" or an invented city.
  assert.equal(shortLocation(""), "");
  assert.equal(shortLocation(null), "");
  assert.equal(shortLocation("560066, India"), "");
}

console.log("logic.check.ts — all assertions passed");
