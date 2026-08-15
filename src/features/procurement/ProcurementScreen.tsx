import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, Chip, OutlinedBtn, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';

export interface ProcurementScreenProps {
  mode?: 'manager' | 'owner';
}

interface SupplyItem {
  id: string;
  itemName: string;
  category: 'bedding' | 'cleaning' | 'hardware' | 'toiletries';
  unit: string;
  defaultPrice: number;
  icon: keyof any;
  desc: string;
}

const DEFAULT_SUPPLIES: SupplyItem[] = [
  {
    id: 'sup_1',
    itemName: 'Fresh Bedsheets & Pillow Covers (Set of 5)',
    category: 'bedding',
    unit: '5 Sets',
    defaultPrice: 1250,
    icon: 'bed',
    desc: '100% Pure cotton, hotel grade white fitted bedsheets with matching pillow covers.',
  },
  {
    id: 'sup_2',
    itemName: 'Orthopedic Coir Mattress (Single)',
    category: 'bedding',
    unit: '1 Unit',
    defaultPrice: 1850,
    icon: 'bed-outline',
    desc: 'High density single bed comfort mattress for resident rooms.',
  },
  {
    id: 'sup_6',
    itemName: 'Disinfectant Surface & Floor Cleaner (5L)',
    category: 'cleaning',
    unit: '5 Litres',
    defaultPrice: 480,
    icon: 'sparkles',
    desc: 'Hospital-grade pine fragrance floor cleaner for corridors and dining area.',
  },
  {
    id: 'sup_7',
    itemName: 'Liquid Handwash & Bathroom Restock Kit',
    category: 'toiletries',
    unit: 'Pack of 6',
    defaultPrice: 360,
    icon: 'hand-left',
    desc: 'Anti-bacterial foaming handwash bottles + toilet bowl disinfectant cubes.',
  },
  {
    id: 'sup_8',
    itemName: 'LED Bulbs & Electrical Spares Pack',
    category: 'hardware',
    unit: 'Pack of 10',
    defaultPrice: 650,
    icon: 'bulb',
    desc: '9W warm white energy saving LED bulbs with replacement switch spares.',
  },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All Items', icon: 'grid-outline' },
  { key: 'bedding', label: '🛏️ Bedding', icon: 'bed' },
  { key: 'cleaning', label: '🧹 Cleaning', icon: 'sparkles' },
  { key: 'hardware', label: '💡 Hardware', icon: 'bulb' },
  { key: 'toiletries', label: '🧼 Toiletries', icon: 'hand-left' },
];

export function ProcurementScreen({ mode }: ProcurementScreenProps) {
  const isManagerMode = usePGowStore((s) => s.isManagerMode);
  const effectiveMode = mode ?? (isManagerMode ? 'manager' : 'owner');

  if (effectiveMode === 'owner') {
    return <OwnerProcurementView />;
  }
  return <ManagerProcurementView />;
}

// ─── Manager View: E-Commerce Store & Requisition ────────────────────────────

function ManagerProcurementView() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const toast = useToast();

  const chefRequests = usePGowStore((s) => s.chefGroceryRequestsState).filter((r) => r.status === 'pending');
  const placePgGroceryOrder = usePGowStore((s) => s.placePgGroceryOrder);
  const resolveChefGroceryRequest = usePGowStore((s) => s.resolveChefGroceryRequest);

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCartModal, setShowCartModal] = useState(false);
  const [submittedOrders, setSubmittedOrders] = useState<any[]>([]);

  const handleFulfillChefRequest = (requestId: string, itemsSummary: string, estimatedCost: number) => {
    hapticSuccess();
    placePgGroceryOrder(itemsSummary, estimatedCost, false);
    resolveChefGroceryRequest(requestId, 'fulfilled');
    toast('success', 'Order placed', 'The kitchen request has been ordered.');
  };

  const handleDismissChefRequest = (requestId: string) => {
    hapticSelect();
    resolveChefGroceryRequest(requestId, 'dismissed');
  };

  const filteredItems = useMemo(() => {
    return DEFAULT_SUPPLIES.filter((item) => {
      const matchCat = selectedCat === 'all' || item.category === selectedCat;
      const matchSearch = search.trim() === '' || item.itemName.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCat, search]);

  const cartItemCount = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const cartTotalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const it = DEFAULT_SUPPLIES.find((s) => s.id === id);
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

  const handleSubmitRequisition = () => {
    if (cartItemCount === 0) return;
    hapticSuccess();

    const orderItems = Object.entries(cart).map(([id, qty]) => {
      const it = DEFAULT_SUPPLIES.find((s) => s.id === id)!;
      return {
        id,
        name: it.itemName,
        quantity: qty,
        unit: it.unit,
        price: it.defaultPrice,
        total: it.defaultPrice * qty,
      };
    });

    const newOrder = {
      id: `ord_${Date.now()}`,
      orderType: 'PG Supplies & Groceries',
      items: orderItems,
      totalCost: cartTotalAmount,
      itemCount: cartItemCount,
      status: 'pending_owner_approval',
      createdAt: Date.now(),
      managerName: owner?.managerName ?? 'Manager',
    };

    setSubmittedOrders((prev) => [newOrder, ...prev]);

    // Dispatch notification to Owner
    usePGowStore.getState().sendRoleNotification(
      'OWNER',
      '📦 Procurement Requisition Requested',
      `Manager requested ₹${cartTotalAmount.toLocaleString('en-IN')} supplies (${cartItemCount} items). Awaiting your approval.`,
      'PROCUREMENT',
      'HIGH',
    );

    toast('success', 'Requisition Sent', `Requisition for ₹${cartTotalAmount.toLocaleString('en-IN')} sent to PG Owner for approval.`);
    setCart({});
    setShowCartModal(false);
  };

  return (
    <HubScreenWrapper
      title="Procurement & Supplies"
      subtitle={`${owner?.pgName ?? 'Royal PG'} • Store & Requisitions`}
      icon="cart-outline"
    >
      {/* Search Input */}
      <OutlinedTextField
        placeholder="Search supplies (e.g. bedsheets, cleaners, bulbs)..."
        value={search}
        onChangeText={setSearch}
        leadingIcon="search"
        containerColor={Colors.surface}
      />

      <Spacer size={12} />

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATEGORY_TABS.map((tab) => {
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
      </ScrollView>

      <Spacer size={14} />

      {/* Requests from Kitchen — Chef can only request, Manager places the order */}
      {chefRequests.length > 0 && (
        <>
          <Txt size={13} weight="800" color={Colors.textPrimary}>Requests from Kitchen</Txt>
          <Spacer size={8} />
          <View style={{ gap: 8 }}>
            {chefRequests.map((req) => (
              <Card key={req.id} containerColor={Colors.surfaceElevated} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 14]}>
                <Row justify="space-between" align="flex-start">
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{req.chefName} • {req.itemCount} items</Txt>
                    <Txt size={11} color={Colors.textMuted} numberOfLines={2}>{req.itemsSummary}</Txt>
                  </Col>
                  <Txt size={14} weight="900" color={Colors.primaryDark}>~₹{Math.round(req.estimatedCost).toLocaleString('en-IN')}</Txt>
                </Row>
                <Spacer size={10} />
                <Row gap={8}>
                  <Btn
                    onPress={() => handleFulfillChefRequest(req.id, req.itemsSummary, req.estimatedCost)}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={36}
                    style={{ flex: 1 }}
                  >
                    <Txt size={12} weight="800" color={Colors.textInverse}>Order Now</Txt>
                  </Btn>
                  <OutlinedBtn onPress={() => handleDismissChefRequest(req.id)} borderColor={Colors.borderMuted} textColor={Colors.textSecondary} borderRadius={10} height={36} style={{ flex: 1 }}>
                    <Txt size={12} weight="700" color={Colors.textSecondary}>Dismiss</Txt>
                  </OutlinedBtn>
                </Row>
              </Card>
            ))}
          </View>
          <Spacer size={16} />
        </>
      )}

      {/* Supply Catalog Grid */}
      <View style={{ gap: 10 }}>
        {filteredItems.map((item) => {
          const qty = cart[item.id] ?? 0;
          return (
            <Card
              key={item.id}
              containerColor={Colors.surface}
              borderRadius={16}
              borderWidth={1}
              borderColor={qty > 0 ? Colors.primary : Colors.borderSubtle}
              padding={[14, 14]}
            >
              <Row justify="space-between" align="center">
                <Row gap={12} align="center" style={{ flex: 1 }}>
                  <View style={[styles.itemIconWrap, { backgroundColor: qty > 0 ? '#F0FDF9' : Colors.surfaceElevated }]}>
                    <Ionicons name={item.icon} size={22} color={qty > 0 ? Colors.primary : Colors.primaryDark} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={14} weight="800" color={Colors.textPrimary} numberOfLines={2}>
                      {item.itemName}
                    </Txt>
                    <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2 }}>
                      {item.unit} • {item.desc}
                    </Txt>
                    <Txt size={14} weight="900" color={Colors.primaryDark} style={{ marginTop: 4 }}>
                      ₹{item.defaultPrice.toLocaleString('en-IN')}
                    </Txt>
                  </Col>
                </Row>

                {/* Quantity Stepper */}
                <Row gap={6} align="center">
                  {qty > 0 ? (
                    <>
                      <TouchableOpacity
                        onPress={() => updateQty(item.id, -1)}
                        style={styles.qtyBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                      </TouchableOpacity>
                      <View style={styles.qtyBox}>
                        <Txt size={13} weight="900" color={Colors.primaryDark}>{qty}</Txt>
                      </View>
                      <TouchableOpacity
                        onPress={() => updateQty(item.id, 1)}
                        style={[styles.qtyBtn, { backgroundColor: Colors.primary }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color={Colors.textInverse} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Btn
                      onPress={() => updateQty(item.id, 1)}
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
        })}
      </View>

      {/* Submitted Orders Log */}
      {submittedOrders.length > 0 && (
        <>
          <Spacer size={20} />
          <Txt size={14} weight="900" color={Colors.textPrimary}>Submitted Requisitions</Txt>
          <Spacer size={8} />
          <View style={{ gap: 8 }}>
            {submittedOrders.map((ord) => (
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
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{ord.itemCount} Items Requested</Txt>
                    <Txt size={11} color={Colors.textMuted}>₹{ord.totalCost.toLocaleString('en-IN')} • {new Date(ord.createdAt).toLocaleTimeString()}</Txt>
                  </Col>
                  <View style={[styles.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                    <Txt size={10} weight="800" color="#D97706">Pending Approval</Txt>
                  </View>
                </Row>
              </Card>
            ))}
          </View>
        </>
      )}

      {/* Floating Cart Button */}
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

      {/* Cart Summary Modal */}
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
                <Txt size={11} color={Colors.textMuted}>{cartItemCount} items selected for {owner?.pgName ?? 'Royal PG'}</Txt>
              </Col>
              <IconBtn onPress={() => setShowCartModal(false)} icon="close" size={18} tint={Colors.textMuted} />
            </Row>

            <Spacer size={14} />

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {Object.entries(cart).map(([id, qty]) => {
                  const it = DEFAULT_SUPPLIES.find((s) => s.id === id);
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

// ─── Owner View: Requisitions Approval Queue ────────────────────────────────

function OwnerProcurementView() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const toast = useToast();

  const chefRequests = usePGowStore((s) => s.chefGroceryRequestsState).filter((r) => r.status === 'pending');
  const placePgGroceryOrder = usePGowStore((s) => s.placePgGroceryOrder);
  const resolveChefGroceryRequest = usePGowStore((s) => s.resolveChefGroceryRequest);

  const handleFulfillChefRequest = (requestId: string, itemsSummary: string, estimatedCost: number) => {
    hapticSuccess();
    placePgGroceryOrder(itemsSummary, estimatedCost, false);
    resolveChefGroceryRequest(requestId, 'fulfilled');
    toast('success', 'Order placed', 'The kitchen request has been ordered.');
  };

  const handleDismissChefRequest = (requestId: string) => {
    hapticSelect();
    resolveChefGroceryRequest(requestId, 'dismissed');
  };

  const [requisitions, setRequisitions] = useState([
    {
      id: 'req_001',
      managerName: owner?.managerName ?? 'Ramesh (Manager)',
      pgName: owner?.pgName ?? 'Royal PG',
      createdAt: Date.now() - 3600000,
      status: 'pending',
      totalAmount: 3100,
      items: [
        { name: 'Fresh Bedsheets & Pillow Covers (Set of 5)', qty: 2, total: 2500 },
        { name: 'LED Bulbs & Electrical Spares Pack', qty: 1, total: 600 },
      ],
    },
    {
      id: 'req_002',
      managerName: owner?.managerName ?? 'Ramesh (Manager)',
      pgName: owner?.pgName ?? 'Royal PG',
      createdAt: Date.now() - 86400000,
      status: 'pending',
      totalAmount: 2400,
      items: [
        { name: 'Liquid Handwash & Bathroom Restock Kit', qty: 1, total: 360 },
        { name: 'Disinfectant Surface & Floor Cleaner (5L)', qty: 4, total: 1920 },
      ],
    },
  ]);

  const handleApprove = (reqId: string) => {
    hapticSuccess();
    setRequisitions((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'approved' } : r))
    );
    usePGowStore.getState().sendRoleNotification(
      'MANAGER',
      '✅ Procurement Requisition Approved',
      'Owner approved your supply requisition. Order is cleared for purchase.',
      'PROCUREMENT',
      'HIGH',
    );
    toast('success', 'Requisition Approved', 'Manager has been notified with approval.');
  };

  const handleReject = (reqId: string) => {
    hapticError();
    setRequisitions((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'rejected' } : r))
    );
    usePGowStore.getState().sendRoleNotification(
      'MANAGER',
      '❌ Procurement Requisition Rejected',
      'Owner requested adjustments to your requisition cart.',
      'PROCUREMENT',
      'HIGH',
    );
    toast('warning', 'Requisition Rejected', 'Manager notified.');
  };

  return (
    <HubScreenWrapper
      title="Procurement Approvals"
      subtitle={`${owner?.pgName ?? 'Royal PG'} • Manager Requisitions`}
      icon="receipt-outline"
    >
      {chefRequests.length > 0 && (
        <>
          <Txt size={13} weight="800" color={Colors.textPrimary}>Requests from Kitchen</Txt>
          <Spacer size={8} />
          <View style={{ gap: 8 }}>
            {chefRequests.map((req) => (
              <Card key={req.id} containerColor={Colors.surfaceElevated} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 14]}>
                <Row justify="space-between" align="flex-start">
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{req.chefName} • {req.itemCount} items</Txt>
                    <Txt size={11} color={Colors.textMuted} numberOfLines={2}>{req.itemsSummary}</Txt>
                  </Col>
                  <Txt size={14} weight="900" color={Colors.primaryDark}>~₹{Math.round(req.estimatedCost).toLocaleString('en-IN')}</Txt>
                </Row>
                <Spacer size={10} />
                <Row gap={8}>
                  <Btn
                    onPress={() => handleFulfillChefRequest(req.id, req.itemsSummary, req.estimatedCost)}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={36}
                    style={{ flex: 1 }}
                  >
                    <Txt size={12} weight="800" color={Colors.textInverse}>Order Now</Txt>
                  </Btn>
                  <OutlinedBtn onPress={() => handleDismissChefRequest(req.id)} borderColor={Colors.borderMuted} textColor={Colors.textSecondary} borderRadius={10} height={36} style={{ flex: 1 }}>
                    <Txt size={12} weight="700" color={Colors.textSecondary}>Dismiss</Txt>
                  </OutlinedBtn>
                </Row>
              </Card>
            ))}
          </View>
          <Spacer size={16} />
        </>
      )}

      <View style={{ gap: 12 }}>
        {requisitions.map((req) => (
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
                  <View style={[styles.statusBadge, { backgroundColor: req.status === 'approved' ? '#ECFDF5' : req.status === 'rejected' ? '#FEF2F2' : '#FFFBEB' }]}>
                    <Txt size={10} weight="800" color={req.status === 'approved' ? '#047857' : req.status === 'rejected' ? '#DC2626' : '#D97706'}>
                      {req.status === 'approved' ? 'APPROVED' : req.status === 'rejected' ? 'REJECTED' : 'PENDING APPROVAL'}
                    </Txt>
                  </View>
                  <Txt size={11} color={Colors.textMuted}>{new Date(req.createdAt).toLocaleDateString()}</Txt>
                </Row>
                <Txt size={15} weight="900" color={Colors.textPrimary} style={{ marginTop: 6 }}>
                  Requested by {req.managerName}
                </Txt>
                <Txt size={11} color={Colors.textMuted}>{req.pgName}</Txt>
              </Col>
              <Txt size={18} weight="900" color={Colors.primaryDark}>
                ₹{req.totalAmount.toLocaleString('en-IN')}
              </Txt>
            </Row>

            <Spacer size={12} />
            <View style={{ height: 1, backgroundColor: Colors.borderSubtle }} />
            <Spacer size={10} />

            {/* Line items */}
            <View style={{ gap: 6 }}>
              {req.items.map((it, idx) => (
                <Row key={idx} justify="space-between">
                  <Txt size={12} color={Colors.textSecondary}>{it.qty}× {it.name}</Txt>
                  <Txt size={12} weight="800" color={Colors.textPrimary}>₹{it.total.toLocaleString('en-IN')}</Txt>
                </Row>
              ))}
            </View>

            {req.status === 'pending' && (
              <>
                <Spacer size={14} />
                <Row gap={10}>
                  <Btn
                    onPress={() => handleApprove(req.id)}
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
                    onPress={() => handleReject(req.id)}
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
