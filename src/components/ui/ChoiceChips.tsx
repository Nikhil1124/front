/**
 * ChoiceChips — pick one of a short, known list.
 *
 * The rule this exists to enforce: when the answer set is knowable, offer it; only ask
 * someone to type when it genuinely is not. A "sharing" box that accepts any number lets
 * you create a 40-bed room; a "floor" box lets you file a room on floor 99 of a two-storey
 * building. Neither is caught until somebody notices the layout is wrong.
 *
 * Wraps rather than scrolls. A horizontal strip hides its own options — the count is small
 * by definition here, so they all fit on screen at once. When the list is long enough that
 * wrapping eats the screen, it is not a chip row any more; that is a picker sheet.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Txt } from '@/components/ui/Txt';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Radii } from '@/theme';

interface ChoiceChipsProps<T extends string | number> {
  label?: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Display text for an option. Defaults to the value itself. */
  render?: (value: T) => string;
  /** Same contract as `OutlinedTextField.error`. A chip row is a form field like any other —
   *  "Please select a service type" was being delivered as a popup for exactly as long as
   *  this component had nowhere to put it. */
  error?: string;
  required?: boolean;
  testID?: string;
}

export function ChoiceChips<T extends string | number>({
  label, options, value, onChange, render, error, required = false, testID,
}: ChoiceChipsProps<T>) {
  return (
    <View>
      {label ? (
        <Txt size={11} weight="700" color={error ? Colors.danger : Colors.textMuted} style={styles.label}>
          {label.toUpperCase()}{required ? ' *' : ''}
        </Txt>
      ) : null}
      <View style={styles.wrap}>
        {options.map((option) => {
          const selected = option === value;
          const text = render ? render(option) : String(option);
          return (
            <AnimatedPress
              key={String(option)}
              onPress={() => onChange(option)}
              accessibilityState={{ selected }}
              accessibilityLabel={text}
              testID={testID ? `${testID}_${option}` : undefined}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Txt size={13} weight="700" color={selected ? Colors.textInverse : Colors.textPrimary}>
                {text}
              </Txt>
            </AnimatedPress>
          );
        })}
      </View>
      {error ? (
        <View style={styles.message}>
          <Ionicons name="alert-circle" size={13} color={Colors.danger} />
          <Txt size={11} color={Colors.danger} style={{ flex: 1 }}>{error}</Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  label: { letterSpacing: 0.6, marginBottom: 7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    // 44 tall clears the touch-target minimum without a hitSlop that would overlap its
    // neighbour in a wrapped row.
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    // The fill alone is 1.11:1 on the white page — invisible. The border is what makes an
    // unselected chip read as a control, same as `Chip` in the barrel already does.
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
