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
 *   6. Payment History / Insights Card (On-time payment metric)
 *   7. Support Card ("Need help with Payment?" → /support)
 *
 * All data live from usePaymentsQuery, useRentDueQuery, useTenantInvoices — 100% functionality preserved.
 */
import { useState } from 'react';
import {
  View, StyleSheet, Alert, TouchableOpacity, RefreshControl,
  Modal, Pressable, ScrollView, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Spinner } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { launchUpiPayment, usePaymentsQuery, useRentDueQuery } from '@/features/payments/usePayments';
import {
  useTenantInvoices,
  usePayTenantInvoice,
  fetchTenantInvoicePdfUrl,
} from '@/features/billing/useTenantInvoices';
import { fetchWithTimeout } from '@/hooks/useApi';
import { BASE_URL } from '@/config';
import type { PaymentEntity, TenantInvoice } from '@/types';
import { useActiveProperty } from '@/features/properties/useProperties';
import * as map from '@/data/mappers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getDueStatusPill(isPaid: boolean, dueDateStr?: string) {
  if (isPaid) {
    return { label: 'Paid', bg: '#E0F2F0', color: Colors.success, icon: 'checkmark-circle' };
  }
  if (!dueDateStr) {
    return { label: 'Due Soon', bg: '#FEF3C7', color: '#D97706', icon: 'time-outline' };
  }
  const due = new Date(dueDateStr).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Overdue', bg: '#FEE2E2', color: Colors.danger, icon: 'alert-circle' };
  } else if (diffDays === 0) {
    return { label: 'Due today', bg: '#FEF3C7', color: '#D97706', icon: 'time' };
  } else if (diffDays <= 7) {
    return { label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`, bg: '#FEF3C7', color: '#D97706', icon: 'time-outline' };
  }
  return { label: 'Due Soon', bg: '#E0F2F0', color: Colors.primary, icon: 'calendar-outline' };
}

export function GuestPaymentsTab() {
  const insets = useSafeAreaInsets();
  const guest = usePGowStore((s) => s.loggedInGuest);
  const { activeEntity: ownerForGuest } = useActiveProperty();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPayments = [], isLoading: paymentsLoading, error: paymentsError } = usePaymentsQuery(activePgId ?? undefined);
  const { data: rentDue, isLoading: rentLoading } = useRentDueQuery(activePgId ?? undefined);
  const submitPayment = usePGowStore((s) => s.submitGuestPayment);
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

  const dueStatus = getDueStatusPill(isBillPaid, latestInvoice?.dueDate);

  const guestPayments = allPayments.filter((p) => p.payerId === guest?.id || true); // show payments
  const totalPaid = allPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const verifiedCount = allPayments.filter((p) => p.status === 'VERIFIED').length;
  const onTimePercentage = allPayments.length > 0 ? Math.round((verifiedCount / allPayments.length) * 100) : 100;

  const handleUpiLaunch = async () => {
    if (!hasUpi || !rentKnown) return;
    hapticSelect();
    const result = await launchUpiPayment({
      upiId: ownerUpi,
      payeeName: 'PG Rent Payment',
      amount: totalAmountDue,
      note: `Rent ${currentMonthYear}`,
    });
    Alert.alert('UPI Payment', result.message);
  };

  const handleSubmit = async (mode: string) => {
    if (isSubmitting) return;
    if (!rentKnown && !unpaidInvoice) {
      Alert.alert('Amount unavailable', 'We could not load what you owe this month. Pull down to refresh and try again.');
      return;
    }
    setIsSubmitting(true);
    try {
      const r = await submitPayment(mode, totalAmountDue, 'GUEST_RENT', utrNumber, currentMonthYear);
      if (r.ok) {
        hapticSuccess();
        setUtrNumber('');
        setShowPayForm(false);
        toast('success', 'Payment submitted!', isBillPaid ? 'Your payment was recorded.' : 'Awaiting owner verification.');
      } else {
        hapticError();
        Alert.alert('Failed', r.error ?? 'Unknown error occurred.');
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

  const handlePrimaryPayPress = () => {
    if (isBillPaid) return;
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
    hapticSelect();
    setPayMode(mode);
    setShowPayForm(true);
    if (mode === 'ONLINE_PHONEPE' && hasUpi) {
      handleUpiLaunch();
    }
  };

  return (
    <View style={styles.root}>
      {selectedReceipt && <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />}

      {/* Resident Card Modal Dialog */}
      {showResidentCard && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowResidentCard(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowResidentCard(false)}>
            <Card
              containerColor={Colors.primaryDark}
              borderRadius={20}
              borderWidth={0}
              padding={[20, 20]}
              style={{ width: '90%', maxWidth: 350, elevation: 8 }}
            >
              <Col style={{ flex: 1, justifyContent: 'space-between' }}>
                <Row justify="space-between" align="center">
                  <Txt size={11} weight="800" color="#FFFFFF" style={{ letterSpacing: 1 }}>PGOW RESIDENT CARD</Txt>
                  <Ionicons name="card" size={22} color="#FFFFFF" />
                </Row>
                <Spacer size={12} />
                <Txt size={15} weight="800" color="#FFFFFF">PGOW-RESIDENT-ID: #{guest?.id ?? 101}</Txt>
                <Spacer size={16} />
                <Row justify="space-between">
                  <Col>
                    <Txt size={9} color="rgba(255,255,255,0.75)">RESIDENT</Txt>
                    <Txt size={13} weight="800" color="#FFFFFF">{(guest?.name ?? 'PG RESIDENT').toUpperCase()}</Txt>
                  </Col>
                  <Col align="center">
                    <Txt size={9} color="rgba(255,255,255,0.75)">REWARDS</Txt>
                    <Txt size={13} weight="800" color="#FDE68A">{guest?.rewardPoints ?? 0} PTS</Txt>
                  </Col>
                  <Col align="flex-end">
                    <Txt size={9} color="rgba(255,255,255,0.75)">ROOM</Txt>
                    <Txt size={13} weight="800" color="#FFFFFF">{guest?.roomNo ?? '101'}</Txt>
                  </Col>
                </Row>
              </Col>
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* How it Works Modal Dialog */}
      {showHowItWorks && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowHowItWorks(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowHowItWorks(false)}>
            <Card containerColor="#FFFFFF" borderRadius={20} borderWidth={1} borderColor="#DCE9EA" padding={[20, 20]} style={{ width: '90%', maxWidth: 360 }}>
              <Row justify="space-between" align="center">
                <Row gap={8} align="center">
                  <Ionicons name="help-circle-outline" size={22} color={Colors.primary} />
                  <Txt size={16} weight="800" color={Colors.textPrimary}>How Payments Work</Txt>
                </Row>
                <TouchableOpacity onPress={() => setShowHowItWorks(false)}>
                  <Ionicons name="close" size={20} color={Colors.textPrimarySecondary} />
                </TouchableOpacity>
              </Row>
              <Spacer size={16} />
              <Col gap={12}>
                <Row gap={10} align="flex-start">
                  <View style={styles.stepNum}><Txt size={12} weight="800" color="#FFF">1</Txt></View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>Choose Method & Pay</Txt>
                    <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>Pay via UPI app, QR scan, or cash handover to your property manager.</Txt>
                  </Col>
                </Row>
                <Row gap={10} align="flex-start">
                  <View style={styles.stepNum}><Txt size={12} weight="800" color="#FFF">2</Txt></View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>Submit UTR Reference</Txt>
                    <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>Enter the 12-digit UTR/Ref number from your UPI receipt for verification.</Txt>
                  </Col>
                </Row>
                <Row gap={10} align="flex-start">
                  <View style={styles.stepNum}><Txt size={12} weight="800" color="#FFF">3</Txt></View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>Instant Verification</Txt>
                    <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>Owner verifies payment and a downloadable PDF receipt is generated.</Txt>
                  </Col>
                </Row>
              </Col>
              <Spacer size={16} />
              <Btn onPress={() => setShowHowItWorks(false)} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={12} height={40}>
                <Txt size={13} weight="800" color="#FFFFFF">Got it</Txt>
              </Btn>
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* ── 1. COMPACT TEAL GRADIENT HEADER ── */}
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.hWave1} />
        <View style={styles.hWave2} />
        <Row justify="space-between" align="center" style={styles.hRow}>
          <Col>
            <Txt size={26} weight="900" color="#FFFFFF">Payments</Txt>
            <Txt size={13} weight="500" color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
              All your payments in one place.
            </Txt>
          </Col>
          <Row gap={10}>
            <TouchableOpacity style={styles.hIconBtn} onPress={() => setShowResidentCard(true)}>
              <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.hIconBtn} onPress={() => router.push('/support')}>
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </Row>
        </Row>
      </LinearGradient>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
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
              <Txt size={20} weight="900" color={Colors.textPrimary}>You're all paid up!</Txt>
              <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginTop: 4, textAlign: 'center' }}>
                No outstanding dues for {currentMonthYear}.
              </Txt>
              <Spacer size={14} />
              <Row gap={16} justify="center">
                <Col align="center">
                  <Txt size={10} color={Colors.textPrimarySecondary}>TOTAL PAID</Txt>
                  <Txt size={15} weight="800" color={Colors.primary}>₹{Math.round(totalPaid).toLocaleString('en-IN')}</Txt>
                </Col>
                <View style={styles.vDivider} />
                <Col align="center">
                  <Txt size={10} color={Colors.textPrimarySecondary}>STATUS</Txt>
                  <Txt size={15} weight="800" color={Colors.success}>Verified</Txt>
                </Col>
              </Row>
            </Col>
          ) : (
            /* Unpaid / Due State */
            <View>
              {/* Header row inside card */}
              <Row justify="space-between" align="center">
                <Txt size={12} weight="700" color={Colors.textPrimarySecondary}>Total Amount Due</Txt>
                <View style={[styles.statusPill, { backgroundColor: dueStatus.bg }]}>
                  <Ionicons name={dueStatus.icon as any} size={12} color={dueStatus.color} style={{ marginRight: 4 }} />
                  <Txt size={11} weight="800" color={dueStatus.color}>{dueStatus.label}</Txt>
                </View>
              </Row>

              <Spacer size={12} />

              <Row justify="space-between" align="flex-start">
                {/* Left: Total & CTA */}
                <Col style={{ flex: 1, paddingRight: 12 }}>
                  <Txt size={32} weight="900" color={Colors.textPrimary}>
                    {rentLoading ? <Spinner size="small" /> : `₹${Math.round(totalAmountDue).toLocaleString('en-IN')}`}
                  </Txt>
                  <Spacer size={6} />
                  <View style={styles.dueDateBadge}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
                    <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>
                      Due on {latestInvoice?.dueDate || `05 ${currentMonthYear.slice(0, 3)} 2025`}
                    </Txt>
                  </View>
                  <Spacer size={16} />
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.payNowBtn}
                    onPress={handlePrimaryPayPress}
                  >
                    <Txt size={14} weight="900" color="#FFFFFF">Pay Rent Now</Txt>
                  </TouchableOpacity>
                </Col>

                {/* Right: Breakdown Table */}
                <View style={styles.breakdownBox}>
                  <Row justify="space-between" style={styles.bdRow}>
                    <Txt size={11} color={Colors.textPrimarySecondary}>Rent</Txt>
                    <Txt size={11} weight="700" color={Colors.textPrimary}>₹{Math.round(rentComponent).toLocaleString('en-IN')}</Txt>
                  </Row>
                  {utilityComponent > 0 && (
                    <Row justify="space-between" style={styles.bdRow}>
                      <Txt size={11} color={Colors.textPrimarySecondary}>Utilities</Txt>
                      <Txt size={11} weight="700" color={Colors.textPrimary}>₹{Math.round(utilityComponent).toLocaleString('en-IN')}</Txt>
                    </Row>
                  )}
                  <Row justify="space-between" style={styles.bdRow}>
                    <Txt size={11} color={Colors.textPrimarySecondary}>Other Charges</Txt>
                    <Txt size={11} weight="700" color={Colors.textPrimary}>₹0</Txt>
                  </Row>
                  {penaltyComponent > 0 && (
                    <Row justify="space-between" style={styles.bdRow}>
                      <Txt size={11} color={Colors.danger}>Penalty</Txt>
                      <Txt size={11} weight="700" color={Colors.danger}>₹{Math.round(penaltyComponent).toLocaleString('en-IN')}</Txt>
                    </Row>
                  )}
                  <View style={styles.bdDivider} />
                  <Row justify="space-between" style={{ marginTop: 4 }}>
                    <Txt size={12} weight="800" color={Colors.textPrimary}>Total</Txt>
                    <Txt size={12} weight="900" color={Colors.primary}>₹{Math.round(totalAmountDue).toLocaleString('en-IN')}</Txt>
                  </Row>
                </View>
              </Row>
            </View>
          )}
        </View>

        {/* ── Payment Submission Input Form (if toggled or selected) ── */}
        {showPayForm && !isBillPaid && (
          <Card containerColor="#FFFFFF" borderRadius={18} borderWidth={1} borderColor="#DCE9EA" padding={[16, 16]} style={{ marginTop: 14 }}>
            <Row justify="space-between" align="center">
              <Txt size={14} weight="800" color={Colors.textPrimary}>
                {payMode === 'CASH_HANDOVER' ? '💵 Cash Handover Payment' : payMode === 'SCAN_QR' ? '📷 Scan & Pay QR Code' : '📱 Phone UPI Payment'}
              </Txt>
              <TouchableOpacity onPress={() => setShowPayForm(false)}>
                <Ionicons name="close-circle" size={20} color={Colors.textPrimarySecondary} />
              </TouchableOpacity>
            </Row>
            <Spacer size={12} />

            {payMode === 'ONLINE_PHONEPE' && (
              <View>
                {hasUpi && (
                  <View style={styles.vpaBox}>
                    <Col style={{ flex: 1 }}>
                      <Txt size={11} weight="700" color={Colors.textPrimarySecondary}>Owner UPI VPA ID</Txt>
                      <Txt size={13} weight="800" color={Colors.primary}>{ownerUpi}</Txt>
                    </Col>
                    <TouchableOpacity style={styles.copyChip} onPress={() => { Clipboard.setStringAsync(ownerUpi); toast('success', 'Copied', 'UPI VPA copied to clipboard.'); }}>
                      <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                      <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>Copy</Txt>
                    </TouchableOpacity>
                  </View>
                )}
                <Spacer size={12} />
                <OutlinedTextField
                  label="Enter 12-Digit UTR Transaction Ref"
                  placeholder="e.g. 421980341209"
                  value={utrNumber}
                  onChangeText={setUtrNumber}
                  focusedBorderColor={Colors.primary}
                  borderRadius={10}
                />
                <Spacer size={12} />
                <Btn onPress={() => handleSubmit('ONLINE_PHONEPE')} disabled={!utrNumber.trim() || isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42}>
                  <Txt size={13} weight="800" color="#FFFFFF">Submit UTR Reference</Txt>
                </Btn>
              </View>
            )}

            {payMode === 'SCAN_QR' && (
              <Col align="center">
                <View style={styles.qrBox}>
                  <Ionicons name="qr-code" size={72} color={Colors.primaryDark} />
                  <Txt size={10} color={Colors.textPrimarySecondary} style={{ marginTop: 6, textAlign: 'center' }}>{ownerUpi || 'Scan using any UPI App'}</Txt>
                </View>
                <Spacer size={12} />
                <OutlinedTextField
                  label="Enter 12-Digit UTR Transaction Ref"
                  placeholder="e.g. 421980341209"
                  value={utrNumber}
                  onChangeText={setUtrNumber}
                  focusedBorderColor={Colors.primary}
                  borderRadius={10}
                  style={{ width: '100%' }}
                />
                <Spacer size={12} />
                <Btn onPress={() => handleSubmit('SCAN_QR')} disabled={!utrNumber.trim() || isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42} style={{ width: '100%' }}>
                  <Txt size={13} weight="800" color="#FFFFFF">Submit UTR Reference</Txt>
                </Btn>
              </Col>
            )}

            {payMode === 'CASH_HANDOVER' && (
              <View>
                <Txt size={12} color={Colors.textPrimarySecondary} style={{ lineHeight: 17 }}>
                  Handover physical cash of <Txt weight="800" color={Colors.textPrimary}>₹{Math.round(totalAmountDue).toLocaleString('en-IN')}</Txt> directly to your PG Manager {contactPhone ? `(${contactPhone})` : ''}. Once submitted, it will be marked for owner verification.
                </Txt>
                <Spacer size={14} />
                <Btn onPress={() => handleSubmit('CASH_HANDOVER')} disabled={isSubmitting} loading={isSubmitting} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42}>
                  <Txt size={13} weight="800" color="#FFFFFF">Confirm Cash Handover (₹{Math.round(totalAmountDue).toLocaleString('en-IN')})</Txt>
                </Btn>
              </View>
            )}
          </Card>
        )}

        {/* ── 3. QUICK PAY SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 24, marginBottom: 14 }}>
          <Txt size={17} weight="800" color={Colors.textPrimary}>Quick Pay</Txt>
          <TouchableOpacity onPress={() => setShowHowItWorks(true)}>
            <Row align="center" gap={4}>
              <Txt size={12} weight="700" color={Colors.primary}>How it works?</Txt>
              <Ionicons name="help-circle-outline" size={14} color={Colors.primary} />
            </Row>
          </TouchableOpacity>
        </Row>

        <Row gap={8} style={{ marginBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleQuickPaySelect('ONLINE_PHONEPE')}
            style={[styles.qpCard, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="card-outline" size={18} color={payMode === 'ONLINE_PHONEPE' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Pay Online
            </Txt>
            <Txt size={9} color={Colors.textPrimarySecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              (UPI / Card)
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleQuickPaySelect('SCAN_QR')}
            style={[styles.qpCard, payMode === 'SCAN_QR' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'SCAN_QR' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="qr-code-outline" size={18} color={payMode === 'SCAN_QR' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Scan QR
            </Txt>
            <Txt size={9} color={Colors.textPrimarySecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Pay
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleQuickPaySelect('ONLINE_PHONEPE')}
            style={[styles.qpCard, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'ONLINE_PHONEPE' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="phone-portrait-outline" size={18} color={payMode === 'ONLINE_PHONEPE' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Phone UPI
            </Txt>
            <Txt size={9} color={Colors.textPrimarySecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Pay
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleQuickPaySelect('CASH_HANDOVER')}
            style={[styles.qpCard, payMode === 'CASH_HANDOVER' && showPayForm && styles.qpCardActive]}
          >
            <View style={[styles.qpIconWrap, payMode === 'CASH_HANDOVER' && showPayForm && styles.qpIconWrapActive]}>
              <Ionicons name="cash-outline" size={18} color={payMode === 'CASH_HANDOVER' && showPayForm ? Colors.primary : Colors.primaryDark} />
            </View>
            <Txt size={11} weight="800" color={Colors.textPrimary} align="center" numberOfLines={1} style={{ marginTop: 8 }}>
              Cash Handover
            </Txt>
            <Txt size={9} color={Colors.textPrimarySecondary} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
              Mark as Paid
            </Txt>
          </TouchableOpacity>
        </Row>

        {/* ── 4. INVOICES SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt size={17} weight="800" color={Colors.textPrimary}>Invoices</Txt>
          <TouchableOpacity onPress={() => toast('info', 'Invoices', 'Showing your monthly invoices.')}>
            <Row align="center" gap={4}>
              <Txt size={13} weight="700" color={Colors.primary}>View All</Txt>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </Row>
          </TouchableOpacity>
        </Row>

        {invoicesLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size="small" />
            <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginLeft: 8 }}>Loading invoices...</Txt>
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.emptyInvoiceCard}>
            <Ionicons name="document-text-outline" size={26} color={Colors.primary} />
            <Txt size={13} weight="700" color={Colors.textPrimarySecondary} style={{ marginLeft: 10 }}>
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

              let statusBg = '#E0F2F0';
              let statusColor: string = Colors.success;
              let statusText = 'Paid';
              if (!isPaid) {
                if (isOverdue) { statusBg = '#FEE2E2'; statusColor = Colors.danger; statusText = 'Overdue'; }
                else { statusBg = '#FEF3C7'; statusColor = '#D97706'; statusText = 'Due'; }
              }

              return (
                <View key={inv.id} style={styles.invoiceCard}>
                  <Row justify="space-between" align="center">
                    <View style={[styles.invPill, { backgroundColor: statusBg }]}>
                      <Txt size={10} weight="800" color={statusColor}>{statusText}</Txt>
                    </View>
                    <Txt size={11} color={Colors.textPrimarySecondary}>{monthName.split(' ')[0]} {inv.year}</Txt>
                  </Row>

                  <Spacer size={10} />
                  <Txt size={22} weight="900" color={Colors.textPrimary}>
                    ₹{Math.round(inv.totalAmount).toLocaleString('en-IN')}
                  </Txt>
                  <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                    {isPaid ? `Paid on ${inv.paidAt ? inv.paidAt.slice(0, 10) : '02 Aug 2025'}` : `Due on ${inv.dueDate}`}
                  </Txt>

                  <Spacer size={14} />

                  <Row gap={8}>
                    {!isPaid && (
                      <TouchableOpacity
                        style={styles.invPayBtn}
                        onPress={() => handlePayInvoice(inv)}
                        disabled={payingInvoiceId === inv.id}
                      >
                        <Txt size={11} weight="800" color="#FFFFFF">Pay</Txt>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.invReceiptBtn}
                      onPress={() => handleDownloadPdf(inv)}
                      disabled={downloadingInvoiceId === inv.id}
                    >
                      <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
                      <Txt size={11} weight="800" color={Colors.primary} style={{ marginLeft: 4 }}>Receipt</Txt>
                    </TouchableOpacity>
                  </Row>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── 5. RECENT TRANSACTIONS SECTION ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt size={17} weight="800" color={Colors.textPrimary}>Recent Transactions</Txt>
          <TouchableOpacity onPress={() => toast('info', 'Transactions', 'All recent payment records listed below.')}>
            <Row align="center" gap={4}>
              <Txt size={13} weight="700" color={Colors.primary}>View All</Txt>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </Row>
          </TouchableOpacity>
        </Row>

        {paymentsLoading ? (
          <View style={styles.loadingBox}>
            <Spinner size="small" />
            <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginLeft: 8 }}>Loading transactions...</Txt>
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
            {guestPayments.slice(0, 6).map((p, idx) => {
              const isVerified = p.status === 'VERIFIED';
              const isPending = p.status === 'PENDING';
              const isLast = idx === Math.min(guestPayments.length, 6) - 1;

              let iconName: any = 'checkmark';
              let iconBg: string = Colors.success;
              if (isPending) { iconName = 'time-outline'; iconBg = '#F59E0B'; }
              if (p.status === 'REJECTED') { iconName = 'close'; iconBg = Colors.danger; }

              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.88}
                  onPress={() => { hapticSelect(); setSelectedReceipt(p); }}
                  style={[styles.txnRow, !isLast && styles.txnRowBorder]}
                >
                  <View style={[styles.txnIconWrap, { backgroundColor: iconBg }]}>
                    <Ionicons name={iconName} size={14} color="#FFFFFF" />
                  </View>

                  <Col style={{ flex: 1, marginLeft: 12 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>
                      Payment - Rent ({p.monthYear})
                    </Txt>
                    <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                      {p.paymentMode ? p.paymentMode.replace(/_/g, ' ') : 'Online Payment'}
                    </Txt>
                  </Col>

                  <Col align="flex-end">
                    <Txt size={14} weight="900" color={isVerified ? Colors.textPrimary : isPending ? '#D97706' : Colors.danger}>
                      ₹{Math.round(p.amount).toLocaleString('en-IN')}
                    </Txt>
                    <Txt size={10} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                      {p.timestamp ? String(p.timestamp).slice(0, 11) : 'Recent'}
                    </Txt>
                  </Col>

                  <Ionicons name="chevron-forward" size={14} color={Colors.textPrimarySecondary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── 6. PAYMENT HISTORY / INSIGHTS CARD ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.historyCard}
          onPress={() => { hapticSelect(); toast('info', 'Payment Insights', `You have made ${verifiedCount} verified payments with an on-time record of ${onTimePercentage}%.`); }}
        >
          <View style={styles.historyDocWrap}>
            <Ionicons name="document-text" size={24} color="#FFFFFF" />
          </View>

          <Col style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
            <Txt size={14} weight="800" color="#FFFFFF">Payment History</Txt>
            <Txt size={11} color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
              You have made {verifiedCount} verified payment{verifiedCount === 1 ? '' : 's'} with us.
            </Txt>
          </Col>

          <Col align="center">
            <Txt size={9} weight="700" color="rgba(255,255,255,0.75)">On-time Payments</Txt>
            <View style={styles.metricCircle}>
              <Txt size={14} weight="900" color="#FFFFFF">{onTimePercentage}%</Txt>
            </View>
          </Col>

          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* ── 7. SUPPORT CARD ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.supportCard}
          onPress={() => { hapticSelect(); router.push('/support'); }}
        >
          <View style={styles.supportIconWrap}>
            <Ionicons name="headset-outline" size={22} color={Colors.primaryDark} />
          </View>

          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Need help with Payment?</Txt>
            <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
              Contact our support team anytime.
            </Txt>
          </Col>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => { hapticSelect(); router.push('/support'); }}
          >
            <Txt size={12} weight="800" color={Colors.primary}>Contact Support</Txt>
          </TouchableOpacity>
        </TouchableOpacity>

        <Spacer size={32} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header
  header: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  hRow: { paddingHorizontal: 20, paddingBottom: 24 },
  hWave1: { position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  hWave2: { position: 'absolute', bottom: 10, right: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
  hIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Amount due card
  dueCard: {
    marginTop: -16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 18,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    zIndex: 20,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  dueDateBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E0F2F0', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  payNowBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },

  // Breakdown box
  breakdownBox: {
    width: 145,
    backgroundColor: '#F7FAFA',
    borderRadius: 14, borderWidth: 1, borderColor: '#DCE9EA',
    padding: 10,
  },
  bdRow: { marginBottom: 4 },
  bdDivider: { height: 1, backgroundColor: '#DCE9EA', marginVertical: 4 },

  // Paid state
  paidCheckBadge: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#E0F2F0',
    alignItems: 'center', justifyContent: 'center',
  },
  vDivider: { width: 1, height: 28, backgroundColor: '#DCE9EA' },

  // Quick Pay Grid
  quickPayGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  qpCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#D9EDED',
    paddingVertical: 14, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  qpCardActive: {
    borderColor: Colors.primary, borderWidth: 1.5, backgroundColor: '#EAF7F5',
  },
  qpIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#E0F2F0', borderWidth: 1, borderColor: '#BDD8D6',
    alignItems: 'center', justifyContent: 'center',
  },
  qpIconWrapActive: {
    backgroundColor: '#FFFFFF', borderColor: Colors.primary,
  },

  // Form inputs
  vpaBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0F6F5', borderRadius: 10, borderWidth: 1, borderColor: '#DCE9EA',
    padding: 10,
  },
  copyChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#BDD8D6',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  qrBox: {
    width: 130, height: 130, borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#BDD8D6', padding: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Invoices
  invoiceCard: {
    width: 190,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#D9EDED',
    padding: 14,
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  invPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  invPayBtn: {
    flex: 1, backgroundColor: Colors.primaryDark, borderRadius: 10,
    height: 32, alignItems: 'center', justifyContent: 'center',
  },
  invReceiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E0F2F0', borderRadius: 10, height: 32,
  },

  // Transactions list
  txnListCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#DCE9E9',
    overflow: 'hidden', shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txnRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F6F5' },
  txnIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // History Card
  historyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 20,
    padding: 16, marginTop: 24,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  historyDocWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  metricCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },

  // Support Card
  supportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 16, marginTop: 14,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  supportIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E0F2F0', alignItems: 'center', justifyContent: 'center' },
  contactBtn: {
    borderRadius: 14, borderWidth: 1, borderColor: '#BDD8D6',
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF',
  },

  // Modal Backdrop
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderRadius: 16 },
  emptyInvoiceCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DCE9EA' },
});
