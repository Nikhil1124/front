/**
 * FeaturedMonetizedAdCard — port of Kotlin `FeaturedMonetizedAdCard`.
 * 3 hardcoded cloud kitchen ads with image banner, discount code, order CTA.
 */
import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import * as Clipboard from 'expo-clipboard';
import type { CloudKitchenAd } from '@/types';

const ADS: CloudKitchenAd[] = [
  {
    id: 1, brandName: 'NutriFit Cloud Kitchen', tagline: 'Chef-crafted healthy meal boxes delivered',
    description: 'High-protein, calorie-counted lunch & dinner boxes tailored for busy PG residents. Free doorstep delivery + extra 15% off coupon!',
    discountCode: 'PGNUTRI15', discountPercent: 15, rating: 4.8, deliveryTime: '12-18 min',
    cuisines: 'Salads, Keto Plates, Grain Bowls', imageResId: 'img_meal_service_ad',
  },
  {
    id: 2, brandName: 'SpiceCraft Biryani Express', tagline: 'Wood-fired authentic dum biryanis',
    description: 'Wood-fired dum biryanis, kebabs, and curries delivered hot. Special PG resident discount available now!',
    discountCode: 'CRAFTBIRYANI20', discountPercent: 20, rating: 4.9, deliveryTime: '22-28 min',
    cuisines: 'Traditional Dum Biryani, Kebabs', imageResId: 'img_guest_dashboard_hero',
  },
  {
    id: 3, brandName: 'SweetSpot Dessert Lab', tagline: 'Artisanal desserts and healthy shakes',
    description: 'Artisanal desserts, milkshakes, and waffles. Healthy alternatives available for fitness-conscious PG residents!',
    discountCode: 'SWEET10', discountPercent: 10, rating: 4.7, deliveryTime: '10-15 min',
    cuisines: 'Desserts, Milkshakes, Waffles', imageResId: 'img_premium_subscription',
  },
];

const AD_IMAGES: Record<string, any> = {
  img_meal_service_ad: require('../../assets/img_meal_service_ad_1784642265436.jpg'),
  img_guest_dashboard_hero: require('../../assets/img_guest_dashboard_hero.jpg'),
  img_premium_subscription: require('../../assets/img_premium_subscription.jpg'),
};

export function FeaturedMonetizedAdCard() {
  const [activeAdIdx, setActiveAdIdx] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const recordImpression = usePGowStore((s) => s.recordAdImpression);
  const recordClick = usePGowStore((s) => s.recordAdClick);
  const recordCouponCopy = usePGowStore((s) => s.recordCouponCopy);

  useEffect(() => {
    recordImpression();
  }, [activeAdIdx, recordImpression]);

  const currentAd = ADS[activeAdIdx];

  return (
    <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={16} borderWidth={1} borderColor="rgba(255,215,0,0.4)" padding={[8, 8]}>
      {/* Sponsored Header */}
      <View style={styles.sponsoredHeader}>
        <Row gap={8} align="center" style={{ flex: 1 }}>
          <View style={styles.sponsoredTag}><Txt size={8} weight="900" color="#FFD700" style={{ letterSpacing: 0.5 }}>SPONSORED PARTNER</Txt></View>
          <Txt size={10} weight="700" color={Colors.SlateMutedText}>Monetized Channel</Txt>
        </Row>
        <Row gap={4}>
          {ADS.map((ad, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setActiveAdIdx(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${ad.brandName} ad`}
            >
              <View style={[styles.dot, { backgroundColor: idx === activeAdIdx ? Colors.CyberPink : 'rgba(156,163,175,0.4)' }]} />
            </TouchableOpacity>
          ))}
        </Row>
      </View>

      {/* Image banner */}
      <View style={styles.bannerBox}>
        <Image source={AD_IMAGES[currentAd.imageResId]} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
        <View style={styles.bannerOverlay} />
        <View style={styles.bannerPillsRow}>
          <View style={styles.bannerPill}><Txt size={10} weight="700" color="#FFFFFF">⭐ {currentAd.rating}</Txt></View>
          <View style={styles.bannerPill}><Txt size={10} weight="700" color="#FFFFFF">⏱️ {currentAd.deliveryTime}</Txt></View>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Row justify="space-between" align="center">
          <Col style={{ flex: 1 }}>
            <Txt size={16} weight="800" color="#FFFFFF">{currentAd.brandName}</Txt>
            <Txt size={11} weight="600" color={Colors.CyberPink}>{currentAd.tagline}</Txt>
          </Col>
          <TouchableOpacity onPress={() => setActiveAdIdx((activeAdIdx + 1) % ADS.length)} style={styles.nextBtn}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Row>
        <Spacer size={8} />
        <Txt size={12} color={Colors.SlateMutedText} style={{ lineHeight: 16 }}>{currentAd.description}</Txt>
        <Spacer size={14} />
        <Txt size={10} weight="700" color="rgba(234,242,243,0.5)">Cuisines: {currentAd.cuisines}</Txt>
        <Spacer size={12} />
        <Row gap={8}>
          <Btn
            onPress={async () => {
              recordCouponCopy();
              await Clipboard.setStringAsync(currentAd.discountCode);
              Alert.alert('Copied', `Copied code '${currentAd.discountCode}'! ${currentAd.discountPercent}% discount applied.`);
            }}
            containerColor="#1A1F36"
            textColor="#FFD700"
            borderRadius={10}
            height={40}
            style={{ flex: 1.1 }}
            borderWidth={1}
            borderColor="rgba(255,215,0,0.5)"
          >
            <Ionicons name="copy" size={14} color="#FFD700" />
            <Txt size={11} weight="900" color="#FFD700" style={{ marginLeft: 6, letterSpacing: 0.5 }}>{currentAd.discountCode}</Txt>
          </Btn>
          <Btn
            onPress={() => { recordClick(); setShowCheckout(true); }}
            containerColor={Colors.CyberPink}
            textColor="#FFFFFF"
            borderRadius={10}
            height={40}
            style={{ flex: 1 }}
          >
            <Txt size={12} weight="800" color="#FFFFFF">Order Now 🛵</Txt>
          </Btn>
        </Row>
      </View>

      {/* Checkout simulation */}
      <Modal visible={showCheckout} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor="#0F0B21" borderRadius={20} borderWidth={1} borderColor={Colors.CyberPink} padding={[20, 20]} style={{ width: '92%' }}>
            <Col align="center">
              <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={32} color="#10B981" /></View>
              <Spacer size={16} />
              <Txt size={18} weight="900" color="#FFFFFF" align="center">{currentAd.brandName}</Txt>
              <Txt size={11} color={Colors.SlateMutedText}>Exclusive PG Partner Integration</Txt>
              <Spacer size={16} /><View style={{ height: 1, backgroundColor: Colors.LuxuryCardBorder, width: '100%' }} /><Spacer size={12} />
              <Row justify="space-between" style={{ width: '100%' }}>
                <Txt size={12} color={Colors.SlateMutedText}>Resident Meal Voucher</Txt>
                <Txt size={12} weight="700" color="#10B981">- {currentAd.discountPercent}% Off Applied</Txt>
              </Row>
              <Row justify="space-between" style={{ width: '100%', marginTop: 6 }}>
                <Txt size={12} color={Colors.SlateMutedText}>Doorstep Delivery Fee</Txt>
                <Txt size={12} weight="700" color="#34D399">FREE (Partner Wave)</Txt>
              </Row>
              <Row justify="space-between" style={{ width: '100%', marginTop: 6 }}>
                <Txt size={12} color={Colors.SlateMutedText}>Estimated Arrival</Txt>
                <Txt size={12} weight="700" color={Colors.IvoryWhiteText}>{currentAd.deliveryTime}</Txt>
              </Row>
              <Spacer size={20} />
              <Txt size={11} color={Colors.SlateMutedText} align="center">
                Voucher code '{currentAd.discountCode}' is copied and active. You can complete order on their platform.
              </Txt>
              <Spacer size={20} />
              <Btn onPress={() => setShowCheckout(false)} containerColor={Colors.CyberPink} textColor="#FFFFFF" borderRadius={12} height={44} style={{ width: '100%' }}>
                <Txt size={13} weight="700" color="#FFFFFF">Awesome, Continue</Txt>
              </Btn>
            </Col>
          </Card>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  sponsoredHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(19,40,45,0.6)',
  },
  sponsoredTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#FFD700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bannerBox: { height: 130, backgroundColor: '#1A1F36', position: 'relative', overflow: 'hidden' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  bannerPillsRow: { position: 'absolute', bottom: 8, left: 16, flexDirection: 'row', gap: 8 },
  bannerPill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(30,41,59,0.8)' },
  nextBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F1B3E', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
});
