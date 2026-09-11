import { useState } from 'react';
import { View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { EmptyState } from '@/components/EmptyState';
import { Radii, Colors } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  useProcurementOrders,
  useApproveProcurementOrder,
  type ProcurementPaymentMethod,
  useRejectProcurementOrder } from './useProcurement';


import { Btn, Card, Col, OutlinedBtn, Row, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';

/**
 * Approve requisitions.
 *
 * The Order Supplies half was removed on request. It was a catalog + cart that submitted a
 * requisition — the same job the Groceries module now does with a real cart and checkout, so
 * keeping both meant two ways to order the same stock. Two consequences worth knowing, since
 * neither is visible from this file alone:
 *
 *   - an owner or manager can no longer RAISE a requisition from here, only approve one. The
 *     server still accepts OWNER/MANAGER/CHEF on `create_order`; nothing about that changed.
 *   - a chef has nothing to approve (`transition` is `require_manage`), so this screen has no
 *     content for them at all. Rather than render an empty shell it now says where ordering
 *     lives.
 *
 * Previously: order supplies AND approve requisitions — the same for owner and manager.
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
  const activeRole = useAuthStore((s) => s.activeRole);
  // Approving is `require_manage` server-side (transition(), procurement/service.py) — owner
  // or manager only.
  const canApprove = activeRole === 'owner' || activeRole === 'manager';

  return (
    <HubScreenWrapper title="Procurement & Supplies" icon="cart-outline">
      {canApprove ? (
        <ApprovalsSection />
      ) : (
        <EmptyState
          icon="cart-outline"
          title="Nothing to approve"
          subtitle="Approving requisitions is an owner or manager action. To order kitchen supplies, use Groceries."
        />
      )}
    </HubScreenWrapper>
  );
}

function usePgId(): string | null {
  return useAuthStore((s) => s.activePgId);
}

function statusLabel(status: string): string {
  if (status === 'pending_owner_approval') return 'Pending approval';
  return status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  return <StatusChip label={statusLabel(status)} tone={toneFor(status)} />;
}

function ApprovalsSection() {
  const pgId = usePgId();
  const toast = useToast();

  const { data: orders = [], isLoading, isError, refetch } = useProcurementOrders({ pgId: pgId ?? undefined });
  const approveOrder = useApproveProcurementOrder();
  const rejectOrder = useRejectProcurementOrder();

  const [rejectingId, setRejectingId] = useState<string | null>(null);

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

  const handleReject = async (reason: string) => {
    if (!rejectingId) return;
    try {
      await rejectOrder.mutateAsync({ orderId: rejectingId, reason });
      toast('warning', 'Requisition Rejected', 'Manager notified.');
      setRejectingId(null);
    } catch (err: any) {
      toast('error', 'Reject failed', err?.message ?? 'Please try again.');
    }
  };

  return (
    <>
      {isLoading ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[20, 20]}>
          <Txt variant="body" color={Colors.textMuted} align="center">Loading requisitions…</Txt>
        </Card>
      ) : isError ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.card} padding={[20, 20]}>
          <Row gap={8} align="center">
            <Ionicons name="cloud-offline" size={20} color={Colors.danger} />
            <Col style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Couldn't load requisitions</Txt>
              <AnimatedPress accessibilityRole="button" onPress={() => refetch()}>
                <Txt variant="caption" color={Colors.primary} weight="700">Tap to retry</Txt>
              </AnimatedPress>
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
              borderRadius={Radii.card}
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
                  <Txt size={15} weight="700" color={Colors.textPrimary} style={{ marginTop: 6 }}>
                    {req.orderType.charAt(0).toUpperCase() + req.orderType.slice(1)} requisition
                  </Txt>
                  {req.notes ? <Txt size={11} color={Colors.textMuted}>{req.notes}</Txt> : null}
                </Col>
                <Txt size={18} weight="700" color={Colors.primaryDark}>
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
                    <Txt size={12} weight="700" color={Colors.textPrimary}>₹{it.lineTotal.toLocaleString('en-IN')}</Txt>
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
                      borderRadius={Radii.control}
                      height={40}
                      style={{ flex: 1 }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                      <Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 4 }}>Approve Order</Txt>
                    </Btn>
                    <OutlinedBtn
                      onPress={() => setRejectingId(req.id)}
                      borderColor={Colors.danger}
                      textColor={Colors.danger}
                      borderRadius={Radii.control}
                      height={40}
                      style={{ flex: 1 }}
                    >
                      <Ionicons name="close-circle" size={16} color={Colors.danger} />
                      <Txt size={12} weight="700" color={Colors.danger} style={{ marginLeft: 4 }}>Reject</Txt>
                    </OutlinedBtn>
                  </Row>
                </>
              )}
            </Card>
          ))}
        </View>
      )}

      <TextPromptDialog
        visible={rejectingId != null}
        title="Reject requisition"
        label="Reason"
        placeholder="Duplicate order, over budget…"
        helper="Whoever submitted this sees it"
        confirmLabel="Confirm rejection"
        destructive
        required
        busy={rejectOrder.isPending}
        onCancel={() => setRejectingId(null)}
        onSave={handleReject}
      />
    </>
  );
}


export default ProcurementScreen;
