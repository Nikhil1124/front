/**
 * PaymentReceiptDialog — PGow digital receipt / invoice modal.
 * Designed as a clean bottom-sheet receipt viewer with optimized hierarchy and layout.
 */
import { useEffect } from 'react';
import {
  Modal, View, StyleSheet, ScrollView, Pressable, Linking, Platform, BackHandler, Alert, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { Colors, Layout } from '@/theme';
import { formatDateTime } from '@/utils/format';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { hapticSelect } from '@/utils/haptics';
import { usePGowStore } from '@/store/usePGowStore';
import type { PaymentEntity } from '@/types';

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
}: Props) {
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
      hapticSelect();
      onDismiss();
      return true; // we handled it
    };
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', subscription);
      return () => sub.remove();
    }
  }, [onDismiss]);

  const handleDownload = () => {
    hapticSelect();
    if (onDownload) {
      onDownload();
      return;
    }
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(() => {/* swallow — no-op */});
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <Row justify="space-between" align="center" style={styles.header}>
            <Row gap={8} align="center">
              <Ionicons name="receipt" size={24} color={isVerified ? Colors.success : Colors.warning} />
              <Col>
                <Txt size={15} weight="900" color={Colors.textPrimary}>PGOW Digital Receipt</Txt>
                <Txt size={11} color={Colors.textMuted}>Official Co-Living Verified Tax Invoice</Txt>
              </Col>
            </Row>
            <IconBtn
              onPress={onDismiss}
              icon="close"
              size={18}
              tint={Colors.textSecondary}
              containerColor={Colors.surfaceMuted}
              borderRadius={999}
              padding={6}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              testID="receipt_header_close_btn"
            />
          </Row>

          {/* Scrollable Content inside Bottom Sheet */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Status banner — compact card directly below header */}
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: isVerified ? Colors.surfaceElevated : Colors.alertGradientStart,
                  borderColor: isVerified ? Colors.success : Colors.warning,
                },
              ]}
            >
              <Row gap={8} align="center">
                <Ionicons
                  name={isVerified ? 'checkmark-circle' : 'time'}
                  size={20}
                  color={isVerified ? Colors.success : Colors.warning}
                />
                <Col style={{ flex: 1 }}>
                  <Txt size={12} weight="900" color={isVerified ? Colors.success : Colors.tertiary}>
                    {isVerified ? 'STATUS: PAID & VERIFIED' : 'STATUS: VERIFICATION PENDING'}
                  </Txt>
                  <Txt size={10} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    {isVerified
                      ? `Receipt ID: ${payment.receiptId}`
                      : 'Slip unlocks automatically once the owner verifies your payment.'}
                  </Txt>
                </Col>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Resident details */}
            <View style={styles.detailsCard}>
              <Txt size={10} weight="800" color={Colors.primary} style={{ letterSpacing: 0.5 }}>RESIDENT</Txt>
              <Spacer size={4} />
              <Txt size={15} weight="900" color={Colors.textPrimary}>{payment.payerName || 'Resident'}</Txt>
              {roomNo ? (
                <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                  Room {roomNo}
                </Txt>
              ) : null}
              <Spacer size={6} />
              <Row gap={8} style={{ marginTop: 2 }}>
                <TouchableOpacity onPress={() => { Clipboard.setStringAsync(payment.pgId); Alert.alert('Copied', 'PG ID copied to clipboard.'); }} style={styles.idChip}>
                  <Txt size={9} color={Colors.textMuted}>PG ID: {payment.pgId.slice(0, 8)}...</Txt>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Clipboard.setStringAsync(payment.payerId); Alert.alert('Copied', 'Resident ID copied to clipboard.'); }} style={styles.idChip}>
                  <Txt size={9} color={Colors.textMuted}>Res ID: {payment.payerId.slice(0, 8)}...</Txt>
                </TouchableOpacity>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Billing & Transaction Summary */}
            <View style={styles.detailsCard}>
              <Txt size={10} weight="800" color={Colors.primary} style={{ letterSpacing: 0.5 }}>BILLING & TRANSACTION SUMMARY</Txt>
              <Spacer size={8} />
              <Row justify="space-between">
                <Txt size={11} color={Colors.textMuted}>Billing Period</Txt>
                <Txt size={11} weight="700" color={Colors.textPrimary}>
                  {payment.monthYear || periodToMonthYear(currentPeriod(new Date(payment.timestamp || Date.now())))}
                </Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt size={11} color={Colors.textMuted}>Payment Type</Txt>
                <Txt size={11} weight="700" color={Colors.textPrimary}>{formatPaymentType(payment.paymentType)}</Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt size={11} color={Colors.textMuted}>Payment Mode</Txt>
                <Txt size={11} weight="700" color={Colors.textPrimary}>{modeLabel}</Txt>
              </Row>
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt size={11} color={Colors.textMuted}>Transaction Ref</Txt>
                <Txt size={11} weight="700" color={Colors.textPrimary}>{payment.transactionRef || '—'}</Txt>
              </Row>
              {payment.utrRef ? (
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt size={11} color={Colors.textMuted}>12-Digit UTR Ref</Txt>
                  <Txt size={11} weight="700" color={Colors.tertiary}>{payment.utrRef}</Txt>
                </Row>
              ) : null}
              <Row justify="space-between" style={{ marginTop: 6 }}>
                <Txt size={11} color={Colors.textMuted}>Date & Time</Txt>
                <Txt size={11} color={Colors.textPrimary}>{formatDateTime(payment.timestamp)}</Txt>
              </Row>
            </View>

            <Spacer size={12} />
            {/* Total Amount Paid Section */}
            <View style={styles.amountCard}>
              <Row justify="space-between" align="center">
                <Txt size={11} weight="800" color={Colors.textSecondary}>TOTAL AMOUNT PAID</Txt>
                <Txt size={22} weight="900" color={Colors.primary}>
                  ₹{Math.round(payment.amount)}.00
                </Txt>
              </Row>
            </View>

            {!isVerified && (
              <>
                <Spacer size={12} />
                <Row gap={6} align="center" justify="center">
                  <Ionicons name="lock-closed" size={12} color={Colors.tertiary} />
                  <Txt size={11} weight="700" color={Colors.tertiary}>Receipt locked until owner approval.</Txt>
                </Row>
              </>
            )}
          </ScrollView>

          {/* Footer Action Bar */}
          <View style={styles.footer}>
            <Row gap={10}>
              {isVerified && (
                <Btn
                  onPress={handleDownload}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Layout.borderRadiusButton}
                  height={42}
                  style={{ flex: 1 }}
                  testID="download_pdf_invoice_btn"
                >
                  <Ionicons name="download" size={14} color={Colors.textInverse} />
                  <Txt size={12} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>
                    {downloadLabel}
                  </Txt>
                </Btn>
              )}
              <OutlinedBtn
                onPress={onDismiss}
                borderColor={Colors.borderMuted}
                textColor={Colors.textSecondary}
                borderRadius={Layout.borderRadiusButton}
                height={42}
                style={isVerified ? undefined : { flex: 1 }}
                testID="receipt_done_btn"
              >
                <Txt size={12} weight="700" color={Colors.textSecondary}>Done</Txt>
              </OutlinedBtn>
            </Row>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 24,
  },
  statusBanner: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  detailsCard: {
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  amountCard: {
    padding: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  idChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceMuted,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
});
