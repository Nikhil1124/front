/**
 * Guard: there is one header component, and it stays one.
 *
 * The app reached three header components plus eighteen hand-rolled copies, drifted across
 * corner radius, notch gap, row padding, title size and chip diameter. Every one of those
 * started as a reasonable local decision. The only thing that stops the nineteenth is a check
 * that fails, so this is it.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Files allowed to position themselves against the notch. */
const ALLOWED = new Set([
  'src/components/AppHeader.tsx',        // the header itself
  'src/components/HubScreenWrapper.tsx', // reserves the bottom inset for a non-scrolling child
  'src/components/AlertOverlay.tsx',     // floats over the header, so it must know where it ends
  'src/components/ui/FormScroll.tsx',
  'src/features/owner/OwnerSetupGate.tsx',
  // Screens whose top bar is genuinely not a title header: a search field, and buttons
  // floating over a full-bleed product image.
  'src/features/groceries/screens/GroceryCategoryScreen.tsx',
  'src/features/groceries/screens/GroceryProductScreen.tsx',
  'src/features/groceries/components/grocery/Header.tsx',
  // Auth screens: no header, they pad their own scroll away from the notch.
  'app/(auth)/reset-password.tsx',
  'src/features/owner/OwnerRegisterScreen.tsx',
  'src/features/auth/SignInScreen.tsx',  // full-screen brand+form, no title header — same pattern
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
for (const file of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'app'))]) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '');
  if (ALLOWED.has(rel)) continue;
  const body = readFileSync(file, 'utf8');
  if (/paddingTop:\s*insets\.top/.test(body)) offenders.push(rel);
}

if (offenders.length) {
  console.error(
    'headers.check.ts — these files position against the notch themselves:\n'
    + offenders.map((f) => `  ${f}`).join('\n')
    + '\n\nUse <AppHeader> instead. If the screen genuinely needs its own top bar '
    + '(a search field, buttons over a full-bleed image), add it to ALLOWED with a reason.',
  );
  process.exit(1);
}

// The brand has no name or logo yet and the colour will change. It must therefore reach the
// header through exactly one token, so a rebrand is one edit rather than a search-and-replace.
const header = readFileSync(join(ROOT, 'src/components/AppHeader.tsx'), 'utf8')
  // Comments may name the old navy they replaced; it is the code that must not.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
if (/#[0-9A-Fa-f]{6}/.test(header)) {
  console.error('headers.check.ts — AppHeader.tsx hardcodes a colour. Use a Colors token so a rebrand stays one edit.');
  process.exit(1);
}

console.log('headers.check.ts — one header, no hardcoded brand colour');
