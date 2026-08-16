/**
 * OwnerPaymentsTab — port of Kotlin `OwnerPaymentsTab`.
 * 3 sub-tabs: Balance Sheet / Expenses / Collections.
 * UPI configuration lives in UpiConfigSection (dashboard quick action + Settings tab).
 */
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hapticSelect } from '@/utils/haptics';
import { ManagerExpenseLoggerSection } from './ManagerExpenseLoggerSection';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import type { PaymentEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

const SUB_TABS = ['📊 Balance Sheet', '💸 Expenses', '🧾 Collections'];

export function OwnerPaymentsTab() {
  const [subTab, setSubTab] = useState(0);
  const payments = usePGowStore((s) => s.currentPayments);
  const { refreshing, onRefresh } = usePullToRefresh();
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {selectedReceipt && (
        <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />
      )}

      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        {SUB_TABS.map((label, idx) => {
          const sel = subTab === idx;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => { hapticSelect(); setSubTab(idx); }}
              style={[styles.subTab, { backgroundColor: sel ? Colors.primary : 'transparent' }]}
            >
              <Txt size={11} weight={sel ? '800' : '600'} color={sel ? Colors.textInverse : Colors.textMuted}>
                {label}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>

      <FormScroll
        contentContainerStyle={{ paddingTop: 12, gap: 14, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {subTab === 0 && <ManagerExpenseLoggerSection showMode={0} />}
        {subTab === 1 && <ManagerExpenseLoggerSection showMode={1} />}

        {subTab === 2 && (
          <>
            {/* Header with Total Verified Collections */}
            <Row justify="space-between" align="center">
              <Col style={{ flex: 1 }}>
                <Txt size={16} weight="900" color={Colors.textPrimary}>Verified Collections Ledger</Txt>
                <Txt size={11} color={Colors.textMuted}>
                  {payments.filter((p) => p.status === 'VERIFIED').length} Verified Receipts Recorded
                </Txt>
              </Col>
              <View style={styles.verifiedTotalPill}>
                <Txt size={11} weight="900" color="#166534">
                  Total: +₹{payments.filter((p) => p.status === 'VERIFIED').reduce((sum, p) => sum + Math.round(p.amount), 0).toLocaleString('en-IN')}
                </Txt>
              </View>
            </Row>

            <Spacer size={4} />

            <OutlinedTextField
              placeholder="Search by Resident Name, Room, ID, or UTR"
              value={searchQuery}
              onChangeText={setSearchQuery}
              leadingIcon="search"
              containerColor={Colors.surfaceMuted}
              style={{ marginBottom: 4 }}
            />

            {/* Sequential Verified Payments List */}
            {(() => {
              const verifiedList = payments
                .filter((p) => p.status === 'VERIFIED')
                .filter((p) =>
                  !searchQuery.trim() ||
                  p.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (p.utrRef && p.utrRef.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  String(p.id).includes(searchQuery) ||
                  String(p.payerId).includes(searchQuery)
                );

              if (verifiedList.length === 0) {
                return (
                  <EmptyState
                    icon="receipt-outline"
                    title="No verified collections found"
                    subtitle="Verified rent collections and subscriber payments will appear here in chronological sequence."
                    accent={Colors.primary}
                  />
                );
              }

              return verifiedList.map((p) => (
                <AnimatedPress
                  key={p.id}
                  scale={0.985}
                  hapticPattern="light"
                  onPress={() => { hapticSelect(); setSelectedReceipt(p); }}
                >
                  <Card
                    containerColor={Colors.surface}
                    borderRadius={16}
                    borderWidth={1}
                    borderColor="#A7F3D0"
                    padding={[14, 14]}
                  >
                    <Row justify="space-between" align="center">
                      <Row gap={10} style={{ flex: 1 }} align="center">
                        <View style={[styles.receiptIcon, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons
                            name={p.paymentType === 'OWNER_SUBSCRIPTION' ? 'ribbon' : 'checkmark-circle'}
                            size={20}
                            color="#059669"
                          />
                        </View>
                        <Col style={{ flex: 1 }}>
                          <Row align="center" gap={6}>
                            <Txt size={14} weight="800" color={Colors.textPrimary}>{p.payerName}</Txt>
                            <View style={styles.verifiedBadge}>
                              <Txt size={9} weight="800" color="#047857">VERIFIED ✓</Txt>
                            </View>
                          </Row>
                          <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>
                            {p.paymentType} • Mode: {p.paymentMode.replace(/_/g, ' ')}
                          </Txt>
                          {p.utrRef ? (
                            <Txt size={10} weight="700" color="#047857">UTR: {p.utrRef}</Txt>
                          ) : null}
                          <Txt size={9} color={Colors.textMuted}>Tap to view digital tax invoice ({p.receiptId})</Txt>
                        </Col>
                      </Row>
                      <Col align="flex-end">
                        <Txt size={16} weight="900" color="#16A34A">
                          +₹{Math.round(p.amount).toLocaleString('en-IN')}
                        </Txt>
                        <Txt size={9} color={Colors.textMuted} style={{ marginTop: 2 }}>
                          {new Date(p.timestamp || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Txt>
                      </Col>
                    </Row>
                  </Card>
                </AnimatedPress>
              ));
            })()}
          </>
        )}

      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 4,
    gap: 4,
  },
  subTab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F0FDF9',
  },
  billPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  breakdownBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  receiptIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  verifiedTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
});
