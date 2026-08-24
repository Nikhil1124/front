import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, RefreshControl, Pressable, ScrollView } from 'react-native';
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
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { FormScroll } from '@/components/ui/FormScroll';
import {
  useProcurementCatalog,
  useProcurementOrders,
  useSubmitProcurementOrder,
  useApproveProcurementOrder,
  useRejectProcurementOrder,
} from './useProcurement';
import type { ProcurementCatalogItem } from '@/types';

export interface ProcurementScreenProps {
  mode?: 'manager' | 'owner';
}

// `category` is the live Supply catalog's own category name (free text, ops-curated) — not
// a fixed set this app can enumerate ahead of time, so both the icon lookup and the tab list
// below key off it loosely rather than assuming any particular value exists.
const CATEGORY_ICON_KEYWORDS: Array<[string, keyof typeof Ionicons.glyphMap]> = [
  ['produce', 'leaf'], ['vegetable', 'leaf'], ['fruit', 'leaf'],
  ['dairy', 'water'],
  ['clean', 'sparkles'],
  ['toilet', 'hand-left'], ['hygiene', 'hand-left'],
  ['hardware', 'bulb'],
  ['grocery', 'nutrition'], ['staple', 'nutrition'], ['grain', 'nutrition'],
  ['snack', 'cube'], ['beverage', 'cube'],
];
function iconForCategory(category: string): keyof typeof Ionicons.glyphMap {
  const lower = category.toLowerCase();
  return CATEGORY_ICON_KEYWORDS.find(([kw]) => lower.includes(kw))?.[1] ?? 'ellipsis-horizontal-circle';
}

import { useActiveProperty } from '@/features/properties/useProperties';

export function ProcurementScreen({ mode }: ProcurementScreenProps) {
  const isManagerMode = useIsManagerMode();
  const effectiveMode = mode ?? (isManagerMode ? 'manager' : 'owner');

  if (effectiveMode === 'owner') {
    return <OwnerProcurementView />;
  }
  return <ManagerProcurementView />;
}

function usePgId(): string | null {
  return useAuthStore((s) => s.activePgId);
}

// ─── Manager View: catalog + requisition cart, submitted to the owner ────────

function ManagerProcurementView() {
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

  // Built from whatever categories the live catalog actually has, not a fixed guess — the
  // catalog is a view of the real Supply categories, which are ops-curated free text.
  const categoryTabs = useMemo(() => {
    const seen = new Set<string>();
    const tabs = [{ key: 'all', label: 'All Items' }];
    for (const item of catalog) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        tabs.push({ key: item.category, label: item.category });
      }
    }
    return tabs;
  }, [catalog]);

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
    hapticSelect();
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
    // The server prices, names and categorises each line itself from the live catalog — all
    // it needs from here is which item and how many.
    const items = Object.entries(cart).map(([id, qty]) => ({ item_id: id, quantity: qty }));
    try {
      await submitOrder.mutateAsync({ pg_id: pgId, order_type: 'supplies', items });
      hapticSuccess();
      toast('success', 'Requisition Sent', `Requisition for ₹${cartTotalAmount.toLocaleString('en-IN')} sent to PG Owner for approval.`);
      setCart({});
      setShowCartModal(false);
    } catch (err: any) {
      hapticError();
      toast('error', 'Submit failed', err?.message ?? 'Please try again.');
    }
  };

  return (
    <HubScreenWrapper
      title="Procurement & Supplies"
      subtitle={`${owner?.pgName ?? 'Property'} • Store & Requisitions`}
      icon="cart-outline"
    >
      <OutlinedTextField
        placeholder="Search supplies (e.g. bedsheets, cleaners, bulbs)..."
        value={search}
        onChangeText={setSearch}
        leadingIcon="search"
        containerColor={Colors.surface}
      />

      <Spacer size={12} />

      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categoryTabs.map((tab) => {
          const isSel = selectedCat === tab.key;
          return (
            <AnimatedPress
              key={tab.key}
              scale={0.96}
              hapticPattern="light"
              onPress={() => { hapticSelect(); setSelectedCat(tab.key); }}
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
              <TouchableOpacity onPress={() => refetch()}>
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
          <Txt size={14} weight="900" color={Colors.textPrimary}>Your Requisitions</Txt>
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
          hapticPattern="medium"
          onPress={() => { hapticSelect(); setShowCartModal(true); }}
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCartModal(false)} />
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

            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                Submit Requisition to Owner 📦
              </Txt>
            </Btn>
          </Card>
        </View>
      </Modal>
    </HubScreenWrapper>
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
            <Ionicons name={iconForCategory(item.category)} size={22} color={qty > 0 ? Colors.primary : Colors.primaryDark} />
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
              <TouchableOpacity onPress={() => onChangeQty(item.id, -1)} style={styles.qtyBtn} activeOpacity={0.7}>
                <Ionicons name="remove" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.qtyBox}>
                <Txt size={13} weight="900" color={Colors.primaryDark}>{qty}</Txt>
              </View>
              <TouchableOpacity onPress={() => onChangeQty(item.id, 1)} style={[styles.qtyBtn, { backgroundColor: Colors.primary }]} activeOpacity={0.7}>
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

function OwnerProcurementView() {
  const { activeEntity: owner } = useActiveProperty();
  const pgId = usePgId();
  const toast = useToast();

  const { data: orders = [], isLoading, isError, refetch, isRefetching } = useProcurementOrders({ pgId: pgId ?? undefined });
  const approveOrder = useApproveProcurementOrder();
  const rejectOrder = useRejectProcurementOrder();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState<'card' | 'upi' | 'credit'>('upi');

  // Approving is buying: the server places a real order on whichever method is chosen here,
  // so this asks first rather than defaulting one silently.
  const handleApprove = async () => {
    if (!approvingId) return;
    try {
      await approveOrder.mutateAsync({ orderId: approvingId, paymentMethod: approvePaymentMethod });
      hapticSuccess();
      toast('success', 'Requisition Approved', 'Manager has been notified with approval.');
      setApprovingId(null);
    } catch (err: any) {
      hapticError();
      toast('error', 'Approve failed', err?.message ?? 'Please try again.');
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await rejectOrder.mutateAsync({ orderId: rejectingId, reason: rejectReason.trim() || 'No reason given' });
      hapticError();
      toast('warning', 'Requisition Rejected', 'Manager notified.');
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      hapticError();
      toast('error', 'Reject failed', err?.message ?? 'Please try again.');
    }
  };

  return (
    <HubScreenWrapper
      title="Procurement Approvals"
      subtitle={`${owner?.pgName ?? 'Property'} • Manager Requisitions`}
      icon="receipt-outline"
    >
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
              <TouchableOpacity onPress={() => refetch()}>
                <Txt variant="caption" color={Colors.primary} weight="700">Tap to retry</Txt>
              </TouchableOpacity>
            </Col>
          </Row>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No requisitions yet" subtitle="Requests your manager submits will show up here for approval." />
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
                      onPress={() => { setApprovingId(req.id); setApprovePaymentMethod('upi'); }}
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

      {approvingId && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setApprovingId(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setApprovingId(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 2 }}
            >
              <Txt size={16} weight="900" color={Colors.textPrimary}>Approve & Buy</Txt>
              <Spacer size={6} />
              <Txt size={12} color={Colors.textMuted}>This places a real order with the property's own money — pick how it's being paid for.</Txt>
              <Spacer size={14} />
              <Row gap={8}>
                {(['upi', 'card', 'credit'] as const).map((m) => {
                  const sel = approvePaymentMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setApprovePaymentMethod(m)}
                      style={[styles.catPill, sel && styles.catPillActive, { flex: 1, alignItems: 'center' }]}
                    >
                      <Txt size={12} weight="800" color={sel ? Colors.textInverse : Colors.textPrimary}>
                        {m === 'upi' ? 'UPI' : m === 'card' ? 'Card' : 'Credit'}
                      </Txt>
                    </TouchableOpacity>
                  );
                })}
              </Row>
              <Spacer size={16} />
              <Row gap={10}>
                <Btn
                  onPress={handleApprove}
                  loading={approveOrder.isPending}
                  disabled={approveOrder.isPending}
                  containerColor={Colors.success}
                  textColor={Colors.textInverse}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt size={12} weight="800" color={Colors.textInverse}>Confirm & Order</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setApprovingId(null)}
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

      {rejectingId && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setRejectingId(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setRejectingId(null)} />
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
                label="Reason (shown to the manager)"
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
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
