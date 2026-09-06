/**
 * PaymentReceiptDialog — PGow digital receipt / invoice modal.
 * Designed as a clean bottom-sheet receipt viewer with optimized hierarchy and layout.
 */
import { useEffect, type ReactNode } from 'react';
import {
  View, StyleSheet, Linking, Platform, BackHandler, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Radii, Colors } from '@/theme';
import { formatDateTime, formatINR } from '@/utils/format';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { usePGowStore } from '@/store/usePGowStore';
import type { PaymentEntity } from '@/types';
import { AnimatedPress, Btn, Col, OutlinedBtn, Row, Sheet, Spacer, Txt } from '@/components/ui';

interface Props {
  payment: PaymentEntity;
  onDismiss: () => void;
  /** Optional: download handler. If provided, the bottom row shows a real
   *  Download button; if absent, the row falls back to a Close-only layout. */
  onDownload?: () => void;
  /** Optional: external download URL (e.g. a tenant-invoice PDF link). When
   *  set and no onDownload is supplied, the Download button uses Linking. */
  downloadUrl?: string;
  downloadLabel?: string;
  /**
   * Decisions that belong to this payment — the owner's Verify / Reject pair.
   *
   * They used to sit inside the payment's list row, two 14px targets inside an already
   * tappable card. A decision needs the UTR, the mode and the payer in front of you, and
   * that is exactly what this sheet already shows.
   */
  actions?: ReactNode;
}

function formatPaymentType(type: string): string {
  switch (type) {
    case 'GUEST_RENT': return 'Guest Rent';
    case 'GUEST_FOOD': return 'Guest Food';
    case 'GUEST_SERVICE': return 'Guest Service';
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function PaymentReceiptDialog({
  payment,
  onDismiss,
  onDownload,
  downloadUrl,
  downloadLabel = 'Download PDF',
  actions }: Props) {
  // Bottom-pinned sheet: the receipt's last row would otherwise sit in the gesture strip.
  const guest = usePGowStore((s) => s.loggedInGuest);
  const roomNo = payment.payerId === guest?.id ? guest?.roomNo : null;
  const isVerified = payment.status === 'VERIFIED';
  const modeLabel = (() => {
    switch (payment.paymentMode) {
      case 'ONLINE_PHONEPE': return 'Online PhonePe Direct';
      case 'SCAN_QR': return 'Scan Owner QR Code';
      case 'PHONE_UPI': return 'Phone / UPI VPA';
      case 'CASH_HANDOVER': return 'Cash Handover';
      default: return payment.paymentMode;
    }
  })();

  // Wires Android's hardware back button to `onDismiss`.
  useEffect(() => {
    const subscription = () => {
      onDismiss();
      return true; // we handled it
    };
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', subscription);
      return () => sub.remove();
    }
  }, [onDismiss]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(() => {/* swallow — no-op */});
    }
  };

  return (
    <Sheet
      visible
      title="PGow digital receipt"
      subtitle="Official co-living verified tax invoice"
      icon="receipt"
      accent={isVerified ? Colors.success : Colors.warning}
      onDismiss={onDismiss}
      footer={
        <>
          {actions ? (
            <>
              {actions}
              <Spacer size={10} />
            </>
          ) : null}
          <Row gap={10}>
            {isVerified && (
              <Btn
                onPress={handleDownload}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={Radii.control}
                height={42}
                style={{ flex: 1 }}
                testID="download_pdf_invoice_btn"
              >
                <Ionicons name="download" size={14} color={Colors.textInverse} />
                <Txt variant="button" color={Colors.textInverse} style={{ marginLeft: 6 }}>
                  {downloadLabel}
                </Txt>
              </Btn>
            )}
            <OutlinedBtn
              onPress={onDismiss}
              borderColor={Colors.borderMuted}
              textColor={Colors.textSecondary}
              borderRadius={Radii.control}
              height={42}
              style={isVerified ? undefined : { flex: 1 }}
              testID="receipt_done_btn"
            >
              <Txt size={12} weight="700" color={Colors.textSecondary}>Done</Txt>
            </OutlinedBtn>
          </Row>
        </>
      }
    >
          <View>
            {/* Status banner — compact card directly below header */}
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: isVerified ? Colors.successPale : Colors.pendingPale,
                  borderColor: isVerified ? Colors.success : Colors.warning },
              ]}
            >
              <Row gap={8} align="center">
                <Ionicons
                  name={isVerified ? 'checkmark-circle' : 'time'}
                  size={20}
                  color={isVerified ? Colors.success : Colors.warning}
                />
                <Col style={{ flex: 1 }}>
                  <Txt variant="meta" weight="600" color={isVerified ? Colors.success : Colors.pending}>
                    {isVerified ? 'STATUS: PAID & VERIFIED' : 'STATUS: VERIFICATION PENDING'}
                  </Txt>
                  <Txt variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    {isVerified
                      ? `Receipt ID: ${payment.receiptId}`
                      : 'Slip unlocks automatically once the owner verifies your payment.'}
                  </Txt>
                  {isVerified && payment.verifiedByName ? (
                    <Txt variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                      Verified by {payment.verifiedByName}
                      {payment.verificationDate ? ` on ${formatDateTime(payment.verificationDate)}` : ''}
                    </Txt>
                  ) : null}
                </Col>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Resident details */}
            <View style={styles.detailsCard}>
              <Txt variant="statusChip" color={Colors.primary}>RESIDENT</Txt>
              <Spacer size={4} />
              <Txt variant="sectionTitle" color={Colors.textPrimary}>{payment.payerName || 'Resident'}</Txt>
              {roomNo ? (
                <Txt variant="meta" color={Colors.textSecondary} tabular style={{ marginTop: 2 }}>
                  Room {roomNo}
                </Txt>
              ) : null}
              <Spacer size={6} />
              <Row gap={8} style={{ marginTop: 2 }}>
                <AnimatedPress accessibilityRole="button" onPress={() => { Clipboard.setStringAsync(payment.pgId); Alert.alert('Copied', 'PG ID copied to clipboard.'); }} style={styles.idChip}>
                  <Txt variant="caption" color={Colors.textMuted} tabular>PG ID: {payment.pgId.slice(0, 8)}...</Txt>
                </AnimatedPress>
                <AnimatedPress accessibilityRole="button" onPress={() => { Clipboard.setStringAsync(payment.payerId); Alert.alert('Copied', 'Resident ID copied to clipboard.'); }} style={styles.idChip}>
                  <Txt variant="caption" color={Colors.textMuted} tabular>Res ID: {payment.payerId.slice(0, 8)}...</Txt>
                </AnimatedPress>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Billing & Transaction Summary */}
            <View style={styles.detailsCard}>
              <Txt variant="statusChip" color={Colors.primary}>BILLING & TRANSACTION SUMMARY</Txt>
              <Spacer size={8} />
              <Row justify="space-between">
                <Txt variant="meta" color={Colors.textMuted}>Billing Period</Txt>
                <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular>
                  {payment.monthYear || periodToMonthYear(currentPeriod(new Date(payment.timestamp || Date.now())))}
                </Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt variant="meta" color={Colors.textMuted}>Payment Type</Txt>
                <Txt variant="meta" weight="600" color={Colors.textPrimary}>{formatPaymentType(payment.paymentType)}</Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt variant="meta" color={Colors.textMuted}>Payment Mode</Txt>
                <Txt variant="meta" weight="600" color={Colors.textPrimary}>{modeLabel}</Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt variant="meta" color={Colors.textMuted}>Transaction Ref</Txt>
                <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular>{payment.transactionRef || '—'}</Txt>
              </Row>
              {payment.utrRef ? (
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt variant="meta" color={Colors.textMuted}>12-Digit UTR Ref</Txt>
                  <Txt variant="meta" weight="600" color={Colors.tertiary} tabular>{payment.utrRef}</Txt>
                </Row>
              ) : null}
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt variant="meta" color={Colors.textMuted}>Date & Time</Txt>
                <Txt variant="meta" color={Colors.textPrimary} tabular>{formatDateTime(payment.timestamp)}</Txt>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Total Amount Paid Section */}
            <View style={styles.amountCard}>
              <Row justify="space-between" align="center">
                <Txt variant="meta" weight="600" color={Colors.textSecondary}>TOTAL AMOUNT PAID</Txt>
                <Txt variant="metric" color={Colors.primary} tabular>
                  {formatINR(Math.round(payment.amount), 2)}
                </Txt>
              </Row>
            </View>

            {!isVerified && (
              <>
                <Spacer size={12} />
                <Row gap={6} align="center" justify="center">
                  <Ionicons name="lock-closed" size={12} color={Colors.tertiary} />
                  <Txt variant="meta" weight="600" color={Colors.tertiary}>Receipt locked until owner approval.</Txt>
                </Row>
              </>
            )}
          </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    borderRadius: Radii.control,
    borderWidth: 1,
    padding: 10 },
  detailsCard: {
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  amountCard: {
    padding: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  idChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.badge,
    backgroundColor: Colors.surfaceMuted }, });
