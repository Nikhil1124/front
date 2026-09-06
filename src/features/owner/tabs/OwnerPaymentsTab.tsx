import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  FlatList,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { TextPromptDialog } from '@/components/dialogs/TextPromptDialog';
import { formatINR, formatDateTime } from '@/utils/format';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors, Palette } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { EmptyState } from '@/components/EmptyState';
import type { PaymentEntity, ExpenseEntity, GuestEntity } from '@/types';
import { useAllPaymentsQuery, useVerifyPaymentMutation, useRejectPaymentMutation } from '@/features/payments/usePayments';
import { useAllExpensesQuery, useLogExpenseMutation, useReverseExpenseMutation, type ExpenseCategory, type ExpenseMethod } from '@/features/expenses/useExpenses';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useActiveProperty } from '@/features/properties/useProperties';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Btn, Card, ChoiceChips, Col, ListRow, Row, SearchField, Sheet, Spacer, Txt, toneFor } from '@/components/ui';

const GREEN = Colors.primary;        // Deep Ocean Blue brand primary
const BG = Colors.canvas;            // Light Ice Canvas BG
const CHARCOAL = Colors.textPrimary; // Obsidian Navy primary text
const MUTED = Colors.textMuted;      // Ocean Muted text
const BORDER = Colors.borderSubtle;  // Ice Cyan subtle border
const WHITE = Colors.surface;        // Pure White surface
const LIGHT_GREEN = Colors.surfaceElevated; // Soft Ice Cyan active tint
const RADIUS = 22;            // Premium rounded corner radius

/** The three ways a PG actually pays an expense — matches `ExpenseMethod` on the server. */
const EXPENSE_MODES = ['UPI', 'Cash', 'Bank Transfer'];

const EXPENSE_CATEGORIES = [
  'Staff Salary',
  'Utility Bills',
  'Daily Mess Groceries',
  'Maintenance & Repairs',
  'Wi-Fi & Internet',
  'Other Operations',
];

function getPast12Months() {
  const months = [];
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) });
  }
  return months;
}

export function OwnerPaymentsTab() {
  const dockScroll = useDockScroll();
  const { activeEntity: owner } = useActiveProperty();
  const [subTab, setSubTab] = useState(0); // 0: Balance Sheet, 1: Expenses, 2: Collections
  const [period, setPeriod] = useState<'month' | '3m' | '6m' | '1y' | 'custom'>('month');
  
  // Custom Date Range Picker states
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const activePgId = useAuthStore((s) => s.activePgId);
  // Balance Sheet sums and buckets this whole list across periods up to 1 year — the capped,
  // single-page queries silently undercounted for any property with more payments/expenses
  // than one page (see useAllPaymentsQuery's comment).
  const { data: payments = [], isLoading: paymentsLoading, error: paymentsError } = useAllPaymentsQuery(activePgId ?? undefined);
  const { data: expenses = [], isLoading: expensesLoading, error: expensesError } = useAllExpensesQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const logExpenseMutation = useLogExpenseMutation(activePgId ?? undefined);
  const reverseExpenseMutation = useReverseExpenseMutation(activePgId ?? undefined);

  // Verify/reject: the backend endpoints (`POST /v1/payments/{id}/verify` and `/reject`)
  // and the mutation hooks for them already existed — nothing in any screen called them.
  // A resident could submit a payment and there was no button anywhere for an owner or
  // manager to approve or reject it.
  const verifyPayment = useVerifyPaymentMutation(activePgId ?? undefined);
  const rejectPayment = useRejectPaymentMutation(activePgId ?? undefined);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentEntity | null>(null);

  const handleVerifyPayment = async (p: PaymentEntity) => {
    try {
      await verifyPayment.mutateAsync(p.id);
      } catch (err) {
      Alert.alert('Could not verify', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleRejectPayment = async (reason: string) => {
    if (!rejectingPayment) return;
    try {
      await rejectPayment.mutateAsync({ paymentId: rejectingPayment.id, reason });
      setRejectingPayment(null);
    } catch (err) {
      Alert.alert('Could not reject', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const getPayerRoom = (payerId: string) => {
    const g = guests.find((x) => x.id === payerId);
    return g ? g.roomNo : '—';
  };

  const { refreshing, onRefresh } = usePullToRefresh();
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentEntity | null>(null);
  // Reversing an expense is destructive and irreversible. It used to be a 14px trash icon
  // inside the row, one thumb-slip from the row's own tap target; it now lives behind the
  // row, in the sheet that shows what is about to be reversed.
  const [detailExpense, setDetailExpense] = useState<ExpenseEntity | null>(null);

  // Log expense form states
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseErrors, setExpenseErrors] = useState<{ title?: string; amount?: string }>({});
  const [expenseCategory, setExpenseCategory] = useState('Staff Salary');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Date filter logic
  const filteredData = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (period === '3m') {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = now;
    } else if (period === '6m') {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = now;
    } else if (period === '1y') {
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      end = now;
    } else if (period === 'custom') {
      start = customStart || new Date(2000, 0, 1);
      end = customEnd || now;
    }

    const filteredPayments = payments.filter((p) => {
      const d = p.timestamp ? new Date(p.timestamp) : new Date();
      return d >= start && d <= end;
    });

    const filteredExpenses = expenses.filter((e) => {
      const d = e.dateLogged ? new Date(e.dateLogged) : new Date();
      return d >= start && d <= end;
    });

    return { filteredPayments, filteredExpenses, start, end };
  }, [period, customStart, customEnd, payments, expenses]);

  const { filteredPayments, filteredExpenses } = filteredData;

  // 2. Calculations
  const verifiedRevenue = useMemo(() => {
    return filteredPayments.filter((p) => p.status === 'VERIFIED').reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const totalOutflows = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const netProfit = verifiedRevenue - totalOutflows;
  const profitMargin = verifiedRevenue > 0 ? (netProfit / verifiedRevenue) * 100 : 0;

  // 3. Outstanding logic (all time or filtered? outstanding is usually all pending invoices)
  const outstandingPayments = useMemo(() => {
    return payments.filter((p) => p.status !== 'VERIFIED');
  }, [payments]);

  const outstandingTotal = useMemo(() => {
    return outstandingPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [outstandingPayments]);

  // 4. Status Strip Message
  const statusStrip = useMemo(() => {
    if (verifiedRevenue === 0 && totalOutflows === 0) {
      return 'No financial activity for this period';
    }
    if (totalOutflows > verifiedRevenue) {
      return 'Expenses exceed collections';
    }
    if (profitMargin > 0) {
      return `Healthy margin · ${profitMargin.toFixed(1)}%`;
    }
    return 'No financial activity recorded';
  }, [verifiedRevenue, totalOutflows, profitMargin]);

  // 5. Expense Breakdown Categories
  const expenseBreakdown = useMemo(() => {
    const totalStaff = filteredExpenses.filter((e) => e.category === 'Staff Salary').reduce((s, e) => s + e.amount, 0);
    const totalUtility = filteredExpenses.filter((e) => e.category === 'Utility Bills').reduce((s, e) => s + e.amount, 0);
    const totalGroceries = filteredExpenses.filter((e) => e.category === 'Daily Mess Groceries').reduce((s, e) => s + e.amount, 0);
    const totalMaintenance = filteredExpenses.filter((e) => e.category === 'Maintenance & Repairs').reduce((s, e) => s + e.amount, 0);
    const totalWifi = filteredExpenses.filter((e) => e.category === 'Wi-Fi & Internet' || e.category === 'Other Operations').reduce((s, e) => s + e.amount, 0);
    const totalOther = filteredExpenses.filter((e) => !EXPENSE_CATEGORIES.includes(e.category)).reduce((s, e) => s + e.amount, 0);

    const breakdown = [
      { name: 'Staff Salaries', amount: totalStaff, icon: 'people-outline' },
      { name: 'Utilities', amount: totalUtility, icon: 'flash-outline' },
      { name: 'Groceries & Food', amount: totalGroceries, icon: 'cart-outline' },
      { name: 'Maintenance & Repairs', amount: totalMaintenance, icon: 'build-outline' },
      { name: 'Internet & Operations', amount: totalWifi, icon: 'wifi-outline' },
      { name: 'Other', amount: totalOther, icon: 'folder-open-outline' },
    ];

    return breakdown.map((item) => {
      const percentage = totalOutflows > 0 ? (item.amount / totalOutflows) * 100 : 0;
      return { ...item, percentage };
    });
  }, [filteredExpenses, totalOutflows]);

  // 6. Expenses Tab Filtering
  const displayedExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => {
      const matchesSearch =
        !searchQuery.trim() ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.recipientName && e.recipientName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [filteredExpenses, searchQuery, categoryFilter]);

  // 7. Collections Tab Filtering
  const displayedCollections = useMemo(() => {
    return filteredPayments.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.utrRef && p.utrRef.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === 'All' ||
        p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [filteredPayments, searchQuery, statusFilter]);

  // The UI's free-text labels, in the values the API's CHECK constraints accept.
  const EXPENSE_CATEGORY_MAP: Record<string, ExpenseCategory> = {
    'Staff Salary': 'staff_salary', Salary: 'staff_salary',
    Groceries: 'groceries', 'Daily Mess Groceries': 'groceries',
    Utilities: 'utilities', 'Utility Bills': 'utilities',
    Maintenance: 'maintenance', Repairs: 'maintenance', 'Maintenance & Repairs': 'maintenance',
    Internet: 'internet', Wifi: 'internet', 'Wi-Fi & Internet': 'internet' };
  const EXPENSE_METHOD_MAP: Record<string, ExpenseMethod> = {
    UPI: 'upi', 'Online UPI': 'upi', Cash: 'cash',
    'Bank Transfer': 'bank_transfer', Bank: 'bank_transfer' };

  const handleLogExpenseSubmit = async () => {
    const amt = parseFloat(expenseAmount) || 0;
    const nextErrors = {
      title: expenseTitle.trim() ? undefined : 'Name what this was for',
      amount: amt > 0 ? undefined : 'Enter an amount above zero',
    };
    setExpenseErrors(nextErrors);
    if (nextErrors.title || nextErrors.amount) return;
    setIsSubmitting(true);
    try {
      await logExpenseMutation.mutateAsync({
        title: expenseTitle.trim() || 'Expense',
        category: EXPENSE_CATEGORY_MAP[expenseCategory] ?? 'other',
        amount: amt,
        method: EXPENSE_METHOD_MAP[paymentMode] ?? 'cash',
        recipient_name: recipientName,
        notes });
      Alert.alert('Success', '✅ Expense logged successfully.');
      setExpenseTitle('');
      setExpenseAmount('');
      setRecipientName('');
      setNotes('');
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetSelect = (title: string, category: string, amount: string, payee: string) => {
    setExpenseTitle(title);
    setExpenseCategory(category);
    setExpenseAmount(amount);
    setRecipientName(payee);
  };

  return (
    <View style={styles.root}>
      {selectedReceipt && (
        <PaymentReceiptDialog
          payment={selectedReceipt}
          onDismiss={() => setSelectedReceipt(null)}
          actions={selectedReceipt.status === 'PENDING' ? (
            <Row gap={10}>
              <Btn
                onPress={() => { const p = selectedReceipt; setSelectedReceipt(null); handleVerifyPayment(p); }}
                containerColor={GREEN}
                borderRadius={Radii.control}
                height={44}
                loading={verifyPayment.isPending}
                style={{ flex: 1 }}
                testID="receipt_verify_btn"
              >
                <Ionicons name="checkmark-circle" size={15} color={WHITE} />
                <Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Verify</Txt>
              </Btn>
              <Btn
                onPress={() => { const p = selectedReceipt; setSelectedReceipt(null); setRejectingPayment(p); }}
                containerColor={Palette.TintRed}
                borderRadius={Radii.control}
                height={44}
                style={{ flex: 1 }}
                testID="receipt_reject_btn"
              >
                <Ionicons name="close-circle" size={15} color={Colors.danger} />
                <Txt size={13} weight="700" color={Colors.danger} style={{ marginLeft: 6 }}>Reject</Txt>
              </Btn>
            </Row>
          ) : undefined}
        />
      )}

      <Sheet
        visible={detailExpense !== null}
        title={detailExpense?.title ?? ''}
        subtitle={detailExpense ? `${detailExpense.category} · ${formatINR(detailExpense.amount)}` : undefined}
        accent={Colors.danger}
        icon="receipt-outline"
        onDismiss={() => setDetailExpense(null)}
        footer={
          <Btn
            onPress={() => {
              const e = detailExpense;
              if (!e) return;
              Alert.alert(
                'Reverse this entry?',
                `${e.title} — ${formatINR(e.amount)}. This cannot be undone.`,
                [
                  { text: 'Keep it', style: 'cancel' },
                  {
                    text: 'Reverse',
                    style: 'destructive',
                    onPress: () => {
                      setDetailExpense(null);
                      reverseExpenseMutation.mutate(
                        { expenseId: e.id, reason: 'Reversed from the expense log' },
                        { onError: (err) => Alert.alert('Could not reverse entry', err instanceof Error ? err.message : 'Nothing was changed.') },
                      );
                    } },
                ],
              );
            }}
            containerColor={Palette.TintRed}
            borderRadius={Radii.control}
            height={46}
            testID="expense_reverse_btn"
          >
            <Ionicons name="arrow-undo-outline" size={16} color={Colors.danger} />
            <Txt size={13} weight="700" color={Colors.danger} style={{ marginLeft: 6 }}>Reverse entry</Txt>
          </Btn>
        }
      >
        {detailExpense ? (
          <Col gap={10}>
            <DetailLine label="Amount" value={formatINR(detailExpense.amount)} />
            <DetailLine label="Category" value={detailExpense.category} />
            {detailExpense.recipientName ? <DetailLine label="Paid to" value={detailExpense.recipientName} /> : null}
            <DetailLine label="Mode" value={detailExpense.paymentMode} />
            <DetailLine label="Logged by" value={detailExpense.loggedByName || detailExpense.loggedByRole || 'staff'} />
            <DetailLine label="Date" value={formatDateTime(detailExpense.dateLogged)} />
            {detailExpense.notes ? <DetailLine label="Notes" value={detailExpense.notes} /> : null}
          </Col>
        ) : null}
      </Sheet>

      {/* ── Segmented Control Sub-tabs ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(0);
            }}
          >
            <Ionicons name="bar-chart-outline" size={16} color={subTab === 0 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Txt variant="button" color={subTab === 0 ? WHITE : CHARCOAL}>
              Balance Sheet
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(1);
            }}
          >
            <Ionicons name="cash-outline" size={16} color={subTab === 1 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Txt variant="button" color={subTab === 1 ? WHITE : CHARCOAL}>
              Expenses
            </Txt>
          </AnimatedPress>

          <AnimatedPress accessibilityRole="button"
            style={[styles.segBtn, subTab === 2 && styles.segBtnActive]}
            onPress={() => {
              setSubTab(2);
            }}
          >
            <Ionicons name="receipt-outline" size={16} color={subTab === 2 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Txt variant="button" color={subTab === 2 ? WHITE : CHARCOAL}>
              Collections
            </Txt>
          </AnimatedPress>
        </Row>
      </View>

      {/* ── Period Selector ── */}
      <View style={styles.periodContainer}>
        <Row gap={6} align="center">
          <AnimatedPress accessibilityRole="button"
            style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
            onPress={() => {
              setPeriod('month');
            }}
          >
            <Txt variant="meta" weight={period === 'month' ? '700' : '600'} color={period === 'month' ? WHITE : CHARCOAL}>
              This Month
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.periodBtn, period === '3m' && styles.periodBtnActive]}
            onPress={() => {
              setPeriod('3m');
            }}
          >
            <Txt variant="meta" weight={period === '3m' ? '700' : '600'} color={period === '3m' ? WHITE : CHARCOAL} tabular>
              3 Months
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.periodBtn, period === '6m' && styles.periodBtnActive]}
            onPress={() => {
              setPeriod('6m');
            }}
          >
            <Txt variant="meta" weight={period === '6m' ? '700' : '600'} color={period === '6m' ? WHITE : CHARCOAL} tabular>
              6 Months
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.periodBtn, period === '1y' && styles.periodBtnActive]}
            onPress={() => {
              setPeriod('1y');
            }}
          >
            <Txt variant="meta" weight={period === '1y' ? '700' : '600'} color={period === '1y' ? WHITE : CHARCOAL} tabular>
              1 Year
            </Txt>
          </AnimatedPress>
          
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Choose a date" accessibilityRole="button"
            style={[styles.periodCalBtn, period === 'custom' && styles.periodCalBtnActive]}
            onPress={() => {
              setShowDatePicker(true);
            }}
          >
            <Ionicons name="calendar-outline" size={16} color={period === 'custom' ? WHITE : CHARCOAL} />
          </AnimatedPress>
        </Row>
        {period === 'custom' && customLabel ? (
          <Txt variant="meta" weight="600" color={GREEN} tabular style={styles.customDateText}>Selected: {customLabel}</Txt>
        ) : null}
      </View>

      {/* ── Subscription & Billing — PGow's own bill to the owner, not a resident's rent,
          so it sits above the sub-tabs rather than inside any one of them. Also the only
          place to raise the property's total bed capacity (the one-time plan's bed
          configurator calls updateProperty with a new total_beds). Was Settings-only. */}
      <View style={styles.periodContainer}>
        <AnimatedPress accessibilityRole="button"
          style={styles.subscriptionRow}
          onPress={() => router.push('/owner-subscription')}
        >
          <Ionicons name="card-outline" size={20} color={GREEN} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Txt variant="cardTitle" color={CHARCOAL}>Subscription & Billing</Txt>
            <Txt variant="meta" color={MUTED} style={styles.subscriptionRowSub}>
              {owner?.subscriptionActive ? 'Plan active — view invoices, increase beds' : 'No active plan — activate to get started'}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </AnimatedPress>
      </View>

      {/* ── Sub-Tab 0: Balance Sheet ── */}
      {subTab === 0 && (
        <ScrollView
          {...dockScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />
          }
        >
          {verifiedRevenue === 0 && totalOutflows === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="receipt-outline" size={32} color={MUTED} />
              </View>
              <Txt variant="sectionTitle" color={CHARCOAL}>No financial activity</Txt>
              <Txt variant="body" color={MUTED} align="center" style={styles.emptyDesc}>
                No collections or expenses have been recorded for this period.
              </Txt>
              <Spacer size={16} />
              <AnimatedPress accessibilityRole="button"
                style={styles.emptyActionBtn}
                onPress={() => setSubTab(2)}
              >
                <Txt variant="button" color={WHITE}>View Collections</Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button"
                style={styles.emptySecBtn}
                onPress={() => setSubTab(1)}
              >
                <Txt variant="button" color={GREEN}>Add Expense</Txt>
              </AnimatedPress>
            </View>
          ) : (
            /* Standard Dashboard Content */
            <>
              {/* Financial Overview KPIs */}
              <Txt variant="sectionTitle" color={CHARCOAL}>Financial Overview</Txt>
              <Spacer size={10} />
              <Row gap={10} style={{ flexWrap: 'wrap' }}>
                {/* KPI 1: Collected */}
                <View style={[styles.kpiCard, { borderColor: Palette.TintGreen }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: Palette.TintGreen }]}>
                      <Ionicons name="wallet-outline" size={16} color={GREEN} />
                    </View>
                    <Txt variant="meta" weight="600" color={CHARCOAL}>Collected</Txt>
                  </Row>
                  <Txt variant="metric" color={GREEN} tabular style={styles.kpiValue}>
                    {formatINR(Math.round(verifiedRevenue))}
                  </Txt>
                  <Txt variant="caption" color={MUTED} style={styles.kpiSub}>Verified Receipts</Txt>
                </View>

                {/* KPI 2: Expenses */}
                <View style={[styles.kpiCard, { borderColor: Palette.TintRed }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: Palette.TintRed }]}>
                      <Ionicons name="briefcase-outline" size={16} color={Colors.danger} />
                    </View>
                    <Txt variant="meta" weight="600" color={CHARCOAL}>Expenses</Txt>
                  </Row>
                  <Txt variant="metric" color={Colors.danger} tabular style={styles.kpiValue}>
                    {formatINR(Math.round(totalOutflows))}
                  </Txt>
                  <Txt variant="caption" color={MUTED} style={styles.kpiSub}>Total logged</Txt>
                </View>

                {/* KPI 3: Net Profit */}
                <View style={[styles.kpiCard, { borderColor: '#EFF6FF' }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="trending-up-outline" size={16} color="#2563EB" />
                    </View>
                    <Txt variant="meta" weight="600" color={CHARCOAL}>Net Profit</Txt>
                  </Row>
                  <Txt variant="metric" color="#2563EB" tabular style={styles.kpiValue}>
                    {formatINR(Math.round(netProfit))}
                  </Txt>
                  <Txt variant="caption" color={MUTED} tabular style={styles.kpiSub}>{profitMargin.toFixed(1)}% margin</Txt>
                </View>
              </Row>

              <Spacer size={12} />

              {/* Status strip */}
              <Row gap={6} align="center" style={styles.statusStripBox}>
                <Ionicons name="analytics-outline" size={15} color={GREEN} />
                <Txt variant="meta" weight="600" color={GREEN}>{statusStrip}</Txt>
              </Row>

              <Spacer size={24} />

              {/* Expense Breakdown Card */}
              <View style={styles.cardBox}>
                <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
                  <Row gap={8} align="center">
                    <Ionicons name="pie-chart-outline" size={18} color={GREEN} />
                    <Txt variant="cardTitle" color={CHARCOAL}>Expense Breakdown</Txt>
                  </Row>
                  <Txt variant="meta" weight="600" color={MUTED} tabular>
                    Total Expenses: {formatINR(Math.round(totalOutflows))}
                  </Txt>
                </Row>

                {expenseBreakdown.map((item) => (
                  <View key={item.name} style={styles.breakdownRow}>
                    <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
                      <Row gap={8} align="center">
                        <Ionicons name={item.icon as any} size={15} color={MUTED} />
                        <Txt variant="meta" weight="600" color={CHARCOAL}>{item.name}</Txt>
                      </Row>
                      <Row gap={12} align="center">
                        <Txt variant="meta" weight="600" color={CHARCOAL} tabular>
                          {formatINR(Math.round(item.amount))}
                        </Txt>
                        <Txt variant="meta" color={MUTED} align="right" tabular style={styles.breakdownPercent}>
                          {item.percentage.toFixed(1)}%
                        </Txt>
                      </Row>
                    </Row>
                    {totalOutflows > 0 && item.amount > 0 && (
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${item.percentage}%` }]} />
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <Spacer size={24} />

              {/* Balance Details */}
              <View style={styles.cardBox}>
                <Row gap={8} align="center" style={{ marginBottom: 16 }}>
                  <Ionicons name="calculator-outline" size={18} color={GREEN} />
                  <Txt variant="cardTitle" color={CHARCOAL}>Balance Details</Txt>
                </Row>

                <View style={styles.detailItemRow}>
                  <Txt variant="meta" weight="600" color={CHARCOAL}>Total Collections</Txt>
                  <Txt variant="body" weight="600" color={GREEN} tabular>
                    {formatINR(Math.round(verifiedRevenue))}
                  </Txt>
                </View>

                <View style={styles.detailItemRow}>
                  <Txt variant="meta" weight="600" color={CHARCOAL}>Total Expenses</Txt>
                  <Txt variant="body" weight="600" color={Colors.danger} tabular>
                    {formatINR(Math.round(totalOutflows))}
                  </Txt>
                </View>

                <View style={styles.detailItemRow}>
                  <Txt variant="meta" weight="600" color={CHARCOAL}>Net Profit</Txt>
                  <Txt variant="body" weight="600" color="#2563EB" tabular>
                    {formatINR(Math.round(netProfit))}
                  </Txt>
                </View>

                <View style={[styles.detailItemRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Txt variant="meta" weight="600" color={CHARCOAL}>Outstanding</Txt>
                  <Txt variant="body" weight="600" color={Colors.warning} tabular align="right">
                    {formatINR(Math.round(outstandingTotal))} · {outstandingPayments.length} payments
                  </Txt>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Sub-Tab 1: Expenses Tab ── */}
      {subTab === 1 && (
        <FlatList
          {...dockScroll}
          style={{ flex: 1 }}
          data={displayedExpenses}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />
          }
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 12 }}>
              {/* Total Expenses Header */}
              <View style={styles.totalHeaderBox}>
                <Txt variant="meta" weight="600" color={MUTED}>TOTAL EXPENSES</Txt>
                <Txt variant="metric" color={Colors.danger} tabular style={styles.totalHeaderValueText}>
                  {formatINR(Math.round(totalOutflows))}
                </Txt>
              </View>

              {/* Log expense — `create_expense` on the server is `require_manage` (owner OR
                  manager, checked against expense/service.py). Restricting this to managers
                  meant an owner running a property with no manager could not log an expense
                  from this screen at all, despite the server allowing it. */}
              <Card containerColor={WHITE} borderRadius={RADIUS} borderWidth={1} borderColor={BORDER} padding={[16, 16]}>
                  <Txt variant="cardTitle" color={CHARCOAL}>Log Daily Expense</Txt>
                  <Spacer size={8} />

                  {/* Preset Quick Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <Row gap={6}>
                      <AnimatedPress accessibilityRole="button"
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('Chef Monthly Salary - Ramesh', 'Staff Salary', '15000', 'Ramesh Kumar')}
                      >
                        <Txt variant="meta" weight="600" color={CHARCOAL} tabular>👨‍🍳 Chef Salary ₹15k</Txt>
                      </AnimatedPress>
                      <AnimatedPress accessibilityRole="button"
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('Daily Mess Grocery Procurement', 'Daily Mess Groceries', '2450', 'Wholesale Mart')}
                      >
                        <Txt variant="meta" weight="600" color={CHARCOAL} tabular>🛒 Groceries ₹2.4k</Txt>
                      </AnimatedPress>
                      <AnimatedPress accessibilityRole="button"
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('PG Electricity Power Bill', 'Utility Bills', '6800', 'Electricity Board')}
                      >
                        <Txt variant="meta" weight="600" color={CHARCOAL} tabular>⚡ Electricity ₹6.8k</Txt>
                      </AnimatedPress>
                    </Row>
                  </ScrollView>

                  <OutlinedTextField
                    label="Expense Title"
                    placeholder="Cook Salary, Groceries, Lock Repair"
                    value={expenseTitle}
                    onChangeText={(v) => { setExpenseTitle(v); if (expenseErrors.title) setExpenseErrors((e) => ({ ...e, title: undefined })); }}
                    error={expenseErrors.title}
                    style={{ marginBottom: 10 }}
                  />

                  <Row gap={8}>
                    <OutlinedTextField
                      label="Amount (₹)"
                      placeholder="5000"
                      value={expenseAmount}
                      onChangeText={(v) => { setExpenseAmount(v.replace(/[^\d.]/g, '')); if (expenseErrors.amount) setExpenseErrors((e) => ({ ...e, amount: undefined })); }}
                      keyboardType="number-pad"
                      error={expenseErrors.amount}
                      style={{ flex: 1 }}
                    />
                    <OutlinedTextField
                      label="Payee / Staff"
                      placeholder="Ramesh Cook"
                      value={recipientName}
                      onChangeText={setRecipientName}
                      containerColor={BG}
                      style={{ flex: 1 }}
                    />
                  </Row>
                  
                  <Spacer size={10} />
                  
                  {/* Six categories in a horizontal strip hid half of them off the right
                      edge, and the visible ones were abbreviated to fit. They wrap now. */}
                  <ChoiceChips
                    label="Category"
                    options={EXPENSE_CATEGORIES}
                    value={expenseCategory}
                    onChange={setExpenseCategory}
                    testID="expense_category"
                  />

                  <Spacer size={12} />

                  {/* The mode was fixed at 'UPI' in state with nothing to change it — every
                      expense was filed as UPI regardless of how it was actually paid, and the
                      row then displayed that as fact. */}
                  <ChoiceChips
                    label="Paid by"
                    options={EXPENSE_MODES}
                    value={paymentMode}
                    onChange={setPaymentMode}
                    testID="expense_mode"
                  />

                  <Spacer size={12} />

                  <AnimatedPress accessibilityRole="button"
                    style={styles.submitBtn}
                    onPress={handleLogExpenseSubmit}
                    disabled={isSubmitting || !expenseAmount.trim()}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
                    <Txt variant="button" color={WHITE}>{isSubmitting ? 'Saving...' : 'Log Expense Entry'}</Txt>
                  </AnimatedPress>
                </Card>

              {/* Search expenses */}
              <SearchField
                placeholder="Search expenses"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter by Category Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', ...EXPENSE_CATEGORIES].map((cat) => (
                    <AnimatedPress accessibilityRole="button"
                      key={cat}
                      style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
                      onPress={() => setCategoryFilter(cat)}
                    >
                      <Txt variant="meta" weight={categoryFilter === cat ? '700' : '600'} color={categoryFilter === cat ? WHITE : CHARCOAL}>
                        {cat}
                      </Txt>
                    </AnimatedPress>
                  ))}
                </Row>
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title="No expenses logged"
              subtitle="Logged outflows and property maintenance expenses will appear here."
              accent={Colors.danger}
              loading={expensesLoading}
              error={expensesError}
            />
          }
          renderItem={({ item: e, index }) => (
            <ListRow
              title={e.title}
              meta={`${e.category}${e.recipientName ? ` · ${e.recipientName}` : ''} · ${e.paymentMode} · ${new Date(e.dateLogged || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`}
              leading={<Ionicons name="receipt-outline" size={17} color={Colors.danger} />}
              amount={`-${formatINR(Math.round(e.amount))}`}
              onPress={() => setDetailExpense(e)}
              first={index === 0}
              last={index === displayedExpenses.length - 1}
              testID={`expense_${e.id}`}
            />
          )}
        />
      )}

      {/* ── Sub-Tab 2: Collections Tab ── */}
      {subTab === 2 && (
        <FlatList
          {...dockScroll}
          style={{ flex: 1 }}
          data={displayedCollections}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />
          }
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 12 }}>
              {/* Total Collected Header */}
              <View style={styles.totalHeaderBox}>
                <Txt variant="meta" weight="600" color={MUTED}>TOTAL COLLECTED</Txt>
                <Txt variant="metric" color={GREEN} tabular style={styles.totalHeaderValueText}>
                  {formatINR(Math.round(verifiedRevenue))}
                </Txt>
              </View>

              {/* Search collections */}
              <SearchField
                placeholder="Search collections by name or UTR"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter by Status Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', 'VERIFIED', 'PENDING', 'REJECTED'].map((status) => (
                    <AnimatedPress accessibilityRole="button"
                      key={status}
                      style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                      onPress={() => setStatusFilter(status)}
                    >
                      <Txt variant="meta" weight={statusFilter === status ? '700' : '600'} color={statusFilter === status ? WHITE : CHARCOAL}>
                        {status}
                      </Txt>
                    </AnimatedPress>
                  ))}
                </Row>
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No collections logged"
              subtitle="Rent collections and subscriber invoices will appear here."
              accent={GREEN}
              loading={paymentsLoading}
              error={paymentsError}
            />
          }
          renderItem={({ item: p, index }) => (
            <ListRow
              title={p.payerName}
              meta={`${p.paymentType.replace(/_/g, ' ').toLowerCase()} · Room ${getPayerRoom(p.payerId)}${p.utrRef ? ` · UTR ${p.utrRef}` : ''}`}
              amount={`+${formatINR(Math.round(p.amount))}`}
              status={{ label: p.status, tone: toneFor(p.status) }}
              onPress={() => setSelectedReceipt(p)}
              first={index === 0}
              last={index === displayedCollections.length - 1}
              testID={`collection_${p.id}`}
            />
          )}
        />
      )}


      <TextPromptDialog
        visible={!!rejectingPayment}
        title="Reject payment"
        label="Reason"
        placeholder="Amount doesn't match the UTR reference"
        helper={rejectingPayment ? `${rejectingPayment.payerName} · ${formatINR(Math.round(rejectingPayment.amount))} — they see this` : undefined}
        confirmLabel="Confirm rejection"
        destructive
        required
        busy={rejectPayment.isPending}
        onCancel={() => setRejectingPayment(null)}
        onSave={handleRejectPayment}
      />

      {/* ── Custom Date Range Picker Sheet ── */}
      {showDatePicker && (
        <Sheet
          visible={showDatePicker}
          title="Select Custom Range"
          onDismiss={() => setShowDatePicker(false)}
          testID="owner-payments-custom-range"
          footer={
            <AnimatedPress accessibilityRole="button" style={styles.pickerCancelBtn} onPress={() => setShowDatePicker(false)}>
              <Txt variant="button" color={CHARCOAL}>Close</Txt>
            </AnimatedPress>
          }
        >
          <Txt variant="sectionTitle" color={CHARCOAL} style={styles.pickerPopupTitle}>Select Custom Range</Txt>

          <Txt variant="meta" weight="600" color={MUTED} style={styles.pickerSectionLabel}>Select Month Range</Txt>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220, marginTop: 8 }}>
            {getPast12Months().map((m) => {
              const isSelected = customLabel === m.label;
              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={m.label}
                  style={[styles.pickerPopupOption, isSelected && styles.pickerPopupOptionActive]}
                  onPress={() => {
                    setCustomStart(m.start);
                    setCustomEnd(m.end);
                    setCustomLabel(m.label);
                    setPeriod('custom');
                    setShowDatePicker(false);
                  }}
                >
                  <Txt variant="body" weight={isSelected ? '600' : '400'} color={isSelected ? GREEN : CHARCOAL} tabular>
                    {m.label}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </ScrollView>
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Sub-tabs Segmented control
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10 },
  segmentedControl: {
    backgroundColor: WHITE,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    width: '100%' },
  segBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  segBtnActive: {
    backgroundColor: GREEN },
  segBtnText: { fontSize: 12, fontWeight: '600', color: CHARCOAL },
  segBtnTextActive: { color: WHITE, fontWeight: '700' },

  // Period selector
  periodContainer: {
    paddingHorizontal: 20,
    paddingBottom: 14 },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14 },
  subscriptionRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHARCOAL },
  subscriptionRowSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2 },
  periodBtn: {
    flex: 1,
    height: 34,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER },
  periodBtnActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  periodBtnText: { fontSize: 11, fontWeight: '600', color: CHARCOAL },
  periodBtnTextActive: { color: WHITE, fontWeight: '700' },
  periodCalBtn: {
    width: 34,
    height: 34,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER },
  periodCalBtnActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  customDateText: { fontSize: 11, color: GREEN, fontWeight: '700', marginTop: 6, paddingHorizontal: 4 },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: CHARCOAL },

  // KPIs
  kpiCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12 },
  kpiIconCircle: {
    width: 28,
    height: 28,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: CHARCOAL },
  kpiValue: { marginTop: 8 },
  kpiSub: { fontSize: 9, color: MUTED, marginTop: 2 },

  // Status Strip
  statusStripBox: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: Radii.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER },
  statusStripText: { fontSize: 12, color: GREEN, fontWeight: '700' },

  // Cards Content
  cardBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16 },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  cardHeaderValue: { fontSize: 11, color: MUTED, fontWeight: '600' },

  // Expense breakdown rows
  breakdownRow: {
    marginBottom: 12 },
  breakdownLabel: { fontSize: 12, fontWeight: '600', color: CHARCOAL },
  breakdownAmount: { fontSize: 12, fontWeight: '700', color: CHARCOAL },
  breakdownPercent: { fontSize: 11, color: MUTED, width: 34, textAlign: 'right' },
  progressBarBg: {
    height: 4,
    backgroundColor: BG,
    borderRadius: Radii.badge,
    marginTop: 4,
    overflow: 'hidden' },
  progressBarFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: Radii.badge },

  // Balance details items
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BG },
  detailItemLabel: { fontSize: 12, fontWeight: '600', color: CHARCOAL },
  detailItemValue: { fontSize: 13, fontWeight: '700' },

  // Empty State Container
  emptyContainer: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10 },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  emptyDesc: { fontSize: 13, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyActionBtn: {
    height: 44,
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%' },
  emptyActionText: { fontSize: 13, fontWeight: '700', color: WHITE },
  emptySecBtn: {
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8 },
  emptySecText: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Expenses Tab list
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40 },
  totalHeaderBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'center' },
  totalHeaderLabel: { fontSize: 10.5, fontWeight: '600', color: MUTED, letterSpacing: 0 },
  totalHeaderValueText: { marginTop: 4 },

  // Log Form
  formTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.control,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 6 },
  presetChipText: { fontSize: 11, fontWeight: '600', color: CHARCOAL },
  submitBtn: {
    height: 46,
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: WHITE },

  // Outflow item card

  // Filter chips
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  // Status label


  // Custom picker popup modals
  pickerPopupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center' },
  pickerPopupCard: {
    width: '80%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18 },
  pickerPopupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CHARCOAL,
    marginBottom: 10 },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    marginBottom: 4 },
  pickerPopupOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: Radii.control,
    borderBottomWidth: 1,
    borderBottomColor: BG },
  pickerPopupOptionActive: {
    backgroundColor: LIGHT_GREEN },
  pickerPopupOptionText: {
    fontSize: 13,
    color: CHARCOAL,
    fontWeight: '500' },
  pickerPopupOptionTextActive: {
    color: GREEN,
    fontWeight: '700' },
  pickerCancelBtn: {
    height: 40,
    backgroundColor: BG,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  pickerCancelBtnText: { fontSize: 12, color: CHARCOAL, fontWeight: '700' } });

/** One label/value line in the expense sheet. */
function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" align="flex-start" gap={16}>
      <Txt variant="meta" color={Colors.textMuted}>{label}</Txt>
      <Txt variant="meta" weight="600" color={Colors.textPrimary} tabular style={{ flex: 1, textAlign: 'right' }}>{value}</Txt>
    </Row>
  );
}
