/** Chef dashboard "Eaters" tab or Delivery Dashboard Route */
import { useState } from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';

import {
  Card, Txt, Spacer, Col, Row, Btn, IconBtn, OutlinedBtn, StatusChip,
  AnimatedPress } from '@/components/ui';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';
import { FormScroll } from '@/components/ui/FormScroll';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { CameraProofModal } from '@/components/CameraProofModal';
import { Ionicons } from '@expo/vector-icons';
import { getGreeting } from '@/utils/format';
import { useToast } from '@/hooks/useToast';
import { openInMaps } from '@/utils/maps';

export default function ChefEatersTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryDashboardRoute />;
  return <ChefEatersView />;
}

import { useMealsQuery, useMealResponsesQuery, useBroadcastMealMutation } from '@/features/meals/useMeals';


function ChefEatersView() {
  const dockScroll = useDockScroll();
  const activePgId = useAuthStore((s) => s.activePgId);
  const toast = useToast();
  const broadcastMutation = useBroadcastMealMutation(activePgId ?? undefined);

  const { data: notifications = [] } = useMealsQuery(activePgId ?? undefined);
  const { activeMeal, setActiveMeal } = useActiveMeal();
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);

  // Stats
  const reqCount = mealResponses.filter((r) => r.choice === 'eating').length;
  const notReqCount = mealResponses.filter((r) => r.choice === 'skipping').length;
  const noResponse = mealResponses.filter((r) => r.choice === null && !r.is_away).length;
  const pendingReplies = mealResponses
    .filter((r) => r.choice === null)
    .sort((a, b) => Number(a.is_away) - Number(b.is_away) || a.name.localeCompare(b.name));

  const handleResendBroadcast = async () => {
    if (!activeMeal?.id) return;
    try {
      await broadcastMutation.mutateAsync({ mealId: activeMeal.id, params: { kind: 'announce' } });
      toast('success', 'Sent', 'Broadcast notification resent successfully!');
    } catch (e: any) {
      toast('error', 'Failed to resend', e.message);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const FOOD_BG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";

  return (
    <View style={styles.root}>
      <FormScroll {...dockScroll} contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 24 }}>
        
        {/* Groceries Banner */}
        <ChefGroceriesShortcut />

        {/* Today's Meals Navigation */}
        <Col gap={16}>
          <Row justify="space-between" align="center">
            <Txt size={18} weight="800" color={Colors.textPrimary}>Today's Meals</Txt>
            <Row align="center" gap={6}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Txt size={13} weight="700" color={Colors.textSecondary}>{todayStr}</Txt>
            </Row>
          </Row>
          
          <Row gap={10}>
            {notifications.slice(0,3).map((n) => {
              const isSel = activeMeal?.id === n.id;
              const iconName = n.mealType.toLowerCase().includes('lunch') ? 'sunny' : n.mealType.toLowerCase().includes('dinner') ? 'moon' : 'partly-sunny';
              return (
                <AnimatedPress key={n.id} onPress={() => setActiveMeal(n)} style={[styles.mealTab, isSel ? styles.mealTabOn : styles.mealTabOff]}>
                  <Ionicons name={iconName} size={16} color={isSel ? Colors.textInverse : Colors.textPrimary} style={{ marginRight: 6 }} />
                  <Txt size={14} weight="700" color={isSel ? Colors.textInverse : Colors.textPrimary}>{n.mealType}</Txt>
                </AnimatedPress>
              );
            })}
          </Row>
        </Col>

        {/* Active Meal Card */}
        {activeMeal ? (
          <Card containerColor={Colors.surface} borderRadius={20} padding={[0,0]} style={styles.activeMealCard}>
            <ImageBackground source={{ uri: FOOD_BG }} style={styles.mealImagePlaceholder} imageStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <View style={styles.darkGradientOverlay} />
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Txt size={10} weight="800" color={Colors.textInverse} style={{ letterSpacing: 0.5 }}>ACTIVE</Txt>
              </View>
              <View style={{ position: 'absolute', bottom: 12, left: 16 }}>
                 <Txt size={22} weight="800" color={Colors.textInverse}>{activeMeal.mealType}</Txt>
                 <Row align="center" gap={4} style={{ marginTop: 2 }}>
                   <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                   <Txt size={12} weight="700" color="rgba(255,255,255,0.9)">12:00 PM - 2:00 PM</Txt>
                 </Row>
              </View>
            </ImageBackground>
            <View style={{ padding: 16 }}>
              <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={2} style={{ lineHeight: 20 }}>{activeMeal.menuItems}</Txt>
              
              <View style={styles.divider} />
              
              <Row justify="space-between" align="center">
                <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
                  <Txt size={24} weight="800" color={Colors.success}>{reqCount}</Txt>
                  <Txt size={10} weight="700" color={Colors.textSecondary} style={{ marginTop: 2, letterSpacing: 1 }}>EATING</Txt>
                </Col>
                <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
                  <Txt size={24} weight="800" color={Colors.warning}>{notReqCount}</Txt>
                  <Txt size={10} weight="700" color={Colors.textSecondary} style={{ marginTop: 2, letterSpacing: 1 }}>SKIPPING</Txt>
                </Col>
                <Col align="center" style={{ flex: 1 }}>
                  <Txt size={24} weight="800" color={Colors.textMuted}>{noResponse}</Txt>
                  <Txt size={10} weight="700" color={Colors.textSecondary} style={{ marginTop: 2, letterSpacing: 1 }}>NO REPLY</Txt>
                </Col>
              </Row>
              
              <Spacer size={16} />
              <Btn onPress={() => {}} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.pill} height={44} style={{ shadowColor: Colors.primary, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
                <Txt size={14} weight="800" color={Colors.textInverse}>View RSVP Details</Txt>
                <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} style={{ marginLeft: 6 }} />
              </Btn>
            </View>
          </Card>
        ) : (
          <EmptyState icon="restaurant-outline" title="No active meals" subtitle="Use 'Menu' tab to create a meal." />
        )}



        {/* Pending RSVPs */}
        {pendingReplies.length > 0 && (
          <Col gap={16}>
            <Row justify="space-between" align="center">
              <Txt size={18} weight="800" color={Colors.textPrimary}>Pending RSVP's</Txt>
              <AnimatedPress onPress={handleResendBroadcast} disabled={broadcastMutation.isPending}>
                <Row align="center" gap={6} style={{ backgroundColor: Colors.brandPale, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill }}>
                  <Ionicons name="notifications-outline" size={14} color={Colors.primaryDark} />
                  <Txt size={13} weight="800" color={Colors.primaryDark}>{broadcastMutation.isPending ? 'Sending...' : 'Remind All'}</Txt>
                </Row>
              </AnimatedPress>
            </Row>
            
            <Card containerColor={Colors.surface} borderRadius={24} padding={[0, 0]} style={styles.shadowCard}>
              {pendingReplies.slice(0,5).map((r, i) => (
                <View key={r.membership_id} style={[styles.pendingRow, i !== pendingReplies.slice(0,5).length - 1 && { borderBottomWidth: 1, borderColor: Colors.borderSubtle }]}>
                  <Row align="center" gap={14} style={{ flex: 1 }}>
                    <View style={styles.initialsBox}><Txt size={16} weight="800" color={Colors.primaryDark}>{r.name[0]}</Txt></View>
                    <Col>
                      <Txt size={15} weight="800" color={Colors.textPrimary}>{r.name}</Txt>
                      <Txt size={13} weight="600" color={Colors.textSecondary} style={{ marginTop: 2 }}>{r.room_no ? `Room ${r.room_no}` : 'No room assigned'}</Txt>
                    </Col>
                  </Row>
                  <Row align="center" gap={10}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.is_away ? Colors.info : Colors.warning }} />
                    <Txt size={13} weight="700" color={r.is_away ? Colors.info : Colors.textSecondary}>{r.is_away ? 'Away' : 'No reply'}</Txt>
                    <Ionicons name="chevron-forward" size={18} color={Colors.borderSubtle} style={{ marginLeft: 6 }} />
                  </Row>
                </View>
              ))}
            </Card>
          </Col>
        )}
      </FormScroll>
    </View>
  );
}

import {
  useMyTripsQuery,
  useDepartTripMutation,
  useCompleteStopMutation,
  getStopPhotoUploadUrl,
  uploadToPresignedUrl } from '@/features/staff/useTrips';


function DeliveryDashboardRoute() {
  const dockScroll = useDockScroll();
  const staff = usePGowStore((s) => s.loggedInStaff);
  const { data: realTrips = [], refetch, isLoading: tripsLoading, error: tripsError } = useMyTripsQuery();
  const departTripMut = useDepartTripMutation();
  const completeStopMut = useCompleteStopMutation();

  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  // No fallback route. This used to drop to a MOCK_ROUTE of five invented PGs — complete
  // with invented recipient names and phone numbers — whenever the agent had no assigned
  // trip, rendered identically to live stops. An agent with nothing to deliver has to see
  // that, not a fictional round they might try to drive.
  const activeTrip =
    realTrips.find((t) => t.status === 'active' || t.status === 'planned') ?? realTrips[0] ?? null;

  const route = activeTrip
    ? activeTrip.stops.map((stop, _i) => {
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
          phone: stop.recipient_phone };
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
      toast('success', 'Trip started', 'Route is now active. Drive safely!');
    } catch (err: any) {
      toast('error', 'Could not start trip', err?.message || 'Please try again.');
    }
  };

  const confirmDelivery = async () => {
    // `route` is [] without a trip, so an `activeDelivery` implies an `activeTrip`.
    if (!activeDelivery || !activeTrip) return;
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
      toast('success', 'Delivery confirmed', `Stop completed for ${activeDelivery.pgName}.`);
      setActiveDeliveryId(null);
      setPhotoUri(null);
    } catch (err: any) {
      toast('error', 'Could not complete delivery', err?.message || 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  if (activeDelivery) {
    return (
      <View style={styles.root}>
        <FormScroll {...dockScroll} contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
          <Row align="center" gap={10}>
             <IconBtn onPress={() => setActiveDeliveryId(null)} icon="arrow-back" size={20} tint={Colors.primaryDark} containerColor={Colors.surfaceElevated} borderRadius={Radii.pill} padding={8} />
             <Txt variant="screenTitle" weight="700" color={Colors.primaryDark}>Delivery #{activeDelivery.id.slice(0, 4)}</Txt>
          </Row>
          
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt variant="cardTitle" weight="700" color={Colors.textPrimary} numberOfLines={2}>{activeDelivery.pgName}</Txt>
            <Txt variant="caption" color={Colors.textMuted} numberOfLines={2}>{activeDelivery.location}</Txt>
            <Spacer size={12} />
            <Btn onPress={() => openInMaps(activeDelivery.location || activeDelivery.pgName)} containerColor={Colors.surfaceElevated} textColor={Colors.primary} borderRadius={Radii.control} height={40}>
              <Ionicons name="navigate" size={16} color={Colors.primary} />
              <Txt size={13} weight="700" style={{ marginLeft: 6 }}>Open in Google Maps</Txt>
            </Btn>
            <Spacer size={16} />
            <Divider color={Colors.borderSubtle} />
            <Spacer size={16} />
            <Row justify="space-between">
              <Col>
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Recipient</Txt>
                <Txt size={14} weight="700" color={Colors.textPrimary}>{activeDelivery.recipient}</Txt>
                <Txt size={12} color={Colors.textMuted}>{activeDelivery.phone}</Txt>
              </Col>
              <Col align="flex-end">
                <Txt variant="caption" weight="700" color={Colors.textSecondary}>Orders</Txt>
                <Txt size={24} weight="700" color={Colors.primary}>{activeDelivery.orders}</Txt>
              </Col>
            </Row>
            <Spacer size={16} />
            <View style={[styles.statusPill, { backgroundColor: activeDelivery.status === 'Completed' ? Palette.TintGreen : Palette.TintAmber }]}>
              <Txt size={12} weight="700" color={activeDelivery.status === 'Completed' ? Colors.success : Colors.tertiary}>
                {activeDelivery.status === 'Completed' ? `✓ Delivered at ${activeDelivery.time}` : '● Out for Delivery'}
              </Txt>
            </View>
            
            {activeDelivery.status !== 'Completed' && (
              <>
                <Spacer size={20} />
                <Txt variant="cardTitle" weight="700" color={Colors.textPrimary}>Proof of Delivery</Txt>
                <Txt variant="caption" color={Colors.textMuted}>Photograph must show delivered products & recipient.</Txt>
                <Spacer size={10} />
                
                {photoUri ? (
                  <View style={styles.photoPreviewBox}>
                    <Ionicons name="image-outline" size={32} color={Colors.primary} />
                    <Txt size={12} weight="700" color={Colors.textPrimary}>Photo captured</Txt>
                    <Spacer size={10} />
                    <Btn onPress={() => setCameraOpen(true)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={Radii.control}>
                      <Txt size={12} weight="700">Retake Photo</Txt>
                    </Btn>
                  </View>
                ) : (
                  <Btn onPress={() => setCameraOpen(true)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={Radii.control} height={60}>
                    <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                    <Txt size={14} weight="700" style={{ marginLeft: 8 }}>Take Photo</Txt>
                  </Btn>
                )}
                
                <Spacer size={16} />
                <Btn onPress={confirmDelivery} disabled={!photoUri || confirming} loading={confirming} containerColor={photoUri ? Colors.success : Colors.surfaceMuted} textColor={photoUri ? Colors.textInverse : Colors.textMuted} borderRadius={Radii.control} height={50}>
                  <Txt size={15} weight="700">Confirm Delivery</Txt>
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
      <FormScroll {...dockScroll} contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 16 }}>
        <Txt size={18} weight="700" color={Colors.primaryDark}>{getGreeting()}, {staff?.name?.split(' ')[0] || 'there'} 👋</Txt>
        
        <Card containerColor={Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Col style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle, paddingRight: 10 }}>
              <Txt size={11} weight="700" color={Colors.primaryDark}>TODAY'S ROUTE</Txt>
              <Spacer size={4} />
              <Row align="center" gap={4}>
                <Txt size={36} weight="700" color={Colors.primaryDark}>{route.length}</Txt>
                <Txt size={14} weight="700" color={Colors.textPrimary}>PGs</Txt>
              </Row>
            </Col>
            <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
              <Spacer size={4} />
              <Txt size={20} weight="700" color={Colors.success}>{completed}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Completed</Txt>
            </Col>
            <Col align="center" style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.borderSubtle }}>
              <Ionicons name="radio-button-on-outline" size={24} color={Colors.success} />
              <Spacer size={4} />
              <Txt size={20} weight="700" color={Colors.success}>{current ? 1 : 0}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Current</Txt>
            </Col>
            <Col align="center" style={{ flex: 1 }}>
              <Ionicons name="ellipse-outline" size={24} color={Colors.warning} />
              <Spacer size={4} />
              <Txt size={20} weight="700" color={Colors.warning}>{pending}</Txt>
              <Txt size={10} weight="600" color={Colors.textSecondary}>Remaining</Txt>
            </Col>
          </Row>
          <Spacer size={20} />
          <Row justify="space-between" align="center">
            <Txt size={11} weight="700" color={Colors.textSecondary}>Route Progress</Txt>
            <Txt size={12} weight="700" color={Colors.primaryDark}>{progressPct}%</Txt>
          </Row>
          <Spacer size={8} />
          <View style={[styles.progressTrack, { height: 8, backgroundColor: Colors.surfaceElevated }]}><View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: Colors.primary, borderRadius: Radii.badge }]} /></View>
        </Card>

        {activeTrip && activeTrip.status === 'planned' && (
          <>
            <Spacer size={12} />
            <Btn onPress={handleDepart} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={48} loading={departTripMut.isPending}>
              <Ionicons name="play" size={18} color={Colors.textInverse} style={{ marginRight: 6 }} />
              <Txt size={14} weight="700" color={Colors.textInverse}>Depart Warehouse &amp; Start Trip</Txt>
            </Btn>
          </>
        )}

          {current && (
            <Col>
              <Spacer size={4} />
              <Card containerColor={Colors.primaryDark} borderRadius={Radii.card} padding={[20, 16]} style={{ shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6, overflow: 'hidden' }}>
                <Ionicons name="map-outline" size={140} color="rgba(255,255,255,0.06)" style={{ position: 'absolute', right: -30, top: -20, transform: [{ rotate: '15deg' }] }} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.card, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <Txt size={10} weight="700" color={Colors.textInverse}>NEXT DELIVERY</Txt>
                </View>
                <Spacer size={16} />
                <Row align="center" justify="space-between">
                  <Row gap={12} align="center">
                    <View style={{ backgroundColor: Colors.surface, borderRadius: Radii.control, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt size={24} weight="700" color={Colors.primaryDark}>{String(route.indexOf(current) + 1).padStart(2, '0')}</Txt>
                    </View>
                    <Col>
                      <Txt size={20} weight="700" color={Colors.textInverse} numberOfLines={1}>{current.pgName}</Txt>
                      <Spacer size={6} />
                      <Row align="center" gap={6}>
                        <Ionicons name="location-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={13} color={Colors.borderSubtle}>{current.location.split(',').slice(-2).join(',').trim()}</Txt>
                      </Row>
                      <Spacer size={2} />
                      <Row gap={6} align="center">
                        <Ionicons name="cube-outline" size={14} color={Colors.borderSubtle} />
                        <Txt size={14} weight="700" color={Colors.textInverse}>{current.orders} Orders</Txt>
                      </Row>
                      <Spacer size={10} />
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: Colors.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.card, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: Radii.pill, backgroundColor: Colors.success, marginRight: 6 }} />
                        <Txt size={10} weight="700" color={Colors.success}>Ready for Delivery</Txt>
                      </View>
                    </Col>
                  </Row>
                </Row>
                
                <Spacer size={24} />
                <Row gap={12}>
                  <Btn onPress={() => setActiveDeliveryId(current.id)} containerColor={Colors.surface} textColor={Colors.primaryDark} borderRadius={Radii.control} height={48} style={{ flex: 1 }}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.primaryDark} style={{ marginRight: 6 }} />
                    <Txt size={14} weight="700" color={Colors.primaryDark}>View Delivery</Txt>
                  </Btn>
                  <Btn onPress={() => openInMaps(current.location || current.pgName)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={48} style={{ flex: 1, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                    <Ionicons name="navigate-outline" size={18} color={Colors.textInverse} style={{ marginRight: 6 }} />
                    <Txt size={14} weight="700" color={Colors.textInverse}>Navigate</Txt>
                  </Btn>
                </Row>
              </Card>
            </Col>
          )}

        <Row justify="space-between" align="center" style={{ marginTop: 12 }}>
          <Col>
            <Txt size={14} weight="700" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>DELIVERY ROUTE</Txt>
            <Txt size={12} color={Colors.textMuted}>Largest orders first</Txt>
          </Col>
          <OutlinedBtn onPress={() => toast('info', 'Not available yet', 'A combined route map is planned but not built. Tap a stop above to open it in Maps individually.')} borderColor={Colors.borderSubtle} textColor={Colors.primaryDark} height={32}>
            <Ionicons name="map-outline" size={14} color={Colors.primaryDark} style={{ marginRight: 6 }} />
            <Txt size={12} weight="700" color={Colors.primaryDark}>View on Map</Txt>
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
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 19, width: 2, backgroundColor: isCompleted || isCurrent ? Colors.success : Colors.borderMuted, zIndex: 0, marginTop: i === 0 ? 30 : 0, marginBottom: isLast ? '50%' : 0 }} />
                  
                  <View style={{ width: 26, height: 26, borderRadius: Radii.pill, backgroundColor: isCompleted ? Colors.success : (isCurrent ? Colors.primaryDark : Colors.textInverse), borderWidth: isPending ? 2 : 0, borderColor: Colors.warning, alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: 26 }}>
                    {isCompleted && <Ionicons name="checkmark" size={16} color={Colors.textInverse} />}
                    {isCurrent && <Txt size={10} weight="700" color={Colors.textInverse}>{indexStr}</Txt>}
                  </View>
                </Col>

                {/* Card Column */}
                <Col style={{ flex: 1, paddingBottom: 12, paddingTop: 12, paddingLeft: 8 }}>
                  <AnimatedPress accessibilityRole="button" onPress={() => setActiveDeliveryId(r.id)}>
                    <Card containerColor={isCurrent ? Colors.surfaceElevated : Colors.surface} borderRadius={Radii.control} borderWidth={1} borderColor={isCurrent ? Colors.primaryDark : Colors.borderSubtle} padding={[14, 14]} style={isCurrent ? { elevation: 2, shadowColor: Colors.primaryDark, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } : {}}>
                      <Row align="center" justify="space-between">
                        <Row gap={12} align="center" style={{ flex: 1 }}>
                          {!isCurrent && <Txt size={16} weight="700" color={Colors.textPrimary}>{indexStr}</Txt>}
                          <Col style={{ flex: 1 }}>
                            <Txt size={15} weight="700" color={Colors.textPrimary} numberOfLines={1}>{r.pgName}</Txt>
                            <Row align="center" gap={4} style={{ marginTop: 4 }}>
                              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                              <Txt size={12} color={Colors.textMuted} numberOfLines={1}>{area} · {r.orders} orders</Txt>
                            </Row>
                          </Col>
                        </Row>
                        
                        <Col align="flex-end" style={{ marginLeft: 10 }}>
                          <StatusChip
                            label={isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                            tone={isCompleted ? 'ok' : isCurrent ? 'info' : 'warn'}
                          />
                          {isCompleted ? (
                            <>
                              <Spacer size={4} />
                              <Txt size={10} weight="700" color={Colors.textMuted}>{r.time}</Txt>
                            </>
                          ) : null}
                        </Col>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 10 }} />
                      </Row>
                    </Card>
                  </AnimatedPress>
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
  root: { flex: 1, backgroundColor: '#F8F9FE' },
  groceryBanner: { height: 110, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.primaryDark, justifyContent: 'center', paddingHorizontal: 24, shadowColor: Colors.primaryDark, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  groceryOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 10, 80, 0.4)' },
  cartIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  bannerArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  mealTab: { flexGrow: 1, paddingVertical: 14, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  mealTabOn: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  mealTabOff: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle },
  activeMealCard: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8, overflow: 'hidden', borderWidth: 0 },
  mealImagePlaceholder: { height: 120, backgroundColor: '#E2E8F0', justifyContent: 'center' },
  darkGradientOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.3)' },
  activeBadge: { position: 'absolute', top: 12, left: 16, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 12 },
  shadowCard: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6, borderWidth: 0 },
  chefHatIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(91, 69, 232, 0.1)', alignItems: 'center', justifyContent: 'center' },
  navCirc: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle },
  pendingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  initialsBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(91, 69, 232, 0.08)', alignItems: 'center', justifyContent: 'center' },
  mealPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealPill: { flexGrow: 1, flexBasis: 96, minWidth: 96, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.control, borderWidth: 1 },
  mealPillOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  mealPillOff: { backgroundColor: Colors.surfaceMuted, borderColor: Colors.borderSubtle },
  breakdownRule: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 14 },
  breakdownDot: { width: 8, height: 8, borderRadius: Radii.pill },
  emptyMealBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', padding: 16 },
  progressTrack: { height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.badge, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radii.control, alignSelf: 'flex-start' },
  photoPreviewBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' } 
});
