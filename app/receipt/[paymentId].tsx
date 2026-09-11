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
import { ErrorState, LoadingState, Row, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';
import { usePayment } from '@/features/payments/usePayments';
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

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // Text, not a PDF: nothing in this app generates one yet, and claiming to attach a
      // document that does not exist would be worse than sharing the figures plainly.
      await Share.share({
        message: [
          `PGow receipt — ${formatINR(payment.amount)}`,
          `Period: ${payment.monthYear}`,
          `Paid by: ${payment.payerName}`,
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
  pendingNote: { padding: 12, borderRadius: Radii.control, backgroundColor: Colors.surfaceMuted } });
