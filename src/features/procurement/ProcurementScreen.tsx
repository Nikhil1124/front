import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, RefreshControl, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, OutlinedBtn, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { FormScroll } from '@/components/ui/FormScroll';
import {
  useProcurementCatalog,
  useProcurementOrders,
  useSubmitProcurementOrder,
  useApproveProcurementOrder,
  type ProcurementPaymentMethod,
  useRejectProcurementOrder,
} from './useProcurement';
import type { ProcurementCatalogItem } from '@/types';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  grocery: 'nutrition',
  produce: 'leaf',
  dairy: 'water',
  cleaning: 'sparkles',
  toiletries: 'hand-left',
  hardware: 'bulb',
  supplies: 'cube',
  other: 'ellipsis-horizontal-circle',
};

const CATEGORY_TABS = [
  { key: 'all', label: 'All Items' },
  { key: 'grocery', label: '🥫 Grocery' },
  { key: 'produce', label: '🥬 Produce' },
  { key: 'dairy', label: '🥛 Dairy' },
  { key: 'cleaning', label: '🧹 Cleaning' },
  { key: 'toiletries', label: '🧼 Toiletries' },
  { key: 'hardware', label: '💡 Hardware' },
];

import { useActiveProperty } from '@/features/properties/useProperties';

/**
 * Order supplies AND approve requisitions — the same for owner and manager.
 *
 * Used to be two mutually exclusive screens picked by role: a manager got a catalog + cart
 * with no way to approve anything (not even another manager's requisition), an owner got an
 * approval queue with no way to browse the catalog or submit one themselves. Neither
 * restriction exists on the server — `create_order` accepts OWNER, MANAGER or CHEF as the
 * raiser, and `transition` (approve/reject) checks `require_manage`, which is owner OR
 * manager, not owner-only. So both roles get both tabs; the starting tab is just a sensible
 * default for what each role is more often here to do, not a wall.
 */
export function ProcurementScreen() {
  const isManagerMode = useIsManagerMode();
  const activeRole = useAuthStore((s) => s.activeRole);
  // Approving is `require_manage` server-side (transition(), procurement/service.py) —
  // owner or manager only. A chef can raise a requisition (create_order accepts
  // OWNER/MANAGER/CHEF) but can never approve one, including their own, so there is nothing
  // real for an Approvals tab to show them — not even an empty state, since list_orders
  // already scopes a non-managing raiser to their own requests and none of those are ever
  // theirs to approve.
  const canApprove = activeRole === 'owner' || activeRole === 'manager';
  const [tab, setTab] = useState<'order' | 'approvals'>(isManagerMode ? 'order' : 'approvals');

  return (
    <HubScreenWrapper title="Procurement & Supplies" icon="cart-outline">
      {canApprove && (
        <Row gap={8} style={{ marginBottom: 14 }}>
          <TouchableOpacity accessibilityRole="button"
            onPress={() => { setTab('order'); }}
            style={[styles.tabBtn, tab === 'order' && styles.tabBtnActive]}
          >
            <Txt size={12} weight="800" color={tab === 'order' ? Colors.textInverse : Colors.textPrimary}>
              Order Supplies
            </Txt>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            onPress={() => { setTab('approvals'); }}
            style={[styles.tabBtn, tab === 'approvals' && styles.tabBtnActive]}
          >
            <Txt size={12} weight="800" color={tab === 'approvals' ? Colors.textInverse : Colors.textPrimary}>
              Approvals
            </Txt>
          </TouchableOpacity>
        </Row>
      )}
      {canApprove && tab === 'approvals' ? <ApprovalsSection /> : <OrderSuppliesSection />}
    </HubScreenWrapper>
  );
}

function usePgId(): string | null {
  return useAuthStore((s) => s.activePgId);
}

// ─── Manager View: catalog + requisition cart, submitted to the owner ────────

function OrderSuppliesSection() {
  const { activeEntity: owner } = useActiveProperty();
  const pgId = usePgId();
  const toast = useToast();

  const { data: catalog = [], isLoading, isError, refetch, isRefetching } = useProcurementCatalog();
  const { data: myOrders = [] } = useProcurementOrders({ pgId: pgId ?? undefined });
  const submitOrder = useSubmitProcurementOrder();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCartModal, setShowCartModal] = useState(false);

  const filteredItems = catalog.filter((item) => {
    const matchCat = selectedCat === 'all' || item.category === selectedCat;
    const matchSearch = search.trim() === '' || item.itemName.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartItemCount = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const cartTotalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const it = catalog.find((c) => c.id === id);
    return sum + (it ? it.defaultPrice * qty : 0);
  }, 0);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const handleSubmitRequisition = async () => {
    if (cartItemCount === 0 || !pgId) return;
    // {item_id, quantity} — see the note on SubmitProcurementOrderParams for why this used
    // to send five fields the server rejects and the one it requires.
    const items = Object.entries(cart).map(([id, qty]) => ({ item_id: id, quantity: qty }));
    try {
      await submitOrder.mutateAsync({ pg_id: pgId, order_type: 'supplies', items });
      toast('success', 'Requisition Sent', `Requisition for ₹${cartTotalAmount.toLocaleString('en-IN')} sent for approval.`);
      setCart({});
      setShowCartModal(false);
    } catch (err: any) {
      toast('error', 'Submit failed', err?.message ?? 'Please try again.');
    }
  };

  return (
    <>
      <OutlinedTextField
        placeholder="Search supplies (e.g. bedsheets, cleaners, bulbs)..."
        value={search}
        onChangeText={setSearch}
        leadingIcon="search"
        containerColor={Colors.surface}
      />

      <Spacer size={12} />

      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATEGORY_TABS.map((tab) => {
          const isSel = selectedCat === tab.key;
          return (
            <AnimatedPress
              key={tab.key}
              scale={0.96}
              onPress={() => { setSelectedCat(tab.key); }}
            >
              <View style={[styles.catPill, isSel && styles.catPillActive]}>
                <Txt size={12} weight="800" color={isSel ? Colors.textInverse : Colors.textPrimary}>
                  {tab.label}
                </Txt>
              </View>
            </AnimatedPress>
          );
        })}
      </FormScroll>

      <Spacer size={14} />

      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">Loading catalog…</Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Row gap={8} align="center">
            <Ionicons name="cloud-offline" size={20} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Couldn't load the catalog</Txt>
              <TouchableOpacity accessibilityRole="button" onPress={() => refetch()}>
                <Txt variant="caption" color={Colors.primary} weight="700">Tap to retry</Txt>
              </TouchableOpacity>
            </Col>
          </Row>
        </Card>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon="cart-outline" title="No items found" subtitle="Try a different search or category." />
      ) : (
        <View style={{ gap: 10 }}>
          {filteredItems.map((item) => (
            <CatalogRow key={item.id} item={item} qty={cart[item.id] ?? 0} onChangeQty={updateQty} />
          ))}
        </View>
      )}

      {myOrders.length > 0 && (
        <>
          <Spacer size={20} />
          <Txt size={14} weight="900" color={Colors.textPrimary}>Recent Requisitions</Txt>
          <Spacer size={8} />
          <View style={{ gap: 8 }}>
            {myOrders.map((ord) => (
              <Card
                key={ord.id}
                containerColor={Colors.surface}
                borderRadius={14}
                borderWidth={1}
                borderColor={Colors.borderSubtle}
                padding={[12, 14]}
              >
                <Row justify="space-between" align="center">
                  <Col>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{ord.items.length} Item{ord.items.length === 1 ? '' : 's'} Requested</Txt>
                    <Txt size={11} color={Colors.textMuted}>₹{ord.totalCost.toLocaleString('en-IN')} • {new Date(ord.createdAt).toLocaleDateString()}</Txt>
                  </Col>
                  <StatusBadge status={ord.status} />
                </Row>
              </Card>
            ))}
          </View>
        </>
      )}

      {cartItemCount > 0 && (
        <AnimatedPress
          scale={0.92}
          onPress={() => { setShowCartModal(true); }}
          style={styles.floatingCart}
        >
          <Row gap={8} align="center">
            <View style={styles.cartCountPill}>
              <Txt size={12} weight="900" color={Colors.primaryDark}>{cartItemCount}</Txt>
            </View>
            <Txt size={13} weight="900" color={Colors.textInverse}>
              View Requisition Cart • ₹{cartTotalAmount.toLocaleString('en-IN')}
            </Txt>
            <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
          </Row>
        </AnimatedPress>
      )}

      <Modal visible={showCartModal} transparent animationType="slide" onRequestClose={() => setShowCartModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setShowCartModal(false)} />
          <Card
            containerColor={Colors.surface}
            borderRadius={24}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[20, 20]}
            style={{ width: '92%', maxHeight: '80%', zIndex: 2 }}
          >
            <Row justify="space-between" align="center">
              <Col>
                <Txt size={18} weight="900" color={Colors.textPrimary}>Requisition Summary</Txt>
                <Txt size={11} color={Colors.textMuted}>{cartItemCount} items selected for {owner?.pgName ?? 'this property'}</Txt>
              </Col>
              <IconBtn onPress={() => setShowCartModal(false)} icon="close" size={18} tint={Colors.textMuted} />
            </Row>

            <Spacer size={14} />

            {/* Same real fix as AddPgPropertyDialog/EditPgPropertyDialog: FormScroll's inner
                ScrollView is hardcoded flex: 1, which needs a flex-bounded ancestor — this
                Card sizes to its own content (maxHeight: '80%' is a cap, not flex: 1), so
                flex: 1 collapsed to zero the same way flex: 0 did. Plain maxHeight-bounded
                ScrollView instead, no flex anywhere in the chain. */}
            <KeyboardAvoidingView behavior="padding">
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 8 }}>
                {Object.entries(cart).map(([id, qty]) => {
                  const it = catalog.find((c) => c.id === id);
                  if (!it) return null;
                  const itemTotal = it.defaultPrice * qty;
                  return (
                    <Row key={id} justify="space-between" align="center" style={styles.cartRow}>
                      <Col style={{ flex: 1 }}>
                        <Txt size={13} weight="800" color={Colors.textPrimary}>{it.itemName}</Txt>
                        <Txt size={11} color={Colors.textMuted}>{it.unit} • ₹{it.defaultPrice} each</Txt>
                      </Col>
                      <Row gap={8} align="center">
                        <Txt size={12} weight="800" color={Colors.textMuted}>×{qty}</Txt>
                        <Txt size={13} weight="900" color={Colors.primaryDark}>₹{itemTotal.toLocaleString('en-IN')}</Txt>
                      </Row>
                    </Row>
                  );
                })}
              </View>
              </ScrollView>
            </KeyboardAvoidingView>

            <Spacer size={14} />
            <View style={{ height: 1, backgroundColor: Colors.borderSubtle }} />
            <Spacer size={12} />

            <Row justify="space-between" align="center">
              <Txt size={14} weight="800" color={Colors.textPrimary}>Estimated Total Cost</Txt>
              <Txt size={20} weight="900" color={Colors.primaryDark}>₹{cartTotalAmount.toLocaleString('en-IN')}</Txt>
            </Row>

            <Spacer size={16} />

            <Btn
              onPress={handleSubmitRequisition}
              loading={submitOrder.isPending}
              disabled={submitOrder.isPending}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={48}
            >
              <Ionicons name="send" size={16} color={Colors.textInverse} />
              <Txt size={13} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>
                Submit Requisition 📦
              </Txt>
            </Btn>
          </Card>
        </View>
      </Modal>
    </>
  );
}

function CatalogRow({
  item, qty, onChangeQty,
}: { item: ProcurementCatalogItem; qty: number; onChangeQty: (id: string, delta: number) => void }) {
  return (
    <Card
      containerColor={Colors.surface}
      borderRadius={16}
      borderWidth={1}
      borderColor={qty > 0 ? Colors.primary : Colors.borderSubtle}
      padding={[14, 14]}
    >
      <Row justify="space-between" align="center">
        <Row gap={12} align="center" style={{ flex: 1 }}>
          <View style={[styles.itemIconWrap, { backgroundColor: qty > 0 ? '#F0FDF9' : Colors.surfaceElevated }]}>
            <Ionicons name={CATEGORY_ICONS[item.category] ?? 'cube'} size={22} color={qty > 0 ? Colors.primary : Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1 }}>
            <Txt size={14} weight="800" color={Colors.textPrimary} numberOfLines={2}>{item.itemName}</Txt>
            <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2 }}>{item.unit}</Txt>
            <Txt size={14} weight="900" color={Colors.primaryDark} style={{ marginTop: 4 }}>
              ₹{item.defaultPrice.toLocaleString('en-IN')}
            </Txt>
          </Col>
        </Row>

        <Row gap={6} align="center">
          {qty > 0 ? (
            <>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button" onPress={() => onChangeQty(item.id, -1)} style={styles.qtyBtn} activeOpacity={0.7}>
                <Ionicons name="remove" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.qtyBox}>
                <Txt size={13} weight="900" color={Colors.primaryDark}>{qty}</Txt>
              </View>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" onPress={() => onChangeQty(item.id, 1)} style={[styles.qtyBtn, { backgroundColor: Colors.primary }]} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color={Colors.textInverse} />
              </TouchableOpacity>
            </>
          ) : (
            <Btn
              onPress={() => onChangeQty(item.id, 1)}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={10}
              height={34}
              contentStyle={{ paddingHorizontal: 12 }}
            >
              <Ionicons name="add" size={14} color={Colors.textInverse} />
              <Txt size={11} weight="800" color={Colors.textInverse} style={{ marginLeft: 4 }}>+ Add</Txt>
            </Btn>
          )}
        </Row>
      </Row>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'approved' ? { bg: '#ECFDF5', text: '#047857', label: 'APPROVED' } :
    status === 'rejected' ? { bg: '#FEF2F2', text: '#DC2626', label: 'REJECTED' } :
    status === 'ordered' || status === 'delivered' ? { bg: '#EFF6FF', text: '#1D4ED8', label: status.toUpperCase() } :
    { bg: '#FFFBEB', text: '#D97706', label: 'PENDING APPROVAL' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Txt size={10} weight="800" color={style.text}>{style.label}</Txt>
    </View>
  );
}

// ─── Owner View: real requisitions approval queue ─────────────────────────────

function ApprovalsSection() {
  const { activeEntity: owner } = useActiveProperty();
  const pgId = usePgId();
  const toast = useToast();

  const { data: orders = [], isLoading, isError, refetch, isRefetching } = useProcurementOrders({ pgId: pgId ?? undefined });
  const approveOrder = useApproveProcurementOrder();
  const rejectOrder = useRejectProcurementOrder();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approving buys the goods for real — the server turns the requisition into a supply
  // order charged on this method — so it is asked for, never assumed. (It also has to be
  // sent at all: omitting it made every approval a 422.)
  // ponytail: 'upi' and 'card' are still valid server-side (`ProcurementPaymentMethod`), but
  // neither has a real payment gateway behind it yet, so only 'credit' is offered here for
  // now — see the matching note in GroceryCheckoutScreen. Bring them back once a processor
  // is wired up.
  const handleApprove = (orderId: string) => {
    Alert.alert(
      'Approve and buy',
      'This places the order now, charged to the property credit account.',
      [
        { text: 'Approve on credit', onPress: () => submitApproval(orderId, 'credit') },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const submitApproval = async (orderId: string, paymentMethod: ProcurementPaymentMethod) => {
    try {
      await approveOrder.mutateAsync({ orderId, paymentMethod });
      toast('success', 'Requisition Approved', 'Manager has been notified with approval.');
    } catch (err: any) {
      toast('error', 'Approve failed', err?.message ?? 'Please try again.');
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await rejectOrder.mutateAsync({ orderId: rejectingId, reason: rejectReason.trim() || 'No reason given' });
      toast('warning', 'Requisition Rejected', 'Manager notified.');
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast('error', 'Reject failed', err?.message ?? 'Please try again.');
    }
  };

  return (
    <>
      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">Loading requisitions…</Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[20, 20]}>
          <Row gap={8} align="center">
            <Ionicons name="cloud-offline" size={20} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Couldn't load requisitions</Txt>
              <TouchableOpacity accessibilityRole="button" onPress={() => refetch()}>
                <Txt variant="caption" color={Colors.primary} weight="700">Tap to retry</Txt>
              </TouchableOpacity>
            </Col>
          </Row>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No requisitions yet" subtitle="Requests submitted here will show up for approval." />
      ) : (
        <View style={{ gap: 12 }}>
          {orders.map((req) => (
            <Card
              key={req.id}
              containerColor={Colors.surface}
              borderRadius={18}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[16, 16]}
            >
              <Row justify="space-between" align="flex-start">
                <Col style={{ flex: 1 }}>
                  <Row gap={6} align="center">
                    <StatusBadge status={req.status} />
                    <Txt size={11} color={Colors.textMuted}>{new Date(req.createdAt).toLocaleDateString()}</Txt>
                  </Row>
                  <Txt size={15} weight="900" color={Colors.textPrimary} style={{ marginTop: 6 }}>
                    {req.orderType.charAt(0).toUpperCase() + req.orderType.slice(1)} requisition
                  </Txt>
                  {req.notes ? <Txt size={11} color={Colors.textMuted}>{req.notes}</Txt> : null}
                </Col>
                <Txt size={18} weight="900" color={Colors.primaryDark}>
                  ₹{req.totalCost.toLocaleString('en-IN')}
                </Txt>
              </Row>

              <Spacer size={12} />
              <View style={{ height: 1, backgroundColor: Colors.borderSubtle }} />
              <Spacer size={10} />

              <View style={{ gap: 6 }}>
                {req.items.map((it) => (
                  <Row key={it.id} justify="space-between">
                    <Txt size={12} color={Colors.textSecondary}>{it.quantity}× {it.itemName}</Txt>
                    <Txt size={12} weight="800" color={Colors.textPrimary}>₹{it.lineTotal.toLocaleString('en-IN')}</Txt>
                  </Row>
                ))}
              </View>

              {req.status === 'pending_owner_approval' && (
                <>
                  <Spacer size={14} />
                  <Row gap={10}>
                    <Btn
                      onPress={() => handleApprove(req.id)}
                      loading={approveOrder.isPending}
                      disabled={approveOrder.isPending}
                      containerColor={Colors.success}
                      textColor={Colors.textInverse}
                      borderRadius={10}
                      height={40}
                      style={{ flex: 1 }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                      <Txt size={12} weight="800" color={Colors.textInverse} style={{ marginLeft: 4 }}>Approve Order</Txt>
                    </Btn>
                    <OutlinedBtn
                      onPress={() => { setRejectingId(req.id); setRejectReason(''); }}
                      borderColor={Colors.danger}
                      textColor={Colors.danger}
                      borderRadius={10}
                      height={40}
                      style={{ flex: 1 }}
                    >
                      <Ionicons name="close-circle" size={16} color={Colors.danger} />
                      <Txt size={12} weight="800" color={Colors.danger} style={{ marginLeft: 4 }}>Reject</Txt>
                    </OutlinedBtn>
                  </Row>
                </>
              )}
            </Card>
          ))}
        </View>
      )}

      {rejectingId && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setRejectingId(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setRejectingId(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2 }}
            >
              <Txt size={16} weight="900" color={Colors.textPrimary}>Reject Requisition</Txt>
              <Spacer size={10} />
              <OutlinedTextField
                label="Reason (shown to whoever submitted this)"
                placeholder="Duplicate order, over budget, etc."
                value={rejectReason}
                onChangeText={setRejectReason}
                containerColor={Colors.surfaceMuted}
              />
              <Spacer size={14} />
              <Row gap={8}>
                <Btn
                  onPress={handleReject}
                  loading={rejectOrder.isPending}
                  disabled={rejectOrder.isPending}
                  containerColor={Colors.danger}
                  textColor={Colors.textInverse}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textInverse}>Confirm Rejection</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setRejectingId(null)}
                  borderColor={Colors.borderSubtle}
                  textColor={Colors.textPrimary}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textPrimary}>Cancel</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  catPillActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0FDF9',
    borderRadius: 6,
    minWidth: 26,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  floatingCart: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cartCountPill: {
    backgroundColor: Colors.textInverse,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
});

export default ProcurementScreen;
