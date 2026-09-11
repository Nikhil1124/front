/**
 * SheetActionGrid — the tinted icon tiles that go inside a `Sheet`.
 *
 * For the small "what are you adding?" kind of menu: three or four choices that are easier to
 * tell apart by colour and glyph than by reading four labels down a column. Each tile is a
 * tinted rounded square with the icon in the matching ink, and the label underneath.
 *
 * This is the grid half only — the header, handle, backdrop, drag-to-dismiss and focus trap
 * all come from the `Sheet` it sits in, so any sheet can use it without inheriting a second
 * copy of that chrome.
 *
 * Use `PGowActionSheet` instead when the choices are verbs acting on one object ("Edit staff",
 * "Remove staff"): a row reads faster than a tile when the label is the thing that matters,
 * and a destructive verb needs the gap that component puts above it. Tiles are for a handful
 * of distinct destinations, which is why there is no `destructive` flag here.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Palette, Radii } from '@/theme';
import { AnimatedPress } from './AnimatedPress';
import { Txt } from './Txt';

/** Named by ROLE, not by colour, so a tile picks its tint the way the rest of the app does
 *  and no call site has to name a hex. */
export type SheetActionTint = 'brand' | 'success' | 'danger' | 'warning';

const TINTS: Record<SheetActionTint, { fill: string; ink: string }> = {
  brand: { fill: Palette.TintBlue, ink: Colors.primary },
  success: { fill: Palette.TintGreen, ink: Colors.success },
  danger: { fill: Palette.TintRed, ink: Colors.danger },
  warning: { fill: Palette.TintAmber, ink: Colors.warning },
};

export interface SheetAction {
  /** One or two words under the tile — "Resident", not "Add a new resident". The sheet's own
   *  title already said what this is a menu of. */
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tint?: SheetActionTint;
  disabled?: boolean;
  testID?: string;
}

export interface SheetActionGridProps {
  actions: SheetAction[];
  /**
   * Closes the sheet before the action runs. Same order `PGowActionSheet` uses and for the
   * same reason: a tile that navigates while the sheet is still up leaves a dismissing modal
   * over a screen that is already changing, and one that opens a dialog would be stacking a
   * second layer. Sequential, not nested — and not a `setTimeout`, which is what this
   * replaced: the delay was tuned to the dismiss animation and drifted out of step with it.
   */
  onDismiss?: () => void;
  testID?: string;
}

export function SheetActionGrid({ actions, onDismiss, testID }: SheetActionGridProps) {
  const run = (action: SheetAction) => {
    if (action.disabled) return;
    onDismiss?.();
    action.onPress();
  };

  return (
    <View style={styles.grid} testID={testID}>
      {actions.map((action) => {
        const tint = TINTS[action.tint ?? 'brand'];
        return (
          <AnimatedPress
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: !!action.disabled }}
            disabled={action.disabled}
            onPress={() => run(action)}
            style={[styles.item, action.disabled && styles.itemDisabled]}
            testID={action.testID}
          >
            <View style={[styles.iconBox, { backgroundColor: tint.fill }]}>
              <Ionicons name={action.icon} size={22} color={action.disabled ? Colors.textMuted : tint.ink} />
            </View>
            <Txt
              size={12}
              weight="700"
              color={action.disabled ? Colors.textMuted : Colors.textPrimary}
              align="center"
              numberOfLines={2}
              style={styles.label}
            >
              {action.label}
            </Txt>
          </AnimatedPress>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps rather than squeezing: four tiles fit a narrow phone, a fifth starts a second row
  // instead of shrinking all of them below a comfortable target.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    rowGap: 16,
    marginVertical: 10,
  },
  item: { width: 80, alignItems: 'center', justifyContent: 'flex-start' },
  itemDisabled: { opacity: 0.5 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 8 },
});

export default SheetActionGrid;
