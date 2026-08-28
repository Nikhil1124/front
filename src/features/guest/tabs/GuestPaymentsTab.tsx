/**
 * GuestPaymentsTab — Resident payments screen.
 * Sub-tabs: Pay Rent + Payment History + Invoices.
 * Optimized information architecture and user flow matching Home and Meals visual style.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, RefreshControl, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Sharing from 'expo-sharing';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip, Spinner } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Palette, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import * as Clipboard from 'expo-clipboard';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { launchUpiPayment } from '@/features/payments/usePayments';
// ── Task 8: tenant invoices (PDF + pay) ──────────────────────────────────────
import {
  useTenantInvoices,
  usePayTenantInvoice,
  fetchTenantInvoicePdfUrl,
} from '@/features/billing/useTenantInvoices';
import { fetchWithTimeout } from '@/hooks/useApi';
import { BASE_URL } from '@/config';
import type { PaymentEntity, TenantInvoice } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

import { usePaymentsQuery, useRentDueQuery } from '@/features/payments/usePayments';
import { useActiveProperty } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';

export function GuestPaymentsTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const { activeEntity: ownerForGuest } = useActiveProperty();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPayments = [], isLoading: paymentsLoading, error: paymentsError } = usePaymentsQuery(activePgId ?? undefined);
  // GET /v1/payments/due — the server's own answer for "what does this resident owe this
  // cycle". `useGuestsQuery` used to stand in for it, but that endpoint is
  // `require_manage`-gated (pg-backend guest/service.py), so from a resident it always 403'd
  // and silently produced an empty roster.
  const { data: rentDue, isLoading: rentLoading, error: rentError } = useRentDueQuery(activePgId ?? undefined);
  const submitPayment = usePGowStore((s) => s.submitGuestPayment);
  const activeMembership = useAuthStore((s) => s.user?.memberships.find((m) => m.role === 'guest')?.membership_id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  // Invoices (server-side monthly invoices)
  const { data: invoices = [], isLoading: invoicesLoading } = useTenantInvoices(activePgId, activeMembership ?? undefined);
  const payInvoice = usePayTenantInvoice(activePgId);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState(0);
  const [payMode, setPayMode] = useState('ONLINE_PHONEPE');
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentEntity | null>(null);
  const [filter, setFilter] = useState('ALL');

  const [showResidentCard, setShowResidentCard] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const ownerUpi = ownerForGuest?.upiId?.trim() ?? '';
  const hasUpi = ownerUpi.length > 0;
  const contactPhone = ownerForGuest?.managerPhone?.trim() || ownerForGuest?.phonePeNumber?.trim() || '';
  const isBillPaid = guest?.isBillPaid ?? false;

  // The amount the resident owes comes from the server and nowhere else.
  //
  // This used to be `guest?.rentAmount ?? 6500` minus a ₹50 "on-time" and ₹100 "rewards
  // winner" discount computed here. Both were wrong in the same way: the number on screen —
  // and the number handed to the UPI intent and POSTed as the payment — was one this client
  // invented. A resident whose guest record had not loaded yet was quoted a ₹6,500 rent that
  // belonged to nobody, and the discounts existed only on this device, so the amount paid
  // never matched the amount owed. Any such incentive has to be priced by whatever issues the
  // invoice; until then the due figure is simply reported, not adjusted.
  const rentAmount = rentDue ? map.toAmount(rentDue.rent_amount) : null;
  const rentKnown = rentAmount !== null && rentAmount > 0;
  const currentMonthYear = periodToMonthYear(currentPeriod());

  const guestPayments = allPayments.filter((p) => p.payerId === guest?.id);
  const filteredPayments = filter === 'ALL' ? guestPayments : guestPayments.filter((p) => p.status === filter);
  const totalPaid = guestPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = guestPayments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);

  const handleUpiLaunch = async () => {
    if (!hasUpi || !rentKnown) return;
    hapticSelect();
    const result = await launchUpiPayment({
      upiId: ownerUpi,
      payeeName: 'PG Rent Payment',
      amount: rentAmount!,
      note: `Rent ${currentMonthYear}`,
    });
    Alert.alert('UPI Payment', result.message);
  };

  const handleSubmit = async (mode: string) => {
    if (isSubmitting) return;
    if (!rentKnown) {
      Alert.alert('Amount unavailable', 'We could not load what you owe this month. Pull down to refresh and try again.');
      return;
    }
    setIsSubmitting(true);
    try {
      const r = await submitPayment(mode, rentAmount!, 'GUEST_RENT', utrNumber, currentMonthYear);
      if (r.ok) {
        hapticSuccess();
        setUtrNumber('');
        toast('success', 'Payment submitted!', isBillPaid ? 'Your payment was recorded.' : 'Awaiting owner verification.');
      } else {
        hapticError();
        Alert.alert('Failed', r.error ?? 'Unknown');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInvoice = async (inv: TenantInvoice) => {
    setPayingInvoiceId(inv.id);
    try {
      await payInvoice.mutateAsync({ invoiceId: inv.id, method: 'upi_manual' });
      hapticSuccess();
      toast('success', 'Invoice paid', `${periodToMonthYear(`${inv.year}-${String(inv.month).padStart(2, '0')}-01`)} invoice marked as paid.`);
    } catch (err: any) {
      hapticError();
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
        hapticError();
        toast('error', 'PDF unavailable', 'The invoice PDF could not be generated.');
        return;
      }
      const res = await fetchWithTimeout(pdfUrl.startsWith('http') ? pdfUrl : `${BASE_URL}${pdfUrl}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      try {
        await Clipboard.setStringAsync(pdfUrl);
        hapticSuccess();
        toast('success', 'PDF link copied', 'The invoice PDF URL has been copied. Open it in a browser to download.');
      } catch {
        hapticSuccess();
        toast('success', 'PDF ready', 'The invoice PDF is available; check your downloads.');
      }
    } catch (err: any) {
      hapticError();
      toast('error', 'PDF failed', err?.message ?? 'Please try again later.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };
  void Sharing;

  const handlePrimaryPayPress = () => {
    if (isBillPaid) return;
    if (payMode === 'CASH_HANDOVER') {
      handleSubmit('CASH_HANDOVER');
    } else {
      if (!hasUpi) {
        Alert.alert('Payment Unavailable', "The owner hasn't set up a UPI payment ID yet. Please select Cash Handover instead.");
        return;
      }
      handleUpiLaunch();
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {selectedReceipt && <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />}

      {/* Resident Card Modal Dialog */}
      {showResidentCard && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowResidentCard(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowResidentCard(false)}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Card
              containerColor={Colors.primary}
              borderRadius={16}
              borderWidth={0}
              padding={[20, 20]}
              style={{ width: '90%', maxWidth: 350, height: 160 }}
            >
              <Col style={{ flex: 1, justifyContent: 'space-between' }}>
                <Row justify="space-between" align="center">
                  <Txt variant="caption" weight="800" color={Colors.textInverse} style={{ letterSpacing: 1 }}>PGOW RESIDENT CARD</Txt>
                  <Ionicons name="card" size={22} color={Colors.textInverse} />
                </Row>
                <Txt variant="body" weight="800" color={Colors.textInverse}>PGOW-RESIDENT-ID: #{guest?.id ?? 101}</Txt>
                <Spacer size={8} />
                <Row justify="space-between">
                  <Col>
                    <Txt size={8} color="rgba(255,255,255,0.75)">RESIDENT</Txt>
                    <Txt variant="caption" weight="700" color={Colors.textInverse}>{(guest?.name ?? 'PG RESIDENT').toUpperCase()}</Txt>
                  </Col>
                  <Col align="center">
                    <Txt size={8} color="rgba(255,255,255,0.75)">REWARDS</Txt>
                    <Txt variant="caption" weight="800" color="#FDE68A">{guest?.rewardPoints ?? 0} PTS</Txt>
                  </Col>
                  <Col align="flex-end">
                    <Txt size={8} color="rgba(255,255,255,0.75)">ROOM</Txt>
                    <Txt variant="caption" weight="700" color={Colors.textInverse}>{guest?.roomNo ?? '101'}</Txt>
                  </Col>
                </Row>
              </Col>
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* Compact Segmented Tabs bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setActiveSubTab(0)} style={[styles.subTab, { backgroundColor: activeSubTab === 0 ? Colors.primary : 'transparent' }]}>
          <Txt variant="caption" weight="700" color={activeSubTab === 0 ? Colors.textInverse : Colors.textMuted}>Pay Rent</Txt>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab(1)} style={[styles.subTab, { backgroundColor: activeSubTab === 1 ? Colors.primary : 'transparent' }]}>
          <Txt variant="caption" weight="700" color={activeSubTab === 1 ? Colors.textInverse : Colors.textMuted}>Payment History</Txt>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab(2)} style={[styles.subTab, { backgroundColor: activeSubTab === 2 ? Colors.primary : 'transparent' }]}>
          <Txt variant="caption" weight="700" color={activeSubTab === 2 ? Colors.textInverse : Colors.textMuted}>Invoices</Txt>
        </TouchableOpacity>
      </View>

      {/* Pay Rent Tab */}
      {activeSubTab === 0 && (
        <FormScroll contentContainerStyle={{ paddingTop: 12, gap: 14 }} showsVerticalScrollIndicator={false}>
          {/* Rent Summary Card */}
          <Card
            containerColor={Colors.surface}
            borderRadius={Layout.borderRadiusCard}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[16, 16]}
          >
            <Row justify="space-between" align="center">
              <Txt variant="caption" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                {currentMonthYear.toUpperCase()} RENT
              </Txt>
              <View style={[styles.statusPill, { backgroundColor: isBillPaid ? `${Colors.success}1A` : `${Colors.warning}1A`, borderWidth: 1, borderColor: isBillPaid ? Colors.success : Colors.warning }]}>
                <Txt variant="labelSmall" weight="800" color={isBillPaid ? Colors.success : Colors.tertiary}>
                  {isBillPaid ? 'SETTLED' : 'UNPAID'}
                </Txt>
              </View>
            </Row>

            <Spacer size={8} />
            <Txt size={32} weight="900" color={Colors.primary} style={{ alignSelf: 'flex-start' }}>
              {rentLoading ? <Spinner size="large" /> : rentKnown ? `₹${Math.round(rentAmount!).toLocaleString('en-IN')}` : '—'}
            </Txt>
            <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 2 }}>
              {rentKnown ? 'Due now' : rentLoading ? 'Checking what you owe…' : 'Amount unavailable — pull down to refresh'}
            </Txt>

            <Spacer size={16} />
            <View style={styles.breakdownBox}>
              <Row justify="space-between">
                <Txt variant="caption" color={Colors.textSecondary}>Monthly Rent</Txt>
                <Txt variant="caption" weight="700" color={Colors.textPrimary}>{rentKnown ? `₹${Math.round(rentAmount!).toLocaleString('en-IN')}` : '—'}</Txt>
              </Row>
              <View style={styles.divider} />
              <Row justify="space-between">
                <Txt variant="caption" weight="700" color={Colors.textPrimary}>Payable for {currentMonthYear}</Txt>
                <Txt variant="body" weight="900" color={Colors.primary}>{rentKnown ? `₹${Math.round(rentAmount!).toLocaleString('en-IN')}` : '—'}</Txt>
              </Row>
            </View>
          </Card>

          {/* Primary CTA button */}
          <Btn
            onPress={handlePrimaryPayPress}
            disabled={isBillPaid || !rentKnown || isSubmitting}
            loading={isSubmitting}
            containerColor={isBillPaid ? Colors.success : Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Layout.borderRadiusButton}
            height={48}
            testID="primary_pay_rent_btn"
          >
            <Ionicons name={isBillPaid ? "checkmark-circle" : "wallet-outline"} size={18} color={Colors.textInverse} />
            <Txt variant="body" weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>
              {isBillPaid ? 'Rent Settled & Verified' : rentKnown ? `Pay ₹${Math.round(rentAmount!).toLocaleString('en-IN')} →` : 'Amount unavailable'}
            </Txt>
          </Btn>

          {/* Payment Methods */}
          {!isBillPaid && (
            <>
              <Txt variant="body" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 4 }}>
                SELECT PAYMENT METHOD
              </Txt>

              <View style={{ gap: 10 }}>
                {/* Method 1: UPI / UTR */}
                <TouchableOpacity
                  onPress={() => hasUpi && setPayMode('ONLINE_PHONEPE')}
                  activeOpacity={0.8}
                  style={[
                    styles.methodCard,
                    payMode === 'ONLINE_PHONEPE' && styles.methodCardSelected,
                    !hasUpi && styles.methodCardDisabled
                  ]}
                >
                  <Row gap={12} align="center">
                    <Ionicons name="apps" size={22} color={payMode === 'ONLINE_PHONEPE' && hasUpi ? Colors.primary : Colors.textMuted} />
                    <Col style={{ flex: 1 }}>
                      <Txt size={13} weight="800" color={!hasUpi ? Colors.textMuted : Colors.textPrimary}>
                        UPI / UTR {!hasUpi && '(Unavailable)'}
                      </Txt>
                      <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2, lineHeight: 14 }}>
                        {!hasUpi 
                          ? "Owner hasn't set up a UPI ID. Please use another available method."
                          : "Pay directly via UPI apps (PhonePe, GPay, Paytm) and submit UTR."}
                      </Txt>
                    </Col>
                    {hasUpi && (
                      <Ionicons
                        name={payMode === 'ONLINE_PHONEPE' ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={payMode === 'ONLINE_PHONEPE' ? Colors.primary : Colors.borderMuted}
                      />
                    )}
                  </Row>
                </TouchableOpacity>

                {/* Method 2: QR Code */}
                <TouchableOpacity
                  onPress={() => setPayMode('SCAN_QR')}
                  activeOpacity={0.8}
                  style={[
                    styles.methodCard,
                    payMode === 'SCAN_QR' && styles.methodCardSelected
                  ]}
                >
                  <Row gap={12} align="center">
                    <Ionicons name="qr-code" size={22} color={payMode === 'SCAN_QR' ? Colors.primary : Colors.textMuted} />
                    <Col style={{ flex: 1 }}>
                      <Row gap={6} align="center">
                        <Txt size={13} weight="800" color={Colors.textPrimary}>QR Code</Txt>
                        <View style={styles.recommendedBadge}>
                          <Txt size={8} weight="900" color={Colors.textInverse}>RECOMMENDED</Txt>
                        </View>
                      </Row>
                      <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2, lineHeight: 14 }}>
                        Scan & pay using any UPI app. Instant & secure.
                      </Txt>
                    </Col>
                    <Ionicons
                      name={payMode === 'SCAN_QR' ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={payMode === 'SCAN_QR' ? Colors.primary : Colors.borderMuted}
                    />
                  </Row>
                </TouchableOpacity>

                {/* Method 3: Pay Cash */}
                <TouchableOpacity
                  onPress={() => setPayMode('CASH_HANDOVER')}
                  activeOpacity={0.8}
                  style={[
                    styles.methodCard,
                    payMode === 'CASH_HANDOVER' && styles.methodCardSelected
                  ]}
                >
                  <Row gap={12} align="center">
                    <Ionicons name="cash" size={22} color={payMode === 'CASH_HANDOVER' ? Colors.primary : Colors.textMuted} />
                    <Col style={{ flex: 1 }}>
                      <Txt size={13} weight="800" color={Colors.textPrimary}>Pay Cash</Txt>
                      <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2, lineHeight: 14 }}>
                        Pay directly to your property manager. Mark as cash payment.
                      </Txt>
                    </Col>
                    <Ionicons
                      name={payMode === 'CASH_HANDOVER' ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={payMode === 'CASH_HANDOVER' ? Colors.primary : Colors.borderMuted}
                    />
                  </Row>
                </TouchableOpacity>
              </View>

              {/* Selected Payment Specific Flow */}
              {payMode === 'ONLINE_PHONEPE' && hasUpi && (
                <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                  <Txt size={12} weight="800" color={Colors.primary}>📱 UPI Intent Details</Txt>
                  <Spacer size={8} />
                  <Row justify="space-between" align="center" style={styles.vpaBox}>
                    <Col style={{ flex: 1 }}>
                      {contactPhone ? (
                        <Txt size={11} weight="700" color={Colors.textPrimary}>Owner Phone: +91 {contactPhone}</Txt>
                      ) : null}
                      <Txt size={11} weight="700" color={Colors.primary}>VPA ID: {ownerUpi}</Txt>
                    </Col>
                    <IconBtn
                      onPress={() => { Clipboard.setStringAsync(ownerUpi); Alert.alert('Copied', 'UPI VPA copied to clipboard.'); }}
                      icon="copy"
                      size={18}
                      tint={Colors.primary}
                    />
                  </Row>
                  <Spacer size={12} />
                  <OutlinedTextField
                    label="Enter 12-Digit UTR Transaction Ref"
                    placeholder="421980341209"
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                    testID="phone_upi_utr_input"
                    focusedBorderColor={Colors.primary}
                    borderRadius={10}
                    style={{ marginBottom: 12 }}
                  />
                  <Btn
                    onPress={() => handleSubmit('ONLINE_PHONEPE')}
                    disabled={!utrNumber.trim() || isSubmitting}
                    loading={isSubmitting}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={40}
                    testID="submit_phone_utr_btn"
                  >
                    <Txt variant="caption" weight="700" color={Colors.textInverse}>Submit UTR Reference</Txt>
                  </Btn>
                </Card>
              )}

              {payMode === 'SCAN_QR' && hasUpi && (
                <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                  <Txt size={12} weight="800" color={Colors.primary}>📷 Scan UPI QR Code</Txt>
                  <Spacer size={8} />
                  <View style={styles.qrBox}>
                    <Ionicons name="qr-code-sharp" size={64} color={Colors.textPrimary} />
                    <Txt size={10} color={Colors.textMuted} align="center" style={{ marginTop: 6 }}>{ownerUpi}</Txt>
                  </View>
                  <Spacer size={12} />
                  <OutlinedTextField
                    label="Enter 12-Digit UTR Transaction Ref"
                    placeholder="421980341209"
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                    testID="qr_utr_input"
                    focusedBorderColor={Colors.primary}
                    borderRadius={10}
                    style={{ marginBottom: 12 }}
                  />
                  <Btn
                    onPress={() => handleSubmit('SCAN_QR')}
                    disabled={!utrNumber.trim() || isSubmitting}
                    loading={isSubmitting}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={40}
                    testID="submit_qr_utr_btn"
                  >
                    <Txt variant="caption" weight="700" color={Colors.textInverse}>Submit UTR Reference</Txt>
                  </Btn>
                </Card>
              )}

              {payMode === 'CASH_HANDOVER' && (
                <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                  <Txt size={12} weight="800" color={Colors.primary}>💵 Cash Handover Flow</Txt>
                  <Spacer size={8} />
                  <Txt size={11} color={Colors.textSecondary} style={{ lineHeight: 16 }}>
                    Handover physical cash of <Txt weight="800" color={Colors.textPrimary}>{rentKnown ? `₹${Math.round(rentAmount!).toLocaleString('en-IN')}` : '—'}</Txt> directly to your PG Manager {contactPhone ? `(${contactPhone})` : ''}. Once submitted, the manager will verify and settle it on the dashboard.
                  </Txt>
                  <Spacer size={12} />
                  <Btn
                    onPress={() => handleSubmit('CASH_HANDOVER')}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={10}
                    height={40}
                    testID="cash_handover_btn"
                  >
                    <Txt variant="caption" weight="700" color={Colors.textInverse}>Confirm Cash Handover ({rentKnown ? `₹${Math.round(rentAmount!).toLocaleString('en-IN')}` : '—'})</Txt>
                  </Btn>
                </Card>
              )}

              {/* Payment verification message */}
              <Card containerColor={Colors.surfaceElevated} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[10, 12]}>
                <Row gap={8} align="center">
                  <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
                  <Txt size={11} color={Colors.textSecondary} style={{ flex: 1, lineHeight: 15 }}>
                    After payment, your transaction will be verified by the property owner.
                  </Txt>
                </Row>
              </Card>
            </>
          )}

          {/* Resident summary row */}
          <Spacer size={4} />
          <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
            <Row justify="space-between" align="center">
              <Col style={{ flex: 1 }}>
                <Txt size={10} color={Colors.textMuted} weight="600">RESIDENT</Txt>
                <Txt size={12} weight="800" color={Colors.textPrimary} style={{ marginTop: 2 }}>
                  {guest?.name ?? 'Resident'} · Room {guest?.roomNo ?? 'N/A'}
                </Txt>
              </Col>
              <AnimatedPress scale={0.95} onPress={() => setShowResidentCard(true)}>
                <Txt size={11} weight="800" color={Colors.primary}>{"View Resident Card >"}</Txt>
              </AnimatedPress>
            </Row>
          </Card>

          {/* Notification setting */}
          <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
            <Row justify="space-between" align="center">
              <Col style={{ flex: 1 }}>
                <Txt size={12} weight="800" color={Colors.textPrimary}>Rent payment notifications</Txt>
                <Txt size={9} color={Colors.textMuted} style={{ marginTop: 2, lineHeight: 13 }}>
                  Get notified when rent is due and payments are verified.
                </Txt>
              </Col>
              <TouchableOpacity onPress={() => { hapticSelect(); setNotificationsEnabled(prev => !prev); toast('info', 'Notifications Updated', `Notifications are now ${!notificationsEnabled ? 'enabled' : 'disabled'}.`); }} style={[styles.toggleBtn, { backgroundColor: notificationsEnabled ? `${Colors.success}1A` : `${Colors.borderMuted}` }]}>
                <Txt size={10} weight="900" color={notificationsEnabled ? Colors.success : Colors.textMuted}>
                  {notificationsEnabled ? 'ON >' : 'OFF >'}
                </Txt>
              </TouchableOpacity>
            </Row>
          </Card>
        </FormScroll>
      )}

      {/* Payment History Tab */}
      {activeSubTab === 1 && (
        <FormScroll
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        >
          <Row gap={8} style={{ marginBottom: 12 }}>
            <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]} style={{ flex: 1 }}>
              <Txt size={9} color={Colors.textMuted} weight="700">TOTAL PAID</Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.primary}>₹{Math.round(totalPaid)}</Txt>
            </Card>
            <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]} style={{ flex: 1 }}>
              <Txt size={9} color={Colors.textMuted} weight="700">PENDING</Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.tertiary}>₹{Math.round(pendingAmount)}</Txt>
            </Card>
          </Row>
          <Row gap={6} style={{ marginBottom: 12 }}>
            {['ALL', 'VERIFIED', 'PENDING', 'REJECTED'].map((f) => (
              <Chip key={f} label={f} selected={filter === f} onPress={() => { hapticSelect(); setFilter(f); }} selectedColor={Colors.primary} size={11} />
            ))}
          </Row>
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={`No ${filter === 'ALL' ? '' : filter + ' '}transactions yet`}
              subtitle="Pay your rent via UPI / QR / cash and your receipts will appear here. Pull down to refresh."
              accent={Colors.primary}
              loading={paymentsLoading}
              error={paymentsError}
              onRetry={onRefresh}
            />
          ) : (
            filteredPayments.map((p) => {
              const isVerified = p.status === 'VERIFIED';
              const isPending = p.status === 'PENDING';
              const statusColor = isVerified ? Colors.success : isPending ? Colors.warning : Colors.danger;
              return (
                <AnimatedPress
                  key={p.id}
                  scale={0.985}
                  hapticPattern="light"
                  onPress={() => { hapticSelect(); setSelectedReceipt(p); }}
                >
                  <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
                    <Row justify="space-between" align="center">
                      <Col style={{ flex: 1 }}>
                        <Txt variant="body" weight="700" color={Colors.textPrimary}>{p.monthYear} • {p.paymentType.replace(/_/g, ' ')}</Txt>
                        <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }}>Ref: {p.transactionRef} • {p.paymentMode.replace(/_/g, ' ')}</Txt>
                      </Col>
                      <View style={[styles.statusPillHistory, { backgroundColor: `${statusColor}1A`, borderWidth: 1, borderColor: statusColor }]}>
                        <Txt variant="labelSmall" weight="800" color={statusColor}>{isVerified ? 'VERIFIED' : isPending ? 'PENDING' : 'REJECTED'}</Txt>
                      </View>
                    </Row>
                    <Spacer size={8} />
                    <Row justify="space-between" align="center">
                      <Txt variant="sectionTitle" weight="900" color={statusColor}>₹{Math.round(p.amount)}</Txt>
                      <Row gap={4} align="center">
                        <Txt variant="labelSmall" color={Colors.primary}>Tap to view receipt</Txt>
                        <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                      </Row>
                    </Row>
                  </Card>
                </AnimatedPress>
              );
            })
          )}
        </FormScroll>
      )}

      {/* Invoices Tab */}
      {activeSubTab === 2 && (
        <FormScroll
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        >
          <Row gap={6} align="center">
            <Txt size={13} weight="800" color={Colors.textPrimary}>Your Monthly Invoices</Txt>
            <InfoTip text="Server-generated monthly rent invoices. Pay online or download a PDF copy." />
          </Row>
          <Spacer size={6} />
          {invoicesLoading || invoices.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No invoices yet"
              subtitle="Your monthly rent invoice will appear here when the owner generates one."
              accent={Colors.primary}
              loading={invoicesLoading}
            />
          ) : (
            invoices.map((inv: TenantInvoice) => {
              const monthYear = periodToMonthYear(`${inv.year}-${String(inv.month).padStart(2, '0')}-01`);
              const isPaid = inv.status === 'paid';
              const isOverdue = inv.status === 'overdue';
              const tint = isPaid ? Colors.success : isOverdue ? Colors.danger : Colors.warning;
              return (
                <Card key={inv.id} containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]}>
                  <Row justify="space-between" align="center">
                    <Col style={{ flex: 1 }}>
                      <Txt variant="body" weight="700" color={Colors.textPrimary}>{monthYear} Invoice</Txt>
                      <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }}>Due {inv.dueDate}</Txt>
                    </Col>
                    <View style={[styles.statusPillHistory, { backgroundColor: `${tint}1A`, borderWidth: 1, borderColor: tint }]}>
                      <Txt variant="labelSmall" weight="800" color={tint}>{inv.status.toUpperCase()}</Txt>
                    </View>
                  </Row>
                  <Spacer size={8} />
                  <Row justify="space-between" align="center">
                    <Txt variant="sectionTitle" weight="900" color={tint}>₹{Math.round(inv.totalAmount).toLocaleString('en-IN')}</Txt>
                    <Row gap={6} align="center">
                      {!isPaid && (
                        <Btn
                          onPress={() => handlePayInvoice(inv)}
                          loading={payingInvoiceId === inv.id}
                          containerColor={Colors.primary}
                          textColor={Colors.textInverse}
                          borderRadius={8}
                          height={32}
                          contentStyle={{ paddingHorizontal: 10 }}
                          testID={`invoice_pay_${inv.id}`}
                        >
                          <Txt size={11} weight="800" color={Colors.textInverse}>Pay Now</Txt>
                        </Btn>
                      )}
                      <Btn
                        onPress={() => handleDownloadPdf(inv)}
                        loading={downloadingInvoiceId === inv.id}
                        containerColor={Colors.surfaceMuted}
                        textColor={Colors.primary}
                        borderRadius={8}
                        height={32}
                        contentStyle={{ paddingHorizontal: 10 }}
                        testID={`invoice_pdf_${inv.id}`}
                      >
                        <Ionicons name="download" size={12} color={Colors.primary} />
                        <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>PDF</Txt>
                      </Btn>
                    </Row>
                  </Row>
                </Card>
              );
            })
          )}
        </FormScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surfaceMuted, borderRadius: 10, padding: 4, gap: 4 },
  subTab: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  breakdownBox: { backgroundColor: Colors.canvas, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12 },
  divider: { height: 1, backgroundColor: Colors.borderMuted, marginVertical: 8 },
  vpaBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 8 },
  qrBox: { width: 140, height: 140, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderSubtle, padding: 8, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center' },
  methodCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderMuted, backgroundColor: Colors.surface },
  methodCardSelected: { borderColor: Colors.primary, borderWidth: 1.5, backgroundColor: Colors.surfaceElevated },
  methodCardDisabled: { borderColor: Colors.borderMuted, opacity: 0.55 },
  recommendedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.primary },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusPillHistory: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
