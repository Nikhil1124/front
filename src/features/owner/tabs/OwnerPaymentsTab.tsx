import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Text,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { EmptyState } from '@/components/EmptyState';
import type { PaymentEntity, ExpenseEntity, GuestEntity } from '@/types';
import { usePaymentsQuery, useVerifyPaymentMutation, useRejectPaymentMutation } from '@/features/payments/usePayments';
import { useExpensesQuery } from '@/features/expenses/useExpenses';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useActiveProperty } from '@/features/properties/useProperties';
import { FormScroll } from '@/components/ui/FormScroll';

const GREEN = '#5B45E8';      // Indigo primary brand
const BG = '#F7F8FC';         // Canvas BG
const CHARCOAL = '#15171A';   // Primary text
const MUTED = '#6B7280';      // Muted text
const BORDER = '#E5E7EB';     // Subtle border
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF2FF';// Soft indigo active tint
const RADIUS = 22;            // Premium rounded corner radius

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
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    });
  }
  return months;
}

export function OwnerPaymentsTab() {
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
  const { data: payments = [], isLoading: paymentsLoading, error: paymentsError } = usePaymentsQuery(activePgId ?? undefined);
  const { data: expenses = [], isLoading: expensesLoading, error: expensesError } = useExpensesQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const logExpense = usePGowStore((s) => s.logExpense);
  const deleteExpense = usePGowStore((s) => s.deleteExpense);

  // Verify/reject: the backend endpoints (`POST /v1/payments/{id}/verify` and `/reject`)
  // and the mutation hooks for them already existed — nothing in any screen called them.
  // A resident could submit a payment and there was no button anywhere for an owner or
  // manager to approve or reject it.
  const verifyPayment = useVerifyPaymentMutation(activePgId ?? undefined);
  const rejectPayment = useRejectPaymentMutation(activePgId ?? undefined);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentEntity | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleVerifyPayment = async (p: PaymentEntity) => {
    hapticSelect();
    try {
      await verifyPayment.mutateAsync(p.id);
      hapticSuccess();
    } catch (err) {
      hapticError();
      Alert.alert('Could not verify', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectingPayment) return;
    try {
      await rejectPayment.mutateAsync({ paymentId: rejectingPayment.id, reason: rejectReason.trim() || undefined });
      hapticError();
      setRejectingPayment(null);
      setRejectReason('');
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

  // Log expense form states
  const [expenseTitle, setExpenseTitle] = useState('');
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

  const handleLogExpenseSubmit = async () => {
    const amt = parseFloat(expenseAmount) || 0;
    if (!expenseTitle.trim()) {
      Alert.alert('Validation', 'Please enter an expense title.');
      return;
    }
    if (amt <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    setIsSubmitting(true);
    const result = await logExpense(
      expenseTitle,
      expenseCategory,
      amt,
      recipientName,
      paymentMode,
      notes
    );
    setIsSubmitting(false);
    if (result.ok) {
      hapticSuccess();
      Alert.alert('Success', '✅ Expense logged successfully.');
      setExpenseTitle('');
      setExpenseAmount('');
      setRecipientName('');
      setNotes('');
    } else {
      hapticError();
      Alert.alert('Failed', result.error ?? 'Unknown error occurred.');
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
        <PaymentReceiptDialog payment={selectedReceipt} onDismiss={() => setSelectedReceipt(null)} />
      )}

      {/* ── Segmented Control Sub-tabs ── */}
      <View style={styles.tabContainer}>
        <Row gap={8} style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segBtn, subTab === 0 && styles.segBtnActive]}
            onPress={() => {
              hapticSelect();
              setSubTab(0);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="bar-chart-outline" size={16} color={subTab === 0 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.segBtnText, subTab === 0 && styles.segBtnTextActive]}>
              Balance Sheet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segBtn, subTab === 1 && styles.segBtnActive]}
            onPress={() => {
              hapticSelect();
              setSubTab(1);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={16} color={subTab === 1 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.segBtnText, subTab === 1 && styles.segBtnTextActive]}>
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segBtn, subTab === 2 && styles.segBtnActive]}
            onPress={() => {
              hapticSelect();
              setSubTab(2);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt-outline" size={16} color={subTab === 2 ? WHITE : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.segBtnText, subTab === 2 && styles.segBtnTextActive]}>
              Collections
            </Text>
          </TouchableOpacity>
        </Row>
      </View>

      {/* ── Period Selector ── */}
      <View style={styles.periodContainer}>
        <Row gap={6} align="center">
          <TouchableOpacity
            style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
            onPress={() => {
              hapticSelect();
              setPeriod('month');
            }}
          >
            <Text style={[styles.periodBtnText, period === 'month' && styles.periodBtnTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === '3m' && styles.periodBtnActive]}
            onPress={() => {
              hapticSelect();
              setPeriod('3m');
            }}
          >
            <Text style={[styles.periodBtnText, period === '3m' && styles.periodBtnTextActive]}>
              3 Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === '6m' && styles.periodBtnActive]}
            onPress={() => {
              hapticSelect();
              setPeriod('6m');
            }}
          >
            <Text style={[styles.periodBtnText, period === '6m' && styles.periodBtnTextActive]}>
              6 Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === '1y' && styles.periodBtnActive]}
            onPress={() => {
              hapticSelect();
              setPeriod('1y');
            }}
          >
            <Text style={[styles.periodBtnText, period === '1y' && styles.periodBtnTextActive]}>
              1 Year
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.periodCalBtn, period === 'custom' && styles.periodCalBtnActive]}
            onPress={() => {
              hapticSelect();
              setShowDatePicker(true);
            }}
          >
            <Ionicons name="calendar-outline" size={16} color={period === 'custom' ? WHITE : CHARCOAL} />
          </TouchableOpacity>
        </Row>
        {period === 'custom' && customLabel ? (
          <Text style={styles.customDateText}>Selected: {customLabel}</Text>
        ) : null}
      </View>

      {/* ── Subscription & Billing — PGow's own bill to the owner, not a resident's rent,
          so it sits above the sub-tabs rather than inside any one of them. Also the only
          place to raise the property's total bed capacity (the one-time plan's bed
          configurator calls updateProperty with a new total_beds). Was Settings-only. */}
      <View style={styles.periodContainer}>
        <TouchableOpacity
          style={styles.subscriptionRow}
          onPress={() => router.push('/owner-subscription')}
          activeOpacity={0.85}
        >
          <Ionicons name="card-outline" size={20} color={GREEN} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.subscriptionRowTitle}>Subscription & Billing</Text>
            <Text style={styles.subscriptionRowSub}>
              {owner?.subscriptionActive ? 'Plan active — view invoices, increase beds' : 'No active plan — activate to get started'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </TouchableOpacity>
      </View>

      {/* ── Sub-Tab 0: Balance Sheet ── */}
      {subTab === 0 && (
        <ScrollView
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
              <Text style={styles.emptyTitle}>No financial activity</Text>
              <Text style={styles.emptyDesc}>
                No collections or expenses have been recorded for this period.
              </Text>
              <Spacer size={16} />
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setSubTab(2)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionText}>View Collections</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptySecBtn}
                onPress={() => setSubTab(1)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptySecText}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Standard Dashboard Content */
            <>
              {/* Financial Overview KPIs */}
              <Text style={styles.sectionHeader}>Financial Overview</Text>
              <Spacer size={10} />
              <Row gap={10}>
                {/* KPI 1: Collected */}
                <View style={[styles.kpiCard, { borderColor: '#EEF8F1' }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#EEF8F1' }]}>
                      <Ionicons name="wallet-outline" size={16} color={GREEN} />
                    </View>
                    <Text style={styles.kpiLabel}>Collected</Text>
                  </Row>
                  <Text style={[styles.kpiValue, { color: GREEN }]}>
                    ₹{Math.round(verifiedRevenue).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiSub}>Verified Receipts</Text>
                </View>

                {/* KPI 2: Expenses */}
                <View style={[styles.kpiCard, { borderColor: '#FEF2F2' }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF2F2' }]}>
                      <Ionicons name="briefcase-outline" size={16} color="#DC2626" />
                    </View>
                    <Text style={styles.kpiLabel}>Expenses</Text>
                  </Row>
                  <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
                    ₹{Math.round(totalOutflows).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiSub}>Total logged</Text>
                </View>

                {/* KPI 3: Net Profit */}
                <View style={[styles.kpiCard, { borderColor: '#EFF6FF' }]}>
                  <Row gap={6} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="trending-up-outline" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.kpiLabel}>Net Profit</Text>
                  </Row>
                  <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
                    ₹{Math.round(netProfit).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiSub}>{profitMargin.toFixed(1)}% margin</Text>
                </View>
              </Row>

              <Spacer size={12} />

              {/* Status strip */}
              <Row gap={6} align="center" style={styles.statusStripBox}>
                <Ionicons name="analytics-outline" size={15} color={GREEN} />
                <Text style={styles.statusStripText}>{statusStrip}</Text>
              </Row>

              <Spacer size={24} />

              {/* Expense Breakdown Card */}
              <View style={styles.cardBox}>
                <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
                  <Row gap={8} align="center">
                    <Ionicons name="pie-chart-outline" size={18} color={GREEN} />
                    <Text style={styles.cardHeaderTitle}>Expense Breakdown</Text>
                  </Row>
                  <Text style={styles.cardHeaderValue}>
                    Total Expenses: ₹{Math.round(totalOutflows).toLocaleString('en-IN')}
                  </Text>
                </Row>

                {expenseBreakdown.map((item) => (
                  <View key={item.name} style={styles.breakdownRow}>
                    <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
                      <Row gap={8} align="center">
                        <Ionicons name={item.icon as any} size={15} color={MUTED} />
                        <Text style={styles.breakdownLabel}>{item.name}</Text>
                      </Row>
                      <Row gap={12} align="center">
                        <Text style={styles.breakdownAmount}>
                          ₹{Math.round(item.amount).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.breakdownPercent}>
                          {item.percentage.toFixed(1)}%
                        </Text>
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
                  <Text style={styles.cardHeaderTitle}>Balance Details</Text>
                </Row>

                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Total Collections</Text>
                  <Text style={[styles.detailItemValue, { color: GREEN }]}>
                    ₹{Math.round(verifiedRevenue).toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Total Expenses</Text>
                  <Text style={[styles.detailItemValue, { color: '#DC2626' }]}>
                    ₹{Math.round(totalOutflows).toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Net Profit</Text>
                  <Text style={[styles.detailItemValue, { color: '#2563EB' }]}>
                    ₹{Math.round(netProfit).toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={[styles.detailItemRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={styles.detailItemLabel}>Outstanding</Text>
                  <Text style={[styles.detailItemValue, { color: '#D97706' }]}>
                    ₹{Math.round(outstandingTotal).toLocaleString('en-IN')} · {outstandingPayments.length} payments
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Sub-Tab 1: Expenses Tab ── */}
      {subTab === 1 && (
        <FlatList
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
                <Text style={styles.totalHeaderLabel}>TOTAL EXPENSES</Text>
                <Text style={styles.totalHeaderValueText}>
                  ₹{Math.round(totalOutflows).toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Log expense — `create_expense` on the server is `require_manage` (owner OR
                  manager, checked against expense/service.py). Restricting this to managers
                  meant an owner running a property with no manager could not log an expense
                  from this screen at all, despite the server allowing it. */}
              <Card containerColor={WHITE} borderRadius={RADIUS} borderWidth={1} borderColor={BORDER} padding={[16, 16]}>
                  <Text style={styles.formTitle}>Log Daily Expense</Text>
                  <Spacer size={8} />

                  {/* Preset Quick Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <Row gap={6}>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('Chef Monthly Salary - Ramesh', 'Staff Salary', '15000', 'Ramesh Kumar')}
                      >
                        <Text style={styles.presetChipText}>👨‍🍳 Chef Salary ₹15k</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('Daily Mess Grocery Procurement', 'Daily Mess Groceries', '2450', 'Wholesale Mart')}
                      >
                        <Text style={styles.presetChipText}>🛒 Groceries ₹2.4k</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => handlePresetSelect('PG Electricity Power Bill', 'Utility Bills', '6800', 'Electricity Board')}
                      >
                        <Text style={styles.presetChipText}>⚡ Electricity ₹6.8k</Text>
                      </TouchableOpacity>
                    </Row>
                  </ScrollView>

                  <OutlinedTextField
                    label="Expense Title"
                    placeholder="Cook Salary, Groceries, Lock Repair"
                    value={expenseTitle}
                    onChangeText={setExpenseTitle}
                    containerColor={BG}
                    style={{ marginBottom: 10 }}
                  />

                  <Row gap={8}>
                    <OutlinedTextField
                      label="Amount (₹)"
                      placeholder="5000"
                      value={expenseAmount}
                      onChangeText={(v) => setExpenseAmount(v.replace(/[^\d.]/g, ''))}
                      keyboardType="number-pad"
                      containerColor={BG}
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
                  
                  <Row gap={6} align="center">
                    <Text style={styles.formSectionLabel}>Category:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <Row gap={6}>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.smallChip, expenseCategory === cat && styles.smallChipActive]}
                            onPress={() => setExpenseCategory(cat)}
                          >
                            <Text style={[styles.smallChipText, expenseCategory === cat && styles.smallChipTextActive]}>
                              {cat.replace('Daily Mess ', '').replace(' Bills', '')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </Row>
                    </ScrollView>
                  </Row>

                  <Spacer size={12} />

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleLogExpenseSubmit}
                    disabled={isSubmitting || !expenseAmount.trim()}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>{isSubmitting ? 'Saving...' : 'Log Expense Entry'}</Text>
                  </TouchableOpacity>
                </Card>

              {/* Search expenses */}
              <TextInput
                style={styles.searchBar}
                placeholder="Search expenses..."
                placeholderTextColor={MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter by Category Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', ...EXPENSE_CATEGORIES].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
                      onPress={() => setCategoryFilter(cat)}
                    >
                      <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
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
              accent="#DC2626"
              loading={expensesLoading}
              error={expensesError}
            />
          }
          renderItem={({ item: e }) => (
            <Card
              containerColor={WHITE}
              borderRadius={16}
              borderWidth={1}
              borderColor={BORDER}
              padding={[12, 14]}
              style={{ marginBottom: 10 }}
            >
              <Row justify="space-between" align="center">
                <Row gap={10} style={{ flex: 1 }} align="center">
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="receipt-outline" size={18} color="#DC2626" />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Row align="center" gap={6}>
                      <Text style={styles.itemTitle}>{e.title}</Text>
                      <View style={styles.itemCategoryBadge}>
                        <Text style={styles.itemCategoryText}>{e.category}</Text>
                      </View>
                    </Row>
                    {e.recipientName ? (
                      <Text style={styles.itemPayee}>Payee: {e.recipientName}</Text>
                    ) : null}
                    <Text style={styles.itemMeta}>
                      Logged by {e.loggedByRole} • {e.paymentMode}
                    </Text>
                  </Col>
                </Row>
                <Col align="flex-end">
                  <Text style={styles.itemExpenseAmount}>
                    -₹{Math.round(e.amount).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.itemDate}>
                    {new Date(e.dateLogged || Date.now()).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  {/* Reversal — same `require_manage` boundary as logging one; see the note
                      above the log-expense form. */}
                  <TouchableOpacity
                    onPress={() => deleteExpense(e)}
                    style={{ marginTop: 4 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </Col>
              </Row>
            </Card>
          )}
        />
      )}

      {/* ── Sub-Tab 2: Collections Tab ── */}
      {subTab === 2 && (
        <FlatList
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
                <Text style={styles.totalHeaderLabel}>TOTAL COLLECTED</Text>
                <Text style={[styles.totalHeaderValueText, { color: GREEN }]}>
                  ₹{Math.round(verifiedRevenue).toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Search collections */}
              <TextInput
                style={styles.searchBar}
                placeholder="Search collections by name or UTR..."
                placeholderTextColor={MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Filter by Status Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={6}>
                  {['All', 'VERIFIED', 'PENDING', 'DUE'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                      onPress={() => setStatusFilter(status)}
                    >
                      <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                        {status}
                      </Text>
                    </TouchableOpacity>
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
          renderItem={({ item: p }) => (
            <AnimatedPress
              scale={0.985}
              hapticPattern="light"
              onPress={() => {
                hapticSelect();
                setSelectedReceipt(p);
              }}
            >
              <Card
                containerColor={WHITE}
                borderRadius={16}
                borderWidth={1}
                borderColor={p.status === 'VERIFIED' ? '#ECFDF5' : BORDER}
                padding={[12, 14]}
                style={{ marginBottom: 10 }}
              >
                <Row justify="space-between" align="center">
                  <Row gap={10} style={{ flex: 1 }} align="center">
                    <View style={[styles.kpiIconCircle, { backgroundColor: p.status === 'VERIFIED' ? '#EEF8F1' : '#FFFBEB' }]}>
                      <Ionicons
                        name={p.paymentType === 'OWNER_SUBSCRIPTION' ? 'ribbon' : 'checkmark-circle'}
                        size={18}
                        color={p.status === 'VERIFIED' ? GREEN : '#D97706'}
                      />
                    </View>
                    <Col style={{ flex: 1 }}>
                      <Row align="center" gap={6}>
                        <Text style={styles.itemTitle}>{p.payerName}</Text>
                        <View
                          style={[
                            styles.statusLabelBadge,
                            {
                              backgroundColor: p.status === 'VERIFIED' ? '#ECFDF5' : '#FFFBEB',
                              borderColor: p.status === 'VERIFIED' ? '#A7F3D0' : '#FDE68A',
                            },
                          ]}
                        >
                          <Text style={[styles.statusLabelText, { color: p.status === 'VERIFIED' ? '#047857' : '#B45309' }]}>
                            {p.status}
                          </Text>
                        </View>
                      </Row>
                      <Text style={styles.itemMeta}>
                        {p.paymentType} • Room {getPayerRoom(p.payerId)}
                      </Text>
                      {p.utrRef ? (
                        <Text style={styles.itemUtr}>UTR: {p.utrRef}</Text>
                      ) : null}
                    </Col>
                  </Row>
                  <Col align="flex-end">
                    <Text style={[styles.itemCollectedAmount, { color: p.status === 'VERIFIED' ? GREEN : '#D97706' }]}>
                      +₹{Math.round(p.amount).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.itemDate}>
                      {new Date(p.timestamp || Date.now()).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </Col>
                </Row>
                {p.status === 'PENDING' && (
                  <>
                    <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 10 }} />
                    <Row gap={8}>
                      <TouchableOpacity
                        onPress={() => handleVerifyPayment(p)}
                        disabled={verifyPayment.isPending}
                        style={[styles.paymentActionBtn, { backgroundColor: GREEN, opacity: verifyPayment.isPending ? 0.6 : 1 }]}
                      >
                        <Ionicons name="checkmark-circle" size={14} color={WHITE} />
                        <Text style={styles.paymentActionBtnTextLight}>Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { hapticSelect(); setRejectingPayment(p); setRejectReason(''); }}
                        style={[styles.paymentActionBtn, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' }]}
                      >
                        <Ionicons name="close-circle" size={14} color={Colors.danger} />
                        <Text style={[styles.paymentActionBtnTextLight, { color: Colors.danger }]}>Reject</Text>
                      </TouchableOpacity>
                    </Row>
                  </>
                )}
              </Card>
            </AnimatedPress>
          )}
        />
      )}

      {/* ── Reject Payment Modal ── */}
      {rejectingPayment && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setRejectingPayment(null)}>
          {/* KAV so the reason input isn't covered by keyboard on Android */}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'padding' : undefined}>
            <View style={styles.pickerPopupBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setRejectingPayment(null)} />
              <View style={[styles.pickerPopupCard, { padding: 20 }]}>
                <Text style={styles.pickerPopupTitle}>Reject Payment</Text>
                <Spacer size={4} />
                <Text style={{ fontSize: 12, color: MUTED }}>
                  {rejectingPayment.payerName} • ₹{Math.round(rejectingPayment.amount).toLocaleString('en-IN')}
                </Text>
                <Spacer size={14} />
                <OutlinedTextField
                  label="Reason (shown to the resident)"
                  placeholder="Amount doesn't match, UTR not found, etc."
                  value={rejectReason}
                  onChangeText={setRejectReason}
                />
                <Spacer size={16} />
                <Row gap={10}>
                  <TouchableOpacity
                    onPress={() => setRejectingPayment(null)}
                    style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: '#F1F5F4', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: CHARCOAL }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRejectPayment}
                    disabled={rejectPayment.isPending}
                    style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', opacity: rejectPayment.isPending ? 0.6 : 1 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: WHITE }}>
                      {rejectPayment.isPending ? 'Rejecting…' : 'Confirm Rejection'}
                    </Text>
                  </TouchableOpacity>
                </Row>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}


      {/* ── Custom Date Range Picker Modal ── */}
      {showDatePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerPopupBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} />
            <View style={styles.pickerPopupCard}>
              <Text style={styles.pickerPopupTitle}>Select Custom Range</Text>
              
              <Text style={styles.pickerSectionLabel}>Select Month Range</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220, marginTop: 8 }}>
                {getPast12Months().map((m) => {
                  const isSelected = customLabel === m.label;
                  return (
                    <TouchableOpacity
                      key={m.label}
                      style={[styles.pickerPopupOption, isSelected && styles.pickerPopupOptionActive]}
                      onPress={() => {
                        hapticSelect();
                        setCustomStart(m.start);
                        setCustomEnd(m.end);
                        setCustomLabel(m.label);
                        setPeriod('custom');
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[styles.pickerPopupOptionText, isSelected && styles.pickerPopupOptionTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Spacer size={16} />
              
              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.pickerCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    paddingBottom: 10,
  },
  segmentedControl: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    width: '100%',
  },
  segBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  segBtnActive: {
    backgroundColor: GREEN,
  },
  segBtnText: { fontSize: 12, fontWeight: '600', color: CHARCOAL },
  segBtnTextActive: { color: WHITE, fontWeight: '700' },

  // Period selector
  periodContainer: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  subscriptionRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHARCOAL,
  },
  subscriptionRowSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  periodBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  periodBtnActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  periodBtnText: { fontSize: 11, fontWeight: '600', color: CHARCOAL },
  periodBtnTextActive: { color: WHITE, fontWeight: '700' },
  periodCalBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  periodCalBtnActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  customDateText: { fontSize: 11, color: GREEN, fontWeight: '700', marginTop: 6, paddingHorizontal: 4 },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
  },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: CHARCOAL },

  // KPIs
  kpiCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  kpiIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: CHARCOAL },
  kpiValue: { fontSize: 17, fontWeight: '800', marginTop: 8 },
  kpiSub: { fontSize: 9, color: MUTED, marginTop: 2 },

  // Status Strip
  statusStripBox: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statusStripText: { fontSize: 12, color: GREEN, fontWeight: '700' },

  // Cards Content
  cardBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  cardHeaderValue: { fontSize: 11, color: MUTED, fontWeight: '600' },

  // Expense breakdown rows
  breakdownRow: {
    marginBottom: 12,
  },
  breakdownLabel: { fontSize: 12, fontWeight: '600', color: CHARCOAL },
  breakdownAmount: { fontSize: 12, fontWeight: '700', color: CHARCOAL },
  breakdownPercent: { fontSize: 11, color: MUTED, width: 34, textAlign: 'right' },
  progressBarBg: {
    height: 4,
    backgroundColor: BG,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 2,
  },

  // Balance details items
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
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
    marginTop: 10,
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  emptyDesc: { fontSize: 13, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyActionBtn: {
    height: 44,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyActionText: { fontSize: 13, fontWeight: '800', color: WHITE },
  emptySecBtn: {
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptySecText: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Expenses Tab list
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  totalHeaderBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'center',
  },
  totalHeaderLabel: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 0.5 },
  totalHeaderValueText: { fontSize: 24, fontWeight: '800', color: '#DC2626', marginTop: 4 },
  searchBar: {
    height: 48,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 13,
    color: CHARCOAL,
  },

  // Log Form
  formTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 6,
  },
  presetChipText: { fontSize: 11, fontWeight: '600', color: CHARCOAL },
  formSectionLabel: { fontSize: 12, fontWeight: '700', color: MUTED, marginRight: 8 },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  smallChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  smallChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  smallChipTextActive: { color: WHITE, fontWeight: '700' },
  submitBtn: {
    height: 46,
    backgroundColor: GREEN,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },

  // Outflow item card
  itemTitle: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  itemCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: LIGHT_GREEN,
  },
  itemCategoryText: { fontSize: 9, fontWeight: '700', color: GREEN },
  itemPayee: { fontSize: 11, color: MUTED, marginTop: 2 },
  itemMeta: { fontSize: 10, color: MUTED, marginTop: 1 },
  itemExpenseAmount: { fontSize: 14, fontWeight: '800', color: '#DC2626' },
  itemCollectedAmount: { fontSize: 14, fontWeight: '800' },
  itemDate: { fontSize: 9, color: MUTED, marginTop: 2 },
  itemUtr: { fontSize: 10, color: GREEN, marginTop: 2, fontWeight: '600' },

  // Filter chips
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  // Status label
  statusLabelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusLabelText: { fontSize: 8, fontWeight: '800' },

  paymentActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
  },
  paymentActionBtnTextLight: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // Custom picker popup modals
  pickerPopupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerPopupCard: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  pickerPopupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: CHARCOAL,
    marginBottom: 10,
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    marginBottom: 4,
  },
  pickerPopupOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  pickerPopupOptionActive: {
    backgroundColor: LIGHT_GREEN,
  },
  pickerPopupOptionText: {
    fontSize: 13,
    color: CHARCOAL,
    fontWeight: '500',
  },
  pickerPopupOptionTextActive: {
    color: GREEN,
    fontWeight: '700',
  },
  pickerCancelBtn: {
    height: 40,
    backgroundColor: BG,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelBtnText: { fontSize: 12, color: CHARCOAL, fontWeight: '700' },
});
