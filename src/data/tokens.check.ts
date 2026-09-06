/**
 * Guard: design tokens stay tokens.
 *
 * The radius scale was, in practice, not being used: 803 hardcoded `borderRadius` values
 * spanning 14 distinct numbers (including 3, 19 and 22) against 55 uses of the tokens. The
 * old names were the reason — `sm`/`md`/`lg`/`xl`/`xxl`/`big`/`huge`/`round`/`mega` tell you
 * a size but not a purpose, so there was no way to know which one a card was meant to use.
 * They are named by role now, and this keeps them that way.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Files allowed to name a raw radius. */
const ALLOWED = new Set([
  'src/theme/index.ts',   // where the scale is defined
  'src/theme/colors.ts',  // Layout.shadowCard and friends
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
for (const file of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'app'))]) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '');
  // The checks themselves quote the pattern they look for.
  if (ALLOWED.has(rel) || rel.endsWith('.check.ts')) continue;
  const body = readFileSync(file, 'utf8');
  // `borderRadius: 12` or `borderRadius={12}` — a number rather than a token.
  const hits = body.match(/borderRadius[=:]\s*\{?\s*\d/g);
  if (hits) offenders.push(`${rel} (${hits.length})`);
}

if (offenders.length) {
  console.error(
    'tokens.check.ts — hardcoded borderRadius:\n'
    + offenders.map((f) => `  ${f}`).join('\n')
    + '\n\nUse a Radii token. They are named by role:\n'
    + '  badge   tags, status chips, progress bars\n'
    + '  control buttons, inputs, chips, tiles\n'
    + '  card    cards, list rows, panels\n'
    + '  sheet   bottom sheets, modals\n'
    + '  pill    circles and capsules — never `width / 2`, which stops being a\n'
    + '          circle the moment the size changes.',
  );
  process.exit(1);
}

console.log('tokens.check.ts — every radius is a role-named token');
