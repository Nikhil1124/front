import { useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { ReplacementPicker } from '../components/grocery/ReplacementPicker';
import { useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';

import { Ionicons } from '@expo/vector-icons';
import { GroceryColors, Radii } from '@/theme';
import { MiniProductCard } from '../components/ui/MiniProductCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useActiveProperty } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { getPerUnitRateLabel } from '../utils/pricing';
import { useSubmitProcurementOrder } from '@/features/procurement/useProcurement';
import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, Txt } from '@/components/ui';

const FREE_DELIVERY_THRESHOLD = 500;
const DELIVERY_FEE = 30;
const PLATFORM_FEE = 5;

export function GroceryCartScreen() {
  const { items, updateQuantity, removeItem, setReplacement, getCartTotal, getBillEstimate, clearCart, getTotalSavings } = useCartStore();
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

  const subtotal = getCartTotal();
  const { subtotal: billSubtotal } = getBillEstimate();
  const totalSavings = getTotalSavings();

  // Delivery progress
  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const deliveryFreeUnlocked = subtotal >= FREE_DELIVERY_THRESHOLD;
  const progressPercent = Math.min(1, subtotal / FREE_DELIVERY_THRESHOLD);

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Are you sure you want to remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearCart() },
    ]);
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    Alert.alert('Remove Item', `Remove ${itemName} from the cart?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId) },
    ]);
  };

  const [showAddressPrompt, setShowAddressPrompt] = useState(false);

  const isChef = usePGowStore((s) => s.activeRole) === 'CHEF';
  const submitProcurementOrder = useSubmitProcurementOrder();
  const [submittingRequisition, setSubmittingRequisition] = useState(false);

  const handleCheckoutOrRequest = async () => {
    if (isChef) {
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

  const recommendations = useMemo(() => supplyItems.slice(0, 6), [supplyItems]);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <AppHeader
        title="Your Cart"
        onBack={() => router.back()}
        actions={
          items.length > 0 ? (
            <AnimatedPress accessibilityRole="button" onPress={handleClearCart} style={styles.clearBtn}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.clearText}>Clear All</Txt>
            </AnimatedPress>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        /* ── Empty state ── */
        <View style={styles.emptyCart}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="cart-outline" size={56} color={GroceryColors.primary} />
          </View>
          <Txt maxFontSizeMultiplier={1.3} style={styles.emptyTitle}>Your cart is empty</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.emptySubtitle}>
            Add groceries for your PG kitchen or pick up essentials for your stay.
          </Txt>
          <AnimatedPress accessibilityRole="button" style={styles.shopBtn} onPress={() => router.back()}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.shopBtnText}>Start Shopping</Txt>
          </AnimatedPress>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* ── Delivery progress bar ── */}
            <View style={styles.deliveryProgressCard}>
              <View style={styles.deliveryProgressRow}>
                <Ionicons name="bicycle" size={18} color={GroceryColors.primary} />
                {deliveryFreeUnlocked ? (
                  <Txt maxFontSizeMultiplier={1.2} style={styles.deliveryProgressText}>
                    🎉 You've unlocked{' '}
                    <Txt style={styles.deliveryProgressBold}>FREE delivery!</Txt>
                  </Txt>
                ) : (
                  <Txt maxFontSizeMultiplier={1.2} style={styles.deliveryProgressText}>
                    You are just{' '}
                    <Txt style={styles.deliveryProgressBold}>₹{amountToFreeDelivery}</Txt>
                    {' '}away from FREE delivery!
                  </Txt>
                )}
                <Txt maxFontSizeMultiplier={1.1} style={styles.deliveryThreshold}>
                  ₹{FREE_DELIVERY_THRESHOLD}
                </Txt>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent * 100}%` }]} />
              </View>
            </View>

            {/* ── Cart items ── */}
            {items.map((item) => {
              const isEditingReplacement = editingReplacementId === item.id;
              const perUnitRateText = mode === 'owner' ? getPerUnitRateLabel(item.unit, item.price) : '';

              return (
                <View key={item.id} style={styles.cartCard}>
                  <View style={styles.cartItemRow}>
                    {/* Thumbnail */}
                    <View style={styles.thumbnailContainer}>
                      <Image
                        source={
                          item.image
                            ? { uri: item.image }
                            : require('../../../../assets/productimages/d1_nobg.webp')
                        }
                        style={styles.thumbnail}
                      />
                    </View>

                    {/* Info */}
                    <View style={styles.itemInfo}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Txt>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.itemUnit}>
                        {item.unit}
                      </Txt>
                      {perUnitRateText ? (
                        <Txt maxFontSizeMultiplier={1.2} style={styles.unitRateText}>
                          {perUnitRateText}
                        </Txt>
                      ) : null}
                      <View style={styles.priceRow}>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.itemPrice}>
                          ₹{item.price * item.quantity}
                        </Txt>
                        {item.originalPrice ? (
                          <Txt maxFontSizeMultiplier={1.3} style={styles.itemStrikePrice}>
                            ₹{item.originalPrice * item.quantity}
                          </Txt>
                        ) : null}
                      </View>
                    </View>

                    {/* Right: delete + qty */}
                    <View style={styles.cartItemActions}>
                      <AnimatedPress
                        accessibilityRole="button"
                        style={styles.deleteBtn}
                        onPress={() => handleRemoveItem(item.id, item.name)}
                      >
                        <Ionicons name="trash-outline" size={16} color={GroceryColors.textMuted} />
                      </AnimatedPress>

                      <View style={styles.qtyControl}>
                        <AnimatedPress
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          style={styles.qtyBtn}
                          onPress={() =>
                            item.quantity > 1
                              ? updateQuantity(item.id, item.quantity - 1)
                              : handleRemoveItem(item.id, item.name)
                          }
                        >
                          <Ionicons name="remove" size={14} color={GroceryColors.primary} />
                        </AnimatedPress>
                        <Txt maxFontSizeMultiplier={1.2} style={styles.qtyText}>
                          {item.quantity}
                        </Txt>
                        <AnimatedPress
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={14} color={GroceryColors.primary} />
                        </AnimatedPress>
                      </View>
                    </View>
                  </View>

                  {/* Replacement picker */}
                  <AnimatedPress
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    style={styles.replacementToggle}
                    onPress={() => setEditingReplacementId(isEditingReplacement ? null : item.id)}
                  >
                    <ReplacementPicker value={item.replacement || 'best-match'} onChange={() => {}} compact />
                    <Ionicons
                      name={isEditingReplacement ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={GroceryColors.primary}
                    />
                  </AnimatedPress>

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

            {/* ── Add more items ── */}
            <AnimatedPress
              accessibilityRole="button"
              style={styles.addMoreRow}
              onPress={() => router.back()}
            >
              <Ionicons name="add-circle-outline" size={18} color={GroceryColors.primary} />
              <Txt maxFontSizeMultiplier={1.2} style={styles.addMoreText}>Add more items</Txt>
              <Ionicons name="chevron-forward" size={14} color={GroceryColors.primary} />
            </AnimatedPress>

            {/* ── Savings banner ── */}
            {totalSavings > 0 && (
              <View style={styles.savingsBanner}>
                <Txt maxFontSizeMultiplier={1.2} style={styles.savingsIcon}>🏷️</Txt>
                <Txt maxFontSizeMultiplier={1.2} style={styles.savingsText}>
                  You save <Txt style={styles.savingsBold}>₹{totalSavings}</Txt> on this order!
                </Txt>
              </View>
            )}

            {/* ── Bill Details ── */}
            <View style={styles.billCard}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billTitle}>Bill Details</Txt>

              <View style={styles.billRow}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Item Total</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>₹{subtotal}</Txt>
              </View>

              {totalSavings > 0 && (
                <View style={styles.billRow}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Discount</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={[styles.billValue, { color: GroceryColors.discountRed }]}>
                    -₹{totalSavings}
                  </Txt>
                </View>
              )}

              <View style={styles.billRow}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Delivery Fee</Txt>
                {deliveryFreeUnlocked ? (
                  <View style={styles.freeBadgeRow}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.billStrike}>₹{DELIVERY_FEE}</Txt>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.freeLabel}>FREE</Txt>
                  </View>
                ) : (
                  <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>₹{DELIVERY_FEE}</Txt>
                )}
              </View>

              <View style={styles.billRow}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Platform Fee</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>₹{PLATFORM_FEE}</Txt>
              </View>

              <View style={[styles.billRow, styles.totalRow]}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.totalLabel}>Total Amount</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.totalValue}>
                  ₹{billSubtotal + (deliveryFreeUnlocked ? 0 : DELIVERY_FEE) + PLATFORM_FEE}
                </Txt>
              </View>
              <Txt maxFontSizeMultiplier={1.2} style={styles.billFootnote}>
                Item prices are GST-inclusive.
              </Txt>
            </View>

            {/* ── You May Also Need ── */}
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
                    onPress={() =>
                      router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })
                    }
                  />
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* ── Sticky checkout bar ── */}
          <View style={[styles.checkoutBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.checkoutPrice}>
                ₹{billSubtotal + (deliveryFreeUnlocked ? 0 : DELIVERY_FEE) + PLATFORM_FEE}
              </Txt>
              <Txt maxFontSizeMultiplier={1.2} style={styles.checkoutPriceSub}>
                View Details
              </Txt>
            </View>

            <AnimatedPress
              accessibilityRole="button"
              style={[styles.checkoutBtn, submittingRequisition && { opacity: 0.6 }]}
              onPress={handleCheckoutOrRequest}
              disabled={submittingRequisition}
            >
              <Txt maxFontSizeMultiplier={1.3} style={styles.checkoutBtnText}>
                {isChef
                  ? submittingRequisition
                    ? 'Sending…'
                    : 'Request via Manager'
                  : 'Proceed to Checkout →'}
              </Txt>
            </AnimatedPress>
          </View>
        </>
      )}

      <TextPromptDialog
        visible={showAddressPrompt}
        title="Change Address"
        message="Enter your delivery address:"
        label="Delivery address"
        initialValue={deliveryAddress}
        onCancel={() => setShowAddressPrompt(false)}
        onSave={(text) => {
          setDeliveryAddress(text);
          setShowAddressPrompt(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GroceryColors.background,
  },

  // ── Header actions ──
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearText: { fontSize: 13, color: GroceryColors.discountRed, fontWeight: '600' },

  // ── Scroll ──
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 110,
  },

  // ── Delivery progress ──
  deliveryProgressCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: GroceryColors.border,
  },
  deliveryProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  deliveryProgressText: {
    flex: 1,
    fontSize: 12,
    color: GroceryColors.textSecondary,
  },
  deliveryProgressBold: {
    fontWeight: '700',
    color: GroceryColors.primary,
  },
  deliveryThreshold: {
    fontSize: 11,
    fontWeight: '600',
    color: GroceryColors.textMuted,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: GroceryColors.lightGreen,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.pill,
  },

  // ── Cart card ──
  cartCard: {
    backgroundColor: GroceryColors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: GroceryColors.border,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    backgroundColor: GroceryColors.lightGreen,
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: GroceryColors.textPrimary,
    lineHeight: 19,
    marginBottom: 2,
  },
  itemUnit: {
    fontSize: 12,
    color: GroceryColors.textSecondary,
    marginBottom: 2,
  },
  unitRateText: {
    fontSize: 10,
    color: GroceryColors.textMuted,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: GroceryColors.primary,
  },
  itemStrikePrice: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    textDecorationLine: 'line-through',
  },
  cartItemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 8,
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GroceryColors.border,
    borderRadius: Radii.badge,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GroceryColors.softGreen,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    minWidth: 22,
    textAlign: 'center',
  },

  // ── Replacement picker ──
  replacementToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GroceryColors.borderSubtle,
  },
  replacementPickerWrapper: { marginTop: 8 },

  // ── Add more ──
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: GroceryColors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    borderStyle: 'dashed',
  },
  addMoreText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: GroceryColors.primary,
  },

  // ── Savings banner ──
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GroceryColors.lightGreen,
    borderRadius: Radii.control,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: GroceryColors.border,
  },
  savingsIcon: { fontSize: 16 },
  savingsText: {
    fontSize: 13,
    color: GroceryColors.textSecondary,
  },
  savingsBold: {
    fontWeight: '700',
    color: GroceryColors.primary,
  },

  // ── Bill details ──
  billCard: {
    backgroundColor: GroceryColors.white,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: GroceryColors.border,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  billLabel: { fontSize: 13, color: GroceryColors.textSecondary },
  billValue: { fontSize: 13, color: GroceryColors.textPrimary, fontWeight: '500' },
  billStrike: {
    fontSize: 12,
    color: GroceryColors.textMuted,
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  freeBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  freeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GroceryColors.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: GroceryColors.borderSubtle,
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: GroceryColors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '800', color: GroceryColors.primary },
  billFootnote: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    marginTop: 4,
  },

  // ── Recommendations ──
  recSection: { marginHorizontal: 16, marginBottom: 14 },
  recScrollContent: { gap: 8 },

  // ── Checkout bar ──
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GroceryColors.white,
    borderTopWidth: 1,
    borderTopColor: GroceryColors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  checkoutPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: GroceryColors.primary,
  },
  checkoutPriceSub: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    textDecorationLine: 'underline',
  },
  checkoutBtn: {
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.control,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minWidth: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    color: GroceryColors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Empty state ──
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: GroceryColors.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: GroceryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  shopBtn: {
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.control,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  shopBtnText: {
    color: GroceryColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
