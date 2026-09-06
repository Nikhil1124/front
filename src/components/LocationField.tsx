/**
 * The "where is this property" row on a property form.
 *
 * Presentation only — it shows what has been picked and reports a tap. Opening the picker is
 * the parent's job because the two parents need different mechanics: the property dialogs
 * are themselves inside a `Modal` and swap their own content, while the registration screen
 * is an ordinary screen and can present one.
 *
 * A location is not optional: the API refuses to create a property without one, since a PG
 * nobody can find on a map is not much use to whoever is deciding whether to move in.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { PickedLocation } from '@/features/places/pendingLocation';
import { Colors, Radii, Spacing } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface Props {
  value: PickedLocation | null;
  onPress: () => void;
  /** Falls back to the property's stored address when editing one that is already placed. */
  placeholder?: string;
}

export function LocationField({ value, onPress, placeholder }: Props) {
  const picked = value !== null;
  const summary = value
    ? value.formatted_address ||
      `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
    : (placeholder ?? 'Pin the location on the map *');

  return (
    <AnimatedPress accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, picked && styles.rowPicked]}
      testID="location_field"
    >
      <Ionicons
        name={picked ? 'location' : 'map-outline'}
        size={18}
        color={picked ? Colors.primary : Colors.textMuted}
      />
      <View style={styles.text}>
        <Txt variant="labelSmall" color={Colors.textMuted} style={styles.label}>
          PROPERTY LOCATION
        </Txt>
        <Txt
          size={12}
          color={picked ? Colors.textPrimary : Colors.textMuted}
          numberOfLines={2}
        >
          {summary}
        </Txt>
      </View>
      <Txt variant="caption" weight="700" color={Colors.primary}>
        {picked ? 'Change' : 'Pick'}
      </Txt>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.control,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowPicked: { borderColor: Colors.primary },
  text: { flex: 1, gap: 2 },
  label: { letterSpacing: 0.5 },
});
