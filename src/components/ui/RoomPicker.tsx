/**
 * Pick a room, rather than type one.
 *
 * `room_no` is a free string everywhere it is written — `POST /guests/join` and the owner's
 * add/edit resident forms all accept whatever is typed, and nothing validates it against
 * `pg_rooms`. A typo puts a real resident in a room that does not exist, which stays invisible
 * until somebody goes looking for them. The rooms are known; asking someone to retype them is
 * inventing a way to be wrong.
 *
 * Falls back to a plain field when the property has no layout yet. A PG that has not built its
 * bed layout still has to be able to take residents, and a picker with nothing in it is a dead
 * end — this is the one case where typing is the honest answer.
 */
import { View, StyleSheet } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Radii } from '@/theme';
import { usePropertyLayout } from '@/features/property/usePropertyLayout';

interface RoomPickerProps {
  pgId: string | null;
  value: string;
  onChange: (roomNumber: string) => void;
  label?: string;
  testID?: string;
}

export function RoomPicker({ pgId, value, onChange, label = 'Room', testID }: RoomPickerProps) {
  const { data: layout } = usePropertyLayout(pgId);
  const rooms = (layout?.floors ?? []).flatMap((f) => f.rooms);

  if (!rooms.length) {
    return (
      <OutlinedTextField
        label={`${label} (no layout set up yet)`}
        value={value}
        onChangeText={onChange}
        testID={testID}
      />
    );
  }

  return (
    <View>
      <Txt size={11} weight="700" color={Colors.textMuted} style={styles.label}>
        {label.toUpperCase()}
      </Txt>
      <View style={styles.wrap}>
        {rooms.map((r) => {
          const selected = r.roomNumber === value;
          return (
            <AnimatedPress
              key={r.id}
              onPress={() => onChange(r.roomNumber)}
              accessibilityState={{ selected }}
              accessibilityLabel={`Room ${r.roomNumber}, ${r.sharingType} sharing`}
              testID={testID ? `${testID}_${r.roomNumber}` : undefined}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Txt size={12.5} weight="700" color={selected ? Colors.textInverse : Colors.textPrimary}>
                {r.roomNumber}
              </Txt>
              <Txt size={9.5} color={selected ? Colors.textInverse : Colors.textMuted}>
                {r.sharingType} sharing
              </Txt>
            </AnimatedPress>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { letterSpacing: 0.6, marginBottom: 7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minWidth: 70,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    // The fill alone is 1.11:1 on the white page — invisible. The border is what makes an
    // unselected chip read as a control, same as `Chip` in the barrel already does.
    borderWidth: 1,
    borderColor: Colors.separator,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
