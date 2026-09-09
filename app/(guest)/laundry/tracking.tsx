import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryStore, OrderStatus } from '@/features/laundry/store/useLaundryStore';
import { Timeline, TimelineStep } from '@/features/laundry/components/Timeline';

const ALL_STAGES: { id: OrderStatus, label: string }[] = [
  { id: 'BOOKING_CONFIRMED', label: 'Booking Confirmed' },
  { id: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { id: 'PICKED_UP', label: 'Clothes Picked Up' },
  { id: 'WEIGHED', label: 'Weighed & Checked' },
  { id: 'WASHING', label: 'Washing' },
  { id: 'DRYING', label: 'Drying' },
  { id: 'IRONING', label: 'Ironing / Dry Cleaning' },
  { id: 'QUALITY_CHECK', label: 'Quality Check' },
  { id: 'PACKED', label: 'Packed' },
  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { id: 'DELIVERED', label: 'Delivered to Room' },
];

export default function LaundryTrackingScreen() {
  const insets = useSafeAreaInsets();
  const activeOrder = useLaundryStore((s) => s.activeOrder);
  const updateOrderStatus = useLaundryStore((s) => s.updateOrderStatus);

  // Auto-progress state for demonstration purposes
  useEffect(() => {
    if (!activeOrder) return;
    
    // For demo: if just confirmed, move to pickup scheduled quickly
    if (activeOrder.status === 'BOOKING_CONFIRMED') {
      const t = setTimeout(() => updateOrderStatus('PICKUP_SCHEDULED'), 3000);
      return () => clearTimeout(t);
    }
  }, [activeOrder?.status, updateOrderStatus]);

  if (!activeOrder) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 20 }]}>
        <AnimatedPress accessibilityRole="button" onPress={() => router.replace('/laundry')} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={40} />
        <Txt style={styles.emptyTitle}>No active laundry orders.</Txt>
        <Btn style={{ marginTop: 20 }} onPress={() => router.replace('/laundry/orders')}>
          <Txt variant="button" color="#FFF">View History</Txt>
        </Btn>
      </View>
    );
  }

  const currentIndex = ALL_STAGES.findIndex(s => s.id === activeOrder.status);
  
  const steps: TimelineStep[] = ALL_STAGES.map((stage, idx) => {
    let status: TimelineStep['status'] = 'upcoming';
    if (idx < currentIndex) status = 'completed';
    else if (idx === currentIndex) status = 'current';

    let subLabel = undefined;
    if (stage.id === 'BOOKING_CONFIRMED' && status !== 'upcoming') subLabel = 'Today • 4:32 PM';
    if (stage.id === 'PICKUP_SCHEDULED' && status !== 'upcoming') subLabel = `${activeOrder.pickupDate} • ${activeOrder.pickupTime}`;
    
    return { id: stage.id, label: stage.label, status, subLabel };
  });

  // Current Status Card formatting
  const currentStage = ALL_STAGES[currentIndex];
  let icon = 'time';
  let desc = 'Processing...';
  
  if (currentStage.id === 'PICKUP_SCHEDULED') {
    icon = 'car';
    desc = `Our laundry partner will collect your clothes from ${activeOrder.pickupLocation}.`;
  } else if (currentStage.id === 'PICKED_UP' || currentStage.id === 'WEIGHED') {
    icon = 'basket';
    desc = 'Your laundry is currently being inspected and sorted.';
  } else if (currentStage.id === 'WASHING' || currentStage.id === 'DRYING' || currentStage.id === 'IRONING' || currentStage.id === 'QUALITY_CHECK') {
    icon = 'water';
    desc = `Your clothes are currently in the ${currentStage.label.toLowerCase()} phase.`;
  } else if (currentStage.id === 'PACKED') {
    icon = 'cube';
    desc = 'Everything has been cleaned, checked and packed securely.';
  } else if (currentStage.id === 'OUT_FOR_DELIVERY') {
    icon = 'bicycle';
    desc = 'Your clean clothes are on their way back to your room!';
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" justify="space-between" style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Row align="center" gap={16}>
            <AnimatedPress accessibilityRole="button" onPress={() => router.push('/laundry')} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </AnimatedPress>
            <Txt style={styles.headerTitle}>Laundry Order</Txt>
          </Row>
          <Txt style={styles.headerOrderNo}>{activeOrder.id}</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* TOP STATUS OVERVIEW */}
        <View style={styles.topOverview}>
          <Txt style={styles.statusPill}>{currentStage.label.toUpperCase()}</Txt>
          <Spacer size={8} />
          <Row align="center" gap={8}>
            <Ionicons name="time" size={16} color={Colors.textSecondary} />
            <Txt style={styles.estReturnText}>Estimated return: {activeOrder.estimatedReturn}</Txt>
          </Row>
        </View>

        {/* STATUS CARD */}
        <View style={styles.statusCard}>
          <Row align="center" gap={12}>
            <View style={styles.statusIconWrap}>
              <Ionicons name={icon as any} size={24} color={Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.statusCardTitle}>{currentStage.label}</Txt>
              <Txt style={styles.statusCardDesc}>{desc}</Txt>
            </Col>
          </Row>
        </View>

        {/* TIMELINE */}
        <View style={styles.timelineCard}>
          <Txt style={styles.timelineTitle}>Progress Timeline</Txt>
          <Spacer size={16} />
          <Timeline steps={steps} />
        </View>

      </ScrollView>
      
      {/* DEMO CONTROLS (for development testing only) */}
      <View style={styles.demoControls}>
        <Row align="center" justify="space-around">
          <Txt style={{ fontSize: 10, color: '#999', position: 'absolute', top: -14, alignSelf: 'center' }}>[Simulation Controls]</Txt>
          <Btn onPress={() => updateOrderStatus('WEIGHED')} height={30} style={{ paddingHorizontal: 12 }} containerColor="#F1F5F9" textColor="#333">
            <Txt style={{fontSize:11}}>Weigh</Txt>
          </Btn>
          <Btn onPress={() => updateOrderStatus('WASHING')} height={30} style={{ paddingHorizontal: 12 }} containerColor="#F1F5F9" textColor="#333">
            <Txt style={{fontSize:11}}>Wash</Txt>
          </Btn>
          <Btn onPress={() => updateOrderStatus('OUT_FOR_DELIVERY')} height={30} style={{ paddingHorizontal: 12 }} containerColor="#F1F5F9" textColor="#333">
            <Txt style={{fontSize:11}}>Delivery</Txt>
          </Btn>
          <Btn onPress={() => updateOrderStatus('DELIVERED')} height={30} style={{ paddingHorizontal: 12 }} containerColor="#059669" textColor="#FFF">
            <Txt style={{fontSize:11}} color="#FFF">Done</Txt>
          </Btn>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerOrderNo: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  
  emptyTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  
  topOverview: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  statusPill: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark, letterSpacing: 0.5 },
  estReturnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  
  statusCard: { backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statusIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBF4EC', alignItems: 'center', justifyContent: 'center' },
  statusCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statusCardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  
  timelineCard: { backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 20, paddingBottom: 4 },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  
  demoControls: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
});
