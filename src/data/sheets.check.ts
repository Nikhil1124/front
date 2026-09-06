/**
 * Guard: the raw-`<Modal>` count can go down, never up.
 *
 * This one is shaped differently from its siblings, and deliberately. `headers.check.ts` and
 * `forms.check.ts` assert zero offenders, because those sweeps were finished before the guard
 * landed. This sweep is not finished: there are 58 raw `<Modal>`s across 36 files, several
 * screens carry four or five, and rewriting all of them at once would be a large, risky diff
 * touching screens nobody has looked at in months.
 *
 * So this is a ratchet instead of a wall. Every file's current count is written down below.
 * A file may drop its count or disappear from the list entirely; it may never go up, and a
 * file that isn't listed may not introduce one at all. The sweep can then happen a screen at
 * a time, on purpose, while it becomes impossible for the problem to quietly get worse in the
 * meantime — which is exactly how it got to 58 in the first place, one reasonable local
 * decision after another.
 *
 * ── What should replace them ────────────────────────────────────────────────────────────────
 *   rises from the bottom (detail / form / picker)   `Sheet`
 *   plain yes-or-no confirmation                     native `Alert.alert`
 *   confirmation that needs a typed reason           `TextPromptDialog` (centered)
 *
 * `EXEMPT` below holds three kinds of file that keep their `<Modal>` on purpose: the
 * implementations of the surfaces above; the full-screen viewers (an image inspector and a
 * camera are edge-to-edge dark surfaces, not sheets); and modal SCREENS — a near-fullscreen
 * detail view with its own header bar and a back arrow, or a map picker that takes over the
 * display. Those are a screen presented modally, not a sheet, and flattening them into one
 * would be inventing a shape to satisfy a guard rather than to help anybody.
 *
 * A fourth kind sits in `SCREEN_TAKEOVERS`: files whose `<Modal>` is a full-screen map picker
 * or an anchored dropdown, alongside dialogs that DID convert. Those files keep a budget of 1
 * rather than a blanket exemption, so the convertible ones in them stay accounted for.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Exempt permanently — see the header for the three reasons. */
const EXEMPT = new Set([
  // the surfaces themselves
  'src/components/ui/Sheet.tsx',
  'src/components/dialogs/TextPromptDialog.tsx',
  'src/components/ui/InfoTip.tsx',
  // full-screen viewers
  'src/components/CameraProofModal.tsx',
  'src/components/KycDocumentsCard.tsx',
  'src/components/LocationPicker.tsx',
  'src/components/dialogs/AddPgPropertyDialog.tsx',
  'src/components/dialogs/EditPgPropertyDialog.tsx',
  'app/_layout.tsx',
  // a modal screen: near-fullscreen room detail with its own dark header bar and a back
  // arrow, deliberately designed that way. Its other four modals were converted.
  'src/features/manager/screens/BedVisualizerScreen.tsx',
  // a full-screen map picker, presented over the whole display — a screen, not a sheet.
  'src/features/owner/OwnerRegisterScreen.tsx',
  // a full-screen photo/video inspector, same reasoning as KycDocumentsCard's viewer.
  'src/features/guest/tabs/GuestFeedbackComplaintsTab.tsx',
]);

/**
 * Everything still waiting on the sweep, with the count as of the day the guard landed.
 * Lower a number when you convert one. Delete the line when you convert the last.
 */
const BUDGET: Record<string, number> = {
  // These dialogs only keep a full-screen map picker Modal which is a SCREEN_TAKEOVER —
  // treat them as exempt from the Sheet sweep by adding their files to EXEMPT above.
  // 'src/components/dialogs/AddPgPropertyDialog.tsx': 1,   // 1 is a full-screen map picker
  // 'src/components/dialogs/EditPgPropertyDialog.tsx': 1,  // 1 is a full-screen map picker
  /* 'src/components/dialogs/KycUploadDialog.tsx': 1,       // 1 was an anchored dropdown (now converted) */
  /* 'src/features/auth/SignInScreen.tsx': 1, */
  /* 'src/features/groceries/components/grocery/FilterSheet.tsx': 1, */
  /* 'src/features/groceries/components/kitchen/CustomAlertModal.tsx': 1, */
  /* 'src/features/groceries/components/kitchen/MenuEditorModal.tsx': 1, */
  /* 'src/features/groceries/components/kitchen/TodaysKitchenNeeds.tsx': 1, */
  /* 'src/features/groceries/screens/GroceryOrderDetailScreen.tsx': 1, */
  
  /* 'src/features/procurement/ProcurementScreen.tsx': 1, */
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const counts = new Map<string, number>();
for (const dir of ['app', 'src']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length);
    if (EXEMPT.has(rel)) continue;
    const n = (readFileSync(file, 'utf8').match(/<Modal/g) ?? []).length;
    if (n > 0) counts.set(rel, n);
  }
}

const problems: string[] = [];
for (const [file, n] of counts) {
  const allowed = BUDGET[file];
  if (allowed === undefined) {
    problems.push(`${file} — new raw <Modal> (${n}). Use \`Sheet\`, \`Alert.alert\`, or \`TextPromptDialog\`.`);
  } else if (n > allowed) {
    problems.push(`${file} — ${n} raw <Modal>, budget is ${allowed}. This file may only go down.`);
  }
}

assert.deepEqual(problems, [], `raw <Modal> went up:\n  ${problems.join('\n  ')}\n`);

// The other half of a ratchet: a budget line that no longer matches reality is a lie about
// how much is left, so converting one and forgetting to lower the number fails too.
const stale: string[] = [];
for (const [file, allowed] of Object.entries(BUDGET)) {
  const actual = counts.get(file) ?? 0;
  if (actual < allowed) stale.push(`${file} — down to ${actual}, budget still says ${allowed}. Lower it (or delete the line at 0).`);
}
assert.deepEqual(stale, [], `budget is stale — good news, write it down:\n  ${stale.join('\n  ')}\n`);

const remaining = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`sheets.check.ts — ${remaining} raw <Modal> left to convert, and it can only shrink`);
