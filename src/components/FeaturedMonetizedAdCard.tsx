/**
 * FeaturedMonetizedAdCard — the owner's one configured sponsored ad, or nothing.
 *
 * No `AdConfig` for this property → renders null. There is no "3 hardcoded fallback ads"
 * behaviour to fall back to: an owner who hasn't set one up shows their residents nothing,
 * not somebody else's promotion.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import * as Clipboard from 'expo-clipboard';
import { useAdConfigQuery, useRecordAdEventMutation } from '@/features/ads/useAds';
import { useAuthStore } from '@/store/authStore';

export function FeaturedMonetizedAdCard() {
  const [showCheckout, setShowCheckout] = useState(false);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: ad } = useAdConfigQuery(activePgId ?? undefined);
  const recordEvent = useRecordAdEventMutation(activePgId ?? undefined);

  useEffect(() => {
    if (ad) recordEvent.mutate({ eventType: 'impression' });
    // Fire once per ad shown, not on every render this component re-mounts for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.pg_id, ad?.brand_name]);

  if (!ad) return null;

  const recordClick = () => recordEvent.mutate({ eventType: 'click' });
  const recordCouponCopy = () => recordEvent.mutate({ eventType: 'coupon_copy' });

  return (
    <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor="rgba(255,215,0,0.4)" padding={[8, 8]}>
      {/* Sponsored Header */}
      <View style={styles.sponsoredHeader}>
        <Row gap={8} align="center" style={{ flex: 1 }}>
          <View style={styles.sponsoredTag}><Txt size={8} weight="900" color="#FFD700" style={{ letterSpacing: 0.5 }}>SPONSORED PARTNER</Txt></View>
          <Txt variant="labelSmall" color={Colors.textMuted}>Monetized Channel</Txt>
        </Row>
      </View>

      {/* Image banner */}
      {!!ad.image_url && (
        <View style={styles.bannerBox}>
          <Image source={{ uri: ad.image_url }} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
          {!!ad.delivery_time && (
            <View style={styles.bannerPillsRow}>
              <View style={styles.bannerPill}><Txt variant="labelSmall" color="#FFFFFF">⏱️ {ad.delivery_time}</Txt></View>
            </View>
          )}
        </View>
      )}

      <View style={{ padding: 16 }}>
        <Col style={{ flex: 1 }}>
          <Txt variant="sectionTitle" weight="800" color="#FFFFFF">{ad.brand_name}</Txt>
          {!!ad.tagline && <Txt variant="caption" weight="600" color={Colors.accentRose}>{ad.tagline}</Txt>}
        </Col>
        {!!ad.description && (
          <>
            <Spacer size={8} />
            <Txt variant="caption" color={Colors.textMuted} style={{ lineHeight: 16 }}>{ad.description}</Txt>
          </>
        )}
        {!!ad.cuisines && (
          <>
            <Spacer size={14} />
            <Txt variant="labelSmall" color="rgba(234,242,243,0.5)">Cuisines: {ad.cuisines}</Txt>
          </>
        )}
        <Spacer size={12} />
        <Row gap={8}>
          {!!ad.discount_code && (
            <Btn
              onPress={async () => {
                recordCouponCopy();
                await Clipboard.setStringAsync(ad.discount_code);
                Alert.alert('Copied', `Copied code '${ad.discount_code}'!${ad.discount_percent > 0 ? ` ${ad.discount_percent}% discount applied.` : ''}`);
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
              <Txt size={11} weight="900" color="#FFD700" style={{ marginLeft: 6, letterSpacing: 0.5 }}>{ad.discount_code}</Txt>
            </Btn>
          )}
          <Btn
            onPress={() => { recordClick(); setShowCheckout(true); }}
            containerColor={Colors.accentRose}
            textColor="#FFFFFF"
            borderRadius={10}
            height={40}
            style={{ flex: 1 }}
          >
            <Txt variant="caption" weight="800" color="#FFFFFF">Order Now 🛵</Txt>
          </Btn>
        </Row>
      </View>

      {/* Checkout simulation — there is no real cross-app checkout integration; this mirrors
          the copy-code-and-continue flow the prototype offered. */}
      <Modal visible={showCheckout} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor="#0F0B21" borderRadius={20} borderWidth={1} borderColor={Colors.accentRose} padding={[20, 20]} style={{ width: '92%' }}>
            <Col align="center">
              <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={32} color="#10B981" /></View>
              <Spacer size={16} />
              <Txt variant="sectionTitle" weight="900" color="#FFFFFF" align="center">{ad.brand_name}</Txt>
              <Txt variant="caption" color={Colors.textMuted}>Exclusive PG Partner Integration</Txt>
              <Spacer size={16} /><View style={{ height: 1, backgroundColor: Colors.borderSubtle, width: '100%' }} /><Spacer size={12} />
              {!!ad.discount_code && (
                <Row justify="space-between" style={{ width: '100%' }}>
                  <Txt variant="caption" color={Colors.textMuted}>Resident Meal Voucher</Txt>
                  <Txt variant="caption" weight="700" color="#10B981">
                    {ad.discount_percent > 0 ? `- ${ad.discount_percent}% Off Applied` : 'Applied'}
                  </Txt>
                </Row>
              )}
              {!!ad.delivery_time && (
                <Row justify="space-between" style={{ width: '100%', marginTop: 6 }}>
                  <Txt variant="caption" color={Colors.textMuted}>Estimated Arrival</Txt>
                  <Txt variant="caption" weight="700" color={Colors.textInverse}>{ad.delivery_time}</Txt>
                </Row>
              )}
              <Spacer size={20} />
              <Txt variant="caption" color={Colors.textMuted} align="center">
                {ad.discount_code
                  ? `Voucher code '${ad.discount_code}' is copied and active. You can complete order on their platform.`
                  : 'You can complete your order on their platform.'}
              </Txt>
              <Spacer size={20} />
              <Btn onPress={() => setShowCheckout(false)} containerColor={Colors.accentRose} textColor="#FFFFFF" borderRadius={12} height={44} style={{ width: '100%' }}>
                <Txt variant="body" weight="700" color="#FFFFFF">Awesome, Continue</Txt>
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
  bannerBox: { height: 130, backgroundColor: '#1A1F36', position: 'relative', overflow: 'hidden' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  bannerPillsRow: { position: 'absolute', bottom: 8, left: 16, flexDirection: 'row', gap: 8 },
  bannerPill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(30,41,59,0.8)' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
});
