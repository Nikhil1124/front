/**
 * StatusChip — the one way this app shows a state.
 *
 * Before this there were eight: a `KYC_STYLE` record on the owner's resident list, a
 * `kycPill()` function in `TenantListScreen`, a *second* `kycPill()` in `GuestSecurityTab`, a
 * `StatusBadge` inside `ProcurementScreen`, a `getDueStatusPill()` in `GuestPaymentsTab`, and
 * bare `statusBadge` styles in the complaints tab, the grocery orders screen and the owner
 * overview. The same "paid / pending / rejected" idea rendered as a bordered pill on one
 * screen, a plain-background badge on another and a coloured dot on a third.
 *
 * They also bypassed the palette: `#047857`, `#B91C1C`, `#1D4ED8`, `#6B7280` and friends are
 * not in `Colors` at all, so the palette pass never reached them, and several paired text and
 * background at contrasts below AA.
 *
 * Five tones, each a verified pair against its own background:
 *
 *     ok       5.68:1     warn   4.51:1     danger   4.70:1
 *     info     5.50:1     neutral 8.34:1
 *
 * `neutral` deliberately uses `textSecondary` rather than `textMuted` — muted on the elevated
 * tint measures 4.46:1, which misses AA for text this size by a hair.
 */
import { View, StyleSheet } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { Colors, Palette, Radii } from '@/theme';
import { toneFor, type StatusTone } from './statusTone';

export { toneFor, type StatusTone } from './statusTone';

/** Each pair verified against its own background — see the ratios in the header above. */
const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  ok: { bg: Palette.TintGreen, fg: Colors.success },
  warn: { bg: Palette.TintAmber, fg: Colors.warning },
  danger: { bg: Palette.TintRed, fg: Colors.danger },
  info: { bg: Palette.TintBlue, fg: Colors.primary },
  neutral: { bg: Colors.surfaceElevated, fg: Colors.textSecondary },
};

interface StatusChipProps {
  label: string;
  /** Omit to derive it from `label` via `toneFor`. */
  tone?: StatusTone;
  /**
   * `chip` is the filled pill — for a detail screen, where there is exactly one status and it
   * should carry weight. `dot` is a 6px mark and a word, for list rows: forty filled pills is
   * a wall of colour that stops meaning "look here" and starts meaning "row", which spends the
   * signal before anything is actually wrong.
   */
  variant?: 'chip' | 'dot';
}

export function StatusChip({ label, tone, variant = 'chip' }: StatusChipProps) {
  const { bg, fg } = TONES[tone ?? toneFor(label)];

  if (variant === 'dot') {
    return (
      <View style={styles.dotRow}>
        <View style={[styles.dot, { backgroundColor: fg }]} />
        <Txt size={11} weight="500" color={fg} numberOfLines={1}>{label}</Txt>
      </View>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Txt size={10} weight="700" color={fg} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: Radii.pill },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
});
