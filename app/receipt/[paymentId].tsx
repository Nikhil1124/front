/**
 * Receipt — a financial record, so a destination rather than a panel.
 *
 * A resident produces this to third parties: a landlord, an employer, a tax filing. That is
 * the test the audit settled on for "screen vs sheet" — shareability, not size. The expense
 * detail next to it in the owner's Payments tab stays a sheet for exactly the opposite
 * reason: internal bookkeeping that never leaves the app.
 *
 * Information hierarchy is re-levelled from the sheet it replaces, where "Official co-living
 * verified tax invoice" sat in the subtitle — system information in the headline position —
 * while the amount, which is the reason anyone opens a receipt, was mid-body. Amount and
 * period lead; the branding is a footer line.
 */
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { Col, ErrorState, LoadingState, Row, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';
import { usePayment } from '@/features/payments/usePayments';
import { buildInvoice, invoiceAsText } from '@/features/payments/invoice';
import { usePGowStore } from '@/store/usePGowStore';
import { useActiveProperty } from '@/features/properties/useProperties';
import { useToast } from '@/hooks/useToast';
import { formatINR, formatDateTime } from '@/utils/format';
import { Colors, Radii } from '@/theme';

const MODE_LABELS: Record<string, string> = {
  ONLINE_PHONEPE: 'UPI (PhonePe)',
  SCAN_QR: 'Scanned QR',
  PHONE_UPI: 'UPI reference',
  CASH_HANDOVER: 'Cash' };

export default function ReceiptScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const toast = useToast();
  const { payment, isLoading, error, refetch } = usePayment(paymentId);
  const [sharing, setSharing] = useState(false);
  // Whichever of these the viewer has — an owner reading their own record, or the resident
  // reading theirs. Only used to name the two parties on the invoice.
  const owner = usePGowStore((s) => s.loggedInOwner);
  const guest = usePGowStore((s) => s.loggedInGuest);
  // The resident's own property comes from the active-property hook, the same source
  // GuestPaymentsTab uses for the owner's UPI.
  const { activeEntity: ownerForGuest } = useActiveProperty();

  if (isLoading) return <Frame><LoadingState label="Loading receipt…" /></Frame>;
  if (error) return <Frame><ErrorState error={error} title="Could not load this receipt" onRetry={refetch} /></Frame>;
  if (!payment) {
    return (
      <Frame>
        <ErrorState title="This payment record no longer exists" error={new Error('It may have been removed.')} />
      </Frame>
    );
  }

  const isVerified = payment.status === 'VERIFIED';

  const pg = owner ?? ownerForGuest;
  const invoice = buildInvoice({
    paymentId: payment.id,
    amount: payment.amount,
    monthYear: payment.monthYear,
    paymentType: payment.paymentType,
    issuedAt: payment.verificationDate || payment.timestamp,
    isVerified,
    from: { name: pg?.pgName || 'Your PG', line: pg?.address || undefined },
    to: {
      name: payment.payerName || guest?.name || 'Resident',
      line: guest?.id === payment.payerId && guest?.roomNo ? `Room ${guest.roomNo}` : undefined,
    },
  });

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // Text, not a PDF: nothing in this app generates one yet, and claiming to attach a
      // document that does not exist would be worse than sharing the figures plainly.
      await Share.share({
        message: [
          invoiceAsText(invoice),
          '',
          `Mode: ${MODE_LABELS[payment.paymentMode] ?? payment.paymentMode}`,
          payment.transactionRef ? `Reference: ${payment.transactionRef}` : null,
          payment.receiptId ? `Receipt ID: ${payment.receiptId}` : null,
        ].filter(Boolean).join('\n'),
      });
    } catch {
      toast('error', 'Could not share', 'The share sheet did not open.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Frame>
      <AppHeader
        title="Receipt"
        onBack={() => router.back()}
        actions={isVerified ? <HeaderChip icon="share-social-outline" label="Share receipt" onPress={share} /> : undefined}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* L2 — the number, and what period it covers. */}
        <Txt variant="meta" weight="600" color={Colors.textMuted} style={styles.kicker}>TOTAL AMOUNT PAID</Txt>
        <Txt variant="hero" color={Colors.textPrimary} tabular>{formatINR(payment.amount)}</Txt>
        <Spacer size={4} />
        <Row gap={8} align="center">
          <Txt variant="sectionTitle" color={Colors.textSecondary}>{payment.monthYear}</Txt>
          <StatusChip label={payment.status.toLowerCase()} tone={toneFor(payment.status)} />
        </Row>

        {!isVerified ? (
          <>
            <Spacer size={14} />
            <View style={styles.pendingNote}>
              <Txt variant="body" color={Colors.textSecondary}>
                This slip unlocks once the owner verifies the payment. Until then it is a record of what
                you submitted, not a receipt.
              </Txt>
            </View>
          </>
        ) : null}

        {/* ── Invoice ──────────────────────────────────────────────────────────────────
            Every payment has one. The number is derived from the payment, so the copy a
            resident forwards and the copy the owner reads are the same document. */}
        <Spacer size={24} />
        <View style={styles.invoiceBox}>
          <Row justify="space-between" align="center">
            <Txt variant="meta" weight="700" color={Colors.textMuted} style={styles.kicker}>
              {invoice.isFinal ? 'TAX INVOICE' : 'PROVISIONAL INVOICE'}
            </Txt>
            <Txt variant="meta" weight="700" color={Colors.textPrimary} tabular>{invoice.number}</Txt>
          </Row>
          <Spacer size={10} />
          <Row justify="space-between" align="flex-start" gap={16}>
            <Col style={{ flex: 1 }}>
              <Txt variant="caption" color={Colors.textMuted}>FROM</Txt>
              <Txt variant="body" weight="600" color={Colors.textPrimary} numberOfLines={2}>{invoice.from.name}</Txt>
              {invoice.from.line ? <Txt variant="caption" color={Colors.textMuted} numberOfLines={2}>{invoice.from.line}</Txt> : null}
              {invoice.from.gstin ? (
                <Txt variant="caption" color={Colors.textMuted} tabular>GSTIN {invoice.from.gstin}</Txt>
              ) : null}
            </Col>
            <Col style={{ flex: 1 }}>
              <Txt variant="caption" color={Colors.textMuted}>BILLED TO</Txt>
              <Txt variant="body" weight="600" color={Colors.textPrimary} numberOfLines={2}>{invoice.to.name}</Txt>
              {invoice.to.line ? <Txt variant="caption" color={Colors.textMuted} numberOfLines={2}>{invoice.to.line}</Txt> : null}
            </Col>
          </Row>

          <Spacer size={12} />
          <View style={styles.hr} />
          <DetailRow label={invoice.description} value={formatINR(invoice.taxableValue)} />
          <DetailRow label={`GST @ ${invoice.taxRate}%`} value={formatINR(invoice.taxAmount)} />
          <Row justify="space-between" align="center" style={styles.invoiceTotal}>
            <Txt variant="body" weight="700" color={Colors.textPrimary}>Total</Txt>
            <Txt variant="sectionTitle" weight="700" color={Colors.textPrimary} tabular>{formatINR(invoice.total)}</Txt>
          </Row>
          {invoice.taxRate === 0 ? (
            <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 6 }}>
              Residential accommodation — exempt from GST under Notification 12/2017.
            </Txt>
          ) : null}
        </View>

        <Spacer size={24} />
        <View style={styles.hr} />
        <DetailRow label="Paid by" value={payment.payerName || 'Resident'} />
        <DetailRow label="Payment mode" value={MODE_LABELS[payment.paymentMode] ?? payment.paymentMode} />
        <DetailRow label="Payment type" value={payment.paymentType.replace(/_/g, ' ').toLowerCase()} />

        <Spacer size={18} />
        {/* L4 — metadata. Small, muted, and at the bottom where it belongs. */}
        <DetailMeta label="Paid at" value={payment.timestamp ? formatDateTime(payment.timestamp) : '—'} />
        {payment.transactionRef ? <DetailMeta label="Transaction ref" value={payment.transactionRef} /> : null}
        {payment.utrRef ? <DetailMeta label="UTR" value={payment.utrRef} /> : null}
        {payment.receiptId ? <DetailMeta label="Receipt ID" value={payment.receiptId} /> : null}
        {isVerified && payment.verifiedByName ? (
          <DetailMeta
            label="Verified by"
            value={payment.verifiedByName + (payment.verificationDate ? ` · ${formatDateTime(payment.verificationDate)}` : '')}
          />
        ) : null}

        <Spacer size={22} />
        <Txt variant="caption" color={Colors.textMuted} align="center">
          PGow digital receipt · official co-living verified tax invoice
        </Txt>
      </ScrollView>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="center" style={styles.detailRow}>
      <Txt variant="body" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="body" weight="600" color={Colors.textPrimary} style={styles.detailValue} numberOfLines={2}>{value}</Txt>
    </Row>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="center" style={styles.metaRow}>
      <Txt variant="meta" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="meta" color={Colors.textMuted} style={styles.detailValue} numberOfLines={2}>{value}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { padding: 18, paddingBottom: 48 },
  kicker: { letterSpacing: 0.6, marginBottom: 2 },
  hr: { height: 1, backgroundColor: Colors.separator },
  detailRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  metaRow: { paddingVertical: 5 },
  detailValue: { flex: 1, textAlign: 'right', marginLeft: 16 },
  pendingNote: { padding: 12, borderRadius: Radii.control, backgroundColor: Colors.surfaceMuted },
  invoiceBox: {
    padding: 14,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface },
  invoiceTotal: { paddingTop: 11 } });
