import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import {
  usePropertyLayout,
  useAssignBed,
  useVacateBed,
  useCreateRoom,
  useIncreaseRoomSharing,
} from '@/features/property/usePropertyLayout';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { BedResponse, RoomResponse } from '@/types';

/**
 * The single home for bed-level property layout — floor → room → bed, backed
 * by the real `/v1/pgs/{id}/layout` API. Previously this screen generated a
 * fake fixed grid (3 floors × 4 rooms × 3 beds, always) and "assign"/"vacate"
 * created or deleted whole guest records. A second, separate room-occupancy
 * summary also lived in the Guests tab. Both now point here.
 */
import { useGuestsQuery } from '@/features/guests/useGuests';

export function BedVisualizerScreen() {
  const pgId = useAuthStore((s) => s.activePgId) ?? null;
  const { data: guests = [], refetch: refetchGuests } = useGuestsQuery(pgId ?? undefined);
  const toast = useToast();

  const { data: layout, isLoading, isError, error, refetch: refetchLayout, isRefetching: isRefetchingLayout } = usePropertyLayout(pgId);
  const assignBed = useAssignBed(pgId);
  const vacateBed = useVacateBed(pgId);
  const createRoom = useCreateRoom(pgId);
  const increaseSharing = useIncreaseRoomSharing(pgId);

  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [activeBed, setActiveBed] = useState<{ room: RoomResponse; bed: BedResponse } | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newFloor, setNewFloor] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newSharing, setNewSharing] = useState('');
  const [increasingRoom, setIncreasingRoom] = useState<RoomResponse | null>(null);
  const [increasedSharing, setIncreasedSharing] = useState('');

  const floors = layout?.floors ?? [];
  const floor = floors.find((f) => f.floorNumber === selectedFloor) ?? floors[0] ?? null;

  const allBeds = useMemo(() => floors.flatMap((f) => f.rooms.flatMap((r) => r.beds)), [floors]);
  const totalBeds = allBeds.length;
  const occupied = allBeds.filter((b) => b.status === 'occupied').length;
  const vacant = totalBeds - occupied;

  // A resident counts as "unassigned" once they hold no active bed anywhere on this layout —
  // that is who can be offered for a vacant bed, rather than letting this screen create or
  // delete guest records the way the old fake version did.
  const assignedMembershipIds = useMemo(
    () => new Set(allBeds.map((b) => b.tenant?.membershipId).filter((id): id is string => !!id)),
    [allBeds]
  );
  const unassignedGuests = guests.filter((g) => !assignedMembershipIds.has(g.id));

  const handleAssign = async (membershipId: string, guestName: string) => {
    if (!activeBed) return;
    try {
      await assignBed.mutateAsync({ bedId: activeBed.bed.id, tenant_membership_id: membershipId });
      hapticSuccess();
      toast('success', 'Bed assigned', `${guestName} is now in Room ${activeBed.room.roomNumber}, Bed ${activeBed.bed.bedNumber}.`);
      setActiveBed(null);
    } catch (err: any) {
      hapticError();
      toast('error', 'Assign failed', err?.message ?? 'Please try again.');
    }
  };

  const handleVacate = async () => {
    if (!activeBed) return;
    try {
      await vacateBed.mutateAsync(activeBed.bed.id);
      hapticSuccess();
      toast('info', 'Bed vacated', `Room ${activeBed.room.roomNumber}, Bed ${activeBed.bed.bedNumber} is free.`);
      setActiveBed(null);
    } catch (err: any) {
      hapticError();
      toast('error', 'Vacate failed', err?.message ?? 'Please try again.');
    }
  };

  const handleAddRoom = async () => {
    const floorNum = parseInt(newFloor, 10);
    const sharing = parseInt(newSharing, 10);
    if (!newRoomNumber.trim() || !Number.isFinite(floorNum) || !Number.isFinite(sharing) || sharing < 1) {
      hapticError();
      toast('error', 'Check the form', 'Floor, room number, and sharing (1+) are all required.');
      return;
    }
    try {
      await createRoom.mutateAsync({ floor_number: floorNum, room_number: newRoomNumber.trim(), sharing_type: sharing });
      hapticSuccess();
      toast('success', 'Room added', `Room ${newRoomNumber.trim()} with ${sharing} bed${sharing === 1 ? '' : 's'} is on the layout now.`);
      setShowAddRoom(false);
      setNewFloor(''); setNewRoomNumber(''); setNewSharing('');
    } catch (err: any) {
      hapticError();
      // The server's own message already names the total_beds cap when that's the reason —
      // e.g. "...above the 30 beds it's registered for" — worth showing verbatim rather than
      // a generic failure line.
      toast('error', 'Could not add room', err?.message ?? 'Please try again.');
    }
  };

  const handleIncreaseSharing = async () => {
    if (!increasingRoom) return;
    const sharing = parseInt(increasedSharing, 10);
    if (!Number.isFinite(sharing) || sharing <= increasingRoom.sharingType) {
      hapticError();
      toast('error', 'Check the value', `Enter a number greater than ${increasingRoom.sharingType}.`);
      return;
    }
    try {
      await increaseSharing.mutateAsync({ roomId: increasingRoom.id, sharingType: sharing });
      hapticSuccess();
      toast('success', 'Sharing increased', `Room ${increasingRoom.roomNumber} now holds ${sharing}.`);
      setIncreasingRoom(null);
      setIncreasedSharing('');
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not increase sharing', err?.message ?? 'Please try again.');
    }
  };

  return (
    <HubScreenWrapper
      title="Bed Layout"
      subtitle={layout?.propertyName ?? 'Property Layout'}
      icon="bed-outline"
      refreshControl={<RefreshControl refreshing={isRefetchingLayout} onRefresh={() => Promise.all([refetchLayout(), refetchGuests()])} />}
    >
      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">Loading bed layout…</Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Row gap={8} align="center">
            <Ionicons name="cloud-offline" size={20} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Couldn't load the bed layout</Txt>
              <Txt variant="caption" color={Colors.textMuted}>{(error as Error)?.message ?? 'Please try again later.'}</Txt>
            </Col>
          </Row>
        </Card>
      ) : !layout || totalBeds === 0 ? (
        <EmptyState
          icon="bed-outline"
          title="No beds yet"
          subtitle="Beds are created automatically from the property's total bed count."
        />
      ) : (
        <>
          <Card containerColor={Colors.surface} borderRadius={18} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row justify="space-between" align="center">
              <Col>
                <Txt size={22} weight="900" color={Colors.textPrimary}>{totalBeds} Total Beds</Txt>
                <Txt size={11} color={Colors.textMuted}>
                  {floors.length} Floor{floors.length === 1 ? '' : 's'}
                </Txt>
              </Col>
              <View style={styles.occupancyPill}>
                <Txt size={14} weight="900" color="#047857">{Math.round((occupied / totalBeds) * 100)}%</Txt>
                <Txt size={9} weight="700" color="#065F46">Occupied</Txt>
              </View>
            </Row>
            <Spacer size={12} />
            <Row gap={10}>
              <View style={[styles.statBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Txt size={14} weight="900" color="#047857">{occupied} Occupied</Txt>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#F0FDF9', borderColor: '#CCFBF1' }]}>
                <Txt size={14} weight="900" color={Colors.primaryDark}>{vacant} Vacant</Txt>
              </View>
            </Row>
          </Card>

          <Spacer size={12} />

          <OutlinedBtn
            onPress={() => { hapticSelect(); setShowAddRoom(true); }}
            borderColor={Colors.primary}
            textColor={Colors.primary}
            borderRadius={12}
            height={44}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <Txt size={12} weight="800" color={Colors.primary} style={{ marginLeft: 6 }}>Add Room / Floor</Txt>
          </OutlinedBtn>

          <Spacer size={14} />

          {floors.length > 1 && (
            <>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {floors.map((f) => (
                  <Chip
                    key={f.floorNumber}
                    label={`Floor ${f.floorNumber}`}
                    selected={(floor?.floorNumber ?? floors[0].floorNumber) === f.floorNumber}
                    onPress={() => { hapticSelect(); setSelectedFloor(f.floorNumber); }}
                  />
                ))}
              </Row>
              <Spacer size={14} />
            </>
          )}

          <View style={{ gap: 12 }}>
            {(floor?.rooms ?? []).map((room) => (
              <Card key={room.id} containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                <Row justify="space-between" align="center">
                  <Txt size={14} weight="900" color={Colors.textPrimary}>Room {room.roomNumber}</Txt>
                  <Row gap={6} align="center">
                    <Txt size={11} color={Colors.textMuted}>
                      {room.sharingType} Sharing{room.baseRent ? ` • ₹${room.baseRent.toLocaleString('en-IN')}/mo` : ''}
                    </Txt>
                    <TouchableOpacity
                      accessibilityLabel={`Increase sharing for Room ${room.roomNumber}`}
                      onPress={() => { hapticSelect(); setIncreasingRoom(room); setIncreasedSharing(String(room.sharingType + 1)); }}
                    >
                      <Ionicons name="add-circle" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </Row>
                </Row>
                <Spacer size={10} />
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {room.beds.map((bed) => {
                    const occ = bed.status === 'occupied';
                    return (
                      <AnimatedPress
                        key={bed.id}
                        scale={0.96}
                        hapticPattern="light"
                        onPress={() => { hapticSelect(); setActiveBed({ room, bed }); }}
                      >
                        <View style={[styles.bedTile, { backgroundColor: occ ? '#FEF2F2' : '#ECFDF5', borderColor: occ ? '#FCA5A5' : '#A7F3D0' }]}>
                          <Ionicons name="bed" size={16} color={occ ? '#DC2626' : '#059669'} />
                          <Txt size={11} weight="800" color={occ ? '#DC2626' : '#059669'}>Bed {bed.bedNumber}</Txt>
                          <Txt size={9} color={occ ? '#B91C1C' : '#047857'} numberOfLines={1} style={{ maxWidth: 84 }}>
                            {occ ? (bed.tenant?.fullName ?? 'Occupied') : 'Vacant'}
                          </Txt>
                        </View>
                      </AnimatedPress>
                    );
                  })}
                </Row>
              </Card>
            ))}
          </View>
        </>
      )}

      {/* Tap a bed → one action: assign a waiting resident, or vacate the current one. */}
      {activeBed && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setActiveBed(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveBed(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2, maxHeight: '75%' }}
            >
              <Row justify="space-between" align="center">
                <Col>
                  <Txt size={16} weight="900" color={Colors.textPrimary}>
                    Room {activeBed.room.roomNumber} • Bed {activeBed.bed.bedNumber}
                  </Txt>
                  <Txt size={11} color={Colors.textMuted}>
                    {activeBed.bed.status === 'occupied' ? 'Occupied' : 'Vacant'}
                  </Txt>
                </Col>
                <IconBtn onPress={() => setActiveBed(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>

              <Spacer size={14} />

              {activeBed.bed.status === 'occupied' && activeBed.bed.tenant ? (
                <>
                  <Card containerColor={Colors.surfaceMuted} borderRadius={12} padding={[12, 12]}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{activeBed.bed.tenant.fullName}</Txt>
                    <Txt size={11} color={Colors.textMuted}>{activeBed.bed.tenant.phone}</Txt>
                    {activeBed.bed.tenant.checkInDate ? (
                      <Txt size={11} color={Colors.textMuted}>Checked in {activeBed.bed.tenant.checkInDate}</Txt>
                    ) : null}
                  </Card>
                  <Spacer size={14} />
                  <Btn
                    onPress={handleVacate}
                    loading={vacateBed.isPending}
                    disabled={vacateBed.isPending}
                    containerColor={Colors.danger}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={44}
                  >
                    <Txt size={12} weight="800" color={Colors.textInverse}>Vacate Bed</Txt>
                  </Btn>
                </>
              ) : (
                <>
                  <Txt size={12} weight="700" color={Colors.textPrimary}>Assign a resident</Txt>
                  <Spacer size={8} />
                  {/* FormScroll's inner ScrollView is hardcoded flex: 1, which needs a
                      flex-bounded ancestor — this Card sizes to its own content
                      (maxHeight: '75%' is a cap, not flex: 1), so it collapsed to zero
                      height (same bug fixed in AddPgPropertyDialog/EditPgPropertyDialog/
                      ProcurementScreen's cart modal). Plain maxHeight-bounded ScrollView. */}
                  {unassignedGuests.length === 0 ? (
                    <EmptyState
                      icon="people-outline"
                      title="No unassigned residents"
                      subtitle="Add a resident from the Guests tab first, then assign them here."
                    />
                  ) : (
                    <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : undefined}>
                      <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                        <View style={{ gap: 8 }}>
                          {unassignedGuests.map((g) => (
                            <TouchableOpacity
                              key={g.id}
                              activeOpacity={0.7}
                              disabled={assignBed.isPending}
                              onPress={() => handleAssign(g.id, g.name)}
                            >
                              <Card containerColor={Colors.surfaceMuted} borderRadius={10} padding={[10, 12]}>
                                <Txt size={12} weight="800" color={Colors.textPrimary}>{g.name}</Txt>
                                <Txt size={11} color={Colors.textMuted}>{g.phone}</Txt>
                              </Card>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </KeyboardAvoidingView>
                  )}
                </>
              )}
            </Card>
          </View>
        </Modal>
      )}

      {/* Add Room / Floor — a new floor is just a room whose floor_number hasn't been used
          yet, so one form covers both. The server enforces the total_beds cap; this is just
          the entry point. */}
      {showAddRoom && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowAddRoom(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddRoom(false)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2 }}
            >
              <Row justify="space-between" align="center">
                <Txt size={16} weight="900" color={Colors.textPrimary}>Add Room / Floor</Txt>
                <IconBtn onPress={() => setShowAddRoom(false)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>
              <Spacer size={4} />
              <Txt size={11} color={Colors.textMuted}>
                Total beds on this property is capped — adding beds beyond that is refused.
              </Txt>
              <Spacer size={14} />
              <OutlinedTextField label="Floor number" value={newFloor} onChangeText={setNewFloor} keyboardType="number-pad" style={{ marginBottom: 10 }} />
              <OutlinedTextField label="Room number" value={newRoomNumber} onChangeText={setNewRoomNumber} style={{ marginBottom: 10 }} />
              <OutlinedTextField label="Sharing (beds in this room)" value={newSharing} onChangeText={setNewSharing} keyboardType="number-pad" />
              <Spacer size={16} />
              <Btn
                onPress={handleAddRoom}
                loading={createRoom.isPending}
                disabled={createRoom.isPending}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={10}
                height={44}
              >
                <Txt size={12} weight="800" color={Colors.textInverse}>Add Room</Txt>
              </Btn>
            </Card>
          </View>
        </Modal>
      )}

      {/* Increase a room's roommate limit — beds get added to match, capped the same way. */}
      {increasingRoom && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIncreasingRoom(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIncreasingRoom(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2 }}
            >
              <Row justify="space-between" align="center">
                <Txt size={16} weight="900" color={Colors.textPrimary}>Increase Sharing</Txt>
                <IconBtn onPress={() => setIncreasingRoom(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>
              <Spacer size={4} />
              <Txt size={11} color={Colors.textMuted}>
                Room {increasingRoom.roomNumber} currently holds {increasingRoom.sharingType}. This only ever
                goes up — the extra beds are added, none are removed.
              </Txt>
              <Spacer size={14} />
              <OutlinedTextField label="New sharing" value={increasedSharing} onChangeText={setIncreasedSharing} keyboardType="number-pad" />
              <Spacer size={16} />
              <Btn
                onPress={handleIncreaseSharing}
                loading={increaseSharing.isPending}
                disabled={increaseSharing.isPending}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={10}
                height={44}
              >
                <Txt size={12} weight="800" color={Colors.textInverse}>Save</Txt>
              </Btn>
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
  bedTile: {
    width: 92,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
