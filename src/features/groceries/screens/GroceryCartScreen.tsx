import { SupplyItem } from '@/types';
import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCartStore, CartItem, ReplacementPreference } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { ReplacementPicker } from '../components/grocery/ReplacementPicker';
import { useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';
import { MiniProductCard } from '../components/ui/MiniProductCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useActiveProperty } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { getPerUnitRateLabel } from '../utils/pricing';
import { useSubmitProcurementOrder } from '@/features/procurement/useProcurement';

export function GroceryCartScreen() {
  const { items, updateQuantity, removeItem, setReplacement, getCartTotal, getBillEstimate, clearCart, getItemCount, getTotalSavings } = useCartStore();
  const mode = useShoppingModeStore((s) => s.mode);
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: supplyItems = [] } = useSupplyItems(activePgId);

  const { activeEntity: owner } = useActiveProperty();
  const ownerForGuest = owner;
  const insets = useSafeAreaInsets();

  const [editingReplacementId, setEditingReplacementId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState(
    (owner ?? ownerForGuest)?.address ?? 'Your PG address',
  );

  // Calculations
  const subtotal = getCartTotal();
  const { subtotal: billSubtotal, tax: billTax, taxable: billTaxable } = getBillEstimate();
  const cartItemCount = getItemCount();
  const totalSavings = getTotalSavings();

  // Alert confirmations
  const handleClearCart = () => {
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to remove all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: () => clearCart() }
      ]
    );
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    Alert.alert(
      "Remove Item",
      `Are you sure you want to remove ${itemName} from the cart?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeItem(itemId) }
      ]
    );
  };

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

  const isChef = usePGowStore((s) => s.activeRole) === 'CHEF';
  const submitProcurementOrder = useSubmitProcurementOrder();
  const [submittingRequisition, setSubmittingRequisition] = useState(false);

  const handleCheckoutOrRequest = async () => {
    if (isChef) {
      // Was `submitChefGroceryRequest` — a Zustand-only array nobody ever displayed, so a
      // chef's request vanished on the next app restart and no manager could act on it
      // despite the "sent to the Manager for purchase" confirmation. The real endpoint for
      // exactly this — pg-backend's own words: procurement's catalog IS "the real Supply
      // catalog... what a chef may pick from" (procurement/service.py:list_catalog) — reads
      // the same `supply_items` table this cart's items already come from, so the cart's
      // own ids are valid `item_id`s for a real requisition. Owner/manager then see and
      // approve it on the Approvals tab of this same screen (/procurement).
      if (!activePgId) return;
      setSubmittingRequisition(true);
      try {
        await submitProcurementOrder.mutateAsync({
          pg_id: activePgId,
          order_type: 'supplies',
          items: items.map((i) => ({ item_id: i.productId, quantity: i.quantity })),
        });
        clearCart();
        Alert.alert('Requisition Sent', 'Your grocery list has been sent to the owner/manager for approval.');
        router.back();
      } catch (err) {
        Alert.alert('Could not send request', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setSubmittingRequisition(false);
      }
      return;
    }
    router.push('/groceries/checkout');
  };

  // Recommendations list
  const recommendations = useMemo(() => supplyItems.slice(0, 6), [supplyItems]);

  return (
    <View style={styles.container}>

      {/* 2. Cart Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart ({cartItemCount})</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {items.length === 0 ? (
        /* 18. Empty Cart State */
        <View style={styles.emptyCart}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="cart-outline" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add groceries for your PG kitchen or pick up essentials for your stay.
          </Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 3. Delivery Information */}
            <TouchableOpacity style={styles.deliveryCard} onPress={handleUpdateAddress} activeOpacity={0.9}>
              <View style={styles.deliveryLeft}>
                <View style={styles.deliveryHeaderRow}>
                  <Ionicons name="location-outline" size={16} color={Colors.info} style={styles.locationIcon} />
                  <Text style={styles.deliveryTitle}>Deliver to</Text>
                </View>
                <Text style={styles.deliveryAddress} numberOfLines={1}>
                  {deliveryAddress} <Ionicons name="chevron-down" size={11} color={Colors.textSecondary} />
                </Text>
              </View>
              <View style={styles.deliveryRight}>
                <Text style={styles.deliveryRightLabel}>Estimated Delivery</Text>
                <Text style={styles.deliveryTimeText}>Today • 6:00 PM – 8:00 PM</Text>
              </View>
            </TouchableOpacity>

            {/* 4. Free Delivery Progress Box */}
            <View style={styles.freeDeliveryCard}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={styles.freeDeliveryText}>✓ FREE DELIVERY unlocked</Text>
            </View>

            {/* 5. Cart Item Cards */}
            <Text style={styles.sectionHeading}>Items in Cart</Text>
            {items.map((item) => {
              const isEditingReplacement = editingReplacementId === item.id;
              const hasDiscount = item.originalPrice && item.originalPrice > item.price;
              const itemSavings = hasDiscount ? (item.originalPrice! - item.price) * item.quantity : 0;
              
              // Calculate unit price if in owner mode (e.g. 10 kg -> ₹48/kg)
              const perUnitRateText = mode === 'owner' ? getPerUnitRateLabel(item.unit, item.price) : '';

              return (
                <View key={item.id} style={styles.cartCard}>
                  <View style={styles.cartItemHeader}>
                    {/* Left: Product Image */}
                    <View style={styles.imageContainer}>
                      <Image
                        source={item.image ? { uri: item.image } : require('../../../../assets/img_app_icon.jpg')}
                        style={styles.itemImage}
                      />
                    </View>

                    {/* Middle: Product Info */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.itemUnit}>{item.unit}</Text>
                      
                      {perUnitRateText ? (
                        <Text style={styles.unitRateText}>{perUnitRateText}</Text>
                      ) : null}

                      <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                        {item.originalPrice ? (
                          <Text style={styles.strikePrice}>₹{item.originalPrice * item.quantity}</Text>
                        ) : null}
                      </View>

                      {itemSavings > 0 ? (
                        <Text style={styles.itemSavingsText}>Save ₹{itemSavings}</Text>
                      ) : null}
                    </View>

                    {/* Right: Quantity Adjuster & Delete Action */}
                    <View style={styles.actionsContainer}>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : handleRemoveItem(item.id, item.name)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity + 1)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.removeAction}
                        onPress={() => handleRemoveItem(item.id, item.name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={12} color={Colors.danger} />
                        <Text style={styles.removeActionText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Replacement Picker option */}
                  <TouchableOpacity
                    style={styles.replacementToggle}
                    onPress={() => setEditingReplacementId(isEditingReplacement ? null : item.id)}
                    activeOpacity={0.8}
                  >
                    <ReplacementPicker value={item.replacement || 'best-match'} onChange={() => {}} compact />
                    <Ionicons
                      name={isEditingReplacement ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>

                  {isEditingReplacement && (
                    <View style={styles.replacementPickerWrapper}>
                      <ReplacementPicker
                        value={item.replacement || 'best-match'}
                        onChange={(pref) => {
                          setReplacement(item.id, pref);
                          setEditingReplacementId(null);
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {/* 13. Savings Summary banner card */}
            {totalSavings > 0 && (
              <View style={styles.savingsCard}>
                <Text style={styles.savingsTagIcon}>🏷️</Text>
                <View style={styles.savingsTextWrapper}>
                  <Text style={styles.savingsCardTitle}>You save ₹{totalSavings} today!</Text>
                  <Text style={styles.savingsCardSubtitle}>Great deal for your PG kitchen</Text>
                </View>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>-₹{totalSavings}</Text>
                </View>
              </View>
            )}

            {/* 12. Bill Details Box */}
            <View style={styles.billCard}>
              <Text style={styles.billTitle}>Bill Details</Text>
              
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>₹{subtotal}</Text>
              </View>

              {totalSavings > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Discount</Text>
                  <Text style={[styles.billValue, { color: Colors.danger }]}>-₹{totalSavings}</Text>
                </View>
              )}

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Taxable Value</Text>
                <Text style={styles.billValue}>₹{billTaxable.toFixed(2)}</Text>
              </View>

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>GST</Text>
                <Text style={styles.billValue}>₹{billTax.toFixed(2)}</Text>
              </View>

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Fee</Text>
                <Text style={[styles.billValue, { color: Colors.primary }]}>FREE</Text>
              </View>

              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>₹{billSubtotal}</Text>
              </View>
              <Text style={styles.billFootnote}>Item prices are GST-inclusive. Platform fee &amp; tip are added at checkout.</Text>
            </View>

            {/* 14. You May Also Need — shared MiniProductCard */}
            <View style={styles.recSection}>
              <SectionHeader
                title="You May Also Need"
                actionLabel="View All →"
                onAction={() => router.push('/groceries/categories')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recScrollContent}
              >
                {recommendations.map((p) => (
                  <MiniProductCard
                    key={p.id}
                    product={p}
                    onPress={() => router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 15. Trust / Quality Reassurance strip */}
            <View style={styles.reassuranceStrip}>
              <View style={styles.reassuranceItem}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.reassuranceText}>Quality Checked</Text>
              </View>
              <View style={styles.reassuranceItem}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.reassuranceText}>Hygienically Packed</Text>
              </View>
              <View style={styles.reassuranceItem}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.reassuranceText}>Easy Replacement</Text>
              </View>
            </View>
          </ScrollView>

          {/* 16 & 17. Sticky Checkout Bar */}
          <View style={[styles.stickyCheckoutBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.checkoutBarLeft}>
              <Text style={styles.checkoutPrice}>₹{billSubtotal}</Text>
              <Text style={styles.checkoutInfoText}>
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkoutBtn, submittingRequisition && { opacity: 0.6 }]}
              onPress={handleCheckoutOrRequest}
              activeOpacity={0.8}
              disabled={submittingRequisition}
            >
              <Text style={styles.checkoutBtnText}>
                {isChef ? (submittingRequisition ? 'Sending…' : 'Request via Manager') : 'Proceed to Checkout'}
              </Text>
              <Ionicons name={isChef ? 'send' : 'arrow-forward'} size={16} color={Colors.surface} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </>
      )}
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
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 13,
    color: Colors.danger,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110, // Avoid overlapping sticky bar
  },
  // Delivery layout (Split Row)
  deliveryCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
  },
  deliveryLeft: {
    flex: 1.2,
    justifyContent: 'center',
  },
  deliveryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  locationIcon: {
    marginTop: -1,
  },
  deliveryTitle: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  deliveryAddress: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  deliveryRight: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.borderSubtle,
    justifyContent: 'center',
  },
  deliveryRightLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  deliveryTimeText: {
    color: Colors.info,
    fontSize: 12,
  },
  // Free delivery tag
  freeDeliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 6,
  },
  freeDeliveryText: {
    color: Colors.primaryDark,
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  // Cart Card Layout
  cartCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cartItemHeader: {
    flexDirection: 'row',
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemImage: {
    width: '85%',
    height: '85%',
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 2,
  },
  itemUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  unitRateText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 15,
    color: Colors.primary,
  },
  strikePrice: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  itemSavingsText: {
    fontSize: 10,
    color: Colors.primary,
    marginTop: 2,
  },
  actionsContainer: {
    width: 90,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 2,
    gap: 8,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    color: Colors.textPrimary,
    minWidth: 14,
    textAlign: 'center',
  },
  removeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  removeActionText: {
    fontSize: 11,
    color: Colors.danger,
  },
  replacementToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  replacementPickerWrapper: {
    marginTop: 8,
  },
  // Savings banner summary card
  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  savingsTagIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  savingsTextWrapper: {
    flex: 1,
  },
  savingsCardTitle: {
    fontSize: 13,
    color: Colors.primary,
  },
  savingsCardSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  savingsBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    color: Colors.surface,
    fontSize: 10,
  },
  // Bill Details card
  billCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
  },
  billTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  billValue: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    color: Colors.primary,
  },
  billFootnote: {
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  // You May Also Need Section
  recSection: {
    marginBottom: 16,
  },
  recHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  recSeeAllText: {
    fontSize: 11,
    color: Colors.primary,
  },
  recScrollContent: {
    gap: 8,
  },
  recCard: {
    width: 125,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 14,
    padding: 10,
    position: 'relative',
    marginRight: 6,
  },
  recDiscountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  recDiscountText: {
    color: Colors.surface,
    fontSize: 8,
  },
  recImageContainer: {
    height: 70,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    backgroundColor: Colors.surface,
  },
  recImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  recName: {
    fontSize: 11,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  recUnit: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  recPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginBottom: 8,
  },
  recPrice: {
    fontSize: 12,
    color: Colors.primary,
  },
  recStrikePrice: {
    fontSize: 9,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  recAddBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recAddBtnText: {
    color: Colors.primary,
    fontSize: 11,
  },
  // Reassurance strip
  reassuranceStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 10,
  },
  reassuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reassuranceText: {
    fontSize: 9,
    color: Colors.textPrimary,
  },
  // Sticky Bottom Checkout
  stickyCheckoutBar: {
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
  checkoutBarLeft: {
    justifyContent: 'center',
  },
  checkoutPrice: {
    fontSize: 18,
    color: Colors.primary,
  },
  checkoutInfoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  checkoutBtnText: {
    color: Colors.surface,
    fontSize: 13,
  },
  // Empty state stylings
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.canvas,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  shopBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  shopBtnText: {
    color: Colors.surface,
    fontSize: 14,
  },
});
