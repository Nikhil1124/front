/** Chef dashboard "Eaters" tab or Delivery Dashboard Route */
import { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { Card, Txt, Spacer, Chip, Col, Row, Btn, IconBtn, OutlinedBtn } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { CameraProofModal } from '@/components/CameraProofModal';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import Svg, { Circle, Path, Polyline, Text as SvgText } from 'react-native-svg';

export default function ChefEatersTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryDashboardRoute />;
  return <ChefEatersView />;
}

import { useMealsQuery, useMealResponsesQuery } from '@/features/meals/useMeals';
import { useGuestsQuery } from '@/features/guests/useGuests';

/** A real Google Maps deep link — was `Alert.alert('Navigation', 'Opening Google Maps to
 *  navigate to X...')` on both call sites below, which opened nothing. `Linking.openURL`
 *  with a maps search query is a platform capability, not a backend one, so this needed no
 *  new API — just to actually call the thing the text already claimed to be doing. */
function openInMaps(query: string) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Could not open Maps', 'No maps app is available on this device.');
  });
}

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
          <Txt size={12} weight="800" color={Colors.textPrimary}>Select Active Meal to View RSVP Data</Txt>
          <Spacer size={8} />
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {notifications.map((n) => {
              const isSel = activeMeal?.id === n.id;
              return (
                <TouchableOpacity 
                  key={n.id} 
                  onPress={() => setActiveMeal(n)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isSel ? Colors.primary : Colors.surfaceMuted,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                  }}
                >
                  <Txt size={12} weight="800" color={isSel ? '#FFFFFF' : Colors.textPrimary}>{`${n.mealType} - ${n.menuItems.slice(0, 20)}`}</Txt>
                </TouchableOpacity>
              );
            })}
          </FormScroll>
          <Spacer size={16} />

          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[24, 20]}>
            <Col align="center">
              <Txt size={12} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>TOTAL PORTIONS TO PREPARE TODAY</Txt>
              <Spacer size={24} />
              <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
                <Svg height="140" width="140">
                  <Circle stroke={Colors.surfaceElevated} fill="transparent" strokeWidth={6} r={64} cx="70" cy="70" />
                  <Circle stroke={Colors.primary} fill="transparent" strokeWidth={6} strokeDasharray={402 + ' ' + 402} strokeDashoffset={0} strokeLinecap="round" r={64} cx="70" cy="70" />
                </Svg>
                <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={46} weight="900" color={Colors.primaryDark}>{reqCount}</Txt>
                </View>
              </View>
              <Spacer size={16} />
              <Txt size={13} weight="800" color={Colors.textPrimary} align="center">Active Menu: {activeMeal?.menuItems}</Txt>
            </Col>
          </Card>

          <Spacer size={16} />
          <Row gap={12}>
            <View style={[styles.metricCard, { backgroundColor: '#F0F9FF', borderColor: '#E0F2FE' }]}>
              <Txt size={10} weight="800" color="#0369A1">EATING</Txt>
              <Spacer size={10} />
              <Txt size={32} weight="900" color="#0EA5E9">{reqCount}</Txt>
              <Row gap={4} align="center" style={{ marginTop: 6 }}>
                <Ionicons name="people" size={14} color="#0EA5E9" />
                <Txt size={11} weight="800" color="#0284C7">87.5%</Txt>
              </Row>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
              <Txt size={10} weight="800" color="#B91C1C">SKIPPED / SAVED</Txt>
              <Spacer size={10} />
              <Txt size={32} weight="900" color={Colors.danger}>{notReqCount}</Txt>
              <Row gap={4} align="center" style={{ marginTop: 6 }}>
                <Ionicons name="close" size={14} color={Colors.danger} />
                <Txt size={11} weight="800" color="#991B1B">8.3%</Txt>
              </Row>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
              <Txt size={10} weight="800" color="#B45309">NO REPLY</Txt>
              <Spacer size={10} />
              <Txt size={32} weight="900" color={Colors.warning}>{noResponse}</Txt>
              <Row gap={4} align="center" style={{ marginTop: 6 }}>
                <Ionicons name="time-outline" size={14} color="#B45309" />
                <Txt size={11} weight="800" color="#92400E">4.2%</Txt>
              </Row>
            </View>
          </Row>

          <Spacer size={32} />
          <Row justify="space-between" align="center">
            <Row align="center" gap={6}>
              <Txt size={15} weight="900" color={Colors.textPrimary}>RSVP Trend</Txt>
              <Txt size={13} weight="600" color={Colors.textSecondary}>(Last 7 Days)</Txt>
            </Row>
            <Row align="center" gap={4}>
              <Txt size={13} weight="800" color={Colors.primary}>View Details</Txt>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </Row>
          </Row>
          
          <Spacer size={20} />
          <View style={{ height: 160, width: '100%' }}>
            <Svg height="100%" width="100%" viewBox="0 0 300 120" preserveAspectRatio="none">
              {/* Grid lines */}
              <Path d="M 0 20 L 300 20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 0 60 L 300 60" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 0 100 L 300 100" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
              
              {/* Y axis labels */}
              <SvgText x="0" y="24" fill={Colors.textMuted} fontSize="10" fontWeight="bold">60</SvgText>
              <SvgText x="0" y="64" fill={Colors.textMuted} fontSize="10" fontWeight="bold">40</SvgText>
              <SvgText x="0" y="104" fill={Colors.textMuted} fontSize="10" fontWeight="bold">20</SvgText>
              <SvgText x="0" y="120" fill={Colors.textMuted} fontSize="10" fontWeight="bold">0</SvgText>

              {/* Area fill */}
              <Path d="M 30 90 L 70 70 L 110 65 L 150 40 L 190 70 L 230 45 L 270 30 L 270 120 L 30 120 Z" fill="rgba(88, 86, 214, 0.05)" />
              
              {/* Line */}
              <Polyline points="30,90 70,70 110,65 150,40 190,70 230,45 270,30" fill="none" stroke={Colors.primary} strokeWidth="2.5" />
              
              {/* Data points */}
              <Circle cx="30" cy="90" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="70" cy="70" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="110" cy="65" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="150" cy="40" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="190" cy="70" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="230" cy="45" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />
              <Circle cx="270" cy="30" r="4.5" fill="#FFFFFF" stroke={Colors.primary} strokeWidth="2" />

              {/* End tooltip */}
              <Path d="M 258 4 L 282 4 C 284 4 286 6 286 8 L 286 18 C 286 20 284 22 282 22 L 258 22 C 256 22 254 20 254 18 L 254 8 C 254 6 256 4 258 4 Z" fill={Colors.primary} />
              <SvgText x="270" y="16.5" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">48</SvgText>
            </Svg>

            <Row justify="space-between" style={{ marginTop: 10, paddingLeft: 24, paddingRight: 10 }}>
              {['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'].map((day, idx) => (
                <Txt key={day} size={11} weight={idx === 6 ? '900' : '700'} color={idx === 6 ? Colors.primaryDark : Colors.textMuted}>{day}</Txt>
              ))}
            </Row>
          </View>

          <Spacer size={32} />
          <Txt size={15} weight="900" color={Colors.textPrimary}>Today's Top Skipped Items</Txt>
          <Spacer size={12} />
          <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[4, 16]}>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }}>
              <Row gap={12} align="center">
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textPrimary }} />
                <Txt size={14} weight="700" color={Colors.textPrimary}>Dosa</Txt>
              </Row>
              <Txt size={13} weight="800" color={Colors.danger}>3 skips</Txt>
            </Row>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <Row gap={12} align="center">
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textPrimary }} />
                <Txt size={14} weight="700" color={Colors.textPrimary}>Idli</Txt>
              </Row>
              <Txt size={13} weight="800" color={Colors.danger}>1 skip</Txt>
            </Row>
          </Card>

        </>
      )}
    </FormScroll>
  );
}

import {
  useMyTripsQuery,
  useDepartTripMutation,
  useCompleteStopMutation,
  getStopPhotoUploadUrl,
  uploadToPresignedUrl,
} from '@/features/staff/useTrips';


function DeliveryDashboardRoute() {
  const staff = usePGowStore((s) => s.loggedInStaff);
  const { data: realTrips = [], refetch, isLoading: tripsLoading, error: tripsError } = useMyTripsQuery();
  const departTripMut = useDepartTripMutation();
  const completeStopMut = useCompleteStopMutation();

  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // No fallback route. This used to drop to a MOCK_ROUTE of five invented PGs — complete
  // with invented recipient names and phone numbers — whenever the agent had no assigned
  // trip, rendered identically to live stops. An agent with nothing to deliver has to see
  // that, not a fictional round they might try to drive.
  const activeTrip =
    realTrips.find((t) => t.status === 'active' || t.status === 'planned') ?? realTrips[0] ?? null;

  const route = activeTrip
    ? activeTrip.stops.map((stop, i) => {
        // Map stop statuses: first pending stop in an active trip is 'Current'
        let mappedStatus = 'Pending';
        if (stop.status === 'completed' || stop.status === 'delivered') {
          mappedStatus = 'Completed';
        } else if (activeTrip.status === 'active') {
          // If active, the first non-completed stop is 'Current'
          const firstNonCompleted = activeTrip.stops.find(s => s.status !== 'completed' && s.status !== 'delivered');
          if (firstNonCompleted && firstNonCompleted.id === stop.id) {
            mappedStatus = 'Current';
          }
        }
        return {
          id: stop.order_id,
          pgName: stop.pg_name,
          location: stop.pg_address,
          orders: stop.item_count,
          status: mappedStatus,
          time: stop.completed_at ? new Date(stop.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          recipient: stop.recipient_name,
          phone: stop.recipient_phone,
        };
      })
    : [];

  const completed = route.filter(r => r.status === 'Completed').length;
  const pending = route.filter(r => r.status === 'Pending').length;
  const current = route.find(r => r.status === 'Current');
  const progressPct = route.length > 0 ? Math.round((completed / route.length) * 100) : 0;

  const activeDelivery = route.find(r => r.id === activeDeliveryId);

  const handleCapture = async (uri: string) => {
    setPhotoUri(uri);
    setCameraOpen(false);
  };

  const handleDepart = async () => {
    if (!activeTrip) return;
    try {
      await departTripMut.mutateAsync(activeTrip.id);
      Alert.alert('Trip Started', 'Route is now active. Drive safely!');
    } catch (err: any) {
      Alert.alert('Error starting trip', err?.message || 'Could not depart.');
    }
  };

  const confirmDelivery = async () => {
    if (!activeDelivery) return;
    if (activeTrip) {
      setConfirming(true);
      try {
        let proofKey: string | null = null;
        if (photoUri) {
          const { upload_url, object_key } = await getStopPhotoUploadUrl(activeTrip.id, activeDelivery.id);
          await uploadToPresignedUrl(upload_url, photoUri, 'image/jpeg');
          proofKey = object_key;
        }
        await completeStopMut.mutateAsync({
          tripId: activeTrip.id,
          orderId: activeDelivery.id,
          params: { outcome: 'delivered', proof_photo_key: proofKey }
        });
        hapticSuccess();
        Alert.alert('Delivery Confirmed', `Stop completed for ${activeDelivery.pgName}.`);
        setActiveDeliveryId(null);
        setPhotoUri(null);
      } catch (err: any) {
        hapticError();
        Alert.alert('Failed to complete delivery', err?.message || 'Could not save.');
      } finally {
        setConfirming(false);
      }
    } else {
      // Fallback for mock route
      setActiveDeliveryId(null);
      setPhotoUri(null);
      Alert.alert('Mock Success', 'Delivery confirmed mock-style.');
    }
  };

  if (activeDelivery) {
    return (
      <View style={styles.root}>
        <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
          <Row align="center" gap={10}>
             <IconBtn onPress={() => setActiveDeliveryId(null)} icon="arrow-back" size={20} tint={Colors.primaryDark} containerColor={Colors.surfaceElevated} borderRadius={999} padding={8} />
             <Txt variant="screenTitle" weight="900" color={Colors.primaryDark}>Delivery #{activeDelivery.id.slice(0, 4)}</Txt>
          </Row>
          
          <Card containerColor={Colors.surface} borderRadius={Radii.xxl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{activeDelivery.pgName}</Txt>
            <Txt variant="caption" color={Colors.textMuted}>{activeDelivery.location}</Txt>
            <Spacer size={12} />
            <Btn onPress={() => openInMaps(activeDelivery.location || activeDelivery.pgName)} containerColor={Colors.surfaceElevated} textColor={Colors.primary} borderRadius={8} height={40}>
              <Ionicons name="navigate" size={16} color={Colors.primary} />
              <Txt size={13} weight="800" style={{ marginLeft: 6 }}>Open in Google Maps</Txt>
            </Btn>
            <Spacer size={16} />
            <Divider color={Colors.borderSubtle} />
            <Spacer size={16} />
            <Row justify="space-between">
              <Col>
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Recipient</Txt>
                <Txt size={14} weight="800" color={Colors.textPrimary}>{activeDelivery.recipient}</Txt>
                <Txt size={12} color={Colors.textMuted}>{activeDelivery.phone}</Txt>
              </Col>
              <Col align="flex-end">
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Orders</Txt>
                <Txt size={24} weight="900" color={Colors.primary}>{activeDelivery.orders}</Txt>
              </Col>
            </Row>
            <Spacer size={16} />
            <View style={[styles.statusPill, { backgroundColor: activeDelivery.status === 'Completed' ? '#F0FDF4' : '#FFFBEB' }]}>
              <Txt size={12} weight="800" color={activeDelivery.status === 'Completed' ? Colors.success : Colors.tertiary}>
                {activeDelivery.status === 'Completed' ? `✓ Delivered at ${activeDelivery.time}` : '● Out for Delivery'}
              </Txt>
            </View>
            
            {activeDelivery.status !== 'Completed' && (
              <>
                <Spacer size={20} />
                <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>Proof of Delivery</Txt>
                <Txt variant="caption" color={Colors.textMuted}>Photograph must show delivered products & recipient.</Txt>
                <Spacer size={10} />
                
                {photoUri ? (
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
                <Btn onPress={confirmDelivery} disabled={!photoUri || confirming} loading={confirming} containerColor={photoUri ? Colors.success : Colors.surfaceMuted} textColor={photoUri ? '#FFF' : Colors.textMuted} borderRadius={Radii.lg} height={50}>
                  <Txt size={15} weight="900">Confirm Delivery</Txt>
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
        <Txt size={18} weight="900" color={Colors.primaryDark}>Good Morning, {staff?.name?.split(' ')[0] ?? 'Rahul'} 👋</Txt>
        
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

        {activeTrip && activeTrip.status === 'planned' && (
          <>
            <Spacer size={12} />
            <Btn onPress={handleDepart} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={Radii.lg} height={48} loading={departTripMut.isPending}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Txt size={14} weight="900" color="#FFFFFF">Depart Warehouse &amp; Start Trip</Txt>
            </Btn>
          </>
        )}

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
                      <Txt size={20} weight="900" color="#FFFFFF" numberOfLines={1}>{current.pgName}</Txt>
                      <Spacer size={6} />
                      <Row align="center" gap={6}>
                        <Ionicons name="location-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={13} color={Colors.borderSubtle}>{current.location.split(',').slice(-2)[0].trim()}, Bangalore</Txt>
                      </Row>
                      <Spacer size={2} />
                      <Row gap={6} align="center">
                        <Ionicons name="cube-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={14} weight="800" color="#FFFFFF">{current.orders} Orders</Txt>
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
                  <Btn onPress={() => openInMaps(current.location || current.pgName)} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={Radii.lg} height={48} style={{ flex: 1, borderWidth: 1, borderColor: Colors.borderSubtle }}>
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
            <Txt size={12} color={Colors.textMuted}>Largest orders first</Txt>
          </Col>
          <OutlinedBtn onPress={() => Alert.alert('Not available yet', 'A combined route map is planned but not built. Tap a stop above to open it in Maps individually.')} borderColor={Colors.borderSubtle} textColor={Colors.primaryDark} height={32}>
            <Ionicons name="map-outline" size={14} color={Colors.primaryDark} style={{ marginRight: 6 }} />
            <Txt size={12} weight="800" color={Colors.primaryDark}>View on Map</Txt>
          </OutlinedBtn>
        </Row>

        {tripsLoading || tripsError || route.length === 0 ? (
          <EmptyState
            icon="bicycle-outline"
            title="No deliveries assigned"
            subtitle="When a trip is planned for you it will appear here with every stop on the round."
            accent={Colors.primary}
            loading={tripsLoading}
            error={tripsError}
            onRetry={refetch}
          />
        ) : null}

        <Col gap={0} style={{ paddingLeft: 4 }}>
          {route.map((r, i) => {
            const isCompleted = r.status === 'Completed';
            const isCurrent = r.status === 'Current';
            const isPending = r.status === 'Pending';
            const area = r.location.split(',').slice(-2)[0].trim();
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
                            <Txt size={15} weight="900" color={Colors.textPrimary} numberOfLines={1}>{r.pgName}</Txt>
                            <Row align="center" gap={4} style={{ marginTop: 4 }}>
                              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                              <Txt size={12} color={Colors.textMuted} numberOfLines={1}>{area} · {r.orders} orders</Txt>
                            </Row>
                          </Col>
                        </Row>
                        
                        <Col align="flex-end" style={{ marginLeft: 10 }}>
                          {isCompleted && (
                            <>
                              <View style={{ backgroundColor: Colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                <Txt size={10} weight="800" color={Colors.success}>Completed</Txt>
                              </View>
                              <Spacer size={4} />
                              <Txt size={10} weight="700" color={Colors.textMuted}>{r.time}</Txt>
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
  progressTrack: { height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  seqBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  photoPreviewBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
});
