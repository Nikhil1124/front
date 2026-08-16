import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { GuestEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

interface RoomDef {
  roomNo: string;
  floor: number;
  bedsCapacity: number;
  sharingType: string;
  baseRent: number;
}

export function BedVisualizerScreen() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const guests = usePGowStore((s) => s.currentGuests);
  const toast = useToast();

  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [assigningBed, setAssigningBed] = useState<{ roomNo: string; bedIndex: number } | null>(null);
  const [assignGuestName, setAssignGuestName] = useState('');
  const [assignGuestPhone, setAssignGuestPhone] = useState('');

  // Default floor & room architecture
  const totalFloors = 3;
  const roomsPerFloor = 4;
  const defaultBedsPerRoom = 3;

  // Track room capacity overrides (e.g. manager adds/removes beds in a specific room)
  const [roomCapacityOverrides, setRoomCapacityOverrides] = useState<Record<string, number>>({});

  // Generate all rooms across floors
  const allRooms: RoomDef[] = [];
  for (let f = 1; f <= totalFloors; f++) {
    for (let r = 1; r <= roomsPerFloor; r++) {
      const roomNum = `${f}0${r}`;
      const capacity = roomCapacityOverrides[roomNum] ?? defaultBedsPerRoom;
      allRooms.push({
        roomNo: roomNum,
        floor: f,
        bedsCapacity: capacity,
        sharingType: `${capacity} Sharing`,
        baseRent: 6500,
      });
    }
  }

  const floorRooms = allRooms.filter((r) => r.floor === selectedFloor);

  // Map guests to rooms
  const getGuestsInRoom = (roomNo: string) => {
    return guests.filter((g) => g.roomNo === roomNo || g.roomNo === `Room ${roomNo}` || g.roomNo.includes(roomNo));
  };

  const totalBedsInProperty = allRooms.reduce((sum, r) => sum + r.bedsCapacity, 0);
  const totalOccupiedBeds = guests.length;
  const totalVacantBeds = Math.max(0, totalBedsInProperty - totalOccupiedBeds);

  const handleAdjustBedCount = (roomNo: string, delta: number) => {
    const currentCap = roomCapacityOverrides[roomNo] ?? defaultBedsPerRoom;
    const nextCap = currentCap + delta;
    const currentOccupants = getGuestsInRoom(roomNo).length;

    if (nextCap < 1) {
      Alert.alert('Limit Reached', 'A room must contain at least 1 bed.');
      return;
    }
    if (nextCap > 6) {
      Alert.alert('Limit Reached', 'Maximum capacity per room is 6 beds.');
      return;
    }
    if (nextCap < currentOccupants) {
      Alert.alert('Cannot Remove Bed', `Room ${roomNo} currently has ${currentOccupants} residents assigned. Please vacate an occupant before removing a bed.`);
      return;
    }

    hapticSuccess();
    setRoomCapacityOverrides((prev) => ({ ...prev, [roomNo]: nextCap }));
    toast('success', 'Capacity Updated', `Room ${roomNo} capacity set to ${nextCap} beds.`);
  };

  const handleVacate = (guest: GuestEntity) => {
    Alert.alert(
      'Vacate Bed',
      `Are you sure you want to vacate ${guest.name} from Room ${guest.roomNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Vacate Bed',
          style: 'destructive',
          onPress: async () => {
            await usePGowStore.getState().deleteGuest(guest.id);
            hapticSuccess();
            toast('info', 'Bed Vacated', `${guest.name} has been checked out.`);
          },
        },
      ],
    );
  };

  const handleAssignResident = async () => {
    if (!assigningBed) return;
    if (!assignGuestName.trim() || !assignGuestPhone.trim()) {
      hapticError();
      Alert.alert('Required Fields', 'Please enter resident name and phone number.');
      return;
    }
    const res = await usePGowStore.getState().createGuestByOwner(
      assignGuestName.trim(),
      `${assignGuestPhone.trim()}@pgow.in`,
      assignGuestPhone.trim(),
      assigningBed.roomNo,
      '1234',
      6500,
    );
    if (res.ok) {
      hapticSuccess();
      toast('success', 'Resident Assigned', `${assignGuestName.trim()} assigned to Room ${assigningBed.roomNo}!`);
      setAssigningBed(null);
      setAssignGuestName('');
      setAssignGuestPhone('');
    } else {
      hapticError();
      Alert.alert('Assignment Failed', res.error ?? 'Could not assign resident.');
    }
  };

  return (
    <HubScreenWrapper
      title="Bed Layout Matrix"
      subtitle={`${owner?.pgName ?? 'Royal PG'} • Architecture & Seat Map`}
      icon="bed-outline"
    >
      {/* Property Capacity Overview Hero Card */}
      <Card
        containerColor={Colors.surface}
        borderRadius={18}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row justify="space-between" align="center">
          <Col>
            <Txt size={11} weight="800" color={Colors.primaryDark} style={{ letterSpacing: 0.5 }}>
              TOTAL CAPACITY OVERVIEW
            </Txt>
            <Txt size={22} weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
              {totalBedsInProperty} Total Beds
            </Txt>
            <Txt size={11} color={Colors.textMuted}>
              {totalFloors} Floors • {allRooms.length} Rooms ({defaultBedsPerRoom} Sharing)
            </Txt>
          </Col>
          <View style={styles.occupancyPill}>
            <Txt size={14} weight="900" color="#047857">
              {Math.min(100, Math.round((totalOccupiedBeds / totalBedsInProperty) * 100))}%
            </Txt>
            <Txt size={9} weight="700" color="#065F46">Occupied</Txt>
          </View>
        </Row>

        <Spacer size={12} />
        <Row gap={10}>
          <View style={[styles.statBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Txt size={14} weight="900" color="#047857">{totalOccupiedBeds} Occupied</Txt>
            <Txt size={10} color="#065F46">Assigned Beds</Txt>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F0FDF9', borderColor: '#CCFBF1' }]}>
            <Txt size={14} weight="900" color={Colors.primaryDark}>{totalVacantBeds} Vacant</Txt>
            <Txt size={10} color={Colors.primaryDark}>Available Beds</Txt>
          </View>
        </Row>
      </Card>

      <Spacer size={14} />

      {/* Floor Selector Tabs */}
      <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
        SELECT FLOOR
      </Txt>
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 6 }}>
        {[1, 2, 3].map((f) => {
          const isSel = selectedFloor === f;
          const roomsOnFloor = allRooms.filter((r) => r.floor === f);
          const bedsOnFloor = roomsOnFloor.reduce((s, r) => s + r.bedsCapacity, 0);
          const floorOccupants = roomsOnFloor.reduce((s, r) => s + getGuestsInRoom(r.roomNo).length, 0);

          return (
            <AnimatedPress
              key={f}
              scale={0.96}
              hapticPattern="light"
              onPress={() => { hapticSelect(); setSelectedFloor(f); setSelectedRoom(null); }}
            >
              <Card
                containerColor={isSel ? Colors.primary : Colors.surface}
                borderRadius={14}
                borderWidth={1}
                borderColor={isSel ? Colors.primary : Colors.borderSubtle}
                padding={[10, 14]}
                style={{ minWidth: 110 }}
              >
                <Txt size={13} weight="900" color={isSel ? Colors.textInverse : Colors.textPrimary}>
                  Floor {f}
                </Txt>
                <Txt size={10} weight="700" color={isSel ? 'rgba(255,255,255,0.85)' : Colors.textMuted} style={{ marginTop: 2 }}>
                  {floorOccupants}/{bedsOnFloor} Beds Filled
                </Txt>
              </Card>
            </AnimatedPress>
          );
        })}
      </FormScroll>

      <Spacer size={14} />

      {/* Rooms on Selected Floor */}
      <Row justify="space-between" align="center">
        <Txt size={14} weight="900" color={Colors.textPrimary}>
          Rooms on Floor {selectedFloor} ({floorRooms.length} Rooms)
        </Txt>
        <Txt size={11} color={Colors.textMuted}>Tap room to view beds</Txt>
      </Row>

      <Spacer size={8} />

      <View style={{ gap: 12 }}>
        {floorRooms.map((room) => {
          const occupants = getGuestsInRoom(room.roomNo);
          const filledCount = occupants.length;
          const isFull = filledCount >= room.bedsCapacity;
          const isVacant = filledCount === 0;
          const isExpanded = selectedRoom === room.roomNo;

          const statusColor = isFull ? '#B91C1C' : isVacant ? '#059669' : '#D97706';
          const statusBg = isFull ? '#FEF2F2' : isVacant ? '#ECFDF5' : '#FFFBEB';
          const statusLabel = isFull ? `${filledCount}/${room.bedsCapacity} Full` : isVacant ? `0/${room.bedsCapacity} Vacant` : `${filledCount}/${room.bedsCapacity} Filled`;

          return (
            <Card
              key={room.roomNo}
              containerColor={Colors.surface}
              borderRadius={16}
              borderWidth={1}
              borderColor={isExpanded ? Colors.primary : Colors.borderSubtle}
              padding={[14, 14]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { hapticSelect(); setSelectedRoom(isExpanded ? null : room.roomNo); }}
              >
                <Row justify="space-between" align="center">
                  <Row gap={10} align="center">
                    <View style={[styles.roomIconBox, { backgroundColor: isExpanded ? '#F0FDF9' : Colors.surfaceElevated }]}>
                      <Ionicons name="home" size={18} color={isExpanded ? Colors.primary : Colors.textSecondary} />
                    </View>
                    <Col>
                      <Row align="center" gap={6}>
                        <Txt size={15} weight="900" color={Colors.textPrimary}>Room {room.roomNo}</Txt>
                        <View style={[styles.fillBadge, { backgroundColor: statusBg }]}>
                          <Txt size={10} weight="800" color={statusColor}>{statusLabel}</Txt>
                        </View>
                      </Row>
                      <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2 }}>
                        {room.bedsCapacity} Beds ({room.bedsCapacity} Sharing) • ₹{room.baseRent.toLocaleString('en-IN')}/mo
                      </Txt>
                    </Col>
                  </Row>

                  <Row gap={6} align="center">
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                  </Row>
                </Row>
              </TouchableOpacity>

              {/* Bed Dots Preview */}
              <Row gap={6} align="center" style={{ marginTop: 10 }}>
                {Array.from({ length: room.bedsCapacity }).map((_, idx) => {
                  const occupant = occupants[idx];
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.bedPillMini,
                        { backgroundColor: occupant ? '#FEF2F2' : '#ECFDF5', borderColor: occupant ? '#FCA5A5' : '#A7F3D0' },
                      ]}
                    >
                      <Ionicons name="bed" size={12} color={occupant ? '#DC2626' : '#059669'} />
                      <Txt size={9} weight="800" color={occupant ? '#DC2626' : '#059669'} style={{ marginLeft: 3 }}>
                        Bed {String.fromCharCode(65 + idx)}
                      </Txt>
                    </View>
                  );
                })}
              </Row>

              {/* Expanded Room Bed Details & Capacity Controls */}
              {isExpanded && (
                <>
                  <Spacer size={12} />
                  <View style={{ height: 1, backgroundColor: Colors.borderSubtle }} />
                  <Spacer size={10} />

                  {/* Bed Capacity Stepper Controls */}
                  <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
                    <Txt size={12} weight="800" color={Colors.textPrimary}>Room Capacity Configuration</Txt>
                    <Row gap={6} align="center">
                      <Btn
                        onPress={() => handleAdjustBedCount(room.roomNo, -1)}
                        containerColor={Colors.surfaceMuted}
                        textColor={Colors.textPrimary}
                        borderRadius={6}
                        height={28}
                        contentStyle={{ paddingHorizontal: 8 }}
                      >
                        <Txt size={12} weight="900" color={Colors.textPrimary}>- 1 Bed</Txt>
                      </Btn>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F0FDF9', borderRadius: 6 }}>
                        <Txt size={11} weight="900" color={Colors.primaryDark}>{room.bedsCapacity} Beds</Txt>
                      </View>
                      <Btn
                        onPress={() => handleAdjustBedCount(room.roomNo, 1)}
                        containerColor={Colors.primary}
                        textColor={Colors.textInverse}
                        borderRadius={6}
                        height={28}
                        contentStyle={{ paddingHorizontal: 8 }}
                      >
                        <Txt size={12} weight="900" color={Colors.textInverse}>+ 1 Bed</Txt>
                      </Btn>
                    </Row>
                  </Row>

                  {/* Individual Beds Roster */}
                  <View style={{ gap: 8 }}>
                    {Array.from({ length: room.bedsCapacity }).map((_, idx) => {
                      const occupant = occupants[idx];
                      const bedLabel = `Bed ${room.roomNo}-${String.fromCharCode(65 + idx)}`;

                      return (
                        <Card
                          key={idx}
                          containerColor={occupant ? '#F8FAFC' : '#F0FDF9'}
                          borderRadius={12}
                          borderWidth={1}
                          borderColor={occupant ? Colors.borderSubtle : '#A7F3D0'}
                          padding={[10, 12]}
                        >
                          <Row justify="space-between" align="center">
                            <Row gap={8} align="center" style={{ flex: 1 }}>
                              <View style={[styles.bedIconBadge, { backgroundColor: occupant ? '#FEE2E2' : '#DCFCE7' }]}>
                                <Ionicons name="bed" size={16} color={occupant ? '#DC2626' : '#16A34A'} />
                              </View>
                              <Col style={{ flex: 1 }}>
                                <Row align="center" gap={6}>
                                  <Txt size={12} weight="900" color={Colors.textPrimary}>{bedLabel}</Txt>
                                  <View style={[styles.statusMiniTag, { backgroundColor: occupant ? '#FEF2F2' : '#ECFDF5' }]}>
                                    <Txt size={8} weight="800" color={occupant ? '#B91C1C' : '#047857'}>
                                      {occupant ? 'OCCUPIED' : 'VACANT'}
                                    </Txt>
                                  </View>
                                </Row>
                                <Txt size={10} color={Colors.textMuted} style={{ marginTop: 1 }}>
                                  {occupant ? `${occupant.name} • ${occupant.phone}` : 'Available for new resident check-in'}
                                </Txt>
                              </Col>
                            </Row>

                            {occupant ? (
                              <Btn
                                onPress={() => handleVacate(occupant)}
                                containerColor="#FEF2F2"
                                textColor="#DC2626"
                                borderRadius={8}
                                height={30}
                                contentStyle={{ paddingHorizontal: 8 }}
                              >
                                <Txt size={10} weight="800" color="#DC2626">Vacate</Txt>
                              </Btn>
                            ) : (
                              <Btn
                                onPress={() => {
                                  hapticSelect();
                                  setAssigningBed({ roomNo: room.roomNo, bedIndex: idx });
                                }}
                                containerColor={Colors.primary}
                                textColor={Colors.textInverse}
                                borderRadius={8}
                                height={30}
                                contentStyle={{ paddingHorizontal: 10 }}
                              >
                                <Txt size={10} weight="800" color={Colors.textInverse}>+ Assign</Txt>
                              </Btn>
                            )}
                          </Row>
                        </Card>
                      );
                    })}
                  </View>
                </>
              )}
            </Card>
          );
        })}
      </View>

      {/* Assign Resident Modal */}
      {assigningBed && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAssigningBed(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAssigningBed(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2 }}
            >
              <Row justify="space-between" align="center">
                <Col>
                  <Txt size={16} weight="900" color={Colors.textPrimary}>Assign Resident to Bed</Txt>
                  <Txt size={11} color={Colors.textMuted}>Room {assigningBed.roomNo} • Bed {String.fromCharCode(65 + assigningBed.bedIndex)}</Txt>
                </Col>
                <IconBtn onPress={() => setAssigningBed(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>

              <Spacer size={14} />

              <OutlinedTextField
                label="Resident Full Name *"
                placeholder="Rahul Sharma"
                value={assignGuestName}
                onChangeText={setAssignGuestName}
                containerColor={Colors.surfaceMuted}
                style={{ marginBottom: 10 }}
              />

              <OutlinedTextField
                label="Resident Phone Number *"
                placeholder="9876543210"
                value={assignGuestPhone}
                onChangeText={setAssignGuestPhone}
                keyboardType="phone-pad"
                containerColor={Colors.surfaceMuted}
                style={{ marginBottom: 14 }}
              />

              <Row gap={8}>
                <Btn
                  onPress={handleAssignResident}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textInverse}>Confirm Assignment</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setAssigningBed(null)}
                  borderColor={Colors.borderSubtle}
                  textColor={Colors.textPrimary}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textPrimary}>Cancel</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </Modal>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  occupancyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  roomIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bedPillMini: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  bedIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMiniTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
