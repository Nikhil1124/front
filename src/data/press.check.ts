/**
 * Guard: a tappable thing uses `AnimatedPress`, so it actually responds to being pressed.
 *
 * `TouchableOpacity` fades; `AnimatedPress` compresses with a spring on the UI thread and
 * inherits Reanimated's reduced-motion handling for free. Before this sweep the app had 381
 * `TouchableOpacity` against 20 files using the primitive — so the press feedback built into
 * `AnimatedPress` reached about a fifth of the buttons in the app, and every other tap in the
 * app snapped.
 *
 * ── Why groceries has a budget instead of a ban ──────────────────────────────────────────────
 * The groceries mini-app is 39 files and ~7,400 lines awaiting its own redesign pass, and
 * converting its buttons now only to restyle them again later is work done twice. It also
 * holds the only two places that genuinely want no press feedback at all (a nested
 * `` pair in TodaysKitchenNeeds) and the one full-bleed backdrop, where a
 * scale would look broken rather than responsive — those need deciding one at a time, not by
 * codemod. So the number is written down and may only shrink, same ratchet as
 * `sheets.check.ts`.
 *
 * Everywhere else the answer is zero, and stays zero.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Total `<TouchableOpacity` still inside the groceries mini-app. Lower it as they convert. */
const GROCERIES_BUDGET = 0;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
let groceries = 0;

for (const dir of ['app', 'src']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length);
    const n = (readFileSync(file, 'utf8').match(/<TouchableOpacity/g) ?? []).length;
    if (n === 0) continue;
    if (rel.includes('groceries')) groceries += n;
    else offenders.push(`${rel} — ${n}`);
  }
}

assert.deepEqual(
  offenders,
  [],
  `TouchableOpacity outside the groceries mini-app:\n  ${offenders.join('\n  ')}\n\n`
  + 'Use `AnimatedPress` — same props, minus `activeOpacity` (which is a transparency, not a\n'
  + 'transform, and is why the documented press feedback never actually happened).',
);

assert.ok(
  groceries <= GROCERIES_BUDGET,
  `groceries is up to ${groceries} TouchableOpacity, budget is ${GROCERIES_BUDGET}. It may only go down.`,
);
assert.ok(
  groceries === GROCERIES_BUDGET,
  `groceries is down to ${groceries} — lower GROCERIES_BUDGET to match (a stale budget hides how much is left).`,
);

console.log(`press.check.ts — every button springs, ${groceries} left in groceries`);
