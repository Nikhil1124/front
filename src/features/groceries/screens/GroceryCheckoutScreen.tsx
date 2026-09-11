import { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { FormScroll } from '@/components/ui/FormScroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/useCartStore';
import { Radii, Colors } from '@/theme';
import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';

interface CheckoutSlot {
  id: string;
  day: string;
  badge: string;
  window: string;
  fee: number;
  feeText: string;
}

// There used to be a `CHECKOUT_SLOTS` constant here: five invented delivery windows,
// including an "Express • 15–25 min" option that corresponds to nothing the delivery-slot
// system can actually promise. It rendered whenever the real slot list was empty or still
// loading — indistinguishable from live slots — and its ids were never sent to the server,
// so picking one silently dropped the choice. Slots now come only from
// `GET /v1/supply/delivery-slots/applicable`; when ops has configured none for this area,
// the section says so instead of making some up.

/**
 * Who may pay how, mirroring the server's own matrix (`ordering._METHODS_BY_BILLED_TO`).
 *
 * The split is not cosmetic: `create_order` derives `billed_to` from the placer's role at
 * the property — owner/manager bills the property, everyone else bills themselves — and
 * then rejects any method outside that row with a 422. One hardcoded list for everybody
 * meant an owner picking Cash on Delivery and a guest picking Card both got a flat
 * "Payment method is not available for this order" at submit, and that credit — the whole
 * point of the property's credit line — was never offered to anyone at all.
 *
 * ponytail: 'upi' and 'card' are still valid on the server (`PaymentMethodName`), but
 * neither has a real payment gateway behind it — 'upi' is a manual-UTR-then-ops-verifies
 * flow and 'card' has no processing path at all — so they're hidden here for now. Only the
 * two methods that are actually workable end-to-end without a gateway stay offered. Add
 * them back to these lists once a real processor is wired up.
 */
const PROPERTY_BILLED_METHODS = [
  { id: 'credit', label: 'Pay on credit (property account)', icon: 'business-outline' },
];

const GUEST_BILLED_METHODS = [
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline' },
];

import { useActiveProperty } from '@/features/properties/useProperties';
import { useAuthStore } from '@/store/authStore';
import {
  useCreateSupplyOrderMutation,
  useCreditAccountQuery,
  useApplicableDeliverySlotsQuery,
} from '../useSupplyOrders';
import { formatINR } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, OutlinedTextField, Txt } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

export function GroceryCheckoutScreen() {
  const { activeEntity: owner } = useActiveProperty();
  const activePgId = useAuthStore((s) => s.activePgId);
  const ownerForGuest = owner;
  const insets = useSafeAreaInsets();

  const { items, getCartTotal, getBillEstimate, clearCart, getItemCount, getTotalSavings } = useCartStore();
  const createOrderMutation = useCreateSupplyOrderMutation();
  // One key per checkout attempt-set. `Math.random` is fine here — this only needs to be
  // unique per device per pending order, not cryptographically strong.
  const idempotencyKey = useRef(`ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // There is no "Store Pickup". `CreateOrderRequest` has no fulfillment field, the supply
  // order state machine has no pickup state, and no warehouse in this product runs a counter
  // a resident can collect from. The toggle that used to sit here changed nothing on the
  // server — the order dispatched as a normal delivery either way — while zeroing the
  // delivery fee on this screen, so a resident who chose it was quoted a total the server
  // would not honour. Removed rather than faked. Add it back with a `fulfillment_mode` on the
  // order and a pickup state server-side if the warehouses ever offer collection.
  // No default: '1' used to point at the first invented fallback slot. The effect below
  // selects the first REAL slot once they load, and leaves this empty if there are none.
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [driverNote, setDriverNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cod');

  // Same rule the server applies in `_placing_membership`: owner/manager bill the property,
  // everyone else bills themselves. Read from the role held at the ACTIVE property, which is
  // the one this order is placed against.
  const activeRole = useAuthStore((s) => s.activeRole);
  const billsToProperty = activeRole === 'owner' || activeRole === 'manager';
  const paymentMethods = billsToProperty ? PROPERTY_BILLED_METHODS : GUEST_BILLED_METHODS;

  // Only someone who manages the PG may read its credit line — the same people who may pay
  // with it — so this never fires for a guest.
  const { data: creditAccount, error: creditError } = useCreditAccountQuery(
    activePgId ?? owner?.id,
    billsToProperty
  );
  const [deliveryAddress, setDeliveryAddress] = useState((owner ?? ownerForGuest)?.address ?? 'Your PG address');

  const targetPgId = activePgId || owner?.id;
  const { data: realSlots } = useApplicableDeliverySlotsQuery(targetPgId);

  const slotsList = useMemo<CheckoutSlot[]>(
    () =>
      (realSlots ?? []).map((s) => ({
        id: s.id,
        day: 'Delivery Window',
        badge: s.scope_type === 'global' ? 'STANDARD' : 'AREA',
        window: `${s.label} (${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)})`,
        fee: 0,
        feeText: 'FREE',
      })),
    [realSlots]
  );

  useEffect(() => {
    if (slotsList.length > 0 && !slotsList.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(slotsList[0].id);
    }
  }, [slotsList, selectedSlotId]);

  // May be undefined: ops can have zero slots configured for this area. Everything below
  // has to tolerate that rather than assuming a fallback row exists to read `.fee` off.
  const selectedSlot = useMemo(
    () => slotsList.find((s) => s.id === selectedSlotId) ?? slotsList[0],
    [slotsList, selectedSlotId]
  );

  const subtotal = getCartTotal();
  const deliveryFee = selectedSlot?.fee ?? 0;
  // GST is inside `subtotal`, not added to it — supply_items.price is tax-inclusive and the
  // server splits it the same way (see getBillEstimate). Delivery fee is the only addition —
  // there used to be a flat ₹10 "platform fee" and a delivery-partner tip selector here too,
  // but `CreateOrderRequest` has no field for either (extra="forbid" rejects one if sent) and
  // no tip/platform-fee concept exists anywhere in pg-backend's supply module. Both were pure
  // client-side numbers added to what looked like the real total and then discarded on
  // submit — the tip in particular promised "100% goes to your delivery partner" and never
  // reached one. Estimated Total now matches what the server will actually total.
  const { tax: billTax, taxable: billTaxable } = getBillEstimate();
  const estimatedTotal = Math.round((subtotal + deliveryFee) * 100) / 100;
  const cartItemCount = getItemCount();
  const totalSavings = getTotalSavings();

  useEffect(() => {
    if (!paymentMethods.some((pm) => pm.id === paymentMethod)) setPaymentMethod(paymentMethods[0].id);
  }, [paymentMethods, paymentMethod]);

  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const toast = useToast();
  const handleUpdateAddress = () => setShowAddressPrompt(true);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast('error', 'Your cart is empty', 'Add something to it before placing an order.');
      return;
    }

    const targetPgId = activePgId || owner?.id;
    if (!targetPgId) {
      toast('error', 'No active property', 'Pick a property before placing an order.');
      return;
    }

    try {
      // Every slot in the list is now a real one from the server, so its id always goes
      // with the order — the server re-validates it (active, and belonging to this PG's
      // area) and snapshots the window onto the order.
      const slotLine = selectedSlot ? `Slot: ${selectedSlot.window}` : '';
      const note = [slotLine, driverNote].filter(Boolean).join(' — ');
      const order = await createOrderMutation.mutateAsync({
        pg_id: targetPgId,
        payment_method: paymentMethod as 'card' | 'upi' | 'credit' | 'cod',
        delivery_slot_id: selectedSlot?.id,
        delivery_note: note || undefined,
        items: items.map((i) => ({
          item_id: i.productId,
          quantity: i.quantity })),
        idempotency_key: idempotencyKey.current });

      // Fresh key for any subsequent order placed without remounting this screen.
      idempotencyKey.current = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      clearCart();
      router.push({ pathname: '/groceries/orders/[id]', params: { id: order.id } });
    } catch (err: any) {
      toast('error', 'Order failed', err?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>


      {/* Header */}
      <AppHeader title="Checkout" onBack={() => router.back()} />

      <FormScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Fulfillment & Time Slot */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.stepBadgeText}>1</Txt>
            </View>
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle}>Delivery</Txt>
          </View>

          <Txt maxFontSizeMultiplier={1.3} style={styles.slotListLabel}>Select delivery time</Txt>

          {slotsList.length === 0 && (
            <Txt maxFontSizeMultiplier={1.3} style={styles.slotEmptyText}>
              No delivery windows are set up for your area yet. You can still place this
              order — the warehouse will schedule it and confirm the time with you.
            </Txt>
          )}

          {/* Slots list */}
          <View style={styles.slotList}>
            {slotsList.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              const isFastest = slot.badge === 'FASTEST';

              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={slot.id}
                  style={[styles.slotRow, isSelected && styles.selectedSlotRow]}
                  onPress={() => setSelectedSlotId(slot.id)}

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
                        <Txt maxFontSizeMultiplier={1.3} style={styles.slotDay}>{slot.day}</Txt>
                        <View style={[styles.slotBadge, isFastest ? styles.fastestBadge : styles.freeBadge]}>
                          <Txt maxFontSizeMultiplier={1.3} style={[styles.slotBadgeText, isFastest ? styles.fastestText : styles.freeText]}>
                            {slot.badge}
                          </Txt>
                        </View>
                      </View>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.slotWindow}>{slot.window}</Txt>
                    </View>
                  </View>

                  <Txt maxFontSizeMultiplier={1.3} style={[styles.slotFeeText, slot.fee === 0 && styles.greenFeeText]}>
                    {slot.feeText}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </View>
        </View>

        {/* Section 2: Address & Instructions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.stepBadgeText}>2</Txt>
            </View>
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle}>Delivery Address</Txt>
          </View>

          {/* Location card */}
          <View style={styles.locationCard}>
            <Ionicons name="location" size={18} color={Colors.primary} style={styles.locationCardIcon} />
            <View style={styles.locationTextWrapper}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.locationCardTitle}>Deliver to</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.locationCardSub} numberOfLines={1}>{deliveryAddress}</Txt>
            </View>
            <AnimatedPress accessibilityRole="button" onPress={handleUpdateAddress} style={styles.changeBtn}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.changeBtnText}>Change</Txt>
              <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} />
            </AnimatedPress>
          </View>

          {/* Instruction input */}
          <OutlinedTextField
            label="Delivery instructions (optional)"
            placeholder="Leave at door, call when arrived"
            value={driverNote}
            onChangeText={(text: string) => text.length <= 120 && setDriverNote(text)}
            multiline
            helper={`${driverNote.length}/120`}
          />
        </View>

        {/* Section 3: Payment Method */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.stepBadgeText}>3</Txt>
            </View>
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle}>Payment Method</Txt>
          </View>

          <View style={styles.paymentList}>
            {paymentMethods.map((pm) => {
              const isSelected = paymentMethod === pm.id;
              // A closed credit account is the one unambiguous "you cannot pay this way".
              // The remaining balance is NOT used to disable: the server prices the order
              // itself (no tip, no fees), so blocking on this screen's estimate would refuse
              // orders the server would have accepted. It is shown as guidance, and
              // `_enforce_credit_limit` remains the thing that actually decides.
              const isCredit = pm.id === 'credit';
              const isDisabled = isCredit && creditAccount != null && !creditAccount.is_active;
              const overCredit =
                isCredit &&
                creditAccount != null &&
                creditAccount.is_active &&
                Number(creditAccount.available) < estimatedTotal;

              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={pm.id}
                  style={[
                    styles.paymentRow,
                    isSelected && styles.selectedPaymentRow,
                    isDisabled && styles.disabledPaymentRow,
                  ]}
                  onPress={() => !isDisabled && setPaymentMethod(pm.id)}
                  disabled={isDisabled}

                >
                  <Ionicons
                    name={pm.icon as any}
                    size={18}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                    style={styles.paymentIcon}
                  />
                  <View style={styles.paymentLabelColumn}>
                    <Txt maxFontSizeMultiplier={1.3} style={[styles.paymentLabel, isSelected && styles.selectedPaymentLabel]}>
                      {pm.label}
                    </Txt>
                    {/* The gating above deliberately fails open — a failed status check must
                        not remove a payment method. But silently showing nothing implies the
                        limit was checked and was fine, which at a payment step is the wrong
                        impression to leave. */}
                    {isCredit && !creditAccount && creditError && (
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.paymentSubLabel, styles.paymentWarnLabel]}>
                        Balance couldn&apos;t be checked just now — this order may be refused.
                      </Txt>
                    )}
                    {isCredit && creditAccount && (
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.paymentSubLabel, overCredit && styles.paymentWarnLabel]}>
                        {!creditAccount.is_active
                          ? 'This property has no active credit account.'
                          : overCredit
                            ? `Only ₹${creditAccount.available} left of ₹${creditAccount.credit_limit} — this order may be refused.`
                            : `₹${creditAccount.available} of ₹${creditAccount.credit_limit} available`}
                      </Txt>
                    )}
                  </View>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={isSelected ? Colors.primary : Colors.textMuted}
                  />
                </AnimatedPress>
              );
            })}
          </View>
        </View>

        {/* Section 5: Order Summary */}
        <View style={styles.card}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.summaryTitle}>Order Summary</Txt>
          
          {/* Order preview items list */}
          <View style={styles.summaryList}>
            {items.map((item) => (
              <View key={item.id} style={styles.summaryItemRow}>
                <Image
                  source={item.image ? { uri: item.image } : require('../../../../assets/productimages/d1_nobg.webp')}

                  style={styles.summaryItemImg}
                />
                <View style={styles.summaryItemDetails}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.summaryItemName} numberOfLines={1}>{item.name}</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.summaryItemUnit}>{item.unit} × {item.quantity}</Txt>
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.summaryItemPrice}>₹{item.price * item.quantity}</Txt>
              </View>
            ))}
          </View>

          {/* Pricing breakdown */}
          <View style={styles.billBreakdown}>
            <View style={styles.billRow}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Taxable Value</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>{formatINR(billTaxable, 2)}</Txt>
            </View>

            <View style={styles.billRow}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>GST</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>{formatINR(billTax, 2)}</Txt>
            </View>

            <View style={styles.billRow}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Item Total (incl. GST)</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billValue}>{formatINR(subtotal, 2)}</Txt>
            </View>

            <View style={styles.billRow}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Delivery Fee</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={[styles.billValue, deliveryFee === 0 && styles.greenText]}>
                {deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee, 2)}
              </Txt>
            </View>

            <View style={[styles.billRow, styles.totalRow]}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.totalLabel}>Estimated Total</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.totalValue}>{formatINR(estimatedTotal, 2)}</Txt>
            </View>
            <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Item prices include GST. Your final invoice is confirmed when the order is placed.</Txt>
          </View>
        </View>
      </FormScroll>

      {/* Sticky Bottom Placement Bar */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerLeft}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.footerPrice}>{formatINR(estimatedTotal, 2)}</Txt>
          {totalSavings > 0 ? (
            <View style={styles.footerSavings}>
              <Ionicons name="leaf-outline" size={10} color={Colors.primary} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.footerSavingsText}>You save {formatINR(totalSavings, 2)}</Txt>
            </View>
          ) : (
            <Txt maxFontSizeMultiplier={1.3} style={styles.footerItemText}>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</Txt>
          )}
        </View>

        {/* View Cart mini trigger */}
        <AnimatedPress accessibilityRole="button"
          style={styles.viewCartBadgeBtn}
          onPress={() => router.push('/groceries/cart')}

        >
          <View style={styles.cartIconWrapper}>
            <Ionicons name="cart-outline" size={14} color={Colors.primary} />
            <View style={styles.cartCountBadge}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.cartCountText}>{cartItemCount}</Txt>
            </View>
          </View>
          <Txt maxFontSizeMultiplier={1.3} style={styles.viewCartText}>View Cart</Txt>
        </AnimatedPress>

        <AnimatedPress accessibilityRole="button"
          style={[styles.placeOrderBtn, createOrderMutation.isPending && { opacity: 0.6 }]}
          onPress={handlePlaceOrder}

          // Unguarded, a double-tap fired two POSTs — two real orders, two stock
          // decrements, two charges. `idempotency_key` below is the second line of defence.
          disabled={createOrderMutation.isPending}
        >
          <Txt maxFontSizeMultiplier={1.3} style={styles.placeOrderText}>
            {createOrderMutation.isPending ? 'Placing…' : 'Place Order'}
          </Txt>
          <Ionicons name="arrow-forward" size={16} color={Colors.surface} style={{ marginLeft: 4 }} />
        </AnimatedPress>
      </View>
      <TextPromptDialog
        visible={showAddressPrompt}
        title="Change Address"
        message="Enter your delivery address:"
        label="Delivery address"
        initialValue={deliveryAddress}
        onCancel={() => setShowAddressPrompt(false)}
        onSave={(text) => { setDeliveryAddress(text); setShowAddressPrompt(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center' },
  stepBadgeText: {
    color: Colors.surface,
    fontSize: 11 },
  cardTitle: {
    fontSize: 14,
    color: Colors.textPrimary },
  slotListLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8 },
  slotEmptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8 },
  slotList: {
    gap: 8 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.control },
  selectedSlotRow: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated },
  slotRowLeft: {
    flexDirection: 'row',
    alignItems: 'center' },
  radioIcon: {
    marginRight: 8 },
  slotDetails: {
    justifyContent: 'center' },
  slotDayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 },
  slotDay: {
    fontSize: 13,
    color: Colors.textPrimary },
  slotBadge: {
    borderRadius: Radii.badge,
    paddingHorizontal: 4,
    paddingVertical: 2 },
  fastestBadge: {
    backgroundColor: Colors.surfaceElevated },
  freeBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  slotBadgeText: {
    fontSize: 8 },
  fastestText: {
    color: Colors.primary },
  freeText: {
    color: Colors.primary },
  slotWindow: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1 },
  slotFeeText: {
    fontSize: 12,
    color: Colors.textPrimary },
  greenFeeText: {
    color: Colors.primary },
  // Location Card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 10,
    marginBottom: 12 },
  locationCardIcon: {
    marginRight: 8 },
  locationTextWrapper: {
    flex: 1 },
  locationCardTitle: {
    fontSize: 11,
    color: Colors.textSecondary },
  locationCardSub: {
    fontSize: 12,
    color: Colors.textPrimary },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2 },
  changeBtnText: {
    fontSize: 11,
    color: Colors.primary },
  // Payment List
  paymentList: {
    gap: 8 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface },
  selectedPaymentRow: {
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceElevated },
  paymentIcon: {
    marginRight: 10 },
  disabledPaymentRow: {
    opacity: 0.5 },
  paymentLabelColumn: {
    flex: 1 },
  paymentLabel: {
    fontSize: 12,
    color: Colors.textSecondary },
  selectedPaymentLabel: {
    color: Colors.textPrimary },
  paymentSubLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2 },
  paymentWarnLabel: {
    color: Colors.warning },
  // Summary Details
  summaryTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 10 },
  summaryList: {
    gap: 8,
    marginBottom: 12 },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 },
  summaryItemImg: {
    width: 32,
    height: 32,
    borderRadius: Radii.badge,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface },
  summaryItemDetails: {
    flex: 1 },
  summaryItemName: {
    fontSize: 12,
    color: Colors.textPrimary },
  summaryItemUnit: {
    fontSize: 10,
    color: Colors.textSecondary },
  summaryItemPrice: {
    fontSize: 12,
    color: Colors.textPrimary },
  // Bill Breakdown table
  billBreakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
    gap: 6 },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between' },
  billLabel: {
    fontSize: 11,
    color: Colors.textSecondary },
  billValue: {
    fontSize: 11,
    color: Colors.textPrimary },
  greenText: {
    color: Colors.primary },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 8,
    marginTop: 4 },
  totalLabel: {
    fontSize: 14,
    color: Colors.textPrimary },
  totalValue: {
    fontSize: 16,
    color: Colors.primary },
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
    elevation: 8 },
  footerLeft: {
    justifyContent: 'center' },
  footerPrice: {
    fontSize: 18,
    color: Colors.textPrimary },
  footerSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1 },
  footerSavingsText: {
    fontSize: 10,
    color: Colors.primary },
  footerItemText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1 },
  viewCartBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4 },
  cartIconWrapper: {
    position: 'relative',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center' },
  cartCountBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: Radii.badge,
    minWidth: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1.5 },
  cartCountText: {
    color: Colors.surface,
    fontSize: 7 },
  viewCartText: {
    color: Colors.primary,
    fontSize: 11 },
  placeOrderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.card,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row' },
  placeOrderText: {
    color: Colors.surface,
    fontSize: 13 } });
