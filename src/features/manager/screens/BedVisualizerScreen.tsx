import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import {
  usePropertyLayout,
  useAssignBed,
  useVacateBed,
  useCreateRoom,
  useIncreaseRoomSharing,
} from '@/features/property/usePropertyLayout';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { BedResponse, RoomResponse } from '@/types';

const FLOORPLAN_IMG = require('../../../../assets/room_floorplan_preview.png');

export function BedVisualizerScreen() {
  const pgId = useAuthStore((s) => s.activePgId) ?? null;
  const { data: guests = [], refetch: refetchGuests } = useGuestsQuery(pgId ?? undefined);
  const toast = useToast();

  const { data: layout, isLoading, isError, error, refetch: refetchLayout, isRefetching: isRefetchingLayout } = usePropertyLayout(pgId);
  const assignBed = useAssignBed(pgId);
  const vacateBed = useVacateBed(pgId);
  const createRoom = useCreateRoom(pgId);
  const increaseSharing = useIncreaseRoomSharing(pgId);

  // Main screen filter & UI states
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('ALL'); // 'ALL' | '1' | '2' | '3' | '4'
  const [roomFilterSort, setRoomFilterSort] = useState<'ALL' | 'AVAILABLE_FIRST' | 'OCCUPIED_FIRST'>('ALL');

  // Modal / Detail states
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<RoomResponse | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'ALLOCATION' | 'DETAILS' | 'AMENITIES'>('ALLOCATION');
  const [activeBed, setActiveBed] = useState<{ room: RoomResponse; bed: BedResponse } | null>(null);

  // Management modals
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newFloor, setNewFloor] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newSharing, setNewSharing] = useState('');
  const [increasingRoom, setIncreasingRoom] = useState<RoomResponse | null>(null);
  const [increasedSharing, setIncreasedSharing] = useState('');

  const floors = layout?.floors ?? [];
  const currentFloor = floors.find((f) => f.floorNumber === selectedFloor) ?? null;

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

  // Derived available room types with counts
  const roomTypeSummary = useMemo(() => {
    const typesMap: Record<string, { roomsCount: number; vacantCount: number; totalBedsCount: number }> = {
      '1': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '2': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '3': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
      '4': { roomsCount: 0, vacantCount: 0, totalBedsCount: 0 },
    };

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
      hapticSuccess();
      toast('success', 'Bed assigned', `${guestName} is now assigned to Room ${activeBed.room.roomNumber}, Bed ${activeBed.bed.bedNumber}.`);
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
      toast('error', 'Check the form', 'Floor, room number, and sharing (1+) are required.');
      return;
    }
    try {
      await createRoom.mutateAsync({ floor_number: floorNum, room_number: newRoomNumber.trim(), sharing_type: sharing });
      hapticSuccess();
      toast('success', 'Room added', `Room ${newRoomNumber.trim()} (${sharing} Sharing) created on Floor ${floorNum}.`);
      setShowAddRoom(false);
      setNewFloor(''); setNewRoomNumber(''); setNewSharing('');
    } catch (err: any) {
      hapticError();
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
      toast('success', 'Sharing increased', `Room ${increasingRoom.roomNumber} now holds ${sharing} beds.`);
      setIncreasingRoom(null);
      setIncreasedSharing('');
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not increase sharing', err?.message ?? 'Please try again.');
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
        hapticPattern="light"
        onPress={() => {
          hapticSelect();
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
          <Txt size={14} weight="900" color={isSelected ? Colors.primary : Colors.textPrimary}>
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
        <Card containerColor={Colors.surface} borderRadius={20} padding={[24, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">
            Loading property layout & capacity…
          </Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={20} padding={[20, 20]}>
          <Row gap={10} align="center">
            <Ionicons name="cloud-offline" size={22} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="800" color={Colors.danger}>
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
          {/* 1. PROPERTY OVERVIEW SUMMARY CARD */}
          <Card
            containerColor={Colors.surface}
            borderRadius={20}
            borderWidth={1.5}
            borderColor="#CBEFF4"
            padding={[18, 18]}
            style={styles.overviewCardShadow}
          >
            <Row justify="space-between" align="center">
              <Col>
                <Row gap={6} align="center">
                  <Ionicons name="business" size={16} color={Colors.primary} />
                  <Txt size={12} weight="800" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                    PROPERTY OVERVIEW
                  </Txt>
                </Row>
                <Txt size={24} weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                  {totalBeds} Total Beds
                </Txt>
                <Txt size={11} color={Colors.textMuted}>
                  {targetRooms.length} Rooms • {floors.length} Floor{floors.length === 1 ? '' : 's'}
                </Txt>
              </Col>

              <View style={styles.occupancyBadgeBox}>
                <Txt size={16} weight="900" color="#059669">
                  {occupancyPercent}%
                </Txt>
                <Txt size={9} weight="800" color="#047857">
                  Occupied
                </Txt>
              </View>
            </Row>

            <Spacer size={14} />

            {/* Quick Metrics Bar */}
            <Row gap={10}>
              <View style={[styles.overviewMetricPill, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <Ionicons name="people" size={14} color="#DC2626" />
                <Txt size={13} weight="900" color="#DC2626">
                  {occupiedBeds} Occupied
                </Txt>
              </View>

              <View style={[styles.overviewMetricPill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Ionicons name="bed" size={14} color="#059669" />
                <Txt size={13} weight="900" color="#059669">
                  {vacantBeds} Vacant
                </Txt>
              </View>
            </Row>

            <Spacer size={14} />

            <OutlinedBtn
              onPress={() => {
                hapticSelect();
                setShowAddRoom(true);
              }}
              borderColor={Colors.primary}
              textColor={Colors.primary}
              borderRadius={12}
              height={42}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Txt size={12} weight="800" color={Colors.primary} style={{ marginLeft: 6 }}>
                Add Room / Floor
              </Txt>
            </OutlinedBtn>
          </Card>

          <Spacer size={16} />

          {/* 2. DEDICATED ROOM TYPES SELECTOR */}
          <Col>
            <Row justify="space-between" align="center">
              <Txt size={15} weight="900" color={Colors.textPrimary}>
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

          {/* 3. AVAILABILITY SNAPSHOT / INSIGHT BAR */}
          <Card
            containerColor="#F4F9FB"
            borderRadius={16}
            borderWidth={1}
            borderColor="#CBEFF4"
            padding={[14, 14]}
          >
            <Row justify="space-between" align="center">
              <Row gap={8} align="center">
                <Ionicons name="pie-chart-outline" size={16} color={Colors.primary} />
                <Txt size={12} weight="800" color={Colors.textPrimary}>
                  Availability Snapshot
                </Txt>
              </Row>
              <Txt size={11} weight="800" color={Colors.primary}>
                {vacantBeds} Beds Available
              </Txt>
            </Row>

            <Spacer size={8} />

            {/* Segmented capacity bar */}
            <View style={styles.snapshotBarTrack}>
              <View
                style={[
                  styles.snapshotBarFill,
                  { width: `${Math.max(5, occupancyPercent)}%`, backgroundColor: '#DC2626' },
                ]}
              />
            </View>

            <Spacer size={6} />

            <Row justify="space-between" align="center">
              <Txt size={10} color={Colors.textMuted}>
                {occupiedBeds} Occupied ({occupancyPercent}%)
              </Txt>
              <Txt size={10} color={Colors.textMuted}>
                {vacantBeds} Vacant ({100 - occupancyPercent}%)
              </Txt>
            </Row>
          </Card>

          <Spacer size={16} />

          {/* 4. FLOOR SELECTION CHIPS (If multiple floors exist) */}
          {floors.length > 1 && (
            <>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                <Chip
                  label="All Floors"
                  selected={selectedFloor === null}
                  onPress={() => {
                    hapticSelect();
                    setSelectedFloor(null);
                  }}
                />
                {floors.map((f) => (
                  <Chip
                    key={f.floorNumber}
                    label={`Floor ${f.floorNumber}`}
                    selected={selectedFloor === f.floorNumber}
                    onPress={() => {
                      hapticSelect();
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
            <Txt size={15} weight="900" color={Colors.textPrimary}>
              Available Rooms ({filteredRooms.length})
            </Txt>

            <Row gap={6}>
              <TouchableOpacity
                onPress={() => {
                  hapticSelect();
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
                <Txt size={10} weight="800" color={Colors.primary}>
                  {roomFilterSort === 'ALL'
                    ? 'Default Sort'
                    : roomFilterSort === 'AVAILABLE_FIRST'
                    ? 'Vacant First'
                    : 'Occupied First'}
                </Txt>
              </TouchableOpacity>
            </Row>
          </Row>

          <Spacer size={12} />

          {/* 6. SUMMARIZED ROOM CARDS GRID */}
          {filteredRooms.length === 0 ? (
            <Card containerColor={Colors.surface} borderRadius={16} padding={[24, 20]} style={{ alignItems: 'center' }}>
              <Ionicons name="filter-outline" size={32} color={Colors.textMuted} />
              <Spacer size={8} />
              <Txt size={14} weight="800" color={Colors.textPrimary}>
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
                borderRadius={10}
                height={36}
                style={{ paddingHorizontal: 16 }}
              >
                <Txt size={12} weight="800" color={Colors.textInverse}>
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
                    hapticPattern="light"
                    onPress={() => {
                      hapticSelect();
                      setSelectedRoomDetail(room);
                      setDetailActiveTab('ALLOCATION');
                    }}
                  >
                    <Card
                      containerColor={Colors.surface}
                      borderRadius={18}
                      borderWidth={1.5}
                      borderColor="#CBEFF4"
                      padding={[16, 16]}
                    >
                      <Row justify="space-between" align="center">
                        <Row gap={8} align="center">
                          <View style={styles.roomBadgeIcon}>
                            <Ionicons name="key" size={14} color={Colors.primary} />
                          </View>
                          <Col>
                            <Txt size={16} weight="900" color={Colors.textPrimary}>
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
                              ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                              : isPart
                              ? { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }
                              : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                          ]}
                        >
                          <Txt
                            size={10}
                            weight="800"
                            color={isFull ? '#DC2626' : isPart ? '#D97706' : '#059669'}
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
                                    ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                                    : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                                ]}
                              >
                                <Ionicons
                                  name="bed"
                                  size={12}
                                  color={isOcc ? '#DC2626' : '#059669'}
                                />
                                <Txt
                                  size={9}
                                  weight="800"
                                  color={isOcc ? '#DC2626' : '#059669'}
                                  style={{ marginLeft: 2 }}
                                >
                                  {isOcc ? bed.tenant?.fullName?.split(' ')[0] ?? 'B' + bed.bedNumber : 'Free'}
                                </Txt>
                              </View>
                            );
                          })}
                        </Row>

                        <Row gap={4} align="center">
                          <Txt size={12} weight="800" color={Colors.primary}>
                            View Room
                          </Txt>
                          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
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
            <View style={styles.detailModalCard}>
              {/* Header Bar */}
              <View style={styles.detailHeaderBar}>
                <Row justify="space-between" align="center">
                  <Row gap={10} align="center">
                    <TouchableOpacity
                      onPress={() => setSelectedRoomDetail(null)}
                      style={styles.detailBackBtn}
                    >
                      <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Col>
                      <Txt size={18} weight="900" color="#FFFFFF">
                        Room {activeRoomDetailObject.roomNumber}
                      </Txt>
                      <Txt size={11} color="#A7EBF2">
                        {layout?.propertyName ?? "Chaitanya's Residency"}
                      </Txt>
                    </Col>
                  </Row>

                  <View style={styles.detailSharingTag}>
                    <Ionicons name="people" size={14} color="#FFFFFF" />
                    <Txt size={11} weight="800" color="#FFFFFF" style={{ marginLeft: 4 }}>
                      {activeRoomDetailObject.sharingType} Sharing
                    </Txt>
                  </View>
                </Row>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                {/* ROOM OVERVIEW CARD */}
                <Card containerColor="#FFFFFF" borderRadius={18} borderWidth={1} borderColor="#CBEFF4" padding={[16, 16]}>
                  <Row gap={14} align="center">
                    {/* 2D Floorplan Preview */}
                    <Image source={FLOORPLAN_IMG} style={styles.floorplanImage} resizeMode="cover" />

                    <Col style={{ flex: 1 }}>
                      <Txt size={10} weight="800" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                        ROOM OVERVIEW
                      </Txt>
                      <Txt size={16} weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                        {activeRoomDetailObject.sharingType} Sharing Room
                      </Txt>

                      <Spacer size={10} />

                      <Row gap={6}>
                        <View style={styles.overviewMiniPill}>
                          <Ionicons name="bed-outline" size={14} color={Colors.primary} />
                          <Txt size={11} weight="900" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.length} Beds
                          </Txt>
                          <Txt size={9} color={Colors.textMuted}>Total</Txt>
                        </View>

                        <View style={[styles.overviewMiniPill, { backgroundColor: '#FEF2F2' }]}>
                          <Ionicons name="person-outline" size={14} color="#DC2626" />
                          <Txt size={11} weight="900" color="#DC2626" style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.filter((b) => b.status === 'occupied').length} Occupied
                          </Txt>
                          <Txt size={9} color="#DC2626">Active</Txt>
                        </View>

                        <View style={[styles.overviewMiniPill, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#059669" />
                          <Txt size={11} weight="900" color="#059669" style={{ marginTop: 2 }}>
                            {activeRoomDetailObject.beds.filter((b) => b.status !== 'occupied').length} Vacant
                          </Txt>
                          <Txt size={9} color="#059669">Available</Txt>
                        </View>
                      </Row>
                    </Col>
                  </Row>
                </Card>

                {/* SEGMENTED TAB SELECTOR */}
                <Row style={styles.detailSegmentedBar}>
                  <TouchableOpacity
                    onPress={() => setDetailActiveTab('ALLOCATION')}
                    style={[
                      styles.detailTabBtn,
                      detailActiveTab === 'ALLOCATION' ? styles.detailTabBtnActive : null,
                    ]}
                  >
                    <Ionicons
                      name="bed"
                      size={14}
                      color={detailActiveTab === 'ALLOCATION' ? '#FFFFFF' : Colors.primary}
                    />
                    <Txt
                      size={12}
                      weight="800"
                      color={detailActiveTab === 'ALLOCATION' ? '#FFFFFF' : Colors.primary}
                      style={{ marginLeft: 6 }}
                    >
                      Bed Allocation
                    </Txt>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDetailActiveTab('DETAILS')}
                    style={[
                      styles.detailTabBtn,
                      detailActiveTab === 'DETAILS' ? styles.detailTabBtnActive : null,
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={detailActiveTab === 'DETAILS' ? '#FFFFFF' : Colors.primary}
                    />
                    <Txt
                      size={12}
                      weight="800"
                      color={detailActiveTab === 'DETAILS' ? '#FFFFFF' : Colors.primary}
                      style={{ marginLeft: 6 }}
                    >
                      Room Details
                    </Txt>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDetailActiveTab('AMENITIES')}
                    style={[
                      styles.detailTabBtn,
                      detailActiveTab === 'AMENITIES' ? styles.detailTabBtnActive : null,
                    ]}
                  >
                    <Ionicons
                      name="grid-outline"
                      size={14}
                      color={detailActiveTab === 'AMENITIES' ? '#FFFFFF' : Colors.primary}
                    />
                    <Txt
                      size={12}
                      weight="800"
                      color={detailActiveTab === 'AMENITIES' ? '#FFFFFF' : Colors.primary}
                      style={{ marginLeft: 6 }}
                    >
                      Amenities
                    </Txt>
                  </TouchableOpacity>
                </Row>

                {/* TAB CONTENT: BED ALLOCATION */}
                {detailActiveTab === 'ALLOCATION' && (
                  <Card containerColor="#FFFFFF" borderRadius={18} borderWidth={1} borderColor="#CBEFF4" padding={[16, 16]}>
                    <Row justify="space-between" align="center">
                      <Txt size={11} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                        BED ALLOCATION
                      </Txt>

                      <TouchableOpacity
                        onPress={() => {
                          setIncreasingRoom(activeRoomDetailObject);
                          setIncreasedSharing(String(activeRoomDetailObject.sharingType + 1));
                        }}
                        style={styles.editBedsBtn}
                      >
                        <Ionicons name="create-outline" size={13} color={Colors.primary} />
                        <Txt size={11} weight="800" color={Colors.primary} style={{ marginLeft: 4 }}>
                          Edit Beds
                        </Txt>
                      </TouchableOpacity>
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
                            hapticPattern="light"
                            onPress={() =>
                              setActiveBed({ room: activeRoomDetailObject, bed })
                            }
                            style={{ flex: 1, minWidth: 130 }}
                          >
                            <View
                              style={[
                                styles.allocationBedCard,
                                isOcc
                                  ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                                  : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                              ]}
                            >
                              <Row justify="space-between" align="center">
                                <Row gap={4} align="center">
                                  <Ionicons
                                    name="bed"
                                    size={16}
                                    color={isOcc ? '#DC2626' : '#059669'}
                                  />
                                  <Txt size={12} weight="900" color={isOcc ? '#DC2626' : '#059669'}>
                                    Bed {bed.bedNumber}
                                  </Txt>
                                </Row>
                                <Txt size={9} weight="800" color={isOcc ? '#DC2626' : '#059669'}>
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
                                weight="800"
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
                                    ? { backgroundColor: '#FEE2E2' }
                                    : { backgroundColor: '#D1FAE5' },
                                ]}
                              >
                                <Txt
                                  size={10}
                                  weight="800"
                                  color={isOcc ? '#DC2626' : '#059669'}
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
                    <Card containerColor="#F4F9FB" borderRadius={12} padding={[12, 12]}>
                      <Row justify="space-between" align="center">
                        <Row gap={8} align="center">
                          <Ionicons name="people-circle" size={24} color={Colors.primary} />
                          <Col>
                            <Txt size={11} color={Colors.textMuted}>
                              Room Capacity
                            </Txt>
                            <Txt size={13} weight="900" color={Colors.textPrimary}>
                              {activeRoomDetailObject.sharingType} People
                            </Txt>
                          </Col>
                        </Row>

                        <Col align="flex-end">
                          <Txt size={11} color={Colors.textMuted}>
                            Current Occupancy
                          </Txt>
                          <Txt size={13} weight="900" color={Colors.primary}>
                            {activeRoomDetailObject.beds.filter((b) => b.status === 'occupied').length} / {activeRoomDetailObject.beds.length}
                          </Txt>
                        </Col>
                      </Row>
                    </Card>

                    <Spacer size={16} />

                    {/* Quick Actions Row */}
                    <Txt size={11} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                      QUICK ACTIONS
                    </Txt>

                    <Spacer size={8} />

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      <TouchableOpacity
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
                        <Txt size={11} weight="800" color={Colors.textPrimary} style={{ marginLeft: 6 }}>
                          Add Occupant
                        </Txt>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => toast('info', 'Transfer Occupant', 'Select a resident bed to reassign them to another room.')}
                        style={styles.detailQuickActionBtn}
                      >
                        <Ionicons name="swap-horizontal-outline" size={14} color={Colors.primary} />
                        <Txt size={11} weight="800" color={Colors.textPrimary} style={{ marginLeft: 6 }}>
                          Transfer Occupant
                        </Txt>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => toast('info', 'Room History', 'Room history & maintenance log loaded.')}
                        style={styles.detailQuickActionBtn}
                      >
                        <Ionicons name="time-outline" size={14} color={Colors.primary} />
                        <Txt size={11} weight="800" color={Colors.textPrimary} style={{ marginLeft: 6 }}>
                          View History
                        </Txt>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => toast('info', 'Report Issue', 'Opened issue ticket form for Room ' + activeRoomDetailObject.roomNumber)}
                        style={styles.detailQuickActionBtn}
                      >
                        <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                        <Txt size={11} weight="800" color={Colors.danger} style={{ marginLeft: 6 }}>
                          Report Issue
                        </Txt>
                      </TouchableOpacity>
                    </ScrollView>

                    <Spacer size={16} />

                    {/* About This Room Details Grid */}
                    <Txt size={11} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                      ABOUT THIS ROOM
                    </Txt>
                    <Spacer size={8} />

                    <Row gap={8} style={{ flexWrap: 'wrap' }}>
                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="bed-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Room Type</Txt>
                          <Txt size={11} weight="800" color={Colors.textPrimary}>{activeRoomDetailObject.sharingType} Sharing</Txt>
                        </Col>
                      </View>

                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="key-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Room Number</Txt>
                          <Txt size={11} weight="800" color={Colors.textPrimary}>{activeRoomDetailObject.roomNumber}</Txt>
                        </Col>
                      </View>

                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="layers-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Floor</Txt>
                          <Txt size={11} weight="800" color={Colors.textPrimary}>Floor {activeRoomDetailObject.floorNumber}</Txt>
                        </Col>
                      </View>

                      <View style={styles.aboutRoomChip}>
                        <Ionicons name="resize-outline" size={14} color={Colors.primary} />
                        <Col>
                          <Txt size={9} color={Colors.textMuted}>Area</Txt>
                          <Txt size={11} weight="800" color={Colors.textPrimary}>220 sq.ft</Txt>
                        </Col>
                      </View>
                    </Row>
                  </Card>
                )}

                {/* TAB CONTENT: ROOM DETAILS */}
                {detailActiveTab === 'DETAILS' && (
                  <Card containerColor="#FFFFFF" borderRadius={18} padding={[16, 16]}>
                    <Txt size={14} weight="900" color={Colors.textPrimary}>
                      Room Specifications
                    </Txt>
                    <Spacer size={8} />
                    <Txt size={12} color={Colors.textSecondary} style={{ lineHeight: 20 }}>
                      Room {activeRoomDetailObject.roomNumber} is a spacious {activeRoomDetailObject.sharingType}-sharing room located on Floor {activeRoomDetailObject.floorNumber}. It features dedicated personal wardrobes, power sockets at each bedside, attached bathroom, and high-speed Wi-Fi access.
                    </Txt>
                    <Spacer size={14} />
                    <Row justify="space-between" align="center" style={styles.aboutRoomChip}>
                      <Txt size={12} color={Colors.textMuted}>Base Monthly Rent</Txt>
                      <Txt size={14} weight="900" color={Colors.primary}>
                        ₹{activeRoomDetailObject.baseRent ? activeRoomDetailObject.baseRent.toLocaleString('en-IN') : '8,500'} / mo
                      </Txt>
                    </Row>
                  </Card>
                )}

                {/* TAB CONTENT: AMENITIES */}
                {detailActiveTab === 'AMENITIES' && (
                  <Card containerColor="#FFFFFF" borderRadius={18} padding={[16, 16]}>
                    <Txt size={14} weight="900" color={Colors.textPrimary}>
                      Included Room Amenities
                    </Txt>
                    <Spacer size={12} />
                    <View style={{ gap: 10 }}>
                      {[
                        { icon: 'wifi', title: 'High-Speed Wi-Fi', desc: 'Unlimited 100 Mbps fiber internet' },
                        { icon: 'water', title: 'Attached Bathroom', desc: '24/7 hot water supply' },
                        { icon: 'snow', title: 'Air Conditioner', desc: 'Climate controlled cooling' },
                        { icon: 'desktop', title: 'Study Desk & Chair', desc: 'Personal ergonomic workstation' },
                        { icon: 'shirt', title: 'Personal Wardrobe', desc: 'Lockable spacious storage' },
                        { icon: 'flash', title: 'Power Backup', desc: 'Inverter support for lighting & fans' },
                      ].map((item, idx) => (
                        <Row key={idx} gap={10} align="center" style={styles.amenityRow}>
                          <View style={styles.amenityIconCircle}>
                            <Ionicons name={item.icon as any} size={16} color={Colors.primary} />
                          </View>
                          <Col style={{ flex: 1 }}>
                            <Txt size={12} weight="800" color={Colors.textPrimary}>{item.title}</Txt>
                            <Txt size={10} color={Colors.textMuted}>{item.desc}</Txt>
                          </Col>
                        </Row>
                      ))}
                    </View>
                  </Card>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 8. BED ASSIGNMENT / VACATE ACTION DIALOG */}
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
                    {activeBed.bed.status === 'occupied' ? 'Currently Occupied' : 'Vacant & Available'}
                  </Txt>
                </Col>
                <IconBtn onPress={() => setActiveBed(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>

              <Spacer size={14} />

              {activeBed.bed.status === 'occupied' && activeBed.bed.tenant ? (
                <>
                  <Card containerColor={Colors.surfaceMuted} borderRadius={12} padding={[12, 12]}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>
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
                    borderRadius={10}
                    height={44}
                  >
                    <Txt size={12} weight="800" color={Colors.textInverse}>
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
                                <Txt size={12} weight="800" color={Colors.textPrimary}>
                                  {g.name}
                                </Txt>
                                <Txt size={11} color={Colors.textMuted}>
                                  {g.phone} • Room {g.roomNo}
                                </Txt>
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

      {/* 9. ADD ROOM / FLOOR MODAL */}
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
                <Txt size={16} weight="900" color={Colors.textPrimary}>
                  Add Room / Floor
                </Txt>
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
                <Txt size={12} weight="800" color={Colors.textInverse}>
                  Add Room
                </Txt>
              </Btn>
            </Card>
          </View>
        </Modal>
      )}

      {/* 10. INCREASE SHARING MODAL */}
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
                <Txt size={16} weight="900" color={Colors.textPrimary}>
                  Increase Room Sharing
                </Txt>
                <IconBtn onPress={() => setIncreasingRoom(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>
              <Spacer size={4} />
              <Txt size={11} color={Colors.textMuted}>
                Room {increasingRoom.roomNumber} currently holds {increasingRoom.sharingType} beds.
              </Txt>
              <Spacer size={14} />
              <OutlinedTextField label="New sharing capacity" value={increasedSharing} onChangeText={setIncreasedSharing} keyboardType="number-pad" />
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
                <Txt size={12} weight="800" color={Colors.textInverse}>
                  Save
                </Txt>
              </Btn>
            </Card>
          </View>
        </Modal>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  overviewCardShadow: {
    shadowColor: '#011C40',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  occupancyBadgeBox: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
  },
  overviewMetricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  roomTypeCard: {
    width: 140,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  roomTypeCardSelected: {
    backgroundColor: '#EAF7F5',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  roomTypeCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBEFF4',
  },
  roomTypeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F4F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTypeIconSelected: {
    backgroundColor: Colors.primary,
  },
  snapshotBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
    overflow: 'hidden',
  },
  snapshotBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sortBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F4F9FB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  roomBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F4F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniBedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 28, 64, 0.65)',
    justifyContent: 'flex-end',
  },
  detailModalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#F4F9FB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  detailHeaderBar: {
    backgroundColor: '#011C40',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  detailBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSharingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  floorplanImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  overviewMiniPill: {
    flex: 1,
    backgroundColor: '#F4F9FB',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  detailSegmentedBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  detailTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  detailTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  editBedsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F9FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  allocationBedCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  allocationAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  allocationStatusPill: {
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  detailQuickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  aboutRoomChip: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F9FB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBEFF4',
  },
  amenityRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F9FB',
  },
  amenityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
