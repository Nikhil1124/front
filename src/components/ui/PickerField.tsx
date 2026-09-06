/**
 * PickerField — the half of a form you don't type into.
 *
 * `OutlinedTextField` is a filled box and means "type here". This is a row with a chevron and
 * means "choose here" — tapping it opens a sheet with the options. The two shapes are the
 * whole convention: a form tells you which fields will make you use the keyboard before you
 * touch any of them.
 *
 * That matters more than it sounds. The rule this app works to is that people should pick
 * rather than type wherever picking is possible, and a free-text field that *should* have
 * been a picker is invisible in code review — it looks exactly like every other field. Here
 * it doesn't: it's the wrong shape.
 *
 * ── Why it looks like `ListRow` ─────────────────────────────────────────────────────────────
 * Deliberately the same grammar — label left, value right, hairline between, rounded ends on a
 * run — so a form and a list read as the same app rather than two design languages. Runs are
 * grouped the same way too: `first`/`last` bound the group, matching `ListRow` exactly.
 *
 * This does NOT own the sheet it opens. It takes an `onPress` and the already-chosen value to
 * display; what the options are, and how they're presented, belongs to the caller — because
 * "pick a room" and "pick an audience" share nothing but the trigger.
 */
import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Txt } from './Txt';
import { AnimatedPress } from './AnimatedPress';
import { Colors, Palette, Radii } from '@/theme';

export interface PickerFieldProps {
  label: string;
  /** The chosen value, already formatted for display. Leave undefined for "nothing picked
   *  yet" and `placeholder` shows in muted text instead. */
  value?: string;
  placeholder?: string;
  onPress: () => void;
  /** Same contract as `OutlinedTextField.error` — what's wrong, in actionable words. */
  error?: string;
  helper?: string;
  required?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** Replaces the chevron — a swatch, a count, a small badge. */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Round and bound the ends of a run of picker rows, exactly as `ListRow` does. */
  first?: boolean;
  last?: boolean;
  testID?: string;
}

export function PickerField({
  label, value, placeholder = 'Choose', onPress, error, helper, required = false,
  leadingIcon, trailing, disabled = false, first, last, testID,
}: PickerFieldProps) {
  const invalid = !!error;

  return (
    <View>
      <AnimatedPress
        scale={0.99}
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        accessibilityLabel={`${label}${required ? ', required' : ''}, ${value ?? placeholder}`}
        accessibilityHint={error ?? helper ?? 'Opens a list of options'}
        style={[
          styles.row,
          first && styles.first,
          last && styles.last,
          invalid && styles.rowInvalid,
        ]}
      >
        {leadingIcon ? (
          <Ionicons
            name={leadingIcon}
            size={17}
            color={invalid ? Colors.danger : Colors.textMuted}
          />
        ) : null}

        <Txt size={13} color={invalid ? Colors.danger : Colors.textMuted} style={styles.label} numberOfLines={1}>
          {label}{required ? ' *' : ''}
        </Txt>

        <Txt
          size={13}
          weight={value ? '600' : '400'}
          color={disabled ? Colors.textMuted : value ? Colors.textPrimary : Colors.textMuted}
          numberOfLines={1}
          style={styles.value}
        >
          {value ?? placeholder}
        </Txt>

        {trailing ?? (
          <Ionicons name="chevron-forward" size={15} color={disabled ? Colors.borderSubtle : Colors.primary} />
        )}
      </AnimatedPress>

      {!last && <View style={styles.sep} />}

      {error || helper ? (
        <View style={styles.message}>
          {invalid ? <Ionicons name="alert-circle" size={13} color={Colors.danger} /> : null}
          <Txt size={11} color={invalid ? Colors.danger : Colors.textMuted} style={{ flex: 1 }}>
            {error ?? helper}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    // ListRow's own minimum, so a picker row and a list row are literally the same height.
    minHeight: 56,
    paddingVertical: 10,
  },
  rowInvalid: { backgroundColor: Palette.TintRed },
  first: {
    borderTopLeftRadius: Radii.control,
    borderTopRightRadius: Radii.control,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  last: {
    borderBottomLeftRadius: Radii.control,
    borderBottomRightRadius: Radii.control,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  sep: { height: 1, backgroundColor: Colors.separator },
  label: { flexShrink: 0 },
  // Pushed right, and allowed to shrink first — a long chosen value truncates before the
  // label does, because the label is what tells you which row you're looking at.
  value: { flex: 1, textAlign: 'right' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, paddingHorizontal: 2 },
});
