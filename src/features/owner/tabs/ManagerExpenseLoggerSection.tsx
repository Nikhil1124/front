/**
 * ManagerExpenseLoggerSection — port of Kotlin `ManagerExpenseLoggerSection`.
 * showMode: 0=balance sheet only, 1=logger only, 2=both.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { OwnerFinancialSummaryChartCard } from '@/components/charts/OwnerFinancialSummaryChartCard';
import { FormScroll } from '@/components/ui/FormScroll';

const CATEGORIES = ['Staff Salary', 'Daily Mess Groceries', 'Utility Bills', 'Maintenance & Repairs', 'Wi-Fi & Internet', 'Other Operations'];

interface Props {
  showMode?: number;
}

export function ManagerExpenseLoggerSection({ showMode = 2 }: Props) {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const isManager = usePGowStore((s) => s.isManagerMode);
  const expenses = usePGowStore((s) => s.currentExpenses);
  const payments = usePGowStore((s) => s.currentPayments);
  const logExpense = usePGowStore((s) => s.logExpense);
  const deleteExpense = usePGowStore((s) => s.deleteExpense);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Staff Salary');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState('All');

  const verifiedRevenue = payments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const totalSalaries = expenses.filter((e) => e.category === 'Staff Salary').reduce((s, e) => s + e.amount, 0);
  const totalUtility = expenses.filter((e) => e.category === 'Utility Bills').reduce((s, e) => s + e.amount, 0);
  const totalGroceries = expenses.filter((e) => e.category === 'Daily Mess Groceries').reduce((s, e) => s + e.amount, 0);
  const totalMaintenance = expenses.filter((e) => e.category === 'Maintenance & Repairs').reduce((s, e) => s + e.amount, 0);
  const totalWifi = expenses.filter((e) => e.category === 'Wi-Fi & Internet' || e.category === 'Other Operations').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netRevenue = verifiedRevenue - totalExpenses;

  const handleSubmit = async () => {
    const amt = parseFloat(expenseAmount) || 0;
    if (!expenseTitle.trim() && !recipientName.trim()) {
      Alert.alert('Validation', 'Please enter an expense title or recipient name.');
      return;
    }
    if (amt <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    setIsSubmitting(true);
    const result = await logExpense(expenseTitle, expenseCategory, amt, recipientName, paymentMode, notes);
    setIsSubmitting(false);
    if (result.ok) {
      Alert.alert('Success', '✅ Expense entry logged.');
      setExpenseTitle(''); setExpenseAmount(''); setRecipientName(''); setNotes('');
    } else {
      Alert.alert('Failed', result.error ?? 'Unknown');
    }
  };

  const filtered = filter === 'All' ? expenses : expenses.filter((e) => e.category === filter);

  return (
    <View testID="manager_expense_logger_card">
      {(showMode === 0 || showMode === 2) && (
        <>
          <Row justify="space-between" align="center">
            <Col style={{ flex: 1 }}>
              <Row gap={6} align="center">
                <Ionicons name="receipt" size={18} color={Colors.primary} />
                <Txt size={13} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 0.5 }}>
                  EXPENSES & BALANCE SHEET
                </Txt>
              </Row>
              <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 2 }}>
                {isManager ? `Logged by Branch Manager: ${owner?.managerName ?? 'Manager'}` : 'Property Financial Audit & Balance Sheet'}
              </Txt>
            </Col>
          </Row>
          <Spacer size={14} />
          <OwnerFinancialSummaryChartCard />

          {/* Balance Sheet */}
          <Card
            containerColor={Colors.surfaceElevated}
            borderRadius={16}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[14, 14]}
            style={{ marginTop: 14 }}
          >
            <Row justify="space-between" align="center">
              <Txt size={11} weight="900" color={Colors.textPrimary}>📊 COMPLETE BALANCE SHEET</Txt>
              <View style={[styles.profitPill, { backgroundColor: netRevenue >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                <Txt variant="labelSmall" weight="800" color={netRevenue >= 0 ? '#047857' : '#B91C1C'}>
                  {netRevenue >= 0 ? 'PROFITABLE' : 'DEFICIT'}
                </Txt>
              </View>
            </Row>
            <Spacer size={10} />
            <Row justify="space-between" align="center">
              <Row gap={6} align="center">
                <Ionicons name="trending-up" size={14} color="#16A34A" />
                <Txt variant="caption" weight="700" color={Colors.textPrimary}>1. Total Verified Collections</Txt>
              </Row>
              <Txt size={12} weight="900" color="#16A34A">₹{Math.round(verifiedRevenue).toLocaleString('en-IN')}</Txt>
            </Row>
            <Spacer size={6} /><View style={{ height: 1, backgroundColor: Colors.borderSubtle }} /><Spacer size={6} />
            <Txt variant="labelSmall" weight="800" color={Colors.textMuted}>2. Expenses & Outflows Breakdown:</Txt>
            <Spacer size={4} />
            <Row justify="space-between"><Txt variant="caption" color={Colors.textSecondary}>   • 👷 Staff Salaries</Txt><Txt variant="caption" weight="700" color="#B45309">₹{Math.round(totalSalaries).toLocaleString('en-IN')}</Txt></Row>
            <Row justify="space-between"><Txt variant="caption" color={Colors.textSecondary}>   • ⚡ Utility Bills (Power/Water)</Txt><Txt variant="caption" weight="700" color="#4338CA">₹{Math.round(totalUtility).toLocaleString('en-IN')}</Txt></Row>
            <Row justify="space-between"><Txt variant="caption" color={Colors.textSecondary}>   • 🛒 Mess Groceries & Food</Txt><Txt variant="caption" weight="700" color="#166534">₹{Math.round(totalGroceries).toLocaleString('en-IN')}</Txt></Row>
            <Row justify="space-between"><Txt variant="caption" color={Colors.textSecondary}>   • 🛠️ Maintenance & Repairs</Txt><Txt variant="caption" weight="700" color="#BE185D">₹{Math.round(totalMaintenance).toLocaleString('en-IN')}</Txt></Row>
            <Row justify="space-between"><Txt variant="caption" color={Colors.textSecondary}>   • 📶 Wi-Fi & Other Operations</Txt><Txt variant="caption" weight="700" color={Colors.textPrimary}>₹{Math.round(totalWifi).toLocaleString('en-IN')}</Txt></Row>
            <Spacer size={4} />
            <Row justify="space-between"><Txt variant="caption" weight="800" color={Colors.textPrimary}>   Total All Expenses & Outflows:</Txt><Txt size={12} weight="900" color="#B91C1C">₹{Math.round(totalExpenses).toLocaleString('en-IN')}</Txt></Row>
            <Spacer size={8} /><View style={{ height: 1, backgroundColor: Colors.borderSubtle }} /><Spacer size={8} />
            <View style={[styles.netBox, { backgroundColor: netRevenue >= 0 ? '#F0FDF4' : '#FEF2F2', borderColor: netRevenue >= 0 ? '#86EFAC' : '#FCA5A5', borderWidth: 1 }]}>
              <Row justify="space-between" align="center">
                <Col>
                  <Txt size={11} weight="900" color={netRevenue >= 0 ? '#166534' : '#991B1B'}>NET PROFIT</Txt>
                </Col>
                <Txt variant="sectionTitle" weight="900" color={netRevenue >= 0 ? '#16A34A' : '#DC2626'}>
                  ₹{Math.round(netRevenue).toLocaleString('en-IN')}
                </Txt>
              </Row>
            </View>
          </Card>
        </>
      )}

      {(showMode === 1 || showMode === 2) && (
        <>
          {showMode === 2 && <Spacer size={16} />}

          {/* Form is only shown to Managers who record the daily logs */}
          {isManager ? (
            <>
              <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>➕ Log Daily Expense or Staff Salary</Txt>
              <Spacer size={8} />
              <Txt variant="labelSmall" weight="800" color={Colors.textMuted}>Quick Presets:</Txt>
              <Spacer size={4} />
              <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Chip label="👨‍🍳 Chef Salary ₹15k" selected={false} onPress={() => { setExpenseTitle('Chef Monthly Salary - Ramesh'); setExpenseCategory('Staff Salary'); setExpenseAmount('15000'); setRecipientName('Ramesh Kumar (Head Cook)'); setPaymentMode('Bank Transfer'); setNotes('Monthly salary paid for July 2026'); }} />
                <Chip label="🛒 Mess Grocery ₹2.4k" selected={false} onPress={() => { setExpenseTitle('Daily Mess Grocery Procurement'); setExpenseCategory('Daily Mess Groceries'); setExpenseAmount('2450'); setRecipientName('Local Wholesale Mart'); setPaymentMode('UPI'); setNotes('Milk, Eggs, Rice, Vegetables for daily mess'); }} />
                <Chip label="⚡ Electricity Bill ₹6.8k" selected={false} onPress={() => { setExpenseTitle('PG Electricity & Power Bill'); setExpenseCategory('Utility Bills'); setExpenseAmount('6800'); setRecipientName('State Electricity Board'); setPaymentMode('UPI'); setNotes('Monthly power bill & generator diesel'); }} />
              </FormScroll>
              <Spacer size={10} />
              <Txt variant="caption" weight="800" color={Colors.textMuted}>Category:</Txt>
              <Spacer size={4} />
              <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Chip label="All" selected={filter === 'All'} onPress={() => setFilter('All')} />
                {CATEGORIES.map((cat) => (
                  <Chip key={cat} label={cat} selected={expenseCategory === cat} onPress={() => setExpenseCategory(cat)} />
                ))}
              </FormScroll>
              <Spacer size={10} />
              <OutlinedTextField label="Expense Title / Purpose" placeholder="Cook Salary, Vegetables, Plumbing Parts" value={expenseTitle} onChangeText={setExpenseTitle} containerColor={Colors.surfaceMuted} style={{ marginBottom: 8 }} />
              <Row gap={8}>
                <OutlinedTextField label="Amount (₹)" placeholder="5000" value={expenseAmount} onChangeText={(v) => setExpenseAmount(v.replace(/[^\d.]/g, ''))} keyboardType="number-pad" containerColor={Colors.surfaceMuted} style={{ flex: 1 }} />
                <OutlinedTextField label="Payee / Staff / Vendor" placeholder="Ramesh (Cook)" value={recipientName} onChangeText={setRecipientName} containerColor={Colors.surfaceMuted} style={{ flex: 1 }} />
              </Row>
              <Spacer size={8} />
              <Row gap={6} align="center">
                <Txt variant="caption" weight="800" color={Colors.textMuted}>Mode:</Txt>
                {['UPI', 'Cash Handover', 'Bank Transfer'].map((mode) => (
                  <Chip key={mode} label={mode} selected={paymentMode === mode} onPress={() => setPaymentMode(mode)} />
                ))}
              </Row>
              <Spacer size={8} />
              <OutlinedTextField label="Notes / Receipt Ref (Optional)" placeholder="UTR Ref / Bill copy details" value={notes} onChangeText={setNotes} containerColor={Colors.surfaceMuted} style={{ marginBottom: 12 }} />
              <Btn
                onPress={handleSubmit}
                disabled={isSubmitting || !expenseAmount.trim()}
                loading={isSubmitting}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={12}
                height={44}
                testID="submit_expense_log_button"
              >
                <Ionicons name="cloud-upload" size={16} color={Colors.textInverse} />
                <Txt variant="body" weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>{isSubmitting ? 'Saving…' : 'Log Expense Entry'}</Txt>
              </Btn>
              <Spacer size={18} />
            </>
          ) : null}

          {/* Logged Outflows Transactions Ledger */}
          <Row justify="space-between" align="center">
            <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>💸 Logged Outflow Transactions ({expenses.length})</Txt>
            <View style={styles.totalPill}>
              <Txt variant="labelSmall" weight="800" color="#B91C1C">Outflow: -₹{Math.round(totalExpenses).toLocaleString('en-IN')}</Txt>
            </View>
          </Row>
          <Spacer size={8} />
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {['All', ...CATEGORIES].map((cat) => (
              <Chip key={cat} label={cat} selected={filter === cat} onPress={() => setFilter(cat)} />
            ))}
          </FormScroll>
          <Spacer size={10} />

          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
              <Txt variant="caption" weight="700" color={Colors.textMuted}>No expense outflow transactions logged yet.</Txt>
            </View>
          ) : (
            filtered.map((e) => (
              <Card key={e.id} containerColor={Colors.surface} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]} style={{ marginTop: 8 }}>
                <Row justify="space-between" align="center">
                  <Row gap={10} style={{ flex: 1 }} align="center">
                    <View style={[styles.catIcon, { backgroundColor: '#FEF2F2' }]}>
                      <Ionicons name={categoryIcon(e.category)} size={18} color="#DC2626" />
                    </View>
                    <Col style={{ flex: 1 }}>
                      <Row align="center" gap={6}>
                        <Txt variant="body" weight="800" color={Colors.textPrimary}>{e.title}</Txt>
                        <View style={styles.catPill}><Txt variant="labelSmall" color={Colors.primaryDark}>{e.category}</Txt></View>
                      </Row>
                      {e.recipientName ? <Txt variant="caption" weight="600" color={Colors.textSecondary}>Payee: {e.recipientName}</Txt> : null}
                      <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>Logged by {e.loggedByRole} {e.loggedByName} • {e.paymentMode}</Txt>
                      {e.notes ? <Txt size={9} color={Colors.textMuted} numberOfLines={1}>{e.notes}</Txt> : null}
                    </Col>
                  </Row>
                  <Col align="flex-end">
                    <Txt variant="cardTitle" weight="900" color="#DC2626">-₹{Math.round(e.amount).toLocaleString('en-IN')}</Txt>
                    {isManager && (
                      <IconBtn onPress={() => deleteExpense(e)} icon="trash-outline" size={16} tint="#EF4444" containerColor="transparent" />
                    )}
                  </Col>
                </Row>
              </Card>
            ))
          )}
        </>
      )}
    </View>
  );
}

function categoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  switch (cat) {
    case 'Staff Salary': return 'ribbon';
    case 'Daily Mess Groceries': return 'cart';
    case 'Utility Bills': return 'flash';
    case 'Maintenance & Repairs': return 'build';
    default: return 'receipt';
  }
}

const styles = StyleSheet.create({
  profitPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  netBox: { borderRadius: 12, padding: 12 },
  totalPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F0FDF9', borderWidth: 1, borderColor: '#CCFBF1' },
  emptyBox: {
    backgroundColor: Colors.surfaceMuted, borderRadius: 12,
    padding: 20, alignItems: 'center', gap: 6,
  },
  catIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  catPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F0FDF9' },
});
