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
import { SupplyOrderStatus } from '@/types/supply';
import { Colors } from '@/theme';

export const SUPPLY_ORDER_STATUS_SEQUENCE: SupplyOrderStatus[] = [
  'placed',
  'confirmed',
  'packed',
  'loaded',
  'dispatched',
  'delivered',
];

const STEP_META: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }
> = {
  placed: { label: 'Order Placed', icon: 'receipt-outline', hint: 'Order received by warehouse' },
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle-outline', hint: 'Stock reserved & verified' },
  packed: { label: 'Packed', icon: 'cube-outline', hint: 'Packed and staged for dispatch' },
  loaded: { label: 'Loaded on Vehicle', icon: 'bus-outline', hint: 'Assigned to delivery route' },
  dispatched: { label: 'Out for Delivery', icon: 'navigate-outline', hint: 'En route to your property' },
  delivered: { label: 'Delivered', icon: 'checkmark-done-outline', hint: 'Delivered successfully 🎉' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', hint: 'This order was cancelled' },
};

export interface OrderStepperProps {
  status: SupplyOrderStatus | string;
}

export function OrderStepper({ status }: OrderStepperProps) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledBox}>
        <Ionicons name="close-circle" size={24} color={Colors.danger} />
        <Text style={styles.cancelledText}>This order has been cancelled.</Text>
      </View>
    );
  }

  const currentIndex = SUPPLY_ORDER_STATUS_SEQUENCE.indexOf(status as SupplyOrderStatus);

  return (
    <View style={styles.container}>
      {SUPPLY_ORDER_STATUS_SEQUENCE.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        const meta = STEP_META[step] || { label: step, icon: 'ellipse-outline', hint: '' };
        const isLast = i === SUPPLY_ORDER_STATUS_SEQUENCE.length - 1;

        return (
          <View key={step} style={styles.stepRow}>
            {/* Left Node & Line */}
            <View style={styles.nodeColumn}>
              <View style={styles.nodeWrapper}>
                {active && <PulseRing />}
                <View style={[styles.node, done || active ? styles.activeNode : styles.inactiveNode]}>
                  <Ionicons
                    name={done ? 'checkmark' : meta.icon}
                    size={14}
                    color={done || active ? '#fff' : Colors.textMuted}
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
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.6, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseRing, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  cancelledText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 28,
  },
  nodeWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  activeNode: {
    backgroundColor: Colors.primary,
  },
  inactiveNode: {
    backgroundColor: Colors.borderSubtle,
  },
  pulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    zIndex: 1,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  activeLine: {
    backgroundColor: Colors.primary,
  },
  inactiveLine: {
    backgroundColor: Colors.borderSubtle,
  },
  textColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 14,
  },
  lastTextColumn: {
    paddingBottom: 0,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeText: {
    color: Colors.textPrimary,
  },
  inactiveText: {
    color: Colors.textMuted,
  },
  stepHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
