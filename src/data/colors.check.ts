/** Guard: the locked Botanical + Terracotta palette stays the only design language. */
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
  // The warm-ground pass. A cold literal white on a warm canvas reads as a patch of the old
  // design — 226 of these were swept; these bans stop the 227th.
  '#FFFFFF': 'Colors.surface or Colors.textInverse', '#FFF': 'Colors.surface or Colors.textInverse',
  // The cool palette these replaced. Named so a copy-paste from an old screen fails loudly.
  '#26658C': 'Colors.brand',
  '#1B3245': 'Colors.textPrimary',
  '#5A7387': 'Colors.textMuted',
  '#6B7280': 'Colors.textMuted', '#9CA3AF': 'Colors.textMuted',
  '#F3F4F6': 'Colors.surfaceMuted',
  '#E2E8F0': 'Colors.borderMuted',
  '#F6F9FB': 'Colors.canvas', '#FFFCF9': 'Colors.canvas',
  '#DCEAF2': 'DeckTints.brand.fill', '#011C40': 'DeckTints.brand.ink', '#3A5D75': 'DeckTints.brand.sub',
  '#D8EDE3': 'DeckTints.green.fill', '#03402C': 'DeckTints.green.ink', '#2E5F4C': 'DeckTints.green.sub',
  '#F7E8CE': 'DeckTints.amber.fill', '#6B3705': 'DeckTints.amber.ink', '#7A5227': 'DeckTints.amber.sub',
  '#EDEFF2': 'DeckTints.slate.fill', '#0F1B2A': 'DeckTints.slate.ink', '#55677A': 'DeckTints.slate.sub',
  '#E1E7EC': 'Colors.separator (old cool hairline)',
  // Superseded LUNA values: the unified specification explicitly replaces these.
  '#A24A2A': 'Colors.brand', '#5C2B18': 'Colors.brandDeep', '#7A3A22': 'Colors.terracottaDeep',
  '#F2EAE3': 'Colors.surfaceElevated', '#F7F2ED': 'Colors.surfaceMuted', '#EBE2DA': 'Colors.separator',
  '#DCD0C5': 'Colors.borderSubtle', '#E3D9D0': 'Colors.separator', '#2C6248': 'Colors.success',
  '#8A5A15': 'Colors.pending', '#A83226': 'Colors.danger', '#F6E9E1': 'DeckTints.brand.fill',
  '#E6F0E9': 'DeckTints.green.fill', '#F9EEDA': 'DeckTints.amber.fill', '#F2EDE8': 'DeckTints.slate.fill',
  // Locked tinted-card triplets must not be copied into individual screens.
  '#EAF2E6': 'DeckTints.brand.fill', '#2C452A': 'DeckTints.brand.ink', '#4C7246': 'DeckTints.brand.sub',
  '#E4EFEA': 'DeckTints.green.fill', '#1D4738': 'DeckTints.green.ink', '#2E6A54': 'DeckTints.green.sub',
  '#F7EEDC': 'DeckTints.amber.fill', '#57441F': 'DeckTints.amber.ink', '#836731': 'DeckTints.amber.sub',
  '#EFEDE7': 'DeckTints.slate.fill', '#33322C': 'DeckTints.slate.ink', '#6E6A5F': 'DeckTints.slate.sub',
  '#F9F0E8': 'Colors.terracottaPale', '#A0572E': 'Colors.terracotta', '#6E3A22': 'Colors.terracottaDeep',
  '#F9E9E9': 'Colors.dangerPale', '#6E2E33': 'Colors.dangerDeep', '#FDFCFA': 'Colors.canvas',
  '#F5F3EF': 'Colors.surfaceMuted', '#EDEFE8': 'Colors.surfaceElevated', '#E8E5DE': 'Colors.separator',
  '#D6D2C8': 'Colors.borderSubtle', '#4E4C44': 'Colors.textSecondary', '#726E64': 'Colors.textMuted',
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
  ['brand', Colors.brand],
  ['terracotta', Colors.terracotta],
  ['success', Colors.success],
  ['pending', Colors.pending],
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
  ['warn', Colors.pending, Palette.TintAmber],
  ['danger', Colors.danger, Palette.TintRed],
  ['info', Colors.neutral, Palette.TintBlue],
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
  ['focused icon', Colors.brand, DeckTints.brand.fill, NON_TEXT],
  ['focused label', Colors.brand, Colors.surface, AA],
  ['waiting icon', DeckTints.amber.ink, DeckTints.amber.fill, NON_TEXT],
  ['count numeral', Colors.textInverse, DeckTints.amber.ink, AA],
  ['clear icon', Colors.textMuted, DeckTints.green.fill, NON_TEXT],
  ['idle icon', Colors.textMuted, Colors.surface, NON_TEXT],
  ['strip text', DeckTints.amber.ink, DeckTints.amber.fill, AA],
] as const) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= floor, `bottom bar, ${name}: ${ratio.toFixed(2)}:1 — needs ${floor}`);
}

// The single-series Botanical chart must maintain a 3:1 non-text contrast from its most
// recessed historical bar to its selected bar, while status colours remain semantically separate.
assert.ok(contrast(Colors.brandSoft, Colors.canvas) >= NON_TEXT, 'brandSoft must clear 3:1 on canvas');
assert.ok(contrast(Colors.brandDeep, Colors.brandSoft) >= NON_TEXT, 'Botanical chart range must clear 3:1');

console.log('colors.check.ts — palette tokens only, and every pair clears AA');
