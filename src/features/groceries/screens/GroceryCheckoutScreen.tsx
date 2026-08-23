import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Image, Alert, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/useCartStore';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { FormScroll } from '@/components/ui/FormScroll';

interface CheckoutSlot {
  id: string;
  day: string;
  badge: string;
  window: string;
  fee: number;
  feeText: string;
}

// Delivery is free across every slot for now — see GroceryCartScreen's matching notice.
// When real pricing comes from the area-manager/warehouse portal, this table (and the
// per-slot fee it carries) is what should start reading from that instead of a constant.
const CHECKOUT_SLOTS: CheckoutSlot[] = [
  { id: '1', day: 'Today', badge: 'FASTEST', window: 'Express • 15–25 min', fee: 0, feeText: 'FREE' },
  { id: '2', day: 'Today', badge: 'FREE', window: '4:00 PM – 5:00 PM', fee: 0, feeText: 'FREE' },
  { id: '3', day: 'Today', badge: 'FREE', window: '6:00 PM – 7:00 PM', fee: 0, feeText: 'FREE' },
  { id: '4', day: 'Tomorrow', badge: 'FREE', window: '9:00 AM – 10:00 AM', fee: 0, feeText: 'FREE' },
  { id: '5', day: 'Tomorrow', badge: 'FREE', window: '2:00 PM – 3:00 PM', fee: 0, feeText: 'FREE' },
];

const TIPS = [0, 20, 30, 50, 100];

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI / Google Pay / PhonePe', icon: 'qr-code-outline' },
  { id: 'card', label: 'Credit or Debit Card', icon: 'card-outline' },
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline' },
];

import { useActiveProperty } from '@/features/properties/useProperties';
import { useAuthStore } from '@/store/authStore';
import { useCreateSupplyOrderMutation } from '../useSupplyOrders';

export function GroceryCheckoutScreen() {
  const { activeEntity: owner } = useActiveProperty();
  const activePgId = useAuthStore((s) => s.activePgId);
  const ownerForGuest = owner;
  const insets = useSafeAreaInsets();

  const { items, getCartTotal, getGSTDetails, clearCart, getItemCount, getTotalSavings } = useCartStore();
  const createOrderMutation = useCreateSupplyOrderMutation();

  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('1');
  const [driverNote, setDriverNote] = useState<string>('');
  const [selectedTip, setSelectedTip] = useState<number>(20);
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [deliveryAddress, setDeliveryAddress] = useState((owner ?? ownerForGuest)?.address ?? 'Your PG address');

  // Fetch active configurations
  const selectedSlot = useMemo(() => {
    return CHECKOUT_SLOTS.find(s => s.id === selectedSlotId) || CHECKOUT_SLOTS[0];
  }, [selectedSlotId]);

  const subtotal = getCartTotal();
  const { cgst, sgst, totalGst } = getGSTDetails();
  const deliveryFee = fulfillmentMode === 'pickup' ? 0 : selectedSlot.fee;
  const platformFee = 10;
  const grandTotal = Math.round((subtotal + totalGst + deliveryFee + platformFee + selectedTip) * 100) / 100;
  const cartItemCount = getItemCount();
  const totalSavings = getTotalSavings();

  const handleUpdateAddress = () => {
    Alert.prompt(
      "Change Address",
      "Enter your delivery address:",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (text?: string) => text && setDeliveryAddress(text) }
      ],
      "plain-text",
      deliveryAddress
    );
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      Alert.alert("Error", "Your cart is empty. Add items before placing an order.");
      return;
    }

    const targetPgId = activePgId || owner?.id;
    if (!targetPgId) {
      Alert.alert("Error", "No active property found to place the order.");
      return;
    }

    try {
      const order = await createOrderMutation.mutateAsync({
        pg_id: targetPgId,
        payment_method: paymentMethod === 'cod' ? 'cash' : 'upi',
        delivery_slot: `${selectedSlot.day}, ${selectedSlot.window}`,
        delivery_notes: driverNote || undefined,
        items: items.map((i) => ({
          item_id: i.id,
          quantity: i.quantity,
        })),
      });

      clearCart();
      router.push({ pathname: '/groceries/orders/[id]', params: { id: order.id } });
    } catch (err: any) {
      Alert.alert("Order Failed", err?.message || "Could not place order. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />


      {/* Header */}
      <View style={[styles.header, { paddingTop: 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      <FormScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Fulfillment & Time Slot */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.cardTitle}>Delivery</Text>
          </View>

          {/* Mode Switch row */}
          <View style={styles.fulfillmentContainer}>
            <TouchableOpacity
              style={[
                styles.fulfillmentBtn,
                fulfillmentMode === 'delivery' && styles.selectedFulfillmentBtn
              ]}
              onPress={() => setFulfillmentMode('delivery')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bicycle"
                size={16}
                color={fulfillmentMode === 'delivery' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.fulfillmentText, fulfillmentMode === 'delivery' && styles.selectedFulfillmentText]}>
                Delivery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fulfillmentBtn,
                fulfillmentMode === 'pickup' && styles.selectedFulfillmentBtn
              ]}
              onPress={() => setFulfillmentMode('pickup')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="basket-outline"
                size={16}
                color={fulfillmentMode === 'pickup' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.fulfillmentText, fulfillmentMode === 'pickup' && styles.selectedFulfillmentText]}>
                Store Pickup
              </Text>
            </TouchableOpacity>
          </View>

          {fulfillmentMode === 'delivery' ? (
            <>
              <Text style={styles.slotListLabel}>Select delivery time</Text>

              {/* Slots list */}
              <View style={styles.slotList}>
                {CHECKOUT_SLOTS.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  const isFastest = slot.badge === 'FASTEST';

                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotRow, isSelected && styles.selectedSlotRow]}
                      onPress={() => setSelectedSlotId(slot.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.slotRowLeft}>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSelected ? Colors.primary : Colors.textMuted}
                          style={styles.radioIcon}
                        />
                        <View style={styles.slotDetails}>
                          <View style={styles.slotDayBadgeRow}>
                            <Text style={styles.slotDay}>{slot.day}</Text>
                            <View style={[styles.slotBadge, isFastest ? styles.fastestBadge : styles.freeBadge]}>
                              <Text style={[styles.slotBadgeText, isFastest ? styles.fastestText : styles.freeText]}>
                                {slot.badge}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.slotWindow}>{slot.window}</Text>
                        </View>
                      </View>

                      <Text style={[styles.slotFeeText, slot.fee === 0 && styles.greenFeeText]}>
                        {slot.feeText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.slotListLabel}>Pickup is free — collect your order from the store counter, no delivery fee.</Text>
          )}
        </View>

        {/* Section 2: Address & Instructions */}
        {fulfillmentMode === 'delivery' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.cardTitle}>Delivery Address</Text>
            </View>

            {/* Location card */}
            <View style={styles.locationCard}>
              <Ionicons name="location" size={18} color={Colors.primary} style={styles.locationCardIcon} />
              <View style={styles.locationTextWrapper}>
                <Text style={styles.locationCardTitle}>Deliver to</Text>
                <Text style={styles.locationCardSub} numberOfLines={1}>{deliveryAddress}</Text>
              </View>
              <TouchableOpacity onPress={handleUpdateAddress} style={styles.changeBtn} activeOpacity={0.7}>
                <Text style={styles.changeBtnText}>Change</Text>
                <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Instruction input */}
            <Text style={styles.inputLabel}>Delivery instructions (optional)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Leave at door, call when arrived..."
                placeholderTextColor={Colors.textMuted}
                value={driverNote}
                onChangeText={(text) => text.length <= 120 && setDriverNote(text)}
                multiline
              />
              <Text style={styles.charLimitText}>{driverNote.length}/120</Text>
            </View>
          </View>
        )}

        {/* Section 3: Delivery Tip */}
        {fulfillmentMode === 'delivery' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.cardTitle}>Delivery Partner Tip</Text>
            </View>
            <Text style={styles.tipDesc}>100% of the tip goes to your delivery partner.</Text>
            <View style={styles.tipChipsRow}>
              {TIPS.map((tip) => {
                const isSelected = selectedTip === tip;
                return (
                  <TouchableOpacity
                    key={tip}
                    style={[styles.tipChip, isSelected && styles.selectedTipChip]}
                    onPress={() => setSelectedTip(tip)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tipChipText, isSelected && styles.selectedTipText]}>
                      {tip === 0 ? 'No Tip' : `₹${tip}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Section 4: Payment Method */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{fulfillmentMode === 'delivery' ? 4 : 2}</Text>
            </View>
            <Text style={styles.cardTitle}>Payment Method</Text>
          </View>

          <View style={styles.paymentList}>
            {PAYMENT_METHODS.map((pm) => {
              const isSelected = paymentMethod === pm.id;
              return (
                <TouchableOpacity
                  key={pm.id}
                  style={[styles.paymentRow, isSelected && styles.selectedPaymentRow]}
                  onPress={() => setPaymentMethod(pm.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={pm.icon as any}
                    size={18}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                    style={styles.paymentIcon}
                  />
                  <Text style={[styles.paymentLabel, isSelected && styles.selectedPaymentLabel]}>
                    {pm.label}
                  </Text>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={isSelected ? Colors.primary : Colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 5: Order Summary */}
        <View style={styles.card}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          {/* Order preview items list */}
          <View style={styles.summaryList}>
            {items.map((item) => (
              <View key={item.id} style={styles.summaryItemRow}>
                <Image
                  source={item.image ? { uri: item.image } : require('../../../../assets/img_app_icon.jpg')}
                  style={styles.summaryItemImg}
                />
                <View style={styles.summaryItemDetails}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.summaryItemUnit}>{item.unit} × {item.quantity}</Text>
                </View>
                <Text style={styles.summaryItemPrice}>₹{item.price * item.quantity}</Text>
              </View>
            ))}
          </View>

          {/* Pricing breakdown */}
          <View style={styles.billBreakdown}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{subtotal.toFixed(2)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>CGST (2.5%)</Text>
              <Text style={styles.billValue}>₹{cgst.toFixed(2)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>SGST (2.5%)</Text>
              <Text style={styles.billValue}>₹{sgst.toFixed(2)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={[styles.billValue, deliveryFee === 0 && styles.greenText]}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Platform & Handling Fee</Text>
              <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
            </View>

            {fulfillmentMode === 'delivery' && selectedTip > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Tip</Text>
                <Text style={styles.billValue}>₹{selectedTip.toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.billRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total to Pay</Text>
              <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </FormScroll>

      {/* Sticky Bottom Placement Bar */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerPrice}>₹{grandTotal.toFixed(2)}</Text>
          {totalSavings > 0 ? (
            <View style={styles.footerSavings}>
              <Ionicons name="leaf-outline" size={10} color={Colors.primary} />
              <Text style={styles.footerSavingsText}>You save ₹{totalSavings.toFixed(2)}</Text>
            </View>
          ) : (
            <Text style={styles.footerItemText}>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</Text>
          )}
        </View>

        {/* View Cart mini trigger */}
        <TouchableOpacity
          style={styles.viewCartBadgeBtn}
          onPress={() => router.push('/groceries/cart')}
          activeOpacity={0.8}
        >
          <View style={styles.cartIconWrapper}>
            <Ionicons name="cart-outline" size={14} color={Colors.primary} />
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cartItemCount}</Text>
            </View>
          </View>
          <Text style={styles.viewCartText}>View Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.placeOrderBtn}
          onPress={handlePlaceOrder}
          activeOpacity={0.8}
        >
          <Text style={styles.placeOrderText}>Place Order</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.surface} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: Colors.surface,
    fontSize: 11,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  fulfillmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  fulfillmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  selectedFulfillmentBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  fulfillmentText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  selectedFulfillmentText: {
    color: Colors.primary,
  },
  slotListLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  slotList: {
    gap: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 10,
  },
  selectedSlotRow: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  slotRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioIcon: {
    marginRight: 8,
  },
  slotDetails: {
    justifyContent: 'center',
  },
  slotDayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotDay: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  slotBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fastestBadge: {
    backgroundColor: '#DCFCE7',
  },
  freeBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  slotBadgeText: {
    fontSize: 8,
  },
  fastestText: {
    color: Colors.primary,
  },
  freeText: {
    color: Colors.primary,
  },
  slotWindow: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  slotFeeText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  greenFeeText: {
    color: Colors.primary,
  },
  // Location Card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: 10,
    marginBottom: 12,
  },
  locationCardIcon: {
    marginRight: 8,
  },
  locationTextWrapper: {
    flex: 1,
  },
  locationCardTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  locationCardSub: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeBtnText: {
    fontSize: 11,
    color: Colors.primary,
  },
  inputLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 10,
    paddingBottom: 20,
    fontSize: 12,
    color: Colors.textPrimary,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  charLimitText: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontSize: 9,
    color: Colors.textMuted,
  },
  // Tip Layout
  tipDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  tipChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTipChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  selectedTipText: {
    color: Colors.surface,
  },
  // Payment List
  paymentList: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  selectedPaymentRow: {
    borderColor: '#DCFCE7',
    backgroundColor: Colors.surfaceElevated,
  },
  paymentIcon: {
    marginRight: 10,
  },
  paymentLabel: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  selectedPaymentLabel: {
    color: Colors.textPrimary,
  },
  // Summary Details
  summaryTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  summaryList: {
    gap: 8,
    marginBottom: 12,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryItemImg: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  summaryItemDetails: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  summaryItemUnit: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  summaryItemPrice: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  // Bill Breakdown table
  billBreakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
    gap: 6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  billValue: {
    fontSize: 11,
    color: Colors.textPrimary,
  },
  greenText: {
    color: Colors.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    color: Colors.primary,
  },
  // Sticky Footer checkout bar
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  footerLeft: {
    justifyContent: 'center',
  },
  footerPrice: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  footerSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  footerSavingsText: {
    fontSize: 10,
    color: Colors.primary,
  },
  footerItemText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  viewCartBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartIconWrapper: {
    position: 'relative',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1.5,
  },
  cartCountText: {
    color: Colors.surface,
    fontSize: 7,
  },
  viewCartText: {
    color: Colors.primary,
    fontSize: 11,
  },
  placeOrderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  placeOrderText: {
    color: Colors.surface,
    fontSize: 13,
  },
});
