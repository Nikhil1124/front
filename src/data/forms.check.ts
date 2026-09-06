/**
 * Guard: there is one text field, and it stays one.
 *
 * The pattern this app keeps hitting: a good primitive gets built, adoption stalls around
 * 10%, and nothing finishes the job until a check fails the build. `AppHeader` reached three
 * components plus eighteen hand-rolled copies before `headers.check.ts`. `Radii` sat at 55
 * token uses against 803 hardcoded radii before `tokens.check.ts`. `DetailBottomSheet` is at
 * three adopters against thirty-six raw `<Modal>`s right now, because it has no guard yet.
 *
 * So this is the one for form fields. Before it, twenty raw `<TextInput>`s were spread across
 * sixteen files at three heights and two corner radii — and the field primitive had eleven
 * styling escape hatches and no way to show an error, which is why validation was delivered
 * as thirty-four blocking `Alert.alert('Validation', …)` popups instead.
 *
 * ── What's allowed through, and why ─────────────────────────────────────────────────────────
 * Two search surfaces in the groceries mini-app are genuinely not this component: the home
 * hero search animates a rotating placeholder and carries a scan/filter button, and the
 * category header search carries a mic and a conditional clear. Both would lose real features
 * if flattened into `SearchField`. They are named here rather than exempted by a rule, so
 * adding a third means editing this list on purpose.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** The primitives themselves — they are what wraps `TextInput`, so they must contain one. */
const PRIMITIVES = new Set([
  'src/components/ui/OutlinedTextField.tsx',
  'src/components/ui/SearchField.tsx',
]);

/** Search surfaces that carry affordances `SearchField` deliberately does not have. */
const BESPOKE_SEARCH = new Set([
  'src/features/groceries/components/grocery/SearchBar.tsx',
  'src/features/groceries/screens/GroceryCategoryScreen.tsx',
]);

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
for (const dir of ['app', 'src']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length);
    if (PRIMITIVES.has(rel) || BESPOKE_SEARCH.has(rel)) continue;
    if (readFileSync(file, 'utf8').includes('<TextInput')) offenders.push(rel);
  }
}

assert.deepEqual(
  offenders,
  [],
  `raw <TextInput> outside the primitives:\n  ${offenders.join('\n  ')}\n\n`
  + 'Use `OutlinedTextField` for a form field — it carries the label, the error and the\n'
  + 'helper, so validation does not have to become an Alert. Use `SearchField` for a box\n'
  + 'that filters a list. If this genuinely is neither, add it to BESPOKE_SEARCH above with\n'
  + 'a reason, the way the two groceries search surfaces are.',
);

// The field has to be able to say what is wrong, or every caller falls back to a popup —
// which is the whole reason this pass happened. Pinned so a future "simplification" of the
// props cannot quietly take it away again.
{
  const field = readFileSync(join(ROOT, 'src/components/ui/OutlinedTextField.tsx'), 'utf8');
  for (const prop of ['error', 'helper', 'required']) {
    // Anchored to the start of a line and refusing a leading `//`, because a substring test
    // passes happily on `// error?: string;` — which is exactly how a prop gets "kept" while
    // being removed.
    const declared = new RegExp(`^\\s*${prop}\\?:`, 'm').test(field);
    assert.ok(
      declared,
      `OutlinedTextField lost its \`${prop}\` prop — without it validation goes back to Alert.alert`,
    );
  }
}

console.log('forms.check.ts — one text field, and it can show an error');
