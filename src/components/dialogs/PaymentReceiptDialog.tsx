/**
 * PaymentReceiptDialog — PGow digital receipt / invoice modal.
 *
 * Bug #1 fix (PDF Invoice Viewer Exit Trap):
 *   - The original modal had a single small close icon button tucked into the
 *     header row, no Android hardware-back wiring, and no tap-backdrop-to-dismiss.
 *     Residents who opened an invoice could not get out reliably — the modal
 *     ate every back press and the icon's tap-target was tiny.
 *
 *   - This rewrite adds THREE independent exit paths so no resident ever
 *     gets trapped again:
 *       (1) A sticky floating Close button in the top-right corner with a
 *           generous `hitSlop={16}` so it's tappable even with thumbs that
 *           miss the icon. It floats above the scroll content so it never
 *           scrolls out of view.
 *       (2) Android `BackHandler` wired in a `useEffect`. The handler is
 *           scoped to this modal — it's added on mount and removed on
 *           unmount so it doesn't leak into the rest of the app.
 *       (3) Tap-backdrop-to-dismiss. The outermost layer is a pressable
 *           scrim — tapping outside the receipt card calls `onDismiss`.
 *
 *   - Bottom action row uses two distinct buttons (Download PDF / Close) so
 *     the affordance is unambiguous. The "Done" close is a text button so the
 *     primary visual weight stays on Download.
 *
 * Cyber Mint migration:
 *   - Surface is now `Colors.surface` (white), text is `Colors.textPrimary`
 *     (slate-900), the verified state is teal-on-mint rather than the old
 *     dark emerald-on-black.
 */
import { useEffect } from 'react';
import {
  Modal, View, StyleSheet, ScrollView, Pressable, Linking, Platform, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { Colors, Layout } from '@/theme';
import { formatDateTime } from '@/utils/format';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { hapticSelect } from '@/utils/haptics';
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

export function PaymentReceiptDialog({
  payment,
  onDismiss,
  onDownload,
  downloadUrl,
  downloadLabel = 'Download PDF Invoice',
}: Props) {
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

  // ── Bug #1 fix, exit path (2): BackHandler ────────────────────────────────
  // Wires Android's hardware back button to `onDismiss`. The subscription is
  // tied to this component instance via useEffect's deps, so when the modal
  // closes (and the component unmounts), the handler is removed — preventing
  // any leakage into the rest of the app.
  useEffect(() => {
    const subscription = () => {
      hapticSelect();
      onDismiss();
      return true; // we handled it
    };
    if (Platform.OS === 'android') {
      // BackHandler is a normal cross-platform RN export (its iOS addEventListener is
      // simply a no-op), so this only needs the Platform check to skip subscribing at all
      // on iOS, not a dynamic import.
      const sub = BackHandler.addEventListener('hardwareBackPress', subscription);
      return () => sub.remove();
    }
  }, [onDismiss]);

  // ── Bug #1 fix, exit path (3): backdrop tap ───────────────────────────────
  // The outermost layer is a Pressable scrim. Tapping anywhere outside the
  // receipt card dismisses the modal. The card's onPress stops propagation
  // by being a non-pressable View (so taps on the card don't bubble up).
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Sticky floating close button — top-right, hitSlop 16, never scrolls away */}
        <View style={styles.stickyCloseWrap} pointerEvents="box-none">
          <IconBtn
            onPress={onDismiss}
            icon="close-circle"
            size={34}
            tint={Colors.textPrimary}
            containerColor={Colors.surface}
            borderRadius={999}
            padding={0}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            testID="receipt_close_btn"
          />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingVertical: 60, paddingHorizontal: 16 }}
          // Stop the scrollview's tap from bubbling to the backdrop Pressable.
          // Without this, every tap inside the receipt would also fire onDismiss.
          onStartShouldSetResponder={() => true}
        >
          <Pressable onPress={() => {/* swallow tap so it doesn't bubble */}}>
            <Card
              containerColor={Colors.surface}
              borderRadius={20}
              borderWidth={1.5}
              borderColor={isVerified ? Colors.primary : Colors.warning}
              padding={[20, 20]}
              style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}
            >
              {/* Receipt header */}
              <Row justify="space-between" align="center">
                <Row gap={8}>
                  <Ionicons name="receipt" size={28} color={isVerified ? Colors.primary : Colors.warning} />
                  <Col>
                    <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>PGOW DIGITAL RECEIPT</Txt>
                    <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>Official Co-Living Verified Tax Invoice</Txt>
                  </Col>
                </Row>
                {/* A second inline close icon for accessibility — redundant with the sticky
                    floating one but useful when the user is already looking at the header. */}
                <IconBtn
                  onPress={onDismiss}
                  icon="close"
                  size={20}
                  tint={Colors.textSecondary}
                  containerColor={Colors.surfaceMuted}
                  borderRadius={999}
                  padding={6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  testID="receipt_close_inline_btn"
                />
              </Row>

              <Spacer size={16} />
              {/* Status banner — verified / pending, with a clear colour + icon */}
              <View
                style={[
                  styles.statusBanner,
                  {
                    backgroundColor: isVerified ? Colors.surfaceElevated : Colors.alertGradientStart,
                    borderColor: isVerified ? Colors.primary : Colors.warning,
                  },
                ]}
              >
                <Row justify="space-between" align="center">
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="900" color={isVerified ? Colors.primary : Colors.tertiary}>
                      {isVerified ? 'STATUS: PAID & VERIFIED' : 'STATUS: VERIFICATION PENDING'}
                    </Txt>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {isVerified
                        ? `Receipt ID: ${payment.receiptId}`
                        : 'Slip unlocks automatically once the owner verifies your payment.'}
                    </Txt>
                  </Col>
                  <Ionicons
                    name={isVerified ? 'checkmark-circle' : 'time'}
                    size={26}
                    color={isVerified ? Colors.primary : Colors.warning}
                  />
                </Row>
              </View>

              <Spacer size={16} />
              {/* Invoice body */}
              <View style={styles.invoiceBox}>
                <Txt variant="labelSmall" color={Colors.primary} style={{ letterSpacing: 1 }}>
                  RESIDENT / PAYER DETAILS
                </Txt>
                <Spacer size={4} />
                <Txt variant="sectionTitle" color={Colors.textPrimary}>{payment.payerName}</Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  PG ID: {payment.pgId} • Resident ID: {payment.payerId}
                </Txt>

                <Spacer size={12} />
                <View style={{ height: 1, backgroundColor: Colors.borderMuted }} />
                <Spacer size={12} />

                <Txt variant="labelSmall" color={Colors.primary} style={{ letterSpacing: 1 }}>
                  BILLING & TRANSACTION SUMMARY
                </Txt>
                <Spacer size={8} />
                <Row justify="space-between">
                  <Txt variant="caption" color={Colors.textMuted}>Billing Period</Txt>
                  <Txt variant="caption" weight="700" color={Colors.textPrimary}>
                    {payment.monthYear || periodToMonthYear(currentPeriod(new Date(payment.timestamp || Date.now())))}
                  </Txt>
                </Row>
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt variant="caption" color={Colors.textMuted}>Payment Type</Txt>
                  <Txt variant="caption" color={Colors.textPrimary}>{payment.paymentType}</Txt>
                </Row>
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt variant="caption" color={Colors.textMuted}>Payment Mode</Txt>
                  <Txt variant="caption" weight="700" color={Colors.primary}>{modeLabel}</Txt>
                </Row>
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt variant="caption" color={Colors.textMuted}>Transaction Ref</Txt>
                  <Txt variant="caption" weight="700" color={Colors.textPrimary}>{payment.transactionRef}</Txt>
                </Row>
                {payment.utrRef ? (
                  <Row justify="space-between" style={{ marginTop: 6 }}>
                    <Txt variant="caption" color={Colors.textMuted}>12-Digit UTR Ref</Txt>
                    <Txt variant="caption" weight="700" color={Colors.tertiary}>{payment.utrRef}</Txt>
                  </Row>
                ) : null}
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Txt variant="caption" color={Colors.textMuted}>Date</Txt>
                  <Txt variant="caption" color={Colors.textPrimary}>{formatDateTime(payment.timestamp)}</Txt>
                </Row>
                {payment.verificationDate ? (
                  <Row justify="space-between" style={{ marginTop: 6 }}>
                    <Txt variant="caption" color={Colors.textMuted}>Verified Timestamp</Txt>
                    <Txt variant="caption" weight="700" color={Colors.primary}>
                      {formatDateTime(payment.verificationDate)}
                    </Txt>
                  </Row>
                ) : null}

                <Spacer size={12} />
                <View style={{ height: 1, backgroundColor: Colors.borderMuted }} />
                <Spacer size={12} />

                <Row justify="space-between" align="center">
                  <Txt size={13} weight="900" color={Colors.textPrimary}>TOTAL AMOUNT PAID</Txt>
                  <Txt variant="statValue" weight="900" color={Colors.primary}>
                    ₹{Math.round(payment.amount)}.00
                  </Txt>
                </Row>
              </View>

              <Spacer size={20} />
              {/* Bottom action row — distinct Download / Close affordances.
                  This is the bottom action row the spec asked for: the
                  primary visual weight goes on Download, with a clear Done
                  close so the user always has a way out at the bottom too. */}
              <Row gap={10}>
                {isVerified ? (
                  <Btn
                    onPress={handleDownload}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={Layout.borderRadiusButton}
                    height={48}
                    style={{ flex: 1 }}
                    testID="download_pdf_invoice_btn"
                  >
                    <Ionicons name="download" size={18} color={Colors.textInverse} />
                    <Txt variant="cardTitle" weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>
                      {downloadLabel}
                    </Txt>
                  </Btn>
                ) : (
                  <OutlinedBtn
                    onPress={onDismiss}
                    borderColor={Colors.warning}
                    textColor={Colors.tertiary}
                    borderRadius={Layout.borderRadiusButton}
                    height={48}
                    style={{ flex: 1 }}
                    testID="receipt_locked_close_btn"
                  >
                    <Ionicons name="lock-closed" size={16} color={Colors.tertiary} />
                    <Txt variant="body" weight="700" color={Colors.tertiary} style={{ marginLeft: 6 }}>
                      Close (Receipt Locked Until Owner Approval)
                    </Txt>
                  </OutlinedBtn>
                )}
                <OutlinedBtn
                  onPress={onDismiss}
                  borderColor={Colors.borderMuted}
                  textColor={Colors.textSecondary}
                  borderRadius={Layout.borderRadiusButton}
                  height={48}
                  testID="receipt_done_btn"
                >
                  <Txt variant="body" weight="700" color={Colors.textSecondary}>Done</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Backdrop — slate-900 scrim, taps dismiss the modal (see Pressable above).
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
  },
  // Sticky floating Close button — absolute-positioned at the top-right of
  // the modal viewport, sits above the scroll content, never scrolls away.
  stickyCloseWrap: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
  },
  statusBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  invoiceBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    padding: 16,
  },
});
