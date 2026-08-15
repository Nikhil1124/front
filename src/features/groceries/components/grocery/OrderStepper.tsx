import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_STATUS_SEQUENCE, OrderStatus } from '../../services/orderEngine';
import { AppColors, AppFonts } from '../../theme/AppColors';

const STEP_META: Record<OrderStatus, { label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }> = {
  received: { label: 'Order Received', icon: 'receipt-outline', hint: 'Store accepted your order' },
  shopping: { label: 'Shopper Picking Items', icon: 'cart-outline', hint: 'Selecting fresh items for you' },
  checkout: { label: 'At Checkout', icon: 'pricetags-outline', hint: 'Finalizing payment & packing' },
  'on-the-way': { label: 'Out for Delivery', icon: 'navigate-outline', hint: 'Driver is on the way to your door' },
  delivered: { label: 'Delivered', icon: 'checkmark-done-outline', hint: 'Order completed! Enjoy 🎉' },
};

export interface OrderStepperProps {
  status: OrderStatus;
}

export function OrderStepper({ status }: OrderStepperProps) {
  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(status);

  return (
    <View style={styles.container}>
      {ORDER_STATUS_SEQUENCE.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const meta = STEP_META[step];
        const isLast = i === ORDER_STATUS_SEQUENCE.length - 1;

        return (
          <View key={step} style={styles.stepRow}>
            {/* Left Node & Line */}
            <View style={styles.nodeColumn}>
              <View style={styles.nodeWrapper}>
                {active && <PulseRing />}
                <View style={[styles.node, done || active ? styles.activeNode : styles.inactiveNode]}>
                  <Ionicons
                    name={done ? 'checkmark' : meta.icon}
                    size={16}
                    color={done || active ? '#fff' : AppColors.textMuted}
                  />
                </View>
              </View>
              {!isLast && <View style={[styles.line, done ? styles.activeLine : styles.inactiveLine]} />}
            </View>

            {/* Right Text Details */}
            <View style={[styles.textColumn, isLast && styles.lastTextColumn]}>
              <Text style={[styles.stepLabel, done || active ? styles.activeText : styles.inactiveText]}>
                {meta.label}
              </Text>
              <Text style={styles.stepHint}>{meta.hint}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PulseRing() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.7 }],
    opacity: 0.5 * (1 - pulse.value),
  }));

  return <Animated.View style={[styles.pulseRing, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 40,
  },
  nodeWrapper: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  activeNode: {
    backgroundColor: AppColors.primary,
  },
  inactiveNode: {
    backgroundColor: AppColors.divider,
  },
  line: {
    width: 2,
    height: 36,
    marginVertical: 2,
  },
  activeLine: {
    backgroundColor: AppColors.primary,
  },
  inactiveLine: {
    backgroundColor: AppColors.divider,
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.primary,
    zIndex: 1,
  },
  textColumn: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 20,
  },
  lastTextColumn: {
    paddingBottom: 0,
  },
  stepLabel: {
    fontSize: 15,
    fontFamily: AppFonts.bold,
  },
  activeText: {
    color: AppColors.textPrimary,
  },
  inactiveText: {
    color: AppColors.textMuted,
  },
  stepHint: {
    fontSize: 12,
    fontFamily: AppFonts.medium,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
});
