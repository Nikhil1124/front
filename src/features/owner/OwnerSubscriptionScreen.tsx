/**
 * OwnerSubscriptionScreen — activation and billing.
 *
 * This was the one screen in the app still running its own hardcoded dark-navy/purple theme
 * (`#0F172A`, `#1E293B`, `#2E1065`…) — a design generation earlier than everything around it,
 * invisible to `colors.check.ts` because that guard only bans a known list of *past*
 * mistakes, not "any hex a screen invents." It never adopted `Card`, `ListRow`, `StatusChip`,
 * or a single `Colors.*` token for its own backgrounds. Rebuilt on the same tokens, the same
 * `DeckTints` roles the analytics screens use, and `ListRow` for the invoice list.
 *
 * The data path is unchanged: the two plans and their prices are `/v1/billing` rows, not
 * something this file states, and once a property is subscribed the same screen becomes its
 * billing history, because "what am I on and what do I owe" is the question an owner returns
 * here to ask.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  useInvoices,
  usePlans,
  useQuote,
  useReportInvoicePayment,
  useSubscribe,
  useSubscription,
  type Plan } from '@/features/billing/useBilling';
import { updateProperty } from '@/features/properties/useProperties';
import { useActiveProperty } from '@/features/properties/useProperties';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { Radii, Colors, DeckTints, type DeckTint } from '@/theme';
import { Btn, Card, Col, IconBtn, ListRow, ListSectionHeader, Row, Spacer, Txt, type StatusTone } from '@/components/ui';

/** The two shapes the design already had: a flat-fee one and a pay-as-you-grow one. `brand`
 *  and `green` — not a fifth, off-palette purple — so this screen stays inside the same four
 *  verified tints every other tinted card in the app uses. */
function tintFor(plan: Pick<Plan, 'billing_period'>): DeckTint {
  return plan.billing_period === 'usage' ? 'brand' : 'green';
}

function tagFor(plan: Pick<Plan, 'billing_period'>): string {
  return plan.billing_period === 'usage' ? 'PAY AS YOU GROW' : 'FLAT FEE';
}

const money = (value: string | number) => `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;

/** An invoice can be reported paid only while it is issued and nobody has already reported a
 *  method for it — `subscribe()` issues the invoice at activation, so "issued" alone would
 *  include one already mid-confirmation. */
function canReportPayment(inv: { status: string; method?: string | null }): boolean {
  return inv.status === 'issued' && !inv.method;
}

function statusForInvoice(inv: { status: string; method?: string | null }): { label: string; tone: StatusTone } {
  if (inv.status === 'paid') return { label: 'Paid', tone: 'ok' };
  if (inv.method) return { label: 'Awaiting PGow', tone: 'info' };
  return { label: 'Due', tone: 'warn' };
}

/** One bullet of a plan's feature list. */
function PlanPoint({ tint, children }: { tint: DeckTint; children: React.ReactNode }) {
  return (
    <Row align="flex-start" gap={6} style={{ marginBottom: 3 }}>
      <Ionicons name="checkmark" size={13} color={DeckTints[tint].sub} style={{ marginTop: 2 }} />
      <Txt size={12} color={DeckTints[tint].sub} style={{ flex: 1 }}>{children}</Txt>
    </Row>
  );
}

export function OwnerSubscriptionScreen() {
  const { activeEntity: owner } = useActiveProperty();
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const logout = usePGowStore((s) => s.logout);
  const pgId = useAuthStore((s) => s.activePgId);

  const plans = usePlans();
  const subscription = useSubscription(pgId);
  const invoices = useInvoices(pgId);
  const subscribe = useSubscribe(pgId);
  const reportPayment = useReportInvoicePayment(pgId);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  // Seeded from the property's real bed count — never from a placeholder. This is not just
  // a display number: submitting a one-time plan writes it back with
  // `updateProperty({ total_beds })` below. It used to default to 30 whenever `owner` had
  // not loaded yet, so activating a plan on a cold screen could overwrite a 12-bed PG's
  // stored capacity with 30 and bill for it. Hydrates once the property arrives, unless
  // the owner has already adjusted it by hand.
  const [bedsCount, setBedsCount] = useState<number>(owner?.totalBeds ?? 0);
  const bedsTouched = useRef(false);

  useEffect(() => {
    if (!bedsTouched.current && owner?.totalBeds) setBedsCount(owner.totalBeds);
  }, [owner?.totalBeds]);

  const adjustBeds = (next: (c: number) => number) => {
    bedsTouched.current = true;
    setBedsCount(next);
  };

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
              .catch((e: any) => Alert.alert('Failed', e?.message ?? 'Not recorded.')) },
        {
          text: 'Bank transfer',
          onPress: () =>
            reportPayment
              .mutateAsync({ invoiceId, method: 'bank_transfer' })
              .then(() => Alert.alert('Recorded', 'PGow will confirm and settle this shortly.'))
              .catch((e: any) => Alert.alert('Failed', e?.message ?? 'Not recorded.')) },
      ]
    );
  };

  const active = subscription.data;
  // `Subscription` carries `plan_code`, not `billing_period` — look the real plan up in the
  // already-fetched list rather than guess the tint from the plan's display name.
  const activePlan = plans.data?.find((p: any) => p.code === active?.plan_code) ?? null;
  const activeTint = DeckTints[activePlan ? tintFor(activePlan) : 'green'];

  // HubScreenWrapper already owns the back button (router.back(), same as every other
  // drill-down screen); the only reason this screen needed its own header before was the
  // logout affordance for the not-yet-subscribed state, which becomes rightAction instead.
  return (
    <HubScreenWrapper
      title={active ? 'Subscription & billing' : 'Activate this property'}
      onBack={() => router.back()}
      rightAction={
        !active ? (
          <IconBtn onPress={() => logout()} icon="exit" size={20} tint={Colors.textMuted} />
        ) : undefined
      }
    >
      <Card containerColor="transparent" borderRadius={Radii.feature} style={{ height: 130, marginBottom: 20, overflow: 'hidden' }}>
        <Image source={require('../../../assets/img_premium_subscription.webp')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Card>

      {active ? (
        <>
          {/* ── Already subscribed: what am I on, and what do I owe ── */}
          <Card containerColor={activeTint.fill} borderRadius={Radii.feature} borderWidth={0} padding={[16, 16]}>
            <Row justify="space-between" align="center">
              <Txt size={11} weight="700" color={activeTint.sub} style={{ letterSpacing: 0.5 }}>
                CURRENT PLAN
              </Txt>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            </Row>
            <Spacer size={6} />
            <Txt size={22} weight="700" color={activeTint.ink}>{active.plan_name}</Txt>
            <Spacer size={4} />
            {/* `subscribe()` marks the subscription active and issues the invoice in the same
                step (billing/service.py) — the invoice starts "issued", not "paid"; actual
                payment only lands once reported and confirmed (see Invoices below, which
                would show this same invoice as Due right under a card claiming it was
                already paid). */}
            <Txt size={12} color={activeTint.sub} tabular>
              {Number(active.price) > 0
                ? `${money(active.price)} billed at activation`
                : 'No upfront cost — billed as residents are added'}
            </Txt>
            <Txt size={12} color={activeTint.sub}>Active since {active.current_period_start}</Txt>
          </Card>

          <Spacer size={24} />
          <ListSectionHeader title="Invoices" count={invoices.data?.length} />

          {invoices.isLoading ? (
            <Txt size={12} color={Colors.textMuted} style={{ paddingVertical: 12 }}>Loading…</Txt>
          ) : !invoices.data?.length ? (
            <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
              <Txt size={12} color={Colors.textMuted} align="center">Nothing billed yet.</Txt>
            </Card>
          ) : (
            invoices.data.map((inv: any, i: number, arr: any[]) => {
              const reportable = canReportPayment(inv);
              return (
                <ListRow
                  key={inv.id}
                  leading={<Ionicons name="receipt-outline" size={17} color={Colors.primary} />}
                  title={`Period ${inv.period}`}
                  meta={reportable ? 'Tap to report your payment' : undefined}
                  amount={money(inv.amount)}
                  status={statusForInvoice(inv)}
                  onPress={reportable ? () => handleReportPayment(inv.id) : undefined}
                  first={i === 0}
                  last={i === arr.length - 1}
                  testID={`invoice_${inv.id}`}
                />
              );
            })
          )}
        </>
      ) : (
        <>
          {/* ── Not subscribed: pick a plan ── */}
          <Row gap={6} align="center" style={{ marginBottom: 16 }}>
            <Txt size={18} weight="700" color={Colors.textPrimary}>Choose a plan</Txt>
            <InfoTip text="Choose how you want to subscribe to the co-living management features. Pay a fixed upfront cost, or pay-as-you-grow based on residents actually added." />
          </Row>

          {plans.isLoading && (
            <Txt size={12} color={Colors.textMuted}>Loading plans…</Txt>
          )}
          {plans.isError && (
            <Txt size={12} color={Colors.danger}>Could not load plans. Pull back and try again.</Txt>
          )}

          <Row gap={12} style={{ marginBottom: 20 }}>
            {(plans.data ?? []).map((plan: any) => {
              const tint = DeckTints[tintFor(plan)];
              const isSelected = plan.code === selectedCode;
              return (
                <AnimatedPress
                  key={plan.code}
                  onPress={() => setSelectedCode(plan.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.planCard,
                    { backgroundColor: isSelected ? tint.fill : Colors.surface,
                      borderColor: isSelected ? Colors.primary : Colors.borderSubtle,
                      borderWidth: isSelected ? 2 : 1 },
                  ]}
                  testID={`plan_${plan.code}`}
                >
                  <View style={[styles.planTag, { backgroundColor: isSelected ? Colors.surface : Colors.surfaceElevated }]}>
                    <Txt size={9} weight="700" color={isSelected ? tint.ink : Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                      {tagFor(plan)}
                    </Txt>
                  </View>
                  <Spacer size={8} />
                  <Txt size={15} weight="700" color={isSelected ? tint.ink : Colors.textPrimary}>{plan.name}</Txt>
                  <Txt size={11.5} color={isSelected ? tint.sub : Colors.textMuted} style={{ lineHeight: 15, marginTop: 4 }}>
                    {plan.billing_period === 'one_time'
                      ? `Pay ${money(plan.unit_price ?? 0)} per bed upfront. Add residents up to your limit with ₹0 extra.`
                      : plan.billing_period === 'usage'
                        ? `₹0 upfront. First ${plan.included_units} residents free, then ${money(plan.unit_price ?? 0)} per resident added.`
                        : `${money(plan.price)} per ${plan.billing_period.replace('ly', '')}.`}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </Row>

          {selected && (
            <>
              <Txt size={15} weight="700" color={Colors.textPrimary} style={{ marginBottom: 12 }}>
                {isOneTime
                  ? 'How many beds?'
                  : `Starting size — ${selected.included_units} free included`}
              </Txt>

              <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ marginBottom: 16 }}>
                <Col align="center">
                  <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                    {isOneTime ? 'TOTAL BEDS' : 'INITIAL SEAT ALLOCATION'}
                  </Txt>
                  <Spacer size={10} />
                  <Txt size={48} weight="700" color={Colors.textPrimary} tabular>
                    {isOneTime ? bedsCount : selected.included_units}
                  </Txt>
                  <Txt size={12.5} color={Colors.textMuted}>
                    {isOneTime ? 'Paid beds configured' : 'Free starter seats active'}
                  </Txt>

                  {isOneTime ? (
                    <>
                      <Spacer size={18} />
                      <Row gap={8}>
                        <Btn onPress={() => adjustBeds((c) => (c > 10 ? c - 10 : c > 1 ? 1 : c))} containerColor={Colors.surfaceElevated} textColor={Colors.textPrimary} borderRadius={Radii.control} height={40} style={{ flex: 1 }}>
                          <Txt size={13} weight="700" color={Colors.textPrimary}>-10</Txt>
                        </Btn>
                        <Btn onPress={() => adjustBeds((c) => (c > 1 ? c - 1 : c))} containerColor={Colors.surfaceElevated} textColor={Colors.textPrimary} borderRadius={Radii.control} height={40} style={{ flex: 1 }}>
                          <Txt size={13} weight="700" color={Colors.textPrimary}>-1</Txt>
                        </Btn>
                        <Btn onPress={() => adjustBeds((c) => c + 1)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={40} style={{ flex: 1 }}>
                          <Txt size={13} weight="700" color={Colors.textInverse}>+1</Txt>
                        </Btn>
                        <Btn onPress={() => adjustBeds((c) => c + 10)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={40} style={{ flex: 1 }}>
                          <Txt size={13} weight="700" color={Colors.textInverse}>+10</Txt>
                        </Btn>
                      </Row>
                    </>
                  ) : (
                    <>
                      <Spacer size={10} />
                      <Txt size={12} color={Colors.primary} align="center" style={{ paddingHorizontal: 12, lineHeight: 16 }}>
                        Scalable plan: your first {selected.included_units} seats are free. From the
                        next resident onwards, {money(selected.unit_price ?? 0)} is added to that
                        month's invoice.
                      </Txt>
                    </>
                  )}
                </Col>
              </Card>

              <Card containerColor={DeckTints[tintFor(selected)].fill} borderRadius={Radii.feature} borderWidth={0} padding={[16, 16]}>
                <Row justify="space-between" align="center">
                  <Txt size={11} weight="700" color={DeckTints[tintFor(selected)].sub} style={{ letterSpacing: 0.5 }}>
                    DUE AT ACTIVATION
                  </Txt>
                  <Ionicons name="checkmark-circle" size={18} color={DeckTints[tintFor(selected)].ink} />
                </Row>
                <Spacer size={6} />
                <Txt size={26} weight="700" color={DeckTints[tintFor(selected)].ink} tabular>
                  {previewAmount > 0 ? money(previewAmount) : '₹0 free activation'}
                </Txt>
                <Spacer size={10} />
                {/* The server's own words for why that number, so the screen and the invoice
                    can never tell different stories. */}
                {quote.data && <PlanPoint tint={tintFor(selected)}>{quote.data.explanation}</PlanPoint>}
                <PlanPoint tint={tintFor(selected)}>Real-time portions optimizer to eliminate kitchen food waste</PlanPoint>
                <PlanPoint tint={tintFor(selected)}>Staff registration portal for your kitchen chefs and supervisors</PlanPoint>
              </Card>

              <Spacer size={24} />

              <Btn
                onPress={handleSubmit}
                disabled={subscribe.isPending}
                loading={subscribe.isPending}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={Radii.card}
                height={54}
                testID="subscription_submit_button"
              >
                <Txt size={15} weight="700" color={Colors.textInverse}>
                  {subscribe.isPending
                    ? 'Activating…'
                    : previewAmount > 0
                      ? 'Pay upfront and activate'
                      : 'Activate pay-as-you-grow'}
                </Txt>
                <Ionicons name="arrow-forward" size={18} color={Colors.textInverse} style={{ marginLeft: 8 }} />
              </Btn>
            </>
          )}
        </>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  planCard: {
    flex: 1,
    borderRadius: Radii.card,
    padding: 14 },
  planTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge } });
