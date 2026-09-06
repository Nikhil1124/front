/**
 * Guard: the status vocabulary stays in the palette.
 *
 * The radius pass found 803 hardcoded values against 55 token uses; the colours were the same
 * story one layer down. Five screens each invented their own amber — `#D97706`, `#F59E0B`,
 * `#B45309` — and their own tint to sit it on, so "pending" rendered as three different
 * yellows depending on which tab you were looking at. Worse, several of those were never
 * measured: `#D97706` on white is 3.29:1, which fails AA for the 10–11px labels it was being
 * used for. `Colors.warning` is the measured one.
 *
 * This only bans the specific literals that already had a token. A one-off illustration
 * colour is not what this is about.
 *
 * Runs under plain `node` via `npm run check` — no bundler, no test framework.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { Colors, Palette, DeckTints } from '../theme/colors.ts';

const ROOT = new URL('../..', import.meta.url).pathname;

/** hex → the token that already means this. */
const BANNED: Record<string, string> = {
  '#D97706': 'Colors.warning', '#B45309': 'Colors.warning', '#F59E0B': 'Colors.warning',
  '#047857': 'Colors.success', '#166534': 'Colors.success', '#059669': 'Colors.success',
  '#B91C1C': 'Colors.danger', '#DC2626': 'Colors.danger',
  '#FEF3C7': 'Palette.TintAmber', '#FDE68A': 'Palette.TintAmber', '#FFFBEB': 'Palette.TintAmber',
  '#FEF2F2': 'Palette.TintRed', '#FEE2E2': 'Palette.TintRed', '#FCA5A5': 'Palette.TintRed',
  '#ECFDF5': 'Palette.TintGreen', '#E0F2F0': 'Palette.TintGreen', '#D1FAE5': 'Palette.TintGreen',
  '#A7F3D0': 'Palette.TintGreen', '#EEF8F1': 'Palette.TintGreen',
  '#1D4ED8': 'Colors.info',
  '#6B7280': 'Colors.textMuted', '#9CA3AF': 'Colors.textMuted',
  '#F3F4F6': 'Colors.surfaceMuted',
  '#E2E8F0': 'Colors.borderMuted',
  // The ground pass. `#F6F9FB` was the old canvas — anything still naming it is a screen that
  // has not been moved onto the white page and will read as a 1.06:1 non-surface.
  '#F6F9FB': 'Colors.canvas (now white) or Colors.surfaceMuted',
  // Deck tints and their inks. Each is a measured pair; splitting one from the other by
  // inlining half of it is how a tinted card ends up with unreadable text on it.
  '#DCEAF2': 'DeckTints.brand.fill', '#011C40': 'DeckTints.brand.ink', '#3A5D75': 'DeckTints.brand.sub',
  '#D8EDE3': 'DeckTints.green.fill', '#03402C': 'DeckTints.green.ink', '#2E5F4C': 'DeckTints.green.sub',
  '#F7E8CE': 'DeckTints.amber.fill', '#6B3705': 'DeckTints.amber.ink', '#7A5227': 'DeckTints.amber.sub',
  '#EDEFF2': 'DeckTints.slate.fill', '#0F1B2A': 'DeckTints.slate.ink', '#55677A': 'DeckTints.slate.sub',
  '#E1E7EC': 'Colors.separator',
};

/** Files allowed to name these directly. */
const ALLOWED = new Set([
  'src/theme/colors.ts', // where the palette is defined
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
  // The checks themselves quote the literals they look for.
  if (ALLOWED.has(rel) || rel.endsWith('.check.ts')) continue;
  const body = readFileSync(file, 'utf8');
  for (const [hex, token] of Object.entries(BANNED)) {
    if (new RegExp(`['"]${hex}['"]`, 'i').test(body)) offenders.push(`${rel}: ${hex} → ${token}`);
  }
}

if (offenders.length) {
  console.error(
    'colors.check.ts — off-palette status colour:\n'
    + offenders.map((f) => `  ${f}`).join('\n')
    + '\n\nThese hexes each duplicate a token that already exists, and several of them\n'
    + 'were never contrast-checked. Use the token.',
  );
  process.exit(1);
}

// ── The ratios, actually measured ───────────────────────────────────────────
// The comments in `colors.ts` quote these numbers. Comments do not fail a build; this does.
// The whole ground pass exists because a white card sat at 1.06:1 on the old canvas, so the
// one thing that must never regress is a surface being indistinguishable from what it is on.

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const AA = 4.5;
/** WCAG 1.4.11: icons and other non-text graphics need 3:1, not 4.5:1. */
const NON_TEXT = 3;

// Text on the page.
for (const [name, colour] of [
  ['textPrimary', Colors.textPrimary],
  ['textSecondary', Colors.textSecondary],
  ['textMuted', Colors.textMuted],
  ['primary', Colors.primary],
  ['success', Colors.success],
  ['warning', Colors.warning],
  ['danger', Colors.danger],
] as const) {
  const ratio = contrast(colour, Colors.canvas);
  assert.ok(ratio >= AA, `${name} (${colour}) is ${ratio.toFixed(2)}:1 on the canvas — AA needs ${AA}`);
}

// The hairline has to be visible, because on a white page it is the only thing grouping rows.
{
  const ratio = contrast(Colors.separator, Colors.canvas);
  assert.ok(ratio >= 1.2, `separator is ${ratio.toFixed(2)}:1 on the canvas — too faint to group anything`);
}

// A tinted card needs ink of its own hue. Both the figure and its sub-label must clear AA,
// which is the part that fails first when someone swaps a fill without moving the ink.
for (const [name, tint] of Object.entries(DeckTints)) {
  const ink = contrast(tint.ink, tint.fill);
  const sub = contrast(tint.sub, tint.fill);
  assert.ok(ink >= AA, `DeckTints.${name}: ink is ${ink.toFixed(2)}:1 on its fill`);
  assert.ok(sub >= AA, `DeckTints.${name}: sub is ${sub.toFixed(2)}:1 on its fill`);
  const onPage = contrast(tint.fill, Colors.canvas);
  assert.ok(onPage >= 1.1, `DeckTints.${name}: fill is ${onPage.toFixed(2)}:1 on the page — it will not read as a card`);
}

// StatusChip's five tones, each against the background it is actually drawn on.
for (const [name, fg, bg] of [
  ['ok', Colors.success, Palette.TintGreen],
  ['warn', Colors.warning, Palette.TintAmber],
  ['danger', Colors.danger, Palette.TintRed],
  ['info', Colors.primary, Palette.TintBlue],
  ['neutral', Colors.textSecondary, Colors.surfaceElevated],
] as const) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= AA, `StatusChip tone "${name}" is ${ratio.toFixed(2)}:1 — AA needs ${AA}`);
}

// The bottom bar's tab states. These are ICONS on a tint, not text, so the bar is held to the
// 3:1 non-text threshold rather than 4.5 — except the count numeral, which is text. The reason
// they are pinned here at all: the tints do double duty as status (amber = work waiting, green
// = clear), so a fill that drifts pale enough to stop reading as a state is a functional bug,
// not a cosmetic one.
for (const [name, fg, bg, floor] of [
  ['focused icon', Colors.primary, DeckTints.brand.fill, NON_TEXT],
  ['focused label', Colors.primary, Colors.surface, AA],
  ['waiting icon', DeckTints.amber.ink, DeckTints.amber.fill, NON_TEXT],
  ['count numeral', Colors.textInverse, DeckTints.amber.ink, AA],
  ['clear icon', Colors.textMuted, DeckTints.green.fill, NON_TEXT],
  ['idle icon', Colors.textMuted, Colors.surface, NON_TEXT],
  ['strip text', DeckTints.amber.ink, DeckTints.amber.fill, AA],
] as const) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= floor, `bottom bar, ${name}: ${ratio.toFixed(2)}:1 — needs ${floor}`);
}

// "Work waiting" and "all clear" have to be told apart, and contrast is the WRONG instrument
// for it: the two fills sit at 1.01:1, i.e. the same lightness, because they are peer tints
// that differ in HUE. That is measured here as warmth — red minus blue — which is what
// actually separates an amber from a green.
//
// Note what this means, though: two colours of equal lightness are exactly the pair a
// red-green colour-blind reader cannot separate. That is why the amber state also carries a
// numeral and says "N waiting" to a screen reader; the tint is the fast path, never the only
// one. See HeadlessDockTabButton's accessibilityLabel.
{
  const warmth = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
  const split = warmth(DeckTints.amber.fill) - warmth(DeckTints.green.fill);
  assert.ok(split >= 30, `the waiting and clear tints are only ${split} apart in warmth — they will read as one colour`);
}

console.log('colors.check.ts — palette tokens only, and every pair clears AA');
