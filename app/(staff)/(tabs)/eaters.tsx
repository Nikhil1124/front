/** Chef dashboard "Eaters" tab or Delivery Dashboard Route */
import { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { Card, Txt, Spacer, Chip, Col, Row, Btn, IconBtn, OutlinedBtn } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { CameraProofModal } from '@/components/CameraProofModal';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyTripsQuery,
  useCompleteStopMutation,
  uploadStopProofPhoto,
} from '@/features/delivery/useDeliveryAgent';
import type { SupplyTripStop } from '@/types/supply';

export default function ChefEatersTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryDashboardRoute />;
  return <ChefEatersView />;
}

import { useMealsQuery, useMealResponsesQuery } from '@/features/meals/useMeals';
import { useGuestsQuery } from '@/features/guests/useGuests';
import * as map from '@/data/mappers';
import type { GuestRSVPEntity } from '@/types';

function ChefEatersView() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: notifications = [] } = useMealsQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { activeMeal, setActiveMeal } = useActiveMeal();
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);

  const rsvpsForActive: GuestRSVPEntity[] = mealResponses
    .filter((r) => r.choice !== null)
    .map((r) => ({
      id: `${activeMeal?.id}:${r.membership_id}`,
      notificationId: activeMeal?.id ?? '',
      guestId: r.membership_id,
      guestName: r.name,
      choice: r.choice === 'eating' ? 'REQUIRED' : 'NOT_REQUIRED',
      timestamp: map.toMillis(r.responded_at),
    }));

  const reqCount = mealResponses.filter((r) => r.choice === 'eating').length;
  const notReqCount = mealResponses.filter((r) => r.choice === 'skipping').length;
  const noResponse = Math.max(0, guests.length - reqCount - notReqCount);

  return (
    <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      {!activeMeal ? (
        <View style={styles.emptyMealBox}>
          <Txt size={12} color={Colors.textMuted} align="center">No active meals. Use 'Broadcast Food Alert' tab to create a meal.</Txt>
        </View>
      ) : (
        <>
          <Txt size={11} weight="700" color={Colors.textSecondary}>Select Active Meal to View RSVP Data:</Txt>
          <Spacer size={6} />
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {notifications.map((n) => (
              <Chip key={n.id} label={`${n.mealType} - ${n.menuItems.slice(0, 20)}...`} selected={activeMeal?.id === n.id} onPress={() => setActiveMeal(n)} selectedColor={Colors.primary} size={11} />
            ))}
          </FormScroll>
          <Spacer size={14} />

          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
            <Col align="center">
              <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1.2 }}>TOTAL PORTIONS TO PREPARE TODAY</Txt>
              <Spacer size={10} />
              <View style={styles.bigPortionBox}>
                <Txt size={46} weight="900" color={Colors.primary}>{reqCount}</Txt>
              </View>
              <Spacer size={10} />
              <Txt size={13} weight="700" color={Colors.textPrimary} align="center">Active Menu: {activeMeal?.menuItems}</Txt>
            </Col>
          </Card>

          <Spacer size={14} />
          <Row gap={10}>
            <View style={[styles.metricCard, { backgroundColor: Colors.surfaceElevated, borderColor: Colors.borderSubtle }]}>
              <Txt size={10} weight="800" color={Colors.primaryDark}>COOK PORTIONS</Txt>
              <Txt size={28} weight="900" color={Colors.primary}>{reqCount}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Eating ✅</Txt>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' }]}>
              <Txt size={10} weight="800" color="#B91C1C">SKIPPED / SAVED</Txt>
              <Txt size={28} weight="900" color={Colors.danger}>{notReqCount}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Skipping ❌</Txt>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
              <Txt size={10} weight="800" color="#B45309">NO REPLY</Txt>
              <Txt size={28} weight="900" color={Colors.warning}>{noResponse}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Awaiting ⏳</Txt>
            </View>
          </Row>
        </>
      )}
    </FormScroll>
  );
}

function _isTerminal(status: SupplyTripStop['status']) {
  return status === 'delivered' || status === 'failed' || status === 'skipped';
}

function _openInMaps(address: string) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
}

function DeliveryDashboardRoute() {
  const authUser = useAuthStore((s) => s.user);
  const { data: trips = [], isLoading } = useMyTripsQuery();
  const completeStop = useCompleteStopMutation();

  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [proofPhotoKey, setProofPhotoKey] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // The trip currently out for delivery — a delivery agent works one at a time.
  const activeTrip = trips.find((t) => t.status === 'dispatched');
  const route = activeTrip?.stops ?? [];

  const completed = route.filter((s) => _isTerminal(s.status)).length;
  const current = route.find((s) => !_isTerminal(s.status));
  const pending = route.length - completed - (current ? 1 : 0);
  const progressPct = route.length > 0 ? Math.round((completed / route.length) * 100) : 0;

  const activeDelivery = route.find((s) => s.id === activeDeliveryId);

  const handleCapture = async (uri: string) => {
    setCameraOpen(false);
    if (!activeTrip || !activeDelivery) return;
    setUploadingPhoto(true);
    try {
      const key = await uploadStopProofPhoto(activeTrip.id, activeDelivery.order_id, uri);
      setPhotoUri(uri);
      setProofPhotoKey(key);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const confirmDelivery = async () => {
    if (!activeTrip || !activeDelivery || !proofPhotoKey) return;
    try {
      await completeStop.mutateAsync({
        tripId: activeTrip.id,
        orderId: activeDelivery.order_id,
        outcome: 'delivered',
        proofPhotoKey,
      });
      setActiveDeliveryId(null);
      setPhotoUri(null);
      setProofPhotoKey(null);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not confirm the delivery.');
    }
  };

  if (activeDelivery) {
    const isDelivered = activeDelivery.status === 'delivered';
    return (
      <View style={styles.root}>
        <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
          <Row align="center" gap={10}>
             <IconBtn onPress={() => setActiveDeliveryId(null)} icon="arrow-back" size={20} tint={Colors.primaryDark} containerColor={Colors.surfaceElevated} borderRadius={999} padding={8} />
             <Txt variant="screenTitle" weight="900" color={Colors.primaryDark}>{activeDelivery.order_no}</Txt>
          </Row>

          <Card containerColor={Colors.surface} borderRadius={Radii.xxl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{activeDelivery.pg_name}</Txt>
            <Txt variant="caption" color={Colors.textMuted}>{activeDelivery.pg_address}</Txt>
            <Spacer size={12} />
            <Btn onPress={() => _openInMaps(activeDelivery.pg_address)} containerColor={Colors.surfaceElevated} textColor={Colors.primary} borderRadius={8} height={40}>
              <Ionicons name="navigate" size={16} color={Colors.primary} />
              <Txt size={13} weight="800" style={{ marginLeft: 6 }}>Open in Google Maps</Txt>
            </Btn>
            <Spacer size={16} />
            <Divider color={Colors.borderSubtle} />
            <Spacer size={16} />
            <Row justify="space-between">
              <Col>
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Recipient</Txt>
                <Txt size={14} weight="800" color={Colors.textPrimary}>{activeDelivery.recipient_name}</Txt>
                <Txt size={12} color={Colors.textMuted}>{activeDelivery.recipient_phone}</Txt>
              </Col>
              <Col align="flex-end">
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Items</Txt>
                <Txt size={24} weight="900" color={Colors.primary}>{activeDelivery.item_count}</Txt>
              </Col>
            </Row>
            <Spacer size={16} />
            <View style={[styles.statusPill, { backgroundColor: isDelivered ? '#F0FDF4' : '#FFFBEB' }]}>
              <Txt size={12} weight="800" color={isDelivered ? '#15803D' : '#B45309'}>
                {isDelivered
                  ? `✓ Delivered${activeDelivery.completed_at ? ` at ${new Date(activeDelivery.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                  : '● Out for Delivery'}
              </Txt>
            </View>

            {!isDelivered && (
              <>
                <Spacer size={20} />
                <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>Proof of Delivery</Txt>
                <Txt variant="caption" color={Colors.textMuted}>Photograph must show delivered products & recipient.</Txt>
                <Spacer size={10} />

                {uploadingPhoto ? (
                  <View style={styles.photoPreviewBox}>
                    <Txt size={12} weight="700" color={Colors.textMuted}>Uploading…</Txt>
                  </View>
                ) : photoUri ? (
                  <View style={styles.photoPreviewBox}>
                    <Ionicons name="image-outline" size={32} color={Colors.primary} />
                    <Txt size={12} weight="700" color={Colors.textPrimary}>Photo captured</Txt>
                    <Spacer size={10} />
                    <Btn onPress={() => setCameraOpen(true)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={Radii.lg}>
                      <Txt size={12} weight="800">Retake Photo</Txt>
                    </Btn>
                  </View>
                ) : (
                  <Btn onPress={() => setCameraOpen(true)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={Radii.lg} height={60}>
                    <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                    <Txt size={14} weight="800" style={{ marginLeft: 8 }}>Take Photo</Txt>
                  </Btn>
                )}

                <Spacer size={16} />
                <Btn
                  onPress={confirmDelivery}
                  disabled={!proofPhotoKey || completeStop.isPending}
                  containerColor={proofPhotoKey ? Colors.success : Colors.surfaceMuted}
                  textColor={proofPhotoKey ? '#FFF' : Colors.textMuted}
                  borderRadius={Radii.lg}
                  height={50}
                >
                  {completeStop.isPending
                    ? <Ionicons name="hourglass-outline" size={18} color={Colors.textMuted} />
                    : <Txt size={15} weight="900">Confirm Delivery</Txt>
                  }
                </Btn>
              </>
            )}
          </Card>
        </FormScroll>
        <CameraProofModal visible={cameraOpen} title="Proof of Delivery" subtitle="Capture recipient and packages" onCapture={handleCapture} onClose={() => setCameraOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 16 }}>
        <Txt size={18} weight="900" color={Colors.primaryDark}>Good Morning, {authUser?.name?.split(' ')[0] ?? 'there'} 👋</Txt>

        {isLoading ? (
          <View style={styles.emptyMealBox}>
            <Txt size={12} color={Colors.textMuted} align="center">Loading your route…</Txt>
          </View>
        ) : !activeTrip || route.length === 0 ? (
          <View style={styles.emptyMealBox}>
            <Txt size={12} color={Colors.textMuted} align="center">No active trip right now. Check back once your area manager dispatches one.</Txt>
          </View>
        ) : (
        <>
        <Card containerColor={Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Col style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle, paddingRight: 10 }}>
              <Txt size={11} weight="800" color={Colors.primaryDark}>TODAY'S ROUTE</Txt>
              <Spacer size={4} />
              <Row align="center" gap={4}>
                <Txt size={36} weight="900" color={Colors.primaryDark}>{route.length}</Txt>
                <Txt size={14} weight="900" color={Colors.textPrimary}>PGs</Txt>
              </Row>
            </Col>
            <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
              <Spacer size={4} />
              <Txt size={20} weight="900" color={Colors.success}>{completed}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Completed</Txt>
            </Col>
            <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
              <Ionicons name="radio-button-on-outline" size={24} color={Colors.success} />
              <Spacer size={4} />
              <Txt size={20} weight="900" color={Colors.success}>{current ? 1 : 0}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Current</Txt>
            </Col>
            <Col align="center" style={{ flex: 1 }}>
              <Ionicons name="ellipse-outline" size={24} color={Colors.warning} />
              <Spacer size={4} />
              <Txt size={20} weight="900" color={Colors.warning}>{pending}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Remaining</Txt>
            </Col>
          </Row>
          <Spacer size={20} />
          <Row justify="space-between" align="center">
            <Txt size={11} weight="700" color={Colors.textSecondary}>Route Progress</Txt>
            <Txt size={12} weight="800" color={Colors.primaryDark}>{progressPct}%</Txt>
          </Row>
          <Spacer size={8} />
          <View style={[styles.progressTrack, { height: 8, backgroundColor: Colors.surfaceElevated }]}><View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: Colors.primary, borderRadius: 4 }]} /></View>
        </Card>

          {current && (
            <Col>
              <Spacer size={4} />
              <Card containerColor={Colors.primaryDark} borderRadius={Radii.xl} padding={[20, 16]} style={{ shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6, overflow: 'hidden' }}>
                <Ionicons name="map-outline" size={140} color="rgba(255,255,255,0.06)" style={{ position: 'absolute', right: -30, top: -20, transform: [{ rotate: '15deg' }] }} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <Txt size={10} weight="800" color="#FFFFFF">NEXT DELIVERY</Txt>
                </View>
                <Spacer size={16} />
                <Row align="center" justify="space-between">
                  <Row gap={12} align="center">
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt size={24} weight="900" color={Colors.primaryDark}>{String(route.indexOf(current) + 1).padStart(2, '0')}</Txt>
                    </View>
                    <Col>
                      <Txt size={20} weight="900" color="#FFFFFF" numberOfLines={1}>{current.pg_name}</Txt>
                      <Spacer size={6} />
                      <Row align="center" gap={6}>
                        <Ionicons name="location-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={13} color={Colors.borderSubtle} numberOfLines={1}>{current.pg_address}</Txt>
                      </Row>
                      <Spacer size={2} />
                      <Row gap={6} align="center">
                        <Ionicons name="cube-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={14} weight="800" color="#FFFFFF">{current.item_count} Items</Txt>
                      </Row>
                      <Spacer size={10} />
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 }} />
                        <Txt size={10} weight="700" color="#10B981">Ready for Delivery</Txt>
                      </View>
                    </Col>
                  </Row>
                </Row>

                <Spacer size={24} />
                <Row gap={12}>
                  <Btn onPress={() => setActiveDeliveryId(current.id)} containerColor="#FFFFFF" textColor={Colors.primaryDark} borderRadius={Radii.lg} height={48} style={{ flex: 1 }}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.primaryDark} style={{ marginRight: 6 }} />
                    <Txt size={14} weight="900" color={Colors.primaryDark}>View Delivery</Txt>
                  </Btn>
                  <Btn onPress={() => _openInMaps(current.pg_address)} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={Radii.lg} height={48} style={{ flex: 1, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                    <Ionicons name="navigate-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Txt size={14} weight="900" color="#FFFFFF">Navigate</Txt>
                  </Btn>
                </Row>
              </Card>
            </Col>
          )}

        <Row justify="space-between" align="center" style={{ marginTop: 12 }}>
          <Col>
            <Txt size={14} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>DELIVERY ROUTE</Txt>
            <Txt size={12} color={Colors.textMuted}>Stop order</Txt>
          </Col>
        </Row>

        <Col gap={0} style={{ paddingLeft: 4 }}>
          {route.map((r, i) => {
            const isCompleted = _isTerminal(r.status);
            const isCurrent = current?.id === r.id;
            const isPending = !isCompleted && !isCurrent;
            const indexStr = String(i + 1).padStart(2, '0');
            const isLast = i === route.length - 1;

            return (
              <Row key={r.id} style={{ minHeight: 70 }}>
                {/* Timeline Column */}
                <Col align="center" style={{ width: 40, position: 'relative' }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 19, width: 2, backgroundColor: isCompleted || isCurrent ? '#10B981' : '#E2E8F0', zIndex: 0, marginTop: i === 0 ? 30 : 0, marginBottom: isLast ? '50%' : 0 }} />

                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: isCompleted ? Colors.success : (isCurrent ? Colors.primaryDark : '#FFFFFF'), borderWidth: isPending ? 2 : 0, borderColor: Colors.warning, alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: 26 }}>
                    {isCompleted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    {isCurrent && <Txt size={10} weight="900" color="#FFFFFF">{indexStr}</Txt>}
                  </View>
                </Col>

                {/* Card Column */}
                <Col style={{ flex: 1, paddingBottom: 12, paddingTop: 12, paddingLeft: 8 }}>
                  <TouchableOpacity onPress={() => setActiveDeliveryId(r.id)} activeOpacity={0.8}>
                    <Card containerColor={isCurrent ? Colors.surfaceElevated : Colors.surface} borderRadius={Radii.lg} borderWidth={1} borderColor={isCurrent ? Colors.primaryDark : Colors.borderSubtle} padding={[14, 14]} style={isCurrent ? { elevation: 2, shadowColor: Colors.primaryDark, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } : {}}>
                      <Row align="center" justify="space-between">
                        <Row gap={12} align="center" style={{ flex: 1 }}>
                          {!isCurrent && <Txt size={16} weight="900" color={Colors.textPrimary}>{indexStr}</Txt>}
                          <Col style={{ flex: 1 }}>
                            <Txt size={15} weight="900" color={Colors.textPrimary} numberOfLines={1}>{r.pg_name}</Txt>
                            <Row align="center" gap={4} style={{ marginTop: 4 }}>
                              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                              <Txt size={12} color={Colors.textMuted} numberOfLines={1}>{r.pg_address} · {r.item_count} items</Txt>
                            </Row>
                          </Col>
                        </Row>

                        <Col align="flex-end" style={{ marginLeft: 10 }}>
                          {isCompleted && (
                            <>
                              <View style={{ backgroundColor: Colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                <Txt size={10} weight="800" color={r.status === 'delivered' ? '#059669' : '#DC2626'}>
                                  {r.status === 'delivered' ? 'Completed' : 'Failed'}
                                </Txt>
                              </View>
                              {!!r.completed_at && (
                                <>
                                  <Spacer size={4} />
                                  <Txt size={10} weight="700" color={Colors.textMuted}>
                                    {new Date(r.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Txt>
                                </>
                              )}
                            </>
                          )}
                          {isCurrent && (
                            <View style={{ backgroundColor: Colors.primaryDark, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
                              <Txt size={10} weight="900" color="#FFFFFF">CURRENT</Txt>
                            </View>
                          )}
                          {isPending && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
                              <Txt size={10} weight="800" color="#D97706">Pending</Txt>
                            </View>
                          )}
                        </Col>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 10 }} />
                      </Row>
                    </Card>
                  </TouchableOpacity>
                </Col>
              </Row>
            );
          })}
        </Col>
        </>
        )}
      </FormScroll>
    </View>
  );
}

const Divider = ({ color }: { color: string }) => <View style={{ height: 1, backgroundColor: color }} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  emptyMealBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', padding: 16 },
  bigPortionBox: { width: 104, height: 104, borderRadius: 52, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  metricCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
  progressTrack: { height: 8, backgroundColor: '#115E59', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2DD4BF' },
  seqBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  photoPreviewBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
});
