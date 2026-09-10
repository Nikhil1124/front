/**
 * GuestPaymentsTab — Redesigned Resident/Guest Payments Experience.
 *
 * Visual System: Premium Teal (#087F86), Deep Teal (#06656B), Soft Mint (#EAF7F5),
 * Background (#F8FAFB), Dark Navy Typography (#14252B), Light Borders (#DCE9EA).
 *
 * Hierarchy:
 *   1. Teal Gradient Header (Payments / All your payments in one place.)
 *   2. Amount Due Hero Card (Overlaps header, breakdown of Rent/Utilities/Penalty, status pill, CTA)
 *   3. Quick Pay (4 payment method cards: Pay Online, Scan QR, Phone UPI, Cash Handover + actions)
 *   4. Invoices (Horizontal cards with status treatments, PDF download, receipt view)
 *   5. Recent Transactions (Compact list of real payments with receipt dialog trigger)
 *   6. Payments-verified summary row (own history only — see the note beside `totalPaid`)
 *   7. Support Card ("Need help with Payment?" → /support)
 *
 * All data live from usePaymentsQuery, useRentDueQuery, useTenantInvoices — 100% functionality preserved.
 */
import { useState } from 'react';
import {
  View, StyleSheet, Alert, RefreshControl,
  ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatINR } from '@/utils/format';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { buildUpiUri, launchUpiPayment, usePaymentsQuery, useRentDueQuery, useSubmitPaymentMutation } from '@/features/payments/usePayments';
import {
  useTenantInvoices,
  usePayTenantInvoice,
  fetchTenantInvoicePdfUrl } from '@/features/billing/useTenantInvoices';
import { fetchWithTimeout } from '@/hooks/useApi';
import { BASE_URL } from '@/config';
import { useMyRewardsQuery } from '@/features/rewards/useRewards';
import type { PaymentEntity, TenantInvoice } from '@/types';
import { useActiveProperty } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Btn, Card, Col, ListRow, MetricRow, Row, Sheet, Spacer, Spinner, StatusChip, Txt, toneFor, type StatusTone } from '@/components/ui';


/**
 * How close this month's rent is to its due date.
 *
 * The date arithmetic is the point — "Due in 3 days" and "Overdue" are facts this screen
 * computes and nothing else does. Only the colours left: they were four hardcoded pairs
 * (`#E0F2F0`, `#D97706`…) that the palette pass never reached, and are now tones on the one
 * `StatusChip` every status in the app renders through.
 */
function getDueStatus(isPaid: boolean, dueDateStr?: string): { label: string; tone: StatusTone } {
  if (isPaid) return { label: 'Paid', tone: 'ok' };
  if (!dueDateStr) return { label: 'Due soon', tone: 'warn' };

  const due = new Date(dueDateStr).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn' };
  if (diffDays <= 7) return { label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`, tone: 'warn' };
  return { label: 'Due soon', tone: 'info' };
}

export function GuestPaymentsTab() {
  const dockScroll = useDockScroll();
  const guest = usePGowStore((s) => s.loggedInGuest);
  const { activeEntity: ownerForGuest } = useActiveProperty();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPayments = [], isLoading: paymentsLoading, error: paymentsError } = usePaymentsQuery(activePgId ?? undefined);
  const { data: rentDue, isLoading: rentLoading } = useRentDueQuery(activePgId ?? undefined);
  const { data: myRewards } = useMyRewardsQuery(activePgId ?? undefined);
  const submitPaymentMutation = useSubmitPaymentMutation(activePgId ?? undefined);
  const activeMembership = useAuthStore((s) => s.user?.memberships.find((m) => m.role === 'guest')?.membership_id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  // Invoices (server-side monthly invoices)
  const { data: invoices = [], isLoading: invoicesLoading } = useTenantInvoices(activePgId, activeMembership ?? undefined);
  const payInvoice = usePayTenantInvoice(activePgId);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const [payMode, setPayMode] = useState<'ONLINE_PHONEPE' | 'SCAN_QR' | 'CASH_HANDOVER'>('ONLINE_PHONEPE');
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentEntity | null>(null);
  const [showResidentCard, setShowResidentCard] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);

  const ownerUpi = ownerForGuest?.upiId?.trim() ?? '';
  const hasUpi = ownerUpi.length > 0;
  const contactPhone = ownerForGuest?.managerPhone?.trim() || ownerForGuest?.phonePeNumber?.trim() || '';
  const isBillPaid = guest?.isBillPaid ?? false;

  const rentAmount = rentDue ? map.toAmount(rentDue.rent_amount) : null;
  const rentKnown = rentAmount !== null && rentAmount > 0;
  const currentMonthYear = periodToMonthYear(currentPeriod());

  // Find current active unpaid invoice or fallback
  const unpaidInvoice = invoices.find((i) => i.status === 'unpaid' || i.status === 'overdue');
  const latestInvoice = unpaidInvoice || invoices[0];

  const totalAmountDue = unpaidInvoice
    ? unpaidInvoice.totalAmount
    : (rentKnown ? rentAmount! : (guest?.rentAmount ?? 0));

  const rentComponent = unpaidInvoice ? unpaidInvoice.rentAmount : (rentKnown ? rentAmount! : (guest?.rentAmount ?? 0));
  const utilityComponent = unpaidInvoice ? unpaidInvoice.utilityAmount : 0;
  const penaltyComponent = unpaidInvoice ? unpaidInvoice.penaltyAmount : 0;

  // The same deep link "Pay Online" launches, just encoded as a QR instead of opened directly
  // — null (falls back to a placeholder) whenever the VPA is missing or incomplete, exactly
  // the case launchUpiPayment itself refuses to act on.
  const qrUpiUri = hasUpi ? buildUpiUri({ upiId: ownerUpi, amount: totalAmountDue, note: 'PG Rent Payment' }) : null;

  const dueStatus = getDueStatus(isBillPaid, latestInvoice?.dueDate);

  const guestPayments = allPayments.filter((p) => p.payerId === guest?.id);
  // `allPayments` is every payment across the whole PG, not this resident's own — the "total
  // paid" balance and "you have made N payments" were computed against every resident's
  // payments combined and shown as if they were this guest's own history.
  /** A submission for THIS cycle that the owner has not acted on yet. Rejected ones do not
   *  count — a rejected payment is exactly the case where resubmitting is the right move. */
  const hasPendingPayment = guestPayments.some(
    (p) => p.status === 'PENDING' && p.monthYear === currentMonthYear
  );
  const totalPaid = guestPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const verifiedCount = guestPayments.filter((p) => p.status === 'VERIFIED').length;
  // What this actually measures: the share of this guest's own payment submissions PGow has
  // verified, not whether they paid on time — the app has no due-date-vs-paid-date comparison
  // anywhere. Labelled "Payments verified" below rather than "On-time Payments".
  const verifiedPercentage = guestPayments.length > 0 ? Math.round((verifiedCount / guestPayments.length) * 100) : 100;

  const handleUpiLaunch = async () => {
    if (!hasUpi || !rentKnown) return;
    const result = await launchUpiPayment({
      upiId: ownerUpi,
      payeeName: 'PG Rent Payment',
      amount: totalAmountDue,
      note: `Rent ${currentMonthYear}` });
    Alert.alert('UPI Payment', result.message);
  };

  // The UI's action labels, in the values the API's CHECK constraints accept.
  const PAYMENT_METHOD_MAP: Record<string, 'upi_intent' | 'upi_manual' | 'cash'> = {
    ONLINE_PHONEPE: 'upi_intent', SCAN_QR: 'upi_manual', CASH_HANDOVER: 'cash' };

  const handleSubmit = async (mode: string) => {
    if (isSubmitting) return;
    // One pending submission per cycle. `isSubmitting` only guards a double-TAP; it does
    // nothing about coming back an hour later and submitting again, which is how residents
    // ended up filing the same rent payment three or four times. The database does not stop
    // this either — `payments_one_verified_per_period` is a unique index over VERIFIED rows
    // only, so any number of PENDING ones are legal. Every duplicate lands in the owner's
    // verification queue as a separate payment to reconcile against one real transfer.
    if (hasPendingPayment) {
      Alert.alert(
        'Already submitted',
        `You have a payment for ${currentMonthYear} awaiting your owner's verification. `
          + 'They will confirm it shortly — no need to submit it again.'
      );
      return;
    }
    if (!rentKnown && !unpaidInvoice) {
      Alert.alert('Amount unavailable', 'We could not load what you owe this month. Pull down to refresh and try again.');
      return;
    }
    if (!activePgId) return;
    setIsSubmitting(true);
    try {
      await submitPaymentMutation.mutateAsync({
        pg_id: activePgId,
        amount: totalAmountDue,
        period: currentPeriod(),
        purpose: 'rent',
        method: PAYMENT_METHOD_MAP[mode] ?? 'upi_manual',
        upi_ref: utrNumber || undefined });
      setUtrNumber('');
      setShowPayForm(false);
      toast('success', 'Payment submitted!', isBillPaid ? 'Your payment was recorded.' : 'Awaiting owner verification.');
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInvoice = async (inv: TenantInvoice) => {
    setPayingInvoiceId(inv.id);
    try {
      await payInvoice.mutateAsync({ invoiceId: inv.id, method: 'upi_manual' });
      toast('success', 'Invoice paid', `${periodToMonthYear(`${inv.year}-${String(inv.month).padStart(2, '0')}-01`)} invoice marked as paid.`);
    } catch (err: any) {
      toast('error', 'Pay failed', err?.message ?? 'Please try again.');
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadPdf = async (inv: TenantInvoice) => {
    setDownloadingInvoiceId(inv.id);
    try {
      const pdfUrl = await fetchTenantInvoicePdfUrl(inv.id);
      if (!pdfUrl) {
        toast('error', 'PDF unavailable', 'The invoice PDF could not be generated.');
        return;
      }
      const res = await fetchWithTimeout(pdfUrl.startsWith('http') ? pdfUrl : `${BASE_URL}${pdfUrl}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      try {
        await Clipboard.setStringAsync(pdfUrl);
        toast('success', 'PDF link copied', 'The invoice PDF URL has been copied. Open it in a browser to download.');
      } catch {
        toast('success', 'PDF ready', 'The invoice PDF is available; check your downloads.');
      }
    } catch (err: any) {
      toast('error', 'PDF failed', err?.message ?? 'Please try again later.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handlePrimaryPayPress = () => {
    if (isBillPaid) return;
    // Stop at the entry point too, not just at submit — opening the form and filling in a
    // UTR only to be told it was already sent is a worse way to find out.
    if (hasPendingPayment) {
      Alert.alert(
        'Already submitted',
        `Your ${currentMonthYear} payment is awaiting verification from your owner.`
      );
      return;
    }
    setShowPayForm(true);
    if (payMode === 'CASH_HANDOVER') {
      handleSubmit('CASH_HANDOVER');
    } else {
      if (!hasUpi) {
        Alert.alert('Payment Method Note', "Owner UPI ID is not configured. Please use Cash Handover or submit UTR ref manually.");
        return;
      }
      handleUpiLaunch();
    }
  };

  const handleQuickPaySelect = (mode: 'ONLINE_PHONEPE' | 'SCAN_QR' | 'CASH_HANDOVER') => {
    setPayMode(mode);
    setShowPayForm(true);
    if (mode === 'ONLINE_PHONEPE' && hasUpi) {
      handleUpiLaunch();
    }
  };

  return (
    <View style={styles.root}>
      {selectedReceipt && <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />}

      {/* Resident Card Sheet */}
      {showResidentCard && (
        <Sheet
          visible={showResidentCard}
          title="Resident Card"
          icon="card"
          accent={Colors.primary}
          onDismiss={() => setShowResidentCard(false)}
          testID="guest-resident-card"
        >
          <Card
            containerColor={Colors.primaryDark}
            borderRadius={Radii.sheet}
            borderWidth={0}
            padding={[20, 20]}
            style={{ width: '100%', elevation: 0 }}
          >
            <Col style={{ flex: 1, justifyContent: 'space-between' }}>
              <Row justify="space-between" align="center">
                <Txt variant="meta" weight="600" color={Colors.textInverse}>PGOW RESIDENT CARD</Txt>
                <Ionicons name="card" size={22} color={Colors.textInverse} />
              </Row>
              <Spacer size={12} />
              <Txt variant="cardTitle" color={Colors.textInverse} tabular>PGOW-RESIDENT-ID: #{guest?.id ?? '—'}</Txt>
              <Spacer size={16} />
              <Row justify="space-between">
                <Col>
                  <Txt size={9} color="rgba(255,255,255,0.75)">RESIDENT</Txt>
                  <Txt variant="cardTitle" color={Colors.textInverse}>{(guest?.name ?? 'PG RESIDENT').toUpperCase()}</Txt>
                </Col>
                <Col align="center">
                  <Txt size={9} color="rgba(255,255,255,0.75)">REWARDS</Txt>
                  <Txt variant="body" weight="600" color={Palette.TintAmber} tabular>{myRewards?.balance ?? 0} PTS</Txt>
                </Col>
                <Col align="flex-end">
                  <Txt size={9} color="rgba(255,255,255,0.75)">ROOM</Txt>
                  <Txt variant="body" weight="600" color={Colors.textInverse} tabular>{guest?.roomNo ?? '—'}</Txt>
                </Col>
              </Row>
            </Col>
          </Card>
        </Sheet>
      )}

      {/* How it Works Sheet */}
      {showHowItWorks && (
        <Sheet
          visible={showHowItWorks}
          title="How Payments Work"
          icon="help-circle-outline"
          accent={Colors.primary}
          onDismiss={() => setShowHowItWorks(false)}
          testID="guest-payments-how-it-works"
          footer={
            <Btn onPress={() => setShowHowItWorks(false)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.card} height={40}>
              <Txt variant="button" color={Colors.textInverse}>Got it</Txt>
            </Btn>
          }
        >
          <Col gap={12}>
            <Row gap={10} align="flex-start">
              <View style={styles.stepNum}><Txt variant="meta" weight="600" color={Colors.textInverse} tabular>1</Txt></View>
              <Col style={{ flex: 1 }}>
                <Txt variant="cardTitle" color={Colors.textPrimary}>Choose Method & Pay</Txt>
                <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>Pay via UPI app, QR scan, or cash handover to your property manager.</Txt>
              </Col>
            </Row>
            <Row gap={10} align="flex-start">
              <View style={styles.stepNum}><Txt variant="meta" weight="600" color={Colors.textInverse} tabular>2</Txt></View>
              <Col style={{ flex: 1 }}>
                <Txt variant="cardTitle" color={Colors.textPrimary}>Submit UTR Reference</Txt>
                <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>Enter the 12-digit UTR/Ref number from your UPI receipt for verification.</Txt>
              </Col>
            </Row>
            <Row gap={10} align="flex-start">
              <View style={styles.stepNum}><Txt variant="meta" weight="600" color={Colors.textInverse} tabular>3</Txt></View>
              <Col style={{ flex: 1 }}>
                <Txt variant="cardTitle" color={Colors.textPrimary}>Instant Verification</Txt>
                <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>Owner verifies payment and a downloadable PDF receipt is generated.</Txt>
              </Col>
            </Row>
          </Col>
        </Sheet>
      )}

      {/* ── 1. COMPACT TEAL GRADIENT HEADER ── */}
      <AppHeader
        title="Payments"
        subtitle="All your payments in one place."
        actions={
          <Row gap={8}>
            <HeaderChip icon="document-text-outline" label="Resident card" onPress={() => setShowResidentCard(true)} />
            <HeaderChip icon="time-outline" label="Support" onPress={() => router.push('/support')} />
          </Row>
        }
      />

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        {...dockScroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── 2. TOTAL AMOUNT DUE CARD (Overlaps header) ── */}
        <View style={styles.dueCard}>
          {isBillPaid ? (
            /* Positive Paid State */
            <Col align="center" style={{ paddingVertical: 12 }}>
              <View style={styles.paidCheckBadge}>
                <Ionicons name="checkmark-circle" size={44} color={Colors.success} />
              </View>
              <Spacer size={8} />
              <Txt variant="screenTitle" color={Colors.textPrimary}>You're all paid up!</Txt>
              <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 4, textAlign: 'center' }}>
                No outstanding dues for {currentMonthYear}.
              </Txt>
              <Spacer size={14} />
              <Row gap={16} justify="center">
                <Col align="center">
                  <Txt size={10} color={Colors.textSecondary}>TOTAL PAID</Txt>
                  <Txt variant="body" weight="600" color={Colors.primary} tabular>{formatINR(Math.round(totalPaid))}</Txt>
                </Col>
                <View style={styles.vDivider} />
                <Col align="center">
                  <Txt size={10} color={Colors.textSecondary}>STATUS</Txt>
                  <Txt variant="body" weight="600" color={Colors.success}>Verified</Txt>
                </Col>
              </Row>
            </Col>
          ) : (
            /* Unpaid / Due State */
            <View>
              {/* Header row inside card */}
              <Row justify="space-between" align="center">
                <Txt size={12} weight="700" color={Colors.textSecondary}>Total Amount Due</Txt>
                <StatusChip label={dueStatus.label} tone={dueStatus.tone} />
              </Row>

              <Spacer size={12} />

              <Row justify="space-between" align="flex-start">
                {/* Left: Total & CTA */}
                <Col style={{ flex: 1, paddingRight: 12 }}>
                  <Txt variant="hero" color={Colors.textPrimary} tabular>
                    {rentLoading ? <Spinner size="small" /> : formatINR(Math.round(totalAmountDue))}
                  </Txt>
                  <Spacer size={6} />
                  <View style={styles.dueDateBadge}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
                    <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>
                      Due on {latestInvoice?.dueDate || `05 ${currentMonthYear.slice(0, 3)} ${new Date().getFullYear()}`}
                    </Txt>
                  </View>
                  <Spacer size={16} />
                  <AnimatedPress accessibilityRole="button"
                    style={styles.payNowBtn}
                    onPress={handlePrimaryPayPress}
                  >
                    <Txt variant="button" color={Colors.textInverse}>Pay Rent Now</Txt>
                  </AnimatedPress>
                </Col>

                {/* Right: Breakdown Table */}
                <View style={styles.breakdownBox}>
                  <Row justify="space-between" style={styles.bdRow}>
                    <Txt size={11} color={Colors.textSecondary}>Rent</Txt>
                    <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular>{formatINR(Math.round(rentComponent))}</Txt>
                  </Row>
                  {utilityComponent > 0 && (
                    <Row justify="space-between" style={styles.bdRow}>
                      <Txt size={11} color={Colors.textSecondary}>Utilities</Txt>
                      <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular>{formatINR(Math.round(utilityComponent))}</Txt>
                    </Row>
                  )}
                  <Row justify="space-between" style={styles.bdRow}>
                    <Txt size={11} color={Colors.textSecondary}>Other Charges</Txt>
                    <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular>{formatINR(0)}</Txt>
                  </Row>
                  {penaltyComponent > 0 && (
                    <Row justify="space-between" style={styles.bdRow}>
                      <Txt size={11} color={Colors.danger}>Penalty</Txt>
                      <Txt variant="meta" weight="600" color={Colors.danger} tabular>{formatINR(Math.round(penaltyComponent))}</Txt>
                    </Row>
                  )}
                  <View style={styles.bdDivider} />
                  <Row justify="space-between" style={{ marginTop: 4 }}>
                    <Txt variant="meta" weight="600" color={Colors.textPrimary}>Total</Txt>
                    <Txt variant="meta" weight="700" color={Colors.primary} tabular>{formatINR(Math.round(totalAmountDue))}</Txt>
                  </Row>
                </View>
              </Row>
            </View>
          )}
        </View>

        {/* ── Payment Submission Input Form (if toggled or selected) ── */}
        {showPayForm && !isBillPaid && (
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor="#DCE9EA" padding={[16, 16]} style={{ marginTop: 14 }}>
            <Row justify="space-between" align="center">
              <Txt variant="cardTitle" color={Colors.textPrimary}>
                {payMode === 'CASH_HANDOVER' ? '💵 Cash Handover Payment' : payMode === 'SCAN_QR' ? '📷 Scan & Pay QR Code' : '📱 Phone UPI Payment'}
              </Txt>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setShowPayForm(false)}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </AnimatedPress>
            </Row>
            <Spacer size={12} />

            {payMode === 'ONLINE_PHONEPE' && (
              <View>
                {hasUpi && (
                  <View style={styles.vpaBox}>
                    <Col style={{ flex: 1 }}>
                      <Txt size={11} weight="700" color={Colors.textSecondary}>Owner UPI VPA ID</Txt>
                      <Txt variant="body" weight="600" color={Colors.primary} tabular>{ownerUpi}</Txt>
                    </Col>
                    <AnimatedPress accessibilityRole="button" style={styles.copyChip} onPress={() => { Clipboard.setStringAsync(ownerUpi); toast('success', 'Copied', 'UPI VPA copied to clipboard.'); }}>
                      <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                      <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>Copy</Txt>
                    </AnimatedPress>
                  </View>
                )}
                <Spacer size={12} />
                <OutlinedTextField
                  label="Enter 12-Digit UTR Transaction Ref"
                  placeholder="e.g. 421980341209"
                  value={utrNumber}
                  onChangeText={setUtrNumber}
                  focusedBorderColor={Colors.primary}
                  borderRadius={Radii.control}
                />
                <Spacer size={12} />
                <Btn onPress={() => handleSubmit('ONLINE_PHONEPE')} disabled={!utrNumber.trim() || isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={42}>
                  <Txt variant="button" color={Colors.textInverse}>Submit UTR Reference</Txt>
                </Btn>
              </View>
            )}

            {payMode === 'SCAN_QR' && (
              <Col align="center">
                <View style={styles.qrBox}>
                  {qrUpiUri ? (
                    <QRCode value={qrUpiUri} size={110} color={Colors.primaryDark} backgroundColor={Colors.surface} />
                  ) : (
                    <Ionicons name="qr-code-outline" size={72} color={Colors.textSecondary} />
                  )}
                </View>
                <Spacer size={6} />
                <Txt size={10} color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                  {qrUpiUri ? ownerUpi : 'Owner has not set up a UPI ID yet — use Cash Handover instead.'}
                </Txt>
                <Spacer size={12} />
                <OutlinedTextField
                  label="Enter 12-Digit UTR Transaction Ref"
                  placeholder="e.g. 421980341209"
                  value={utrNumber}
                  onChangeText={setUtrNumber}
                  focusedBorderColor={Colors.primary}
                  borderRadius={Radii.control}
                  style={{ width: '100%' }}
                />
                <Spacer size={12} />
                <Btn onPress={() => handleSubmit('SCAN_QR')} disabled={!utrNumber.trim() || isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={42} style={{ width: '100%' }}>
                  <Txt variant="button" color={Colors.textInverse}>Submit UTR Reference</Txt>
                </Btn>
              </Col>
            )}

            {payMode === 'CASH_HANDOVER' && (
              <View>
                <Txt size={12} color={Colors.textSecondary} style={{ lineHeight: 17 }}>
                  Handover physical cash of <Txt weight="600" color={Colors.textPrimary} tabular>{formatINR(Math.round(totalAmountDue))}</Txt> directly to your PG Manager {contactPhone ? `(${contactPhone})` : ''}. Once submitted, it will be marked for owner verification.
                </Txt>
                <Spacer size={14} />
                <Btn onPress={() => handleSubmit('CASH_HANDOVER')} disabled={isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={42}>
                  <Txt variant="button" color={Colors.textInverse} tabular>Confirm Cash Handover ({formatINR(Math.round(totalAmountDue))})</Txt>
                </Btn>
              </View>
            )}
          </Card>
        )}

        {/* ── 3. QUICK PAY SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 24, marginBottom: 14 }}>
          <Txt variant="sectionTitle" color={Colors.textPrimary}>Quick Pay</Txt>
          <AnimatedPress accessibilityRole="button" onPress={() => setShowHowItWorks(true)}>
            <Row align="center" gap={4}>
              <Txt size={12} weight="700" color={Colors.primary}>How it works?</Txt>
              <Ionicons name="help-circle-outline" size={14} color={Colors.primary} />
            </Row>
          </AnimatedPress>
        </Row>

        <Row gap={8} style={{ marginBottom: 14 }}>
          <AnimatedPress accessibilityRole="button"
            onPress={() => handleQuickPaySelect('ONLINE_PHONEPE')}
            style={[styles.qpCard, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="card-outline" size={18} color={payMode === 'ONLINE_PHONEPE' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt variant="meta" weight="600" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Pay Online
            </Txt>
            <Txt size={9} color={Colors.textSecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              (UPI / Card)
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            onPress={() => handleQuickPaySelect('SCAN_QR')}
            style={[styles.qpCard, payMode === 'SCAN_QR' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'SCAN_QR' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="qr-code-outline" size={18} color={payMode === 'SCAN_QR' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt variant="meta" weight="600" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Scan QR
            </Txt>
            <Txt size={9} color={Colors.textSecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Pay
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            onPress={() => handleQuickPaySelect('ONLINE_PHONEPE')}
            style={[styles.qpCard, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="phone-portrait-outline" size={18} color={payMode === 'ONLINE_PHONEPE' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt variant="meta" weight="600" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Phone UPI
            </Txt>
            <Txt size={9} color={Colors.textSecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Pay
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            onPress={() => handleQuickPaySelect('CASH_HANDOVER')}
            style={[styles.qpCard, payMode === 'CASH_HANDOVER' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'CASH_HANDOVER' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="cash-outline" size={18} color={payMode === 'CASH_HANDOVER' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt variant="meta" weight="600" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Cash Handover
            </Txt>
            <Txt size={9} color={Colors.textSecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Mark as Paid
            </Txt>
          </AnimatedPress>
        </Row>

        {/* ── 4. INVOICES SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt variant="sectionTitle" color={Colors.textPrimary}>Invoices</Txt>
          <AnimatedPress accessibilityRole="button" onPress={() => toast('info', 'Not Available Yet', 'A full invoice list is coming soon — every invoice you have is already shown above.')}>
            <Row align="center" gap={4}>
              <Txt size={13} weight="700" color={Colors.primary}>View All</Txt>
              <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
            </Row>
          </AnimatedPress>
        </Row>

        {invoicesLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size="small" />
            <Txt size={12} color={Colors.textSecondary} style={{ marginLeft: 8 }}>Loading invoices...</Txt>
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.emptyInvoiceCard}>
            <Ionicons name="document-text-outline" size={26} color={Colors.primary} />
            <Txt size={13} weight="700" color={Colors.textSecondary} style={{ marginLeft: 10 }}>
              No monthly invoices posted yet.
            </Txt>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}
          >
            {invoices.map((inv: TenantInvoice) => {
              const monthName = periodToMonthYear(`${inv.year}-${String(inv.month).padStart(2, '0')}-01`);
              const isPaid = inv.status === 'paid';
              const isOverdue = inv.status === 'overdue';

              const statusText = isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due';

              return (
                <View key={inv.id} style={styles.invoiceCard}>
                  <Row justify="space-between" align="center">
                    <StatusChip label={statusText} tone={toneFor(statusText)} />
                    <Txt size={11} color={Colors.textSecondary}>{monthName.split(' ')[0]} {inv.year}</Txt>
                  </Row>

                  <Spacer size={10} />
                <Txt variant="metric" color={Colors.textPrimary} tabular>
                    {formatINR(Math.round(inv.totalAmount))}
                </Txt>
                  <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    {isPaid ? (inv.paidAt ? `Paid on ${inv.paidAt.slice(0, 10)}` : 'Paid') : `Due on ${inv.dueDate}`}
                  </Txt>

                  <Spacer size={14} />

                  <Row gap={8}>
                    {!isPaid && (
                      <AnimatedPress accessibilityRole="button"
                        style={styles.invPayBtn}
                        onPress={() => handlePayInvoice(inv)}
                        disabled={payingInvoiceId === inv.id}
                      >
                        <Txt variant="meta" weight="600" color={Colors.textInverse}>Pay</Txt>
                      </AnimatedPress>
                    )}
                    <AnimatedPress accessibilityRole="button"
                      style={styles.invReceiptBtn}
                      onPress={() => handleDownloadPdf(inv)}
                      disabled={downloadingInvoiceId === inv.id}
                    >
                      <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
                      <Txt variant="meta" weight="600" color={Colors.primary} style={{ marginLeft: 4 }}>Receipt</Txt>
                    </AnimatedPress>
                  </Row>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── 5. RECENT TRANSACTIONS SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt variant="sectionTitle" color={Colors.textPrimary}>Recent Transactions</Txt>
          <AnimatedPress accessibilityRole="button" onPress={() => toast('info', 'Not Available Yet', 'A full transaction history is coming soon — only the 6 most recent are shown below.')}>
            <Row align="center" gap={4}>
              <Txt size={13} weight="700" color={Colors.primary}>View All</Txt>
              <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
            </Row>
          </AnimatedPress>
        </Row>

        {paymentsLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size="small" />
            <Txt size={12} color={Colors.textSecondary} style={{ marginLeft: 8 }}>Loading transactions...</Txt>
          </View>
        ) : guestPayments.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No payment history yet"
            subtitle="Pay your rent via UPI / QR / cash and your verified receipts will appear here."
            accent={Colors.primary}
            loading={paymentsLoading}
            error={paymentsError}
            onRetry={onRefresh}
          />
        ) : (
          <View style={styles.txnListCard}>
            {guestPayments.slice(0, 6).map((p, idx) => (
              <ListRow
                key={p.id}
                title={`Rent · ${p.monthYear}`}
                meta={`${p.paymentMode ? p.paymentMode.replace(/_/g, ' ').toLowerCase() : 'online payment'}${p.timestamp ? ` · ${String(p.timestamp).slice(0, 11)}` : ''}`}
                leading={<Ionicons name="cash-outline" size={17} color={Colors.primary} />}
                amount={formatINR(Math.round(p.amount))}
                status={{ label: p.status, tone: toneFor(p.status) }}
                onPress={() => setSelectedReceipt(p)}
                first={idx === 0}
                last={idx === Math.min(guestPayments.length, 6) - 1}
                testID={`txn_${p.id}`}
              />
            ))}
          </View>
        )}

        {/* ── 6. PAYMENT SUMMARY ──
            Used to be a tappable "Payment History" card whose only action was a toast
            repeating these same two numbers, labelled "On-time Payments" — the app has no
            due-date-vs-paid-date comparison anywhere, so that was always this verification
            rate wearing a punctuality label. A plain row, honestly labelled, nothing to tap. */}
        <MetricRow
          label="Payments verified"
          meta={`${verifiedCount} of ${guestPayments.length} submission${guestPayments.length === 1 ? '' : 's'} accepted`}
          value={`${verifiedPercentage}%`}
          last
          testID="payments_verified_summary"
        />

        {/* ── 7. SUPPORT CARD ── */}
        <AnimatedPress accessibilityRole="button"
          style={styles.supportCard}
          onPress={() => { router.push('/support'); }}
        >
          <View style={styles.supportIconWrap}>
            <Ionicons name="headset-outline" size={22} color={Colors.primaryDark} />
          </View>

          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt variant="cardTitle" color={Colors.textPrimary}>Need help with Payment?</Txt>
            <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
              Contact our support team anytime.
            </Txt>
          </Col>

          <AnimatedPress accessibilityRole="button"
            style={styles.contactBtn}
            onPress={() => { router.push('/support'); }}
          >
            <Txt variant="button" color={Colors.primary}>Contact Support</Txt>
          </AnimatedPress>
        </AnimatedPress>

        <Spacer size={32} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Amount due card
  dueCard: {
    marginTop: -16,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 18,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    zIndex: 20 },
  dueDateBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Palette.TintGreen, borderRadius: Radii.card,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start' },
  payNowBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radii.card,
    paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },

  // Breakdown box
  breakdownBox: {
    width: 145,
    backgroundColor: '#F7FAFA',
    borderRadius: Radii.card, borderWidth: 1, borderColor: '#DCE9EA',
    padding: 10 },
  bdRow: { marginBottom: 4 },
  bdDivider: { height: 1, backgroundColor: '#DCE9EA', marginVertical: 4 },

  // Paid state
  paidCheckBadge: {
    width: 60, height: 60, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen,
    alignItems: 'center', justifyContent: 'center' },
  vDivider: { width: 1, height: 28, backgroundColor: '#DCE9EA' },

  // Quick Pay Grid
  qpCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1, borderColor: '#D9EDED',
    paddingVertical: 14, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  qpCardActive: {
    borderColor: Colors.primary, borderWidth: 1.5, backgroundColor: '#EAF7F5' },
  qpIconWrap: {
    width: 38, height: 38, borderRadius: Radii.control,
    backgroundColor: Palette.TintGreen, borderWidth: 1, borderColor: '#BDD8D6',
    alignItems: 'center', justifyContent: 'center' },
  qpIconWrapActive: {
    backgroundColor: Colors.surface, borderColor: Colors.primary },

  // Form inputs
  vpaBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0F6F5', borderRadius: Radii.control, borderWidth: 1, borderColor: '#DCE9EA',
    padding: 10 },
  copyChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: '#BDD8D6',
    paddingHorizontal: 10, paddingVertical: 5 },
  qrBox: {
    width: 130, height: 130, borderRadius: Radii.card, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: '#BDD8D6', padding: 8,
    alignItems: 'center', justifyContent: 'center' },

  // Invoices
  invoiceCard: {
    width: 190,
    backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#D9EDED',
    padding: 14,
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  invPayBtn: {
    flex: 1, backgroundColor: Colors.primaryDark, borderRadius: Radii.control,
    height: 32, alignItems: 'center', justifyContent: 'center' },
  invReceiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.TintGreen, borderRadius: Radii.control, height: 32 },

  // Transactions list
  txnListCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9E9',
    overflow: 'hidden', shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },

  // History Card

  // Support Card
  supportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 16, marginTop: 14,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  supportIconWrap: { width: 44, height: 44, borderRadius: Radii.card, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  contactBtn: {
    borderRadius: Radii.card, borderWidth: 1, borderColor: '#BDD8D6',
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surface },

  // Modal Backdrop
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center' },
  stepNum: { width: 22, height: 22, borderRadius: Radii.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: Colors.surface, borderRadius: Radii.card },
  emptyInvoiceCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: '#DCE9EA' } });
