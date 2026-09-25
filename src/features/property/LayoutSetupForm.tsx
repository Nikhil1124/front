/**
 * The owner's first description of the building, saved in one go
 * (`POST /v1/pgs/{id}/layout/setup`).
 *
 * Built to be done in seconds: three answers — floors, rooms per floor, beds per room — and
 * Save. Most PGs are that regular. Room numbers follow the usual floor-then-position pattern
 * (101, 102… G1, G2 on the ground floor); only an owner whose building is irregular opens
 * "Edit room numbers or beds" to change individual rooms. After setup, rooms can still be
 * added and a room's beds changed on the bed layout screen.
 *
 * A new property has no rooms until this — they used to be invented at registration, which
 * is why the setup gate's "set up your rooms" step never appeared.
 */
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Btn, Card, ChoiceChips, Col, Row, Spacer, Txt } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { useToast } from '@/hooks/useToast';
import { useSetupLayout } from './usePropertyLayout';

type DraftRoom = { number: string; sharing: number };
type DraftFloor = { floor: number; rooms: DraftRoom[] };

const SHARING_OPTIONS = [1, 2, 3, 4, 5, 6];

const floorLabel = (n: number) => (n === 0 ? 'Ground floor' : `Floor ${n}`);
const roomNumber = (floor: number, i: number) => (floor === 0 ? `G${i + 1}` : String(floor * 100 + i + 1));

function build(floorCount: number, roomsPerFloor: number, sharing: number, hasGround: boolean): DraftFloor[] {
  const first = hasGround ? 0 : 1;
  return Array.from({ length: floorCount }, (_, idx) => {
    const floor = first + idx;
    return { floor, rooms: Array.from({ length: roomsPerFloor }, (_, i) => ({ number: roomNumber(floor, i), sharing })) };
  });
}

function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (n: number) => void; label: string;
}) {
  return (
    <Row gap={10} align="center">
      <AnimatedPress
        accessibilityRole="button"
        accessibilityLabel={`Fewer ${label}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
      >
        <Ionicons name="remove" size={18} color={Colors.primaryDark} />
      </AnimatedPress>
      <Txt size={18} weight="800" color={Colors.textPrimary} style={styles.stepValue}>{value}</Txt>
      <AnimatedPress
        accessibilityRole="button"
        accessibilityLabel={`More ${label}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
      >
        <Ionicons name="add" size={18} color={Colors.primaryDark} />
      </AnimatedPress>
    </Row>
  );
}

export function LayoutSetupForm({ pgId }: { pgId: string | null }) {
  const toast = useToast();
  const setup = useSetupLayout(pgId);
  const [quick, setQuick] = useState({ floorCount: 3, roomsPerFloor: 4, sharing: 3, hasGround: false });
  const [floors, setFloors] = useState(() => build(3, 4, 3, false));
  const [editing, setEditing] = useState(false);

  // The three answers rebuild the building; editing single rooms comes after them.
  const answer = (next: Partial<typeof quick>) => {
    const q = { ...quick, ...next };
    setQuick(q);
    setFloors(build(q.floorCount, q.roomsPerFloor, q.sharing, q.hasGround));
  };

  const updateFloor = (idx: number, change: (f: DraftFloor) => DraftFloor) =>
    setFloors((prev) => prev.map((f, i) => (i === idx ? change(f) : f)));

  const totalRooms = floors.reduce((n, f) => n + f.rooms.length, 0);
  const totalBeds = floors.reduce((n, f) => n + f.rooms.reduce((m, r) => m + r.sharing, 0), 0);
  const ranges = floors
    .map((f) => (f.rooms.length === 1 ? f.rooms[0].number : `${f.rooms[0].number}–${f.rooms[f.rooms.length - 1].number}`))
    .join(', ');

  const save = () => {
    const numbers = floors.flatMap((f) => f.rooms.map((r) => r.number.trim()));
    if (numbers.some((n) => !n)) {
      toast('error', 'A room has no number', 'Give every room its number.');
      return;
    }
    const repeated = numbers.find((n, i) => numbers.indexOf(n) !== i);
    if (repeated) {
      toast('error', `Room ${repeated} appears twice`, 'Each room needs its own number.');
      return;
    }
    setup.mutate(
      floors.map((f) => ({
        floor_number: f.floor,
        rooms: f.rooms.map((r) => ({ room_number: r.number.trim(), sharing_type: r.sharing })),
      })),
      {
        onSuccess: () => toast('success', 'Rooms saved', `${totalRooms} rooms · ${totalBeds} beds.`),
        onError: (err) => toast('error', 'Not saved', err instanceof Error ? err.message : 'Please try again.'),
      },
    );
  };

  return (
    <Col gap={14}>
      <Card containerColor={Colors.surface} borderRadius={Radii.sheet} borderWidth={1} borderColor={Colors.borderSubtle} padding={[18, 18]}>
        <Txt size={18} weight="800" color={Colors.textPrimary}>Set up your rooms</Txt>
        <Spacer size={18} />
        <Row justify="space-between" align="center">
          <Txt size={15} weight="700" color={Colors.textPrimary}>Floors</Txt>
          <Stepper value={quick.floorCount} min={1} max={30} label="floors" onChange={(floorCount) => answer({ floorCount })} />
        </Row>
        <Spacer size={14} />
        <Row justify="space-between" align="center">
          <Txt size={15} weight="700" color={Colors.textPrimary}>Rooms per floor</Txt>
          <Stepper value={quick.roomsPerFloor} min={1} max={50} label="rooms per floor" onChange={(roomsPerFloor) => answer({ roomsPerFloor })} />
        </Row>
        <Spacer size={16} />
        <ChoiceChips label="Beds per room" options={SHARING_OPTIONS} value={quick.sharing} onChange={(sharing) => answer({ sharing })} />
        <Spacer size={12} />
        <AnimatedPress accessibilityRole="checkbox" accessibilityState={{ checked: quick.hasGround }} onPress={() => answer({ hasGround: !quick.hasGround })}>
          <Row gap={8} align="center">
            <Ionicons name={quick.hasGround ? 'checkbox' : 'square-outline'} size={20} color={quick.hasGround ? Colors.primary : Colors.textMuted} />
            <Txt size={13} color={Colors.textPrimary}>Ground floor has rooms too</Txt>
          </Row>
        </AnimatedPress>

        <Spacer size={18} />
        <Txt size={15} weight="800" color={Colors.textPrimary}>{totalRooms} rooms · {totalBeds} beds</Txt>
        <Txt size={12} color={Colors.textMuted} numberOfLines={2}>Rooms {ranges}</Txt>
        <Spacer size={14} />
        <Btn onPress={save} loading={setup.isPending} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={50}>
          <Txt variant="button" color={Colors.textInverse}>Save rooms</Txt>
        </Btn>
        <Spacer size={12} />
        <AnimatedPress accessibilityRole="button" onPress={() => setEditing((e) => !e)}>
          <Row gap={6} align="center" justify="center">
            <Txt size={13} weight="700" color={Colors.primaryDark}>{editing ? 'Hide room details' : 'Edit room numbers or beds'}</Txt>
            <Ionicons name={editing ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primaryDark} />
          </Row>
        </AnimatedPress>
      </Card>

      {editing && floors.map((f, idx) => (
        <Card key={f.floor} containerColor={Colors.surface} borderRadius={Radii.sheet} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Txt size={15} weight="800" color={Colors.primaryDark}>{floorLabel(f.floor)}</Txt>
            <Stepper
              value={f.rooms.length}
              min={1}
              max={50}
              label={`rooms on ${floorLabel(f.floor)}`}
              onChange={(count) => updateFloor(idx, (fl) => ({
                ...fl,
                rooms: Array.from({ length: count }, (_, i) => fl.rooms[i] ?? { number: roomNumber(fl.floor, i), sharing: quick.sharing }),
              }))}
            />
          </Row>
          <Spacer size={10} />
          <Col gap={8}>
            {f.rooms.map((r, i) => (
              <Row key={i} justify="space-between" align="center" gap={10}>
                <TextInput
                  value={r.number}
                  onChangeText={(text) => updateFloor(idx, (fl) => ({ ...fl, rooms: fl.rooms.map((x, j) => (j === i ? { ...x, number: text } : x)) }))}
                  maxLength={20}
                  autoCapitalize="characters"
                  accessibilityLabel={`Room number, ${floorLabel(f.floor)}, room ${i + 1}`}
                  style={styles.numberInput}
                />
                <Row gap={6} align="center">
                  <Txt size={12} color={Colors.textMuted}>beds</Txt>
                  <Stepper
                    value={r.sharing}
                    min={1}
                    max={20}
                    label={`beds in room ${r.number}`}
                    onChange={(sharing) => updateFloor(idx, (fl) => ({ ...fl, rooms: fl.rooms.map((x, j) => (j === i ? { ...x, sharing } : x)) }))}
                  />
                </Row>
              </Row>
            ))}
          </Col>
        </Card>
      ))}
    </Col>
  );
}

const styles = StyleSheet.create({
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.4 },
  stepValue: { minWidth: 28, textAlign: 'center' },
  numberInput: {
    width: 96,
    height: 38,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.control,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
});
