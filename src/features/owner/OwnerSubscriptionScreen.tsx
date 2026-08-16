/**
 * OwnerSubscriptionScreen — activation and billing.
 *
 * The layout is unchanged from the port: plan cards, a bed configurator, a preview card, one
 * activation button. What changed is where the numbers come from. The two plans and their
 * prices used to be hardcoded here (₹50 a seat, ₹75 a guest); they are now `/v1/billing`
 * rows, so the screen shows what the server will actually charge rather than what this file
 * happens to say.
 *
 * Once a property is subscribed the same screen becomes its billing history, because "what
 * am I on and what do I owe" is the question an owner returns here to ask.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, Image, TouchableOpacity, Platform, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  useInvoices,
  usePlans,
  useQuote,
  useReportInvoicePayment,
  useSubscribe,
  useSubscription,
  type Plan,
} from '@/features/billing/useBilling';
import { updateProperty } from '@/features/properties/useProperties';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { Colors } from '@/theme';

/** The two shapes the design already had: a prepaid green one and a dynamic purple one. */
function accentFor(plan: Plan): { colour: string; tag: string; tagBg: string } {
  if (plan.billing_period === 'usage') {
    return { colour: '#8B5CF6', tag: 'DYNAMIC', tagBg: 'rgba(139,92,246,0.15)' };
  }
  return { colour: '#10B981', tag: 'PREPAID', tagBg: 'rgba(16,185,129,0.15)' };
}

const money = (value: string | number) => `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;

export function OwnerSubscriptionScreen() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const popScreen = usePGowStore((s) => s.popScreen);

  // Android hardware back — consistent with every screen's visible back button.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      popScreen();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const logout = usePGowStore((s) => s.logout);
  const pgId = useAuthStore((s) => s.activePgId);

  const plans = usePlans();
  const subscription = useSubscription(pgId);
  const invoices = useInvoices(pgId);
  const subscribe = useSubscribe(pgId);
  const reportPayment = useReportInvoicePayment(pgId);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [bedsCount, setBedsCount] = useState<number>(owner?.totalBeds ?? 30);

  // Default to the first plan once they arrive, so the preview is never blank.
  useEffect(() => {
    if (!selectedCode && plans.data?.length) setSelectedCode(plans.data[0].code);
  }, [plans.data, selectedCode]);

  const selected = plans.data?.find((p: any) => p.code === selectedCode) ?? null;
  const quote = useQuote(pgId, selectedCode);

  /**
   * What activating would cost, for the bed count on screen right now.
   *
   * Computed locally rather than re-quoting on every tap of ±1: the server prices a one-time
   * plan against the property's *stored* bed count, which has not changed yet, so a quote
   * fetched mid-adjustment would show a number the owner is no longer looking at. The stored
   * count is updated on submit, and the server then charges exactly this.
   */
  const previewAmount = useMemo(() => {
    if (!selected) return 0;
    if (selected.billing_period === 'one_time') {
      return Number(selected.unit_price ?? 0) * bedsCount;
    }
    if (selected.billing_period === 'usage') return 0;
    return Number(selected.price);
  }, [selected, bedsCount]);

  const isUsage = selected?.billing_period === 'usage';
  const isOneTime = selected?.billing_period === 'one_time';

  const handleSubmit = async () => {
    if (!selected || !pgId) return;
    try {
      // Bed count first: it is what the one-time plan is priced against, so saving it after
      // subscribing would bill the old number.
      if (isOneTime && bedsCount !== owner?.totalBeds) {
        await updateProperty(pgId, { total_beds: bedsCount });
      }
      await subscribe.mutateAsync(selected.code);
      await refreshAll();
      Alert.alert('Activated', `${selected.name} is now active for this property.`);
    } catch (err: any) {
      Alert.alert('Activation failed', err?.message ?? 'Something went wrong.');
    }
  };

  const handleReportPayment = (invoiceId: string) => {
    Alert.alert(
      'How did you pay?',
      'PGow confirms the payment before the invoice is marked settled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'UPI',
          onPress: () =>
            reportPayment
              .mutateAsync({ invoiceId, method: 'upi_manual' })
              .then(() => Alert.alert('Recorded', 'PGow will confirm and settle this shortly.'))
              .catch((e: any) => Alert.alert('Failed', e?.message ?? 'Not recorded.')),
        },
        {
          text: 'Bank transfer',
          onPress: () =>
            reportPayment
              .mutateAsync({ invoiceId, method: 'bank_transfer' })
              .then(() => Alert.alert('Recorded', 'PGow will confirm and settle this shortly.'))
              .catch((e: any) => Alert.alert('Failed', e?.message ?? 'Not recorded.')),
        },
      ]
    );
  };

  const active = subscription.data;

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Txt size={18} weight="700" color={Colors.IvoryWhiteText}>
          {active ? 'Subscription & Billing' : 'Secure PG Portal Activation'}
        </Txt>
        <IconBtn
          onPress={() => (active ? popScreen() : logout())}
          icon={active ? 'arrow-back' : 'exit'}
          size={20}
          tint={Colors.SlateMutedText}
        />
      </Row>

      <Card containerColor="transparent" borderRadius={16} style={{ height: 130, marginBottom: 16, overflow: 'hidden' }}>
        <Image source={require('../../../assets/img_premium_subscription.jpg')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Card>

      {active ? (
        <>
          {/* ── Already subscribed: what am I on, and what do I owe ── */}
          <Card containerColor="#064E3B" borderRadius={16} padding={[16, 16]}>
            <Row justify="space-between" align="center">
              <Txt size={11} weight="900" color={Colors.IvoryWhiteText} style={{ letterSpacing: 0.5 }}>
                CURRENT PLAN
              </Txt>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            </Row>
            <Spacer size={8} />
            <Txt size={22} weight="900" color={Colors.IvoryWhiteText}>{active.plan_name}</Txt>
            <Spacer size={4} />
            <Txt size={12} color="rgba(234,242,243,0.9)">
              {Number(active.price) > 0
                ? `${money(active.price)} paid at activation`
                : 'No upfront cost — billed as residents are added'}
            </Txt>
            <Txt size={12} color="rgba(234,242,243,0.9)">
              Active since {active.current_period_start}
            </Txt>
          </Card>

          <Spacer size={20} />
          <Txt size={16} weight="800" color={Colors.IvoryWhiteText}>Invoices</Txt>
          <Spacer size={10} />

          {invoices.isLoading ? (
            <Txt size={12} color={Colors.SlateMutedText}>Loading…</Txt>
          ) : !invoices.data?.length ? (
            <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={12} borderWidth={1} borderColor={Colors.LuxuryCardBorder} padding={[16, 16]}>
              <Txt size={12} color={Colors.SlateMutedText} align="center">
                Nothing billed yet.
              </Txt>
            </Card>
          ) : (
            invoices.data.map((inv: any) => (
              <Card
                key={inv.id}
                containerColor={Colors.LuxurySurfaceDark}
                borderRadius={12}
                borderWidth={1}
                borderColor={inv.status === 'paid' ? 'rgba(16,185,129,0.35)' : Colors.LuxuryCardBorder}
                padding={[14, 14]}
                style={{ marginBottom: 8 }}
              >
                <Row justify="space-between" align="center">
                  <Col>
                    <Txt size={16} weight="900" color={Colors.IvoryWhiteText}>{money(inv.amount)}</Txt>
                    <Txt size={11} color={Colors.SlateMutedText}>Period {inv.period}</Txt>
                  </Col>
                  <Txt
                    size={11}
                    weight="700"
                    color={inv.status === 'paid' ? '#10B981' : Colors.CyberAmber}
                  >
                    {inv.status === 'paid' ? 'PAID' : inv.method ? 'AWAITING PGOW' : 'DUE'}
                  </Txt>
                </Row>
                {inv.status === 'issued' && !inv.method && (
                  <>
                    <Spacer size={10} />
                    <Btn
                      onPress={() => handleReportPayment(inv.id)}
                      containerColor="#10B981"
                      textColor={Colors.LuxuryPureBlack}
                      borderRadius={10}
                      height={38}
                      testID={`invoice_pay_${inv.id}`}
                    >
                      <Txt size={12} weight="700" color={Colors.LuxuryPureBlack}>I've paid this</Txt>
                    </Btn>
                  </>
                )}
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          {/* ── Not subscribed: pick a plan ── */}
          <Row gap={6} align="center" style={{ marginBottom: 16 }}>
            <Txt size={20} weight="900" color={Colors.CyberGreen}>Step 1: Select Billing Model</Txt>
            <InfoTip text="Choose how you want to subscribe to the co-living management features. Pay a fixed upfront cost, or pay-as-you-grow based on residents actually added." />
          </Row>

          {plans.isLoading && (
            <Txt size={12} color={Colors.SlateMutedText}>Loading plans…</Txt>
          )}
          {plans.isError && (
            <Txt size={12} color={Colors.CyberPink}>
              Could not load plans. Pull back and try again.
            </Txt>
          )}

          <Row gap={12} style={{ marginBottom: 16 }}>
            {(plans.data ?? []).map((plan: any) => {
              const accent = accentFor(plan);
              const isSelected = plan.code === selectedCode;
              return (
                <TouchableOpacity
                  key={plan.code}
                  onPress={() => setSelectedCode(plan.code)}
                  style={[
                    styles.planCard,
                    isSelected && { borderColor: accent.colour, borderWidth: 2, backgroundColor: '#1E293B' },
                  ]}
                  testID={`plan_${plan.code}`}
                >
                  <View style={[styles.planTag, { backgroundColor: accent.tagBg }]}>
                    <Txt size={9} weight="700" color={accent.colour}>{accent.tag}</Txt>
                  </View>
                  <Spacer size={8} />
                  <Txt size={14} weight="900" color={Colors.IvoryWhiteText}>{plan.name}</Txt>
                  <Txt size={11} color="#94A3B8" style={{ lineHeight: 14, marginTop: 4 }}>
                    {plan.billing_period === 'one_time'
                      ? `Pay ${money(plan.unit_price ?? 0)} per bed upfront. Add residents up to your limit with ₹0 extra.`
                      : plan.billing_period === 'usage'
                        ? `₹0 upfront. First ${plan.included_units} residents free, then ${money(plan.unit_price ?? 0)} per resident added.`
                        : `${money(plan.price)} per ${plan.billing_period.replace('ly', '')}.`}
                  </Txt>
                </TouchableOpacity>
              );
            })}
          </Row>

          {selected && (
            <>
              <Txt size={16} weight="800" color={Colors.IvoryWhiteText} style={{ marginBottom: 12 }}>
                {isOneTime
                  ? 'Step 2: Enter PG Bed Capacity'
                  : `Step 2: Starting Seat Size (${selected.included_units} Free Included)`}
              </Txt>

              <Card containerColor="#1D1F27" borderRadius={16} borderWidth={1} borderColor="#2C2F3A" padding={[16, 16]} style={{ marginBottom: 16 }}>
                <Col align="center">
                  <Txt size={11} weight="800" color={Colors.SlateMutedText} style={{ letterSpacing: 0.5 }}>
                    {isOneTime ? 'TOTAL ACTIVE SEATS / BEDS' : 'INITIAL SEAT ALLOCATION'}
                  </Txt>
                  <Spacer size={12} />
                  <Txt size={64} weight="900" color={accentFor(selected).colour}>
                    {isOneTime ? bedsCount : selected.included_units}
                  </Txt>
                  <Txt size={13} weight="500" color={Colors.SlateMutedText}>
                    {isOneTime ? 'Paid Seats Configured' : 'Free Starter Seats Active'}
                  </Txt>

                  {isOneTime ? (
                    <>
                      <Spacer size={20} />
                      <Row gap={8}>
                        <Btn onPress={() => setBedsCount((c) => (c > 10 ? c - 10 : c > 1 ? 1 : c))} containerColor="#2C2F3A" textColor={Colors.IvoryWhiteText} borderRadius={10} height={40} style={{ flex: 1 }}>
                          <Txt size={14} weight="700" color={Colors.IvoryWhiteText}>-10</Txt>
                        </Btn>
                        <Btn onPress={() => setBedsCount((c) => (c > 1 ? c - 1 : c))} containerColor="#2C2F3A" textColor={Colors.IvoryWhiteText} borderRadius={10} height={40} style={{ flex: 1 }}>
                          <Txt size={14} weight="700" color={Colors.IvoryWhiteText}>-1</Txt>
                        </Btn>
                        <Btn onPress={() => setBedsCount((c) => c + 1)} containerColor="#10B981" textColor={Colors.LuxuryPureBlack} borderRadius={10} height={40} style={{ flex: 1 }}>
                          <Txt size={14} weight="700" color={Colors.LuxuryPureBlack}>+1</Txt>
                        </Btn>
                        <Btn onPress={() => setBedsCount((c) => c + 10)} containerColor="#10B981" textColor={Colors.LuxuryPureBlack} borderRadius={10} height={40} style={{ flex: 1 }}>
                          <Txt size={14} weight="700" color={Colors.LuxuryPureBlack}>+10</Txt>
                        </Btn>
                      </Row>
                    </>
                  ) : (
                    <>
                      <Spacer size={12} />
                      <Txt size={11} color="#A78BFA" align="center" style={{ paddingHorizontal: 12, lineHeight: 16 }}>
                        🌱 Scalable plan: your first {selected.included_units} seats are free. From the
                        next resident onwards, {money(selected.unit_price ?? 0)} is added to that
                        month's invoice.
                      </Txt>
                    </>
                  )}
                </Col>
              </Card>

              <Card containerColor={isUsage ? '#2E1065' : '#064E3B'} borderRadius={16} padding={[16, 16]}>
                <Row justify="space-between" align="center">
                  <Txt size={11} weight="900" color={Colors.IvoryWhiteText} style={{ letterSpacing: 0.5 }}>
                    DASHBOARD PREVIEW
                  </Txt>
                  <Ionicons name="checkmark-circle" size={18} color={accentFor(selected).colour} />
                </Row>
                <Spacer size={8} />
                <Txt size={20} weight="900" color={Colors.IvoryWhiteText}>
                  {previewAmount > 0 ? `${money(previewAmount)} DUE NOW` : '₹0 FREE ACTIVATION'}
                </Txt>
                <Spacer size={8} />
                {/* The server's own words for why that number, so the screen and the invoice
                    can never tell different stories. */}
                {quote.data && (
                  <Txt size={12} color="rgba(234,242,243,0.9)">✔ {quote.data.explanation}</Txt>
                )}
                <Txt size={12} color="rgba(234,242,243,0.9)">✔ Real-time portions optimizer to eliminate kitchen food waste</Txt>
                <Txt size={12} color="rgba(234,242,243,0.9)">✔ Staff registration portal for your kitchen chefs & supervisors</Txt>
              </Card>

              <Spacer size={28} />

              <Btn
                onPress={handleSubmit}
                disabled={subscribe.isPending}
                loading={subscribe.isPending}
                containerColor={accentFor(selected).colour}
                textColor={isUsage ? Colors.IvoryWhiteText : Colors.LuxuryPureBlack}
                borderRadius={12}
                height={54}
                testID="subscription_submit_button"
              >
                <Txt size={16} weight="900" color={isUsage ? Colors.IvoryWhiteText : Colors.LuxuryPureBlack}>
                  {subscribe.isPending
                    ? 'Activating...'
                    : previewAmount > 0
                      ? 'Pay Upfront & Activate Portal'
                      : 'Activate Pay-As-You-Grow Portal'}
                </Txt>
                <Ionicons name="arrow-forward" size={18} color={isUsage ? Colors.IvoryWhiteText : Colors.LuxuryPureBlack} style={{ marginLeft: 8 }} />
              </Btn>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.LuxuryPureBlack },
  scroll: { padding: 24, paddingBottom: 100 },
  planCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  planTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
