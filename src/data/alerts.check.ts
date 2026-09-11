/**
 * Guard: no `Alert.alert`, anywhere.
 *
 * There were 137 of them. Only 18 carried an actual decision; the rest stopped the user with
 * an OS modal to announce a success, name a field they had left empty, or say a feature was
 * not built yet. A dialog that fires for "Copied to clipboard" teaches people to dismiss
 * dialogs unread — which is exactly the habit you do not want in front of "Delete staff
 * member?". They also cannot be styled, cannot show the app's own voice, and on Android draw
 * a centred alert for things that are source pickers everywhere else on the platform.
 *
 * ── Where each one went ─────────────────────────────────────────────────────────────────────
 *   a decision you cannot walk back      `PGowDialog`      (centred; it stopped you)
 *   confirm with a typed reason          `PGowDialog` + `prompt`
 *   a menu of verbs (photo source…)      `PGowActionSheet` (rises; it is a place you went)
 *   success / failure / info             `useToast()`      (or `toastNow` outside a component)
 *   a field the user can fix by typing   an error on that field
 *
 * Unlike `sheets.check.ts` this is a wall, not a ratchet: the sweep is finished, so the only
 * number that can be right here is zero.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
for (const dir of ['app', 'src']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length);
    if (rel === 'src/data/alerts.check.ts') continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Prose about the migration is allowed to name the thing it replaced.
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      if (line.includes('Alert.alert(')) offenders.push(`${rel}:${i + 1}`);
    });
  }
}

assert.deepEqual(
  offenders,
  [],
  `Alert.alert is gone from this app — use PGowDialog, PGowActionSheet, useToast, or a field error:\n  ${offenders.join('\n  ')}\n`,
);

console.log('alerts.check.ts — no Alert.alert anywhere; every one of the 137 has a real surface');
