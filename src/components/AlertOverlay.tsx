import { useEffect, useState, useRef, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Card, Txt, Row, Col, Btn } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

interface AlertStyle {
  borderColors: string[];
  iconBg: string;
  iconTint: string;
  subtitle: string;
  subtitleColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function alertStyleFor(type: string): AlertStyle {
  switch (type) {
    case 'MEAL':
      return {
        borderColors: [Colors.primary, '#0D9488'],
        iconBg: '#F0FDF9',
        iconTint: Colors.primary,
        subtitle: '⚡ INSTANT FOOD RSVP ACTION',
        subtitleColor: Colors.primaryDark,
        icon: 'restaurant',
      };
    case 'PAYMENT':
      return {
        borderColors: ['#F59E0B', '#D97706'],
        iconBg: '#FFFBEB',
        iconTint: '#D97706',
        subtitle: '💰 PAYMENT STATUS ALERT',
        subtitleColor: '#B45309',
        icon: 'card',
      };
    case 'SUCCESS':
      return {
        borderColors: [Colors.primary, '#0D9488'],
        iconBg: '#F0FDF9',
        iconTint: Colors.primary,
        subtitle: '✓ CONFIRMATION',
        subtitleColor: Colors.primaryDark,
        icon: 'checkmark-circle',
      };
    case 'ERROR':
      return {
        borderColors: ['#EF4444', '#DC2626'],
        iconBg: '#FEF2F2',
        iconTint: '#DC2626',
        subtitle: '⚠️ ACTION NOTICE',
        subtitleColor: '#B91C1C',
        icon: 'alert-circle',
      };
    default:
      return {
        borderColors: [Colors.primary, Colors.borderSubtle],
        iconBg: '#F0FDF9',
        iconTint: Colors.primary,
        subtitle: '🔔 NOTICE',
        subtitleColor: Colors.primaryDark,
        icon: 'notifications',
      };
  }
}

export function AlertOverlay() {
  const activeAlert = usePGowStore((s) => s.activeAlert);
  const dismiss = usePGowStore((s) => s.dismissAlert);
  const submitRSVPFromNotification = usePGowStore((s) => s.submitRSVPFromNotification);

  const [rsvpChoice, setRsvpChoice] = useState<string | null>(null);
  const isDismissing = useRef(false);

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleDismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    // Smoothly slide upward off screen
    translateY.value = withTiming(-150, { duration: 320, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(dismiss)();
      }
    });
    opacity.value = withTiming(0, { duration: 280 });
  }, [dismiss, translateY, opacity]);

  useEffect(() => {
    setRsvpChoice(null);
    if (activeAlert) {
      isDismissing.current = false;
      // Animate smoothly in from above
      translateY.value = -120;
      opacity.value = 0;
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 220 });

      // Welcome back / login alerts slide upward automatically after 1 second
      const isWelcome = activeAlert.title?.toLowerCase().includes('welcome') || false;
      const isMealWithNotif = activeAlert.type === 'MEAL' && activeAlert.notificationId != null;
      const durationMs = isWelcome ? 1000 : (isMealWithNotif ? 6000 : 1200);

      const timer = setTimeout(() => {
        handleDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [activeAlert?.timestamp, activeAlert?.title, activeAlert?.type, handleDismiss, translateY, opacity]);

  if (!activeAlert) return null;

  const style = alertStyleFor(activeAlert.type);
  const isMealWithNotif = activeAlert.type === 'MEAL' && activeAlert.notificationId != null;

  const handleEat = () => {
    if (activeAlert.notificationId != null) {
      setRsvpChoice('EATING');
      submitRSVPFromNotification(activeAlert.notificationId, 'REQUIRED');
    }
  };

  const handleSkip = () => {
    if (activeAlert.notificationId != null) {
      setRsvpChoice('SKIPPING');
      submitRSVPFromNotification(activeAlert.notificationId, 'NOT_REQUIRED');
    }
  };

  return (
    <Animated.View style={[styles.overlay, animatedStyle]} pointerEvents="box-none">
      <Card
        containerColor={Colors.surface}
        borderRadius={20}
        borderColor={style.borderColors[0]}
        borderWidth={1.5}
        padding={[16, 16]}
        style={styles.card}
      >
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <Row gap={10} style={{ flex: 1 }} align="center">
            <View style={[styles.iconBox, { backgroundColor: style.iconBg }]}>
              <Ionicons name={style.icon} size={20} color={style.iconTint} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{activeAlert.title}</Txt>
              <Txt variant="labelSmall" weight="800" color={style.subtitleColor} style={{ letterSpacing: 0.5, marginTop: 1 }}>
                {style.subtitle}
              </Txt>
            </Col>
          </Row>
          <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </Row>
        {activeAlert.description ? (
          <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 17 }}>
            {activeAlert.description}
          </Txt>
        ) : null}

        {isMealWithNotif && (
          <View style={{ marginTop: 10 }}>
            {rsvpChoice == null ? (
              <Row gap={8}>
                <Btn
                  onPress={handleEat}
                  containerColor="#10B981"
                  textColor="#FFFFFF"
                  borderRadius={10}
                  height={38}
                  style={{ flex: 1 }}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Txt variant="caption" weight="700" color="#FFFFFF" style={{ marginLeft: 4 }}>I will Eat ✅</Txt>
                </Btn>
                <Btn
                  onPress={handleSkip}
                  containerColor="#EF4444"
                  textColor="#FFFFFF"
                  borderRadius={10}
                  height={38}
                  style={{ flex: 1 }}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                  <Txt variant="caption" weight="700" color="#FFFFFF" style={{ marginLeft: 4 }}>Skip Portion ❌</Txt>
                </Btn>
              </Row>
            ) : (
              <View style={[styles.successPill, { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <Ionicons name="star" size={18} color="#FBBF24" />
                <Txt variant="caption" weight="700" color="#34D399" style={{ marginLeft: 8 }}>
                  RSVP: {rsvpChoice} Submitted! +15 Pts Credited 🌟
                </Txt>
              </View>
            )}
          </View>
        )}

        {!isMealWithNotif && (
          <TouchableOpacity onPress={handleDismiss} style={{ marginTop: 10 }}>
            <Txt variant="caption" weight="700" color={style.subtitleColor}>Dismiss</Txt>
          </TouchableOpacity>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    zIndex: 100,
  },
  card: {
    width: '100%',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});

