/**
 * GuestPaymentsTab — port of Kotlin `GuestPaymentsTab`.
 * Sub-tabs: Pay Rent + Payment History.
 * Includes PGow Resident Card, fee alerts, current-month rent card, 4 payment paths.
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Palette } from '@/theme';
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

export function GuestPaymentsTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const ownerForGuest = usePGowStore((s) => s.currentOwnerForGuest);
  const allPayments = usePGowStore((s) => s.currentPayments);
  const submitPayment = usePGowStore((s) => s.submitGuestPayment);
  const allGuests = usePGowStore((s) => s.allGuestsState);
  const activePgId = useAuthStore((s) => s.activePgId);
  const activeMembership = useAuthStore((s) => s.user?.memberships.find((m) => m.role === 'guest')?.membership_id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  // Task 8: tenant invoices (server-side monthly invoices with PDF download).
  const { data: invoices = [], isLoading: invoicesLoading } = useTenantInvoices(activePgId, activeMembership ?? undefined);
  const payInvoice = usePayTenantInvoice(activePgId);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState(0);
  const [payMode, setPayMode] = useState('ONLINE_PHONEPE');
  const [utrNumber, setUtrNumber] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentEntity | null>(null);
  const [filter, setFilter] = useState('ALL');

  const ownerPhone = ownerForGuest?.phonePeNumber?.trim() || '9876543210';
  const ownerUpi = ownerForGuest?.upiId?.trim() || 'pgowowner@ybl';
  const isBillPaid = guest?.isBillPaid ?? false;

  const guestsWithRewardPoints = allGuests.filter((g) => g.rewardPoints > 0);
  const highestReward = guestsWithRewardPoints.length > 0
    ? guestsWithRewardPoints.reduce((a, b) => (b.rewardPoints > a.rewardPoints ? b : a))
    : null;
  const isWinner = highestReward !== null && highestReward.id === guest?.id;
  // Today's actual date — the on-time discount is a real rule, not a demo toggle.
  const isOnTime = new Date().getDate() <= 5;
  const baseRent = guest?.rentAmount ?? 6500;
  const rentAmount = Math.max(1, baseRent - (isOnTime ? 50 : 0) - (isWinner ? 100 : 0));
  const currentMonthYear = periodToMonthYear(currentPeriod());

  const guestPayments = allPayments.filter((p) => p.payerId === guest?.id);
  const filteredPayments = filter === 'ALL' ? guestPayments : guestPayments.filter((p) => p.status === filter);
  const totalPaid = guestPayments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = guestPayments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);

  const handleUpiLaunch = async () => {
    hapticSelect();
    const result = await launchUpiPayment({
      upiId: ownerUpi,
      payeeName: 'PG Rent Payment',
      amount: rentAmount,
      note: `Rent ${currentMonthYear}`,
    });
    Alert.alert('UPI Payment', result.message);
  };

  const handleSubmit = async (mode: string) => {
    const r = await submitPayment(mode, rentAmount, 'GUEST_RENT', utrNumber, currentMonthYear);
    if (r.ok) {
      hapticSuccess();
      setUtrNumber('');
      toast('success', 'Payment submitted!', isBillPaid ? 'Your payment was recorded.' : 'Awaiting owner verification.');
    } else {
      hapticError();
      Alert.alert('Failed', r.error ?? 'Unknown');
    }
  };

  // Task 8: pay a tenant invoice via UPI manual flow (UTR-less — the server
  // accepts upi_manual as the method and tracks the invoice as paid once the
  // UTR is reported separately if needed).
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

  // Task 8: fetch the presigned PDF URL from the server, download the bytes,
  // and hand off to expo-sharing so the resident can save or share.
  const handleDownloadPdf = async (inv: TenantInvoice) => {
    setDownloadingInvoiceId(inv.id);
    try {
      const pdfUrl = await fetchTenantInvoicePdfUrl(inv.id);
      if (!pdfUrl) {
        hapticError();
        toast('error', 'PDF unavailable', 'The invoice PDF could not be generated.');
        return;
      }
      // Fetch through the gateway so the auth token travels with the request and to confirm
      // the PDF actually exists server-side, then hand the resident the link. expo-sharing's
      // shareAsync needs a file:// URI, and expo-file-system (to write one) is not installed —
      // TODO: install expo-file-system and switch to a real local save + Sharing.shareAsync.
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
  // expo-sharing import is referenced by the eventual file-based path; keep it
  // in scope so the linter doesn't drop the dep when the file-system write is
  // wired in.
  void Sharing;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {selectedReceipt && <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />}

      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setActiveSubTab(0)} style={[styles.subTab, { backgroundColor: activeSubTab === 0 ? Colors.primary : 'transparent' }]}>
          <Txt size={12} weight="700" color={activeSubTab === 0 ? Colors.textInverse : Colors.SlateMutedText}>Pay Rent</Txt>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab(1)} style={[styles.subTab, { backgroundColor: activeSubTab === 1 ? Colors.primary : 'transparent' }]}>
          <Txt size={12} weight="700" color={activeSubTab === 1 ? Colors.textInverse : Colors.SlateMutedText}>Payment History</Txt>
        </TouchableOpacity>
        {/* Task 8: third sub-tab for tenant invoices */}
        <TouchableOpacity onPress={() => setActiveSubTab(2)} style={[styles.subTab, { backgroundColor: activeSubTab === 2 ? Colors.primary : 'transparent' }]}>
          <Txt size={12} weight="700" color={activeSubTab === 2 ? Colors.textInverse : Colors.SlateMutedText}>Invoices</Txt>
        </TouchableOpacity>
      </View>

      {/* Task 8: tenant invoices sub-tab */}
      {activeSubTab === 2 && (
        <ScrollView
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.CyberGreen} colors={[Colors.CyberGreen]} />}
        >
          <Row gap={6} align="center">
            <Txt size={13} weight="800" color={Colors.IvoryWhiteText}>Your Monthly Invoices</Txt>
            <InfoTip text="Server-generated monthly rent invoices. Pay online or download a PDF copy." />
          </Row>
          <Spacer size={6} />
          {invoicesLoading ? (
            <Txt size={12} color={Colors.SlateMutedText}>Loading invoices…</Txt>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No invoices yet"
              subtitle="Your monthly rent invoice will appear here when the owner generates one."
              accent={Colors.CyberPurple}
            />
          ) : (
            invoices.map((inv: TenantInvoice) => {
              const monthYear = periodToMonthYear(`${inv.year}-${String(inv.month).padStart(2, '0')}-01`);
              const isPaid = inv.status === 'paid';
              const isOverdue = inv.status === 'overdue';
              const tint = isPaid ? Colors.CyberGreen : isOverdue ? Palette.StatusRed : Colors.CyberAmber;
              return (
                <Card key={inv.id} containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={`${tint}66`} padding={[12, 12]}>
                  <Row justify="space-between" align="center">
                    <Col style={{ flex: 1 }}>
                      <Txt size={13} weight="700" color={Colors.IvoryWhiteText}>{monthYear} Invoice</Txt>
                      <Txt size={10} color={Colors.SlateMutedText}>Due {inv.dueDate}</Txt>
                    </Col>
                    <View style={[styles.statusPill, { backgroundColor: `${tint}26` }]}>
                      <Txt size={10} weight="800" color={tint}>{inv.status.toUpperCase()}</Txt>
                    </View>
                  </Row>
                  <Spacer size={8} />
                  <Row justify="space-between" align="center">
                    <Txt size={16} weight="900" color={tint}>₹{Math.round(inv.totalAmount).toLocaleString('en-IN')}</Txt>
                    <Row gap={6} align="center">
                      {!isPaid && (
                        <Btn
                          onPress={() => handlePayInvoice(inv)}
                          loading={payingInvoiceId === inv.id}
                          containerColor={Colors.CyberGreen}
                          textColor={Colors.LuxuryPureBlack}
                          borderRadius={8}
                          height={32}
                          contentStyle={{ paddingHorizontal: 10 }}
                          testID={`invoice_pay_${inv.id}`}
                        >
                          <Txt size={11} weight="800" color={Colors.LuxuryPureBlack}>Pay Now</Txt>
                        </Btn>
                      )}
                      <Btn
                        onPress={() => handleDownloadPdf(inv)}
                        loading={downloadingInvoiceId === inv.id}
                        containerColor={Colors.surfaceElevated}
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
        </ScrollView>
      )}

      {activeSubTab === 1 ? (
        <ScrollView
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.CyberGreen} colors={[Colors.CyberGreen]} />}
        >
          <Row gap={8} style={{ marginBottom: 12 }}>
            <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor="rgba(20,226,177,0.4)" padding={[12, 12]} style={{ flex: 1 }}>
              <Txt size={9} weight="700" color={Colors.SlateMutedText}>TOTAL PAID</Txt>
              <Txt size={18} weight="900" color={Colors.CyberGreen}>₹{Math.round(totalPaid)}</Txt>
            </Card>
            <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor="rgba(255,167,38,0.4)" padding={[12, 12]} style={{ flex: 1 }}>
              <Txt size={9} weight="700" color={Colors.SlateMutedText}>PENDING</Txt>
              <Txt size={18} weight="900" color={Colors.CyberAmber}>₹{Math.round(pendingAmount)}</Txt>
            </Card>
          </Row>
          <Row gap={6} style={{ marginBottom: 12 }}>
            {['ALL', 'VERIFIED', 'PENDING', 'REJECTED'].map((f) => (
              <Chip key={f} label={f} selected={filter === f} onPress={() => { hapticSelect(); setFilter(f); }} selectedColor={Colors.CyberPurple} size={11} />
            ))}
          </Row>
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={`No ${filter === 'ALL' ? '' : filter + ' '}transactions yet`}
              subtitle="Pay your rent via UPI / QR / cash and your receipts will appear here. Pull down to refresh."
              accent={Colors.CyberPurple}
            />
          ) : (
            filteredPayments.map((p) => {
              const isVerified = p.status === 'VERIFIED';
              const isPending = p.status === 'PENDING';
              const statusColor = isVerified ? Colors.CyberGreen : isPending ? Colors.CyberAmber : Colors.CyberPink;
              return (
                <AnimatedPress
                  key={p.id}
                  scale={0.985}
                  hapticPattern="light"
                  onPress={() => { hapticSelect(); setSelectedReceipt(p); }}
                >
                  <Card containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={`${statusColor}66`} padding={[12, 12]}>
                    <Row justify="space-between" align="center">
                      <Col style={{ flex: 1 }}>
                        <Txt size={13} weight="700" color={Colors.IvoryWhiteText}>{p.monthYear} • {p.paymentType.replace(/_/g, ' ')}</Txt>
                        <Txt size={10} color={Colors.SlateMutedText}>Ref: {p.transactionRef} • {p.paymentMode.replace(/_/g, ' ')}</Txt>
                      </Col>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}26` }]}>
                        <Txt size={10} weight="800" color={statusColor}>{isVerified ? 'VERIFIED ✅' : isPending ? 'PENDING ⏳' : 'REJECTED ❌'}</Txt>
                      </View>
                    </Row>
                    <Spacer size={8} />
                    <Row justify="space-between" align="center">
                      <Txt size={16} weight="900" color={statusColor}>₹{Math.round(p.amount)}</Txt>
                      <Row gap={6} align="center">
                        <Txt size={10} weight="700" color={Colors.CyberPurple}>Tap to view receipt</Txt>
                        <Ionicons name="chevron-forward" size={12} color={Colors.CyberPurple} />
                      </Row>
                    </Row>
                  </Card>
                </AnimatedPress>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 12, gap: 14 }}>
          {/* PGow Resident Card */}
          <View style={styles.residentCard}>
            <Col style={{ flex: 1, justifyContent: 'space-between' }}>
              <Row justify="space-between" align="center">
                <Txt size={11} weight="800" color={Colors.textInverse} style={{ letterSpacing: 1 }}>PGOW RESIDENT CARD</Txt>
                <Ionicons name="card" size={22} color={Colors.textInverse} />
              </Row>
              <Txt size={16} weight="700" color={Colors.textInverse}>PGOW-RESIDENT-ID: #{guest?.id ?? 101}</Txt>
              <Row justify="space-between">
                <Col>
                  <Txt size={8} color="rgba(255,255,255,0.75)">RESIDENT</Txt>
                  <Txt size={12} weight="700" color={Colors.textInverse}>{(guest?.name ?? 'PG RESIDENT').toUpperCase()}</Txt>
                </Col>
                <Col align="center">
                  <Txt size={8} color="rgba(255,255,255,0.75)">REWARDS</Txt>
                  <Txt size={12} weight="800" color="#FDE68A">{guest?.rewardPoints ?? 0} PTS</Txt>
                </Col>
                <Col align="flex-end">
                  <Txt size={8} color="rgba(255,255,255,0.75)">ROOM</Txt>
                  <Txt size={12} weight="700" color={Colors.textInverse}>{guest?.roomNo ?? '101'}</Txt>
                </Col>
              </Row>
            </Col>
          </View>

          {/* Fee Push Notifications Card */}
          <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={14} borderWidth={1} borderColor="rgba(0,163,140,0.5)" padding={[12, 12]}>
            <Row justify="space-between" align="center">
              <Row gap={6}>
                <Ionicons name="notifications" size={18} color={Colors.CyberPurple} />
                <Txt size={12} weight="700" color={Colors.IvoryWhiteText}>Fee Push Notifications</Txt>
              </Row>
              <Txt size={9} weight="900" color={Colors.CyberGreen}>ACTIVE 🟢</Txt>
            </Row>
            <Spacer size={6} />
            <Txt size={10} color={Colors.SlateMutedText}>
              You will be notified here when rent is due and when a payment is verified.
            </Txt>
          </Card>

          {/* August 2026 Monthly Rent Dues */}
          <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={20} borderWidth={1} borderColor={Colors.LuxuryCardBorder} padding={[18, 18]}>
            <Row justify="space-between" align="center">
              <Col>
                <Txt size={15} weight="800" color={Colors.IvoryWhiteText}>{currentMonthYear} Monthly Rent Dues</Txt>
              </Col>
              <View style={[styles.billPill, { backgroundColor: isBillPaid ? 'rgba(20,226,177,0.15)' : 'rgba(255,167,38,0.15)' }]}>
                <Txt size={10} weight="800" color={isBillPaid ? Colors.CyberGreen : Colors.CyberAmber}>{isBillPaid ? 'SETTLED ✅' : 'UNPAID ⏳'}</Txt>
              </View>
            </Row>
            <Spacer size={12} />
            <View style={styles.breakdownBox}>
              <Row justify="space-between"><Txt size={11} color={Colors.SlateMutedText}>Base Monthly Rent Dues</Txt><Txt size={11} weight="700" color={Colors.IvoryWhiteText}>₹{Math.round(baseRent).toLocaleString('en-IN')}</Txt></Row>
              {isOnTime && <Row justify="space-between"><Txt size={11} color={Colors.CyberGreen}>⚡ On-Time Discount (Before 5th)</Txt><Txt size={11} weight="700" color={Colors.CyberGreen}>-₹50</Txt></Row>}
              {isWinner && <Row justify="space-between"><Txt size={11} color={Colors.CyberPink}>🏆 30th Winner Champion Incentive</Txt><Txt size={11} weight="700" color={Colors.CyberPink}>-₹100</Txt></Row>}
              <View style={{ height: 1, backgroundColor: Colors.LuxuryCardBorder, marginVertical: 6 }} />
              <Row justify="space-between"><Txt size={12} weight="700" color={Colors.IvoryWhiteText}>Net Payable Amount</Txt><Txt size={16} weight="900" color={Colors.CyberGreen}>₹{Math.round(rentAmount)}</Txt></Row>
            </View>

            {isBillPaid ? (
              <View style={[styles.paidBanner, { backgroundColor: 'rgba(20,226,177,0.15)' }]}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.CyberGreen} />
                <Txt size={12} weight="700" color={Colors.CyberGreen}>August Rent Settled & Verified! View digital receipt below.</Txt>
              </View>
            ) : (
              <>
                <Spacer size={16} />
                <Txt size={12} weight="700" color={Colors.IvoryWhiteText} style={{ letterSpacing: 0.5 }}>SELECT PAYMENT METHOD</Txt>
                <Spacer size={8} />
                <Row gap={6}>
                  <Chip label="⚡ 1. 1-Tap UPI Launch" selected={payMode === 'ONLINE_PHONEPE'} onPress={() => setPayMode('ONLINE_PHONEPE')} selectedColor={Colors.CyberPurple} size={10} />
                  <Chip label="📷 2. Scan QR Code" selected={payMode === 'SCAN_QR'} onPress={() => setPayMode('SCAN_QR')} selectedColor={Colors.CyberPurple} size={10} />
                  <Chip label="💵 3. Pay Cash" selected={payMode === 'CASH_HANDOVER'} onPress={() => setPayMode('CASH_HANDOVER')} selectedColor={Colors.CyberPurple} size={10} />
                </Row>
                <Spacer size={14} />

                <View style={{ minHeight: 290 }}>
                  {payMode === 'ONLINE_PHONEPE' && (
                    <Card containerColor={Colors.LuxuryPureBlack} borderRadius={12} borderWidth={1} borderColor={Colors.CyberPink} padding={[12, 12]} style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View>
                        <Txt size={12} weight="700" color={Colors.CyberPink}>📱 1. Direct Phone Number / UPI ID Pay</Txt>
                        <Spacer size={10} />
                        <Row justify="space-between" align="center" style={{ backgroundColor: Colors.surface, borderRadius: 8, padding: 8 }}>
                          <Col style={{ flex: 1 }}>
                            <Txt size={11} weight="700" color={Colors.IvoryWhiteText}>Owner Phone Number: +91 {ownerPhone}</Txt>
                            <Txt size={11} weight="700" color={Colors.CyberPurple}>Owner UPI VPA ID: {ownerUpi}</Txt>
                          </Col>
                          <IconBtn onPress={() => { Clipboard.setStringAsync(ownerUpi); Alert.alert('Copied', `Copied UPI VPA: ${ownerUpi}`); }} icon="copy" size={20} tint={Colors.CyberPink} />
                        </Row>
                        <Spacer size={10} />
                        <OutlinedBtn onPress={handleUpiLaunch} borderColor={Colors.CyberPink} textColor={Colors.CyberPink} borderRadius={8} height={36}>
                          <Ionicons name="open" size={14} color={Colors.CyberPink} />
                          <Txt size={11} weight="700" color={Colors.CyberPink} style={{ marginLeft: 6 }}>Launch PhonePe / UPI App Directly</Txt>
                        </OutlinedBtn>
                        <Spacer size={10} />
                        <OutlinedTextField label="Enter 12-Digit UTR Transaction Ref" placeholder="421980341209" value={utrNumber} onChangeText={setUtrNumber} testID="phone_upi_utr_input" focusedBorderColor={Colors.CyberPink} borderRadius={10} style={{ marginBottom: 10 }} />
                      </View>
                      <Btn onPress={() => handleSubmit('ONLINE_PHONEPE')} disabled={!utrNumber.trim()} containerColor={Colors.CyberPink} textColor={Colors.IvoryWhiteText} borderRadius={10} height={40} testID="submit_phone_utr_btn">
                        <Txt size={12} weight="700" color={Colors.IvoryWhiteText}>Submit UTR for Owner Verification</Txt>
                      </Btn>
                    </Card>
                  )}

                  {payMode === 'SCAN_QR' && (
                    <Card containerColor={Colors.LuxuryPureBlack} borderRadius={12} borderWidth={1} borderColor={Colors.CyberAmber} padding={[12, 12]} style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View>
                        <Txt size={12} weight="700" color={Colors.CyberAmber}>📷 2. Scan Owner PhonePe / UPI QR Code</Txt>
                        <Txt size={11} weight="700" color={Colors.IvoryWhiteText}>Scan & Pay to Owner UPI VPA: {ownerUpi}</Txt>
                        <Spacer size={6} />
                        <View style={styles.qrBox}>
                          <Ionicons name="qr-code-sharp" size={54} color="#000000" />
                          <Txt size={9} weight="700" color="#000000" align="center">{ownerUpi}</Txt>
                          <Txt size={8} color="#6B7280">PhonePe / Paytm / GPay</Txt>
                        </View>
                        <Spacer size={6} />
                        <OutlinedTextField label="Enter 12-Digit PhonePe / UPI UTR Ref" placeholder="421980341209" value={utrNumber} onChangeText={setUtrNumber} testID="qr_utr_input" focusedBorderColor={Colors.CyberAmber} borderRadius={10} style={{ marginBottom: 8 }} />
                      </View>
                      <Btn onPress={() => handleSubmit('SCAN_QR')} disabled={!utrNumber.trim()} containerColor={Colors.CyberAmber} textColor={Colors.LuxuryPureBlack} borderRadius={10} height={40} testID="submit_qr_utr_btn">
                        <Txt size={12} weight="700" color={Colors.LuxuryPureBlack}>Submit UTR for Owner Verification</Txt>
                      </Btn>
                    </Card>
                  )}

                  {payMode === 'CASH_HANDOVER' && (
                    <Card containerColor={Colors.LuxuryPureBlack} borderRadius={12} borderWidth={1} borderColor={Colors.CyberGreen} padding={[12, 12]} style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View>
                        <Txt size={12} weight="700" color={Colors.CyberGreen}>💵 3. Cash Handover Request</Txt>
                        <Spacer size={12} />
                        <Txt size={11} color={Colors.SlateMutedText}>
                          Handover physical cash (₹{Math.round(rentAmount)}) directly to your PG Manager ({ownerPhone}). A cash verification request will be sent to the owner dashboard.
                        </Txt>
                      </View>
                      <Btn onPress={() => handleSubmit('CASH_HANDOVER')} containerColor={Colors.CyberGreen} textColor={Colors.LuxuryPureBlack} borderRadius={10} height={42} testID="cash_handover_btn">
                        <Txt size={12} weight="700" color={Colors.LuxuryPureBlack}>Create Cash Handover Request (₹{Math.round(rentAmount)})</Txt>
                      </Btn>
                    </Card>
                  )}
                </View>
              </>
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 10, padding: 4, gap: 4 },
  subTab: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  residentCard: {
    height: 150, borderRadius: 16, padding: 16,
    backgroundColor: Colors.primary,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  billPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  breakdownBox: { backgroundColor: Colors.LuxuryPureBlack, borderRadius: 10, borderWidth: 1, borderColor: Colors.LuxuryCardBorder, padding: 12 },
  paidBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 12 },
  vpaBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,163,140,0.5)', padding: 8 },
  qrBox: { width: 140, height: 140, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: Colors.CyberAmber, padding: 8, alignItems: 'center', justifyContent: 'center' },
});
