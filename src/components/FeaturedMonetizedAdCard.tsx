/**
 * FeaturedMonetizedAdCard — the owner's one configured sponsored ad, or nothing.
 *
 * No `AdConfig` for this property → renders null. There is no "3 hardcoded fallback ads"
 * behaviour to fall back to: an owner who hasn't set one up shows their residents nothing,
 * not somebody else's promotion.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Colors } from '@/theme';
import * as Clipboard from 'expo-clipboard';
import { useAdConfigQuery, useRecordAdEventMutation } from '@/features/ads/useAds';
import { useAuthStore } from '@/store/authStore';
import { Btn, Card, Col, Row, Sheet, Spacer, Txt } from '@/components/ui';

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
    <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor="rgba(255,215,0,0.4)" padding={[8, 8]}>
      {/* Sponsored Header */}
      <View style={styles.sponsoredHeader}>
        <Row gap={8} align="center" style={{ flex: 1 }}>
          <View style={styles.sponsoredTag}><Txt variant="caption" weight="600" color="#FFD700">SPONSORED PARTNER</Txt></View>
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
              <View style={styles.bannerPill}><Txt variant="labelSmall" color={Colors.textInverse}>⏱️ {ad.delivery_time}</Txt></View>
            </View>
          )}
        </View>
      )}

      <View style={{ padding: 16 }}>
        <Col style={{ flex: 1 }}>
          <Txt variant="sectionTitle" color={Colors.textInverse}>{ad.brand_name}</Txt>
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
              borderRadius={Radii.control}
              height={40}
              style={{ flex: 1.1 }}
              borderWidth={1}
              borderColor="rgba(255,215,0,0.5)"
            >
              <Ionicons name="copy" size={14} color="#FFD700" />
              <Txt variant="meta" weight="600" color="#FFD700" tabular style={{ marginLeft: 6 }}>{ad.discount_code}</Txt>
            </Btn>
          )}
          <Btn
            onPress={() => { recordClick(); setShowCheckout(true); }}
            containerColor={Colors.accentRose}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={40}
            style={{ flex: 1 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Order Now 🛵</Txt>
          </Btn>
        </Row>
      </View>

      {/* Checkout simulation — there is no real cross-app checkout integration; this mirrors
          the copy-code-and-continue flow the prototype offered. */}
      <Sheet
        visible={showCheckout}
        title={ad.brand_name}
        subtitle="Exclusive PG partner integration"
        accent={Colors.accentRose}
        icon="checkmark-circle"
        onDismiss={() => setShowCheckout(false)}
        footer={(
          <Btn
            onPress={() => setShowCheckout(false)}
            containerColor={Colors.accentRose}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={44}
            style={{ width: '100%' }}
          >
            <Txt variant="button" color={Colors.textInverse}>Continue</Txt>
          </Btn>
        )}
      >
        <Col>
          {!!ad.discount_code && (
            <Row justify="space-between">
              <Txt variant="body" color={Colors.textMuted}>Resident meal voucher</Txt>
              <Txt variant="body" weight="600" color={Colors.success} tabular>
                {ad.discount_percent > 0 ? `-${ad.discount_percent}% off applied` : 'Applied'}
              </Txt>
            </Row>
          )}
          {!!ad.delivery_time && (
            <Row justify="space-between" style={{ marginTop: ad.discount_code ? 8 : 0 }}>
              <Txt variant="body" color={Colors.textMuted}>Estimated arrival</Txt>
              <Txt variant="body" weight="600" color={Colors.textPrimary}>{ad.delivery_time}</Txt>
            </Row>
          )}
          <Spacer size={16} />
          <Txt variant="body" color={Colors.textSecondary}>
            {ad.discount_code
              ? `Voucher code '${ad.discount_code}' is copied and active. You can complete the order on their platform.`
              : 'You can complete your order on their platform.'}
          </Txt>
        </Col>
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  sponsoredHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(19,40,45,0.6)' },
  sponsoredTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.badge, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#FFD700' },
  bannerBox: { height: 130, backgroundColor: '#1A1F36', position: 'relative', overflow: 'hidden' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  bannerPillsRow: { position: 'absolute', bottom: 8, left: 16, flexDirection: 'row', gap: 8 },
  bannerPill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.badge, backgroundColor: 'rgba(30,41,59,0.8)' },
});
