import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, Col, OutlinedTextField, Row, Txt } from '@/components/ui';
import { useLaundryStore } from '@/features/laundry/store/useLaundryStore';
import { usePGowStore } from '@/store/usePGowStore';

const DATES = ['Today', 'Tomorrow', 'Sep 12', 'Sep 13'];
const TIMES = ['8:00 AM – 10:00 AM', '12:00 PM – 2:00 PM', '5:00 PM – 7:00 PM'];

export default function LaundryPickupScreen() {
  const insets = useSafeAreaInsets();
  
  const guest = usePGowStore((s) => s.loggedInGuest);
  const pickupDetails = useLaundryStore((s) => s.pickupDetails);
  const setPickupDetails = useLaundryStore((s) => s.setPickupDetails);

  const [instructions, setInstructions] = useState(pickupDetails.instructions);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Pickup Details</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Txt style={styles.pageTitle}>When should we pick up your laundry?</Txt>
        </View>

        {/* PICKUP LOCATION */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Pickup Location</Txt>
          <View style={styles.card}>
            <Row align="center" justify="space-between">
              <Row align="center" gap={12}>
                <View style={styles.iconWrap}>
                  <Ionicons name="home" size={20} color={Colors.primaryDark} />
                </View>
                <Col>
                  <Txt style={styles.locationTitle}>PGow Residence</Txt>
                  <Txt style={styles.locationRoom}>Room {guest?.roomNo || '...'}</Txt>
                </Col>
              </Row>
              <Txt style={styles.changeText}>Change Room</Txt>
            </Row>
            <View style={styles.locationBanner}>
              <Txt style={styles.locationBannerText}>Pickup will be collected from your PG room.</Txt>
            </View>
          </View>
        </View>

        {/* PICKUP DATE */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Choose pickup date</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 8 }}>
            {DATES.map(date => (
              <AnimatedPress 
                key={date} 
                onPress={() => setPickupDetails({ date })}
                style={[styles.dateCard, pickupDetails.date === date && styles.dateCardActive]}
              >
                <Txt style={[styles.dateText, pickupDetails.date === date && styles.dateTextActive]}>{date}</Txt>
              </AnimatedPress>
            ))}
          </ScrollView>
        </View>

        {/* PICKUP TIME */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Choose a convenient time</Txt>
          <View style={{ paddingHorizontal: 20, marginTop: 8, gap: 10 }}>
            {TIMES.map(time => (
              <AnimatedPress 
                key={time}
                onPress={() => setPickupDetails({ time })}
                style={[styles.timeCard, pickupDetails.time === time && styles.timeCardActive]}
              >
                <Row align="center" justify="space-between">
                  <Txt style={[styles.timeText, pickupDetails.time === time && styles.timeTextActive]}>{time}</Txt>
                  <View style={[styles.radio, pickupDetails.time === time && styles.radioActive]}>
                    {pickupDetails.time === time && <View style={styles.radioInner} />}
                  </View>
                </Row>
              </AnimatedPress>
            ))}
          </View>
        </View>

        {/* SPECIAL INSTRUCTIONS */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Anything we should know?</Txt>
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            {/* `OutlinedTextField`, not a raw `TextInput`: it is the app's one field
                primitive and carries the label, error and helper slots, which is what keeps
                validation out of blocking Alert popups. `forms.check.ts` enforces this. */}
            <OutlinedTextField
              placeholder="Example: Keep white clothes separate"
              value={instructions}
              onChangeText={(text) => {
                setInstructions(text);
                setPickupDetails({ instructions: text });
              }}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* ESTIMATED RETURN */}
        <View style={styles.section}>
          <View style={styles.returnCard}>
            <Row align="center" gap={12}>
              <View style={styles.iconWrapReturn}>
                <Ionicons name="time" size={20} color={Colors.success} />
              </View>
              <Col>
                <Txt style={styles.returnLabel}>Estimated return</Txt>
                <Txt style={styles.returnValue}>Tomorrow • 6:00 PM – 8:00 PM</Txt>
              </Col>
            </Row>
          </View>
        </View>

      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Btn 
          onPress={() => router.push('/laundry/payment')}
          containerColor={Colors.primary}
          textColor={Colors.surface}
          borderRadius={Radii.control}
          height={50}
        >
          <Txt variant="button" color={Colors.textInverse}>Continue to Payment</Txt>
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, lineHeight: 34 },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: 8 },
  
  card: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: Radii.card, backgroundColor: '#EBF4EC', alignItems: 'center', justifyContent: 'center' },
  locationTitle: { fontSize: 14, color: Colors.textSecondary },
  locationRoom: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  changeText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  locationBanner: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: Radii.control, marginTop: 16 },
  locationBannerText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  
  dateCard: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.surface, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.borderSubtle },
  dateCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  dateTextActive: { color: Colors.textInverse },
  
  timeCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle },
  timeCardActive: { borderColor: Colors.primary, backgroundColor: '#F8FAFB' },
  timeText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  timeTextActive: { color: Colors.primaryDark },
  radio: { width: 20, height: 20, borderRadius: Radii.control, borderWidth: 2, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: Radii.badge, backgroundColor: Colors.primary },
  
  
  returnCard: { backgroundColor: Palette.TintGreen, marginHorizontal: 20, borderRadius: Radii.card, padding: 16, borderWidth: 1, borderColor: Palette.TintGreen },
  iconWrapReturn: { width: 40, height: 40, borderRadius: Radii.card, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  returnLabel: { fontSize: 12, color: '#064E3B', fontWeight: '600' },
  returnValue: { fontSize: 15, fontWeight: '800', color: '#064E3B', marginTop: 2 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
});
