import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  RefreshControl,
  Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Palette, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useResponsivePadding } from '@/utils/responsive';
import {
  usePropertyLayout,
  useAssignBed,
  useVacateBed,
  useCreateRoom,
  useSetRoomSharing } from '@/features/property/usePropertyLayout';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/hooks/useToast';
import type { BedResponse, RoomResponse } from '@/types';
import { Btn, Card, Chip, ChoiceChips, Col, MetricDeck, OutlinedBtn, Row, Sheet, Spacer, Txt, type DeckCardData } from '@/components/ui';

const FLOORPLAN_IMG = require('../../../../assets/room_floorplan_preview.png');

/** The room sizes a PG is actually built at. Beyond 6 it is a dormitory, not a room. */
const SHARING_OPTIONS = [1, 2, 3, 4, 5, 6];

/** The same list, plus whatever this room already is — a room sitting at 8 has to show 8 as
 *  its current value, or the sheet opens with nothing selected and no way back to it. */
function sharingOptionsFor(current: number): number[] {
  return SHARING_OPTIONS.includes(current) ? SHARING_OPTIONS : [...SHARING_OPTIONS, current];
}

export function BedVisualizerScreen() {
  // The room-detail sheet below is pinned to the bottom edge inside a `<Modal>`, which
  // nothing in the layout tree pads — without this its controls sit in the Android
  // gesture-navigation strip, where a tap competes with the swipe-up home gesture.
  const insets = useSafeAreaInsets();
  const sidePadding = useResponsivePadding();
  const pgId = useAuthStore((s) => s.activePgId) ?? null;
  const { data: guests = [], refetch: refetchGuests } = useGuestsQuery(pgId ?? undefined);
  const toast = useToast();

  const { data: layout, isLoading, isError, error, refetch: refetchLayout, isRefetching: isRefetchingLayout } = usePropertyLayout(pgId);
  const assignBed = useAssignBed(pgId);
  const vacateBed = useVacateBed(pgId);
  const createRoom = useCreateRoom(pgId);
  const setSharing = useSetRoomSharing(pgId);

  // Main screen filter & UI states
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('ALL'); // 'ALL' | '1' | '2' | '3' | '4'
  const [roomFilterSort, setRoomFilterSort] = useState<'ALL' | 'AVAILABLE_FIRST' | 'OCCUPIED_FIRST'>('ALL');

  // Modal / Detail states
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<RoomResponse | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'ALLOCATION' | 'DETAILS'>('ALLOCATION');
  const [activeBed, setActiveBed] = useState<{ room: RoomResponse; bed: BedResponse } | null>(null);

  // Management modals
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newFloor, setNewFloor] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newSharing, setNewSharing] = useState('');
  const [newBaseRent, setNewBaseRent] = useState('');
  const [increasingRoom, setIncreasingRoom] = useState<RoomResponse | null>(null);
  const [increasedSharing, setIncreasedSharing] = useState('');

  const floors = layout?.floors ?? [];
  // Every floor that exists, plus the next one up — the only floor you can legitimately be
  // adding that is not already there. Ground counts as 0, so a brand-new property offers it.
  const floorOptions = (() => {
    const existing = floors.map((f) => f.floorNumber).sort((a, b) => a - b);
    const next = existing.length ? existing[existing.length - 1] + 1 : 0;
    return [...existing, next];
  })();

  // Flattened all beds across property
  const allBeds = useMemo(() => floors.flatMap((f) => f.rooms.flatMap((r) => r.beds)), [floors]);
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.status === 'occupied').length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Flattened all rooms across property or selected floor
  const targetRooms = useMemo(() => {
    if (selectedFloor !== null) {
      return floors.find((f) => f.floorNumber === selectedFloor)?.rooms ?? [];
    }
    return floors.flatMap((f) => f.rooms);
  }, [floors, selectedFloor]);

  // The overview card and the availability-snapshot card below it used to show these same
  // four numbers twice, once as a pair of pills and once as a progress bar with two labels
  // underneath — the exact "same information, different shape, right next to itself" pattern
  // this pass exists to close.
  const deckCards: DeckCardData[] = [
    {
      key: 'total', tint: 'brand', label: 'Total beds', value: String(totalBeds),
      delta: `${targetRooms.length} room${targetRooms.length === 1 ? '' : 's'} · ${floors.length} floor${floors.length === 1 ? '' : 's'}` },
    { key: 'occupied', tint: 'green', label: 'Occupied', value: String(occupiedBeds) },
    { key: 'vacant', tint: 'amber', label: 'Vacant', value: String(vacantBeds) },
    { key: 'occupancy', tint: 'slate', label: 'Occupancy', value: `${occupancyPercent}%` },
  ];

  // Derived available room types with counts
  const roomTypeSummary = useMemo(() => {
    const typesMap: Record<string, { roomsCount: number; vacantCount: number; totalBedsCount: number }> = {
      '1': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '2': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '3': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '4': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 } };

    targetRooms.forEach((r) => {
      const typeKey = String(r.sharingType);
      if (!typesMap[typeKey]) {
        typesMap[typeKey] = { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 };
      }
      typesMap[typeKey].roomsCount += 1;
      const vacantInRoom = r.beds.filter((b) => b.status !== 'occupied').length;
      typesMap[typeKey].vacantCount += vacantInRoom;
      typesMap[typeKey].totalBedsCount += r.beds.length;
    });

    return typesMap;
  }, [targetRooms]);

  // Filtered & Sorted Rooms list
  const filteredRooms = useMemo(() => {
    let result = [...targetRooms];

    if (selectedRoomType !== 'ALL') {
      result = result.filter((r) => String(r.sharingType) === selectedRoomType);
    }

    if (roomFilterSort === 'AVAILABLE_FIRST') {
      result.sort((a, b) => {
        const vacantA = a.beds.filter((bed) => bed.status !== 'occupied').length;
        const vacantB = b.beds.filter((bed) => bed.status !== 'occupied').length;
        return vacantB - vacantA;
      });
    } else if (roomFilterSort === 'OCCUPIED_FIRST') {
      result.sort((a, b) => {
        const occA = a.beds.filter((bed) => bed.status === 'occupied').length;
        const occB = b.beds.filter((bed) => bed.status === 'occupied').length;
        return occB - occA;
      });
    }

    return result;
  }, [targetRooms, selectedRoomType, roomFilterSort]);

  // Unassigned residents logic
  const assignedMembershipIds = useMemo(
    () => new Set(allBeds.map((b) => b.tenant?.membershipId).filter((id): id is string => !!id)),
    [allBeds]
  );
  const unassignedGuests = guests.filter((g) => !assignedMembershipIds.has(g.id));

  // Sync active room detail state when layout reloads
  const activeRoomDetailObject = useMemo(() => {
    if (!selectedRoomDetail) return null;
    for (const f of floors) {
      const found = f.rooms.find((r) => r.id === selectedRoomDetail.id);
      if (found) return found;
    }
    return selectedRoomDetail;
  }, [floors, selectedRoomDetail]);

  const handleAssign = async (membershipId: string, guestName: string) => {
    if (!activeBed) return;
    try {
      await assignBed.mutateAsync({ bedId: activeBed.bed.id, tenant_membership_id: membershipId });
      toast('success', 'Bed assigned', `${guestName} is now assigned to Room ${activeBed.room.roomNumber}, Bed ${activeBed.bed.bedNumber}.`);
      setActiveBed(null);
    } catch (err: any) {
      toast('error', 'Assign failed', err?.message ?? 'Please try again.');
    }
  };

  const handleVacate = async () => {
    if (!activeBed) return;
    try {
      await vacateBed.mutateAsync(activeBed.bed.id);
      toast('info', 'Bed vacated', `Room ${activeBed.room.roomNumber}, Bed ${activeBed.bed.bedNumber} is free.`);
      setActiveBed(null);
    } catch (err: any) {
      toast('error', 'Vacate failed', err?.message ?? 'Please try again.');
    }
  };

  const handleAddRoom = async () => {
    const floorNum = parseInt(newFloor, 10);
    const sharing = parseInt(newSharing, 10);
    if (!newRoomNumber.trim() || !Number.isFinite(floorNum) || !Number.isFinite(sharing) || sharing < 1) {
      toast('error', 'Check the form', 'Floor, room number, and sharing (1+) are required.');
      return;
    }
    const rent = parseFloat(newBaseRent);
    try {
      await createRoom.mutateAsync({
        floor_number: floorNum,
        room_number: newRoomNumber.trim(),
        sharing_type: sharing,
        base_rent: Number.isFinite(rent) && rent > 0 ? rent : undefined });
      toast('success', 'Room added', `Room ${newRoomNumber.trim()} (${sharing} Sharing) created on Floor ${floorNum}.`);
      setShowAddRoom(false);
      setNewFloor(''); setNewRoomNumber(''); setNewSharing(''); setNewBaseRent('');
    } catch (err: any) {
      toast('error', 'Could not add room', err?.message ?? 'Please try again.');
    }
  };

  const handleSetSharing = async () => {
    if (!increasingRoom) return;
    const sharing = parseInt(increasedSharing, 10);
    // 1 is a real room size — plenty of PGs have singles — and the server takes 1..20 in
    // either direction now. It refuses a shrink that would delete an occupied bed, which is
    // the one case worth surfacing verbatim rather than pre-empting here: whether a surplus
    // bed is occupied is the server's fact, not this form's.
    if (!Number.isFinite(sharing) || sharing < 1 || sharing > 20) {
      toast('error', 'Check the value', 'Enter how many beds this room holds (1–20).');
      return;
    }
    const shrinking = sharing < increasingRoom.sharingType;
    try {
      await setSharing.mutateAsync({ roomId: increasingRoom.id, sharingType: sharing });
      toast(
        'success',
        shrinking ? 'Sharing reduced' : 'Sharing updated',
        `Room ${increasingRoom.roomNumber} now holds ${sharing} bed${sharing === 1 ? '' : 's'}.`,
      );
      setIncreasingRoom(null);
      setIncreasedSharing('');
    } catch (err: any) {
      toast('error', 'Could not change sharing', err?.message ?? 'Please try again.');
    }
  };

  const renderRoomTypeCard = (typeKey: string, title: string, bedCount: number) => {
    const isSelected = selectedRoomType === typeKey;
    const info = typeKey === 'ALL'
      ? { roomsCount: targetRooms.length, vacantCount: vacantBeds, totalBedsCount: totalBeds }
      : roomTypeSummary[typeKey] || { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 };

    return (
      <AnimatedPress
        key={typeKey}
        scale={0.96}
        onPress={() => {
          setSelectedRoomType(typeKey);
        }}
      >
        <View
          style={[
            styles.roomTypeCard,
            isSelected ? styles.roomTypeCardSelected : styles.roomTypeCardUnselected,
          ]}
        >
          <Row justify="space-between" align="center">
            <View style={[styles.roomTypeIconBox, isSelected ? styles.roomTypeIconSelected : null]}>
              <Ionicons
                name={typeKey === '1' ? 'bed' : typeKey === '2' ? 'people' : typeKey === '3' ? 'grid' : 'apps'}
                size={18}
                color={isSelected ? Colors.textInverse : Colors.primary}
              />
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
          </Row>

          <Spacer size={10} />
          <Txt size={14} weight="700" color={isSelected ? Colors.primary : Colors.textPrimary}>
            {title}
          </Txt>
          <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2 }}>
            {info.roomsCount} Room{info.roomsCount === 1 ? '' : 's'} • {info.vacantCount} Vacant
          </Txt>
        </View>
      </AnimatedPress>
    );
  };

  return (
    <HubScreenWrapper
      title="Bed Layout"
      subtitle={layout?.propertyName ?? 'Chaitanya’s Residency'}
      icon="bed-outline"
      refreshControl={
        <RefreshControl
          refreshing={isRefetchingLayout}
          onRefresh={() => Promise.all([refetchLayout(), refetchGuests()])}
        />
      }
    >
      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.sheet} padding={[24, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">
            Loading property layout & capacity…
          </Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.sheet} padding={[20, 20]}>
          <Row gap={10} align="center">
            <Ionicons name="cloud-offline" size={22} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>
                Couldn't load property layout
              </Txt>
              <Txt variant="caption" color={Colors.textMuted}>
                {(error as Error)?.message ?? 'Please try again.'}
              </Txt>
            </Col>
          </Row>
        </Card>
      ) : !layout || totalBeds === 0 ? (
        <EmptyState
          icon="bed-outline"
          title="No Beds Configured"
          subtitle="Beds are initialized automatically from your property capacity."
        />
      ) : (
        <>
          {/* Total beds · occupied · vacant · occupancy — was two cards. */}
          <MetricDeck cards={deckCards} sidePadding={sidePadding} testID="bed_deck" />

          <Spacer size={16} />

          <OutlinedBtn
            onPress={() => {
              setShowAddRoom(true);
            }}
            borderColor={Colors.primary}
            textColor={Colors.primary}
            borderRadius={Radii.card}
            height={42}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <Txt size={12} weight="700" color={Colors.primary} style={{ marginLeft: 6 }}>
              Add Room / Floor
            </Txt>
          </OutlinedBtn>

          <Spacer size={16} />


          {/* 2. DEDICATED ROOM TYPES SELECTOR */}
          <Col>
            <Row justify="space-between" align="center">
              <Txt size={15} weight="700" color={Colors.textPrimary}>
                Room Types
              </Txt>
              <Txt size={11} color={Colors.textMuted}>
                Tap to filter list
              </Txt>
            </Row>

            <Spacer size={10} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {renderRoomTypeCard('ALL', 'All Rooms', totalBeds)}
              {renderRoomTypeCard('1', 'Single', 1)}
              {renderRoomTypeCard('2', '2 Sharing', 2)}
              {renderRoomTypeCard('3', '3 Sharing', 3)}
              {renderRoomTypeCard('4', '4 Sharing', 4)}
            </ScrollView>
          </Col>

          <Spacer size={16} />

          {/* 4. FLOOR SELECTION CHIPS (If multiple floors exist) */}
          {floors.length > 1 && (
            <>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                <Chip
                  label="All Floors"
                  selected={selectedFloor === null}
                  onPress={() => {
                    setSelectedFloor(null);
                  }}
                />
                {floors.map((f) => (
                  <Chip
                    key={f.floorNumber}
                    label={`Floor ${f.floorNumber}`}
                    selected={selectedFloor === f.floorNumber}
                    onPress={() => {
                      setSelectedFloor(f.floorNumber);
                    }}
                  />
                ))}
              </Row>
              <Spacer size={14} />
            </>
          )}

          {/* 5. ROOMS LIST HEADER & SORTING */}
          <Row justify="space-between" align="center">
            <Txt size={15} weight="700" color={Colors.textPrimary}>
              Available Rooms ({filteredRooms.length})
            </Txt>

            <Row gap={6}>
              <AnimatedPress accessibilityRole="button"
                onPress={() => {
                  setRoomFilterSort((prev) =>
                    prev === 'ALL'
                      ? 'AVAILABLE_FIRST'
                      : prev === 'AVAILABLE_FIRST'
                      ? 'OCCUPIED_FIRST'
                      : 'ALL'
                  );
                }}
                style={styles.sortBtnPill}
              >
                <Ionicons name="swap-vertical" size={12} color={Colors.primary} />
                <Txt size={10} weight="700" color={Colors.primary}>
                  {roomFilterSort === 'ALL'
                    ? 'Default Sort'
                    : roomFilterSort === 'AVAILABLE_FIRST'
                    ? 'Vacant First'
                    : 'Occupied First'}
                </Txt>
              </AnimatedPress>
            </Row>
          </Row>

          <Spacer size={12} />

          {/* 6. SUMMARIZED ROOM CARDS GRID */}
          {filteredRooms.length === 0 ? (
            <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[24, 20]} style={{ alignItems: 'center' }}>
              <Ionicons name="filter-outline" size={32} color={Colors.textMuted} />
              <Spacer size={8} />
              <Txt size={14} weight="700" color={Colors.textPrimary}>
                No rooms match the selected filter
              </Txt>
              <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2, textAlign: 'center' }}>
                Try selecting "All Rooms" or changing floor filters.
              </Txt>
              <Spacer size={14} />
              <Btn
                onPress={() => {
                  setSelectedRoomType('ALL');
                  setRoomFilterSort('ALL');
                }}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={Radii.control}
                height={36}
                style={{ paddingHorizontal: 16 }}
              >
                <Txt size={12} weight="700" color={Colors.textInverse}>
                  Reset Filters
                </Txt>
              </Btn>
            </Card>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredRooms.map((room) => {
                const occCount = room.beds.filter((b) => b.status === 'occupied').length;
                const vacCount = room.beds.length - occCount;
                const isFull = vacCount === 0;
                const isPart = occCount > 0 && vacCount > 0;

                return (
                  <AnimatedPress
                    key={room.id}
                    scale={0.97}
                    onPress={() => {
                      setSelectedRoomDetail(room);
                      setDetailActiveTab('ALLOCATION');
                    }}
                  >
                    <Card
                      containerColor={Colors.surface}
                      borderRadius={Radii.card}
                      borderWidth={1.5}
                      borderColor={Colors.borderSubtle}
                      padding={[16, 16]}
                    >
                      <Row justify="space-between" align="center">
                        <Row gap={8} align="center">
                          <View style={styles.roomBadgeIcon}>
                            <Ionicons name="key" size={14} color={Colors.primary} />
                          </View>
                          <Col>
                            <Txt size={16} weight="700" color={Colors.textPrimary}>
                              Room {room.roomNumber}
                            </Txt>
                            <Txt size={11} color={Colors.textMuted}>
                              Floor {room.floorNumber} • {room.sharingType} Sharing
                            </Txt>
                          </Col>
                        </Row>

                        <View
                          style={[
                            styles.statusTagPill,
                            isFull
                              ? { backgroundColor: Palette.TintRed, borderColor: Palette.TintRed }
                              : isPart
                              ? { backgroundColor: Palette.TintAmber, borderColor: '#FCD34D' }
                              : { backgroundColor: Palette.TintGreen, borderColor: Palette.TintGreen },
                          ]}
                        >
                          <Txt
                            size={10}
                            weight="700"
                            color={isFull ? Colors.danger : isPart ? Colors.warning : Colors.success}
                          >
                            {isFull ? 'Fully Occupied' : isPart ? `${vacCount} Beds Available` : 'Fully Vacant'}
                          </Txt>
                        </View>
                      </Row>

                      <Spacer size={12} />

                      {/* Compact Visual Bed Layout Indicator */}
                      <Row justify="space-between" align="center">
                        <Row gap={6} align="center">
                          {room.beds.map((bed) => {
                            const isOcc = bed.status === 'occupied';
                            return (
                              <View
                                key={bed.id}
                                style={[
                                  styles.miniBedChip,
                                  isOcc
                                    ? { backgroundColor: Palette.TintRed, borderColor: Palette.TintRed }
                                    : { backgroundColor: Palette.TintGreen, borderColor: Palette.TintGreen },
                                ]}
                              >
                                <Ionicons
                                  name="bed"
                                  size={12}
                                  color={isOcc ? Colors.danger : Colors.success}
                                />
                                <Txt
                                  size={9}
                                  weight="700"
                                  color={isOcc ? Colors.danger : Colors.success}
                                  style={{ marginLeft: 2 }}
                                >
                                  {isOcc ? bed.tenant?.fullName?.split(' ')[0] ?? 'B' + bed.bedNumber : 'Free'}
                                </Txt>
                              </View>
                            );
                          })}
                        </Row>

                        <Row gap={4} align="center">
                          <Txt size={12} weight="700" color={Colors.primary}>
                            View Room
                          </Txt>
                          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                        </Row>
                      </Row>
                    </Card>
                  </AnimatedPress>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* 7. HIGH-DETAIL ROOM VIEW MODAL (Matches user design mockup!) */}
      {activeRoomDetailObject && (
        <Modal
          visible={!!activeRoomDetailObject}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedRoomDetail(null)}
        >
          <View style={styles.detailModalBackdrop}>
            <View style={[styles.detailModalCard, { paddingBottom: insets.bottom }]}>
              {/* Header Bar */}
              <View style={styles.detailHeaderBar}>
                <Row justify="space-between" align="center">
                  <Row gap={10} align="center">
                    <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button"
                      onPress={() => setSelectedRoomDetail(null)}
                      style={styles.detailBackBtn}
                    >
                      <Ionicons name="arrow-back" size={20} color={Colors.textInverse} />
                    </AnimatedPress>
                    <Col>
                      <Txt size={18} weight="700" color={Colors.textInverse}>
                        Room {activeRoomDetailObject.roomNumber}
                      </Txt>
                      <Txt size={11} color="#A7EBF2">
                        {layout?.propertyName ?? "Chaitanya's Residency"}
                      </Txt>
                    </Col>
                  </Row>

                  <View style={styles.detailSharingTag}>
                    <Ionicons name="people" size={14} color={Colors.textInverse} />
                    <Txt size={11} weight="700" color={Colors.textInverse} style={{ marginLeft: 4 }}>
                      {activeRoomDetailObject.sharingType} Sharing
                    </Txt>
                  </View>
                </Row>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                {/* ROOM OVERVIEW CARD */}
                <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
                  <Row gap={14} align="center">
                    {/* 2D Floorplan Preview */}
                    <Image source={FLOORPLAN_IMG} style={styles.floorplanImage} resizeMode="cover" />

                    <Col style={{ flex: 1 }}>
                      <Txt size={10} weight="700" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                        ROOM OVERVIEW
                      </Txt>
                      <Txt size={16} weight="700" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                        {activeRoomDetailObject.sharingType} Sharing Room
                      </Txt>

                      <Spacer size={10} />

                      <Row gap={6}>
                        <View style={styles.overviewMiniPill}>
                          <Ionicons name="bed-outline" size={14} color={Colors.primary} />
                          <Txt size={11} weight="700" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.length} Beds
                          </Txt>
                          <Txt size={9} color={Colors.textMuted}>Total</Txt>
                        </View>

                        <View style={[styles.overviewMiniPill, { backgroundColor: Palette.TintRed }]}>
                          <Ionicons name="person-outline" size={14} color={Colors.danger} />
                          <Txt size={11} weight="700" color={Colors.danger} style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.filter((b) => b.status === 'occupied').length} Occupied
                          </Txt>
                          <Txt size={9} color={Colors.danger}>Active</Txt>
                        </View>

                        <View style={[styles.overviewMiniPill, { backgroundColor: Palette.TintGreen }]}>
                          <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                          <Txt size={11} weight="700" color={Colors.success} style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.filter((b) => b.status !== 'occupied').length} Vacant
                          </Txt>
                          <Txt size={9} color={Colors.success}>Available</Txt>
                        </View>
                      </Row>
                    </Col>
                  </Row>
                </Card>

                {/* SEGMENTED TAB SELECTOR */}
                <Row style={styles.detailSegmentedBar}>
                  <AnimatedPress accessibilityRole="button"
                    onPress={() => setDetailActiveTab('ALLOCATION')}
                    style={[
                      styles.detailTabBtn,
                      detailActiveTab === 'ALLOCATION' ? styles.detailTabBtnActive : null,
                    ]}
                  >
                    <Ionicons
                      name="bed"
                      size={14}
                      color={detailActiveTab === 'ALLOCATION' ? Colors.textInverse : Colors.primary}
                    />
                    <Txt
                      size={12}
                      weight="700"
                      color={detailActiveTab === 'ALLOCATION' ? Colors.textInverse : Colors.primary}
                      style={{ marginLeft: 6 }}
                    >
                      Bed Allocation
                    </Txt>
                  </AnimatedPress>

                  <AnimatedPress accessibilityRole="button"
                    onPress={() => setDetailActiveTab('DETAILS')}
                    style={[
                      styles.detailTabBtn,
                      detailActiveTab === 'DETAILS' ? styles.detailTabBtnActive : null,
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={detailActiveTab === 'DETAILS' ? Colors.textInverse : Colors.primary}
                    />
                    <Txt
                      size={12}
                      weight="700"
                      color={detailActiveTab === 'DETAILS' ? Colors.textInverse : Colors.primary}
                      style={{ marginLeft: 6 }}
                    >
                      Room Details
                    </Txt>
                  </AnimatedPress>
                </Row>

                {/* TAB CONTENT: BED ALLOCATION */}
                {detailActiveTab === 'ALLOCATION' && (
                  <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
                    <Row justify="space-between" align="center">
                      <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                        BED ALLOCATION
                      </Txt>

                      <AnimatedPress accessibilityRole="button"
                        onPress={() => {
                          setIncreasingRoom(activeRoomDetailObject);
                          setIncreasedSharing(String(activeRoomDetailObject.sharingType));
                        }}
                        style={styles.editBedsBtn}
                      >
                        <Ionicons name="create-outline" size={13} color={Colors.primary} />
                        <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>
                          Edit Beds
                        </Txt>
                      </AnimatedPress>
                    </Row>

                    <Spacer size={12} />

                    {/* Bed Grid Cards */}
                    <Row gap={10} style={{ flexWrap: 'wrap' }}>
                      {activeRoomDetailObject.beds.map((bed) => {
                        const isOcc = bed.status === 'occupied';

                        return (
                          <AnimatedPress
                            key={bed.id}
                            scale={0.96}
                            onPress={() =>
                              setActiveBed({ room: activeRoomDetailObject, bed })
                            }
                            style={{ flex: 1, minWidth: 130 }}
                          >
                            <View
                              style={[
                                styles.allocationBedCard,
                                isOcc
                                  ? { backgroundColor: Palette.TintRed, borderColor: Palette.TintRed }
                                  : { backgroundColor: Palette.TintGreen, borderColor: Palette.TintGreen },
                              ]}
                            >
                              <Row justify="space-between" align="center">
                                <Row gap={4} align="center">
                                  <Ionicons
                                    name="bed"
                                    size={16}
                                    color={isOcc ? Colors.danger : Colors.success}
                                  />
                                  <Txt size={12} weight="700" color={isOcc ? Colors.danger : Colors.success}>
                                    Bed {bed.bedNumber}
                                  </Txt>
                                </Row>
                                <Txt size={9} weight="700" color={isOcc ? Colors.danger : Colors.success}>
                                  {isOcc ? 'Occupied' : 'Vacant'}
                                </Txt>
                              </Row>

                              <Spacer size={10} />

                              {/* Resident Avatar / Placeholder */}
                              <View style={styles.allocationAvatarCircle}>
                                <Ionicons
                                  name="person"
                                  size={24}
                                  color={isOcc ? Colors.primary : Colors.textMuted}
                                />
                              </View>

                              <Spacer size={6} />

                              <Txt
                                size={12}
                                weight="700"
                                color={Colors.textPrimary}
                                align="center"
                                numberOfLines={1}
                              >
                                {isOcc ? bed.tenant?.fullName ?? 'Resident' : '—'}
                              </Txt>

                              <Txt size={9} color={Colors.textMuted} align="center" style={{ marginTop: 2 }}>
                                {isOcc ? 'Since active lease' : 'Available for assignment'}
                              </Txt>

                              <Spacer size={10} />

                              <View
                                style={[
                                  styles.allocationStatusPill,
                                  isOcc
                                    ? { backgroundColor: Palette.TintRed }
                                    : { backgroundColor: Palette.TintGreen },
                                ]}
                              >
                                <Txt
                                  size={10}
                                  weight="700"
                                  color={isOcc ? Colors.danger : Colors.success}
                                >
                                  {isOcc ? 'Occupied' : 'Assign Resident'}
                                </Txt>
                              </View>
                            </View>
                          </AnimatedPress>
                        );
                      })}
                    </Row>

                    <Spacer size={16} />

                    {/* Room Capacity Card */}
                    <Card containerColor={Colors.canvas} borderRadius={Radii.card} padding={[12, 12]}>
                      <Row justify="space-between" align="center">
                        <Row gap={8} align="center">
                          <Ionicons name="people-circle" size={24} color={Colors.primary} />
                          <Col>
                            <Txt size={11} color={Colors.textMuted}>
                              Room Capacity
                            </Txt>
                            <Txt size={13} weight="700" color={Colors.textPrimary}>
                              {activeRoomDetailObject.sharingType} People
                            </Txt>
                          </Col>
                        </Row>

                        <Col align="flex-end">
                          <Txt size={11} color={Colors.textMuted}>
                            Current Occupancy
                          </Txt>
                          <Txt size={13} weight="700" color={Colors.primary}>
                            {activeRoomDetailObject.beds.filter((b) => b.status === 'occupied').length} / {activeRoomDetailObject.beds.length}
                          </Txt>
                        </Col>
                      </Row>
                    </Card>

                    <Spacer size={16} />

                    {/* Quick Actions Row */}
                    <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                      QUICK ACTIONS
                    </Txt>

                    <Spacer size={8} />

                    {/* Transfer Occupant / View History / Report Issue used to sit here too —
                        each just fired a toast claiming something happened ("Room history &
                        maintenance log loaded.", "Opened issue ticket form...") with no screen,
                        query, or mutation behind any of them. Add Occupant is the only one of
                        the four that ever did anything real. */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      <AnimatedPress accessibilityRole="button"
                        onPress={() => {
                          const freeBed = activeRoomDetailObject.beds.find((b) => b.status !== 'occupied');
                          if (freeBed) {
                            setActiveBed({ room: activeRoomDetailObject, bed: freeBed });
                          } else {
                            toast('info', 'Room Full', 'No vacant beds available in this room.');
                          }
                        }}
                        style={styles.detailQuickActionBtn}
                      >
                        <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
                        <Txt size={11} weight="700" color={Colors.textPrimary} style={{ marginLeft: 6 }}>
                          Add Occupant
                        </Txt>
                      </AnimatedPress>
                    </ScrollView>

                    <Spacer size={16} />

                    {/* About This Room Details Grid */}
                    <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                      ABOUT THIS ROOM
                    </Txt>
                    <Spacer size={8} />

                    <Row gap={8} style={{ flexWrap: 'wrap' }}>
                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="bed-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Room Type</Txt>
                          <Txt size={11} weight="700" color={Colors.textPrimary}>{activeRoomDetailObject.sharingType} Sharing</Txt>
                        </Col>
                      </View>

                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="key-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Room Number</Txt>
                          <Txt size={11} weight="700" color={Colors.textPrimary}>{activeRoomDetailObject.roomNumber}</Txt>
                        </Col>
                      </View>

                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="layers-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Floor</Txt>
                          <Txt size={11} weight="700" color={Colors.textPrimary}>Floor {activeRoomDetailObject.floorNumber}</Txt>
                        </Col>
                      </View>

                    </Row>
                  </Card>
                )}

                {/* TAB CONTENT: ROOM DETAILS. Used to also carry a generic description
                    paragraph ("features dedicated personal wardrobes... high-speed Wi-Fi
                    access") and a fixed "220 sq.ft" area chip — identical text for every
                    room in every property, with no backend field behind either (pg-backend's
                    PgRoom model has no amenities or area column). Base Monthly Rent is the
                    one real fact here. */}
                {detailActiveTab === 'DETAILS' && (
                  <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[16, 16]}>
                    <Txt size={14} weight="700" color={Colors.textPrimary}>
                      Room Specifications
                    </Txt>
                    <Spacer size={14} />
                    <Row justify="space-between" align="center" style={styles.aboutRoomChip}>
                      <Txt size={12} color={Colors.textMuted}>Base Monthly Rent</Txt>
                      <Txt size={14} weight="700" color={activeRoomDetailObject.baseRent ? Colors.primary : Colors.textMuted}>
                        {activeRoomDetailObject.baseRent
                          ? `₹${activeRoomDetailObject.baseRent.toLocaleString('en-IN')} / mo`
                          : 'Not set'}
                      </Txt>
                    </Row>
                  </Card>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 8. BED ASSIGNMENT / VACATE ACTION DIALOG */}
      {activeBed && (
        <Sheet
          visible
          title={`Room ${activeBed.room.roomNumber} · Bed ${activeBed.bed.bedNumber}`}
          subtitle={activeBed.bed.status === 'occupied' ? 'Currently occupied' : 'Vacant and available'}
          icon={activeBed.bed.status === 'occupied' ? 'person' : 'bed-outline'}
          accent={activeBed.bed.status === 'occupied' ? Colors.primary : Colors.success}
          onDismiss={() => setActiveBed(null)}
        >

              {activeBed.bed.status === 'occupied' && activeBed.bed.tenant ? (
                <>
                  <Card containerColor={Colors.surfaceMuted} borderRadius={Radii.card} padding={[12, 12]}>
                    <Txt size={13} weight="700" color={Colors.textPrimary}>
                      {activeBed.bed.tenant.fullName}
                    </Txt>
                    <Txt size={11} color={Colors.textMuted}>
                      {activeBed.bed.tenant.phone}
                    </Txt>
                    {activeBed.bed.tenant.checkInDate ? (
                      <Txt size={11} color={Colors.textMuted}>
                        Checked in {activeBed.bed.tenant.checkInDate}
                      </Txt>
                    ) : null}
                  </Card>
                  <Spacer size={14} />
                  <Btn
                    onPress={handleVacate}
                    loading={vacateBed.isPending}
                    disabled={vacateBed.isPending}
                    containerColor={Colors.danger}
                    textColor={Colors.textInverse}
                    borderRadius={Radii.control}
                    height={44}
                  >
                    <Txt size={12} weight="700" color={Colors.textInverse}>
                      Vacate Bed
                    </Txt>
                  </Btn>
                </>
              ) : (
                <>
                  <Txt size={12} weight="700" color={Colors.textPrimary}>
                    Assign a resident to this bed
                  </Txt>
                  <Spacer size={8} />

                  {unassignedGuests.length === 0 ? (
                    <EmptyState
                      icon="people-outline"
                      title="No unassigned residents"
                      subtitle="Add a resident from the Guests tab first, then assign them here."
                    />
                  ) : (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                      <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                        <View style={{ gap: 8 }}>
                          {unassignedGuests.map((g) => (
                            <AnimatedPress accessibilityRole="button"
                              key={g.id}
                              disabled={assignBed.isPending}
                              onPress={() => handleAssign(g.id, g.name)}
                            >
                              <Card containerColor={Colors.surfaceMuted} borderRadius={Radii.control} padding={[10, 12]}>
                                <Txt size={12} weight="700" color={Colors.textPrimary}>
                                  {g.name}
                                </Txt>
                                <Txt size={11} color={Colors.textMuted}>
                                  {g.phone} • Room {g.roomNo}
                                </Txt>
                              </Card>
                            </AnimatedPress>
                          ))}
                        </View>
                      </ScrollView>
                    </KeyboardAvoidingView>
                  )}
                </>
              )}
        </Sheet>
      )}

      {/* 9. ADD ROOM / FLOOR MODAL */}
      {showAddRoom && (
        <Sheet
          visible
          title="Add room or floor"
          icon="add-circle-outline"
          onDismiss={() => setShowAddRoom(false)}
          footer={
            <Btn
              onPress={handleAddRoom}
              loading={createRoom.isPending}
              disabled={createRoom.isPending}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Radii.control}
              height={44}
            >
              <Txt size={12} weight="700" color={Colors.textInverse}>Add room</Txt>
            </Btn>
          }
        >
              <Txt size={11} color={Colors.textMuted}>
                Total beds on this property is capped — adding beds beyond that is refused.
              </Txt>
              <Spacer size={14} />
              {/* Floor and sharing were number boxes: a typo filed a room on floor 99 of a
                  two-storey building, or created a 40-bed room. Both sets are short and known —
                  the floors that exist plus the next one up, and the sharing counts a PG room
                  is ever built at. */}
              <ChoiceChips
                label="Floor"
                options={floorOptions}
                value={newFloor === '' ? null : Number(newFloor)}
                onChange={(f) => setNewFloor(String(f))}
                render={(f) => (f === 0 ? 'Ground' : `Floor ${f}`)}
                testID="add_room_floor"
              />
              <Spacer size={12} />
              <OutlinedTextField label="Room number" value={newRoomNumber} onChangeText={setNewRoomNumber} style={{ marginBottom: 12 }} />
              <ChoiceChips
                label="Sharing (beds in this room)"
                options={SHARING_OPTIONS}
                value={newSharing === '' ? null : Number(newSharing)}
                onChange={(n) => setNewSharing(String(n))}
                render={(n) => (n === 1 ? 'Single' : `${n} share`)}
                testID="add_room_sharing"
              />
              <Spacer size={12} />
              <OutlinedTextField label="Base rent per bed (₹, optional)" value={newBaseRent} onChangeText={setNewBaseRent} keyboardType="number-pad" />
        </Sheet>
      )}

      {/* 10. INCREASE SHARING MODAL */}
      {increasingRoom && (
        <Sheet
          visible
          title="Change room sharing"
          subtitle={`Room ${increasingRoom.roomNumber}`}
          icon="people-outline"
          onDismiss={() => setIncreasingRoom(null)}
          footer={
            <Btn
              onPress={handleSetSharing}
              loading={setSharing.isPending}
              disabled={setSharing.isPending}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Radii.control}
              height={44}
            >
              <Txt size={12} weight="700" color={Colors.textInverse}>Save</Txt>
            </Btn>
          }
        >
              <Txt size={11} color={Colors.textMuted}>
                Room {increasingRoom.roomNumber} currently holds {increasingRoom.sharingType} bed
                {increasingRoom.sharingType === 1 ? '' : 's'}. Reducing it removes the
                highest-numbered beds, and is refused if anyone is still in them.
              </Txt>
              <Spacer size={14} />
              <ChoiceChips
                label="Beds in this room"
                options={sharingOptionsFor(increasingRoom.sharingType)}
                value={increasedSharing === '' ? null : Number(increasedSharing)}
                onChange={(n) => setIncreasedSharing(String(n))}
                render={(n) => (n === 1 ? 'Single' : `${n} share`)}
                testID="set_sharing"
              />
        </Sheet>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  roomTypeCard: {
    width: 140,
    padding: 14,
    borderRadius: Radii.card,
    borderWidth: 1.5 },
  roomTypeCardSelected: {
    backgroundColor: '#EAF7F5',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3 },
  roomTypeCardUnselected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSubtle },
  roomTypeIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radii.control,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center' },
  roomTypeIconSelected: {
    backgroundColor: Colors.primary },
  sortBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  roomBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: Radii.control,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center' },
  statusTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.control,
    borderWidth: 1 },
  miniBedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.control,
    borderWidth: 1 },
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 28, 64, 0.65)',
    justifyContent: 'flex-end' },
  detailModalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden' },
  detailHeaderBar: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16 },
  detailBackBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center' },
  detailSharingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.card },
  floorplanImage: {
    width: 100,
    height: 100,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  overviewMiniPill: {
    flex: 1,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    padding: 8,
    alignItems: 'center' },
  detailSegmentedBar: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  detailTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radii.control },
  detailTabBtnActive: {
    backgroundColor: Colors.primary },
  editBedsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  allocationBedCard: {
    padding: 12,
    borderRadius: Radii.card,
    borderWidth: 1.5 },
  allocationAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2 },
  allocationStatusPill: {
    paddingVertical: 4,
    borderRadius: Radii.badge,
    alignItems: 'center' },
  detailQuickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  aboutRoomChip: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.canvas,
    padding: 10,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle }, });
