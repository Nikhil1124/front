import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

export type ExpenseCategory =
  | "staff_salary"
  | "groceries"
  | "utilities"
  | "maintenance"
  | "internet"
  | "other";

export type ExpenseMethod = "upi" | "cash" | "bank_transfer";

export interface ExpenseRecord {
  id: string;
  pg_id: string;
  logged_by: string;
  logged_by_name: string | null;
  logged_by_role: string | null;
  title: string;
  category: ExpenseCategory;
  /** Decimal on the wire. Negative on a reversal — that is how a correction nets out. */
  amount: string;
  period: string;
  spent_on: string;
  method: ExpenseMethod;
  paid_to_membership_id: string | null;
  paid_to_name: string | null;
  recipient_name: string;
  request_id: string | null;
  /** Set on a correcting entry, pointing at what it cancels. */
  reverses_expense_id: string | null;
  /** Set on an entry that has BEEN corrected, so it can be struck through in a list. */
  reversed_by_expense_id: string | null;
  notes: string;
  created_at: string;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  amount: string;
}

export interface ExpenseSummary {
  pg_id: string;
  period: string;
  /** Verified payments only — pending money is not money. */
  collected: string;
  spent: string;
  net: string;
  by_category: CategoryTotal[];
}

export interface LogExpenseParams {
  title: string;
  category: ExpenseCategory;
  amount: number;
  method: ExpenseMethod;
  period?: string;
  spent_on?: string;
  paid_to_membership_id?: string;
  recipient_name?: string;
  request_id?: string;
  notes?: string;
}

export function listExpenses(
  pgId: string,
  opts: { category?: ExpenseCategory; period?: string; limit?: number; cursor?: string } = {}
): Promise<Page<ExpenseRecord>> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (opts.category) q.set("category", opts.category);
  if (opts.period) q.set("period", opts.period);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  return apiFetch<Page<ExpenseRecord>>(`${API.EXPENSES}?${q}`);
}

export function logExpense(pgId: string, params: LogExpenseParams): Promise<ExpenseRecord> {
  return apiFetch<ExpenseRecord>(`${API.EXPENSES}?pg_id=${pgId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Cancel an entry by logging its opposite. There is no delete: `expenses` is append-only,
 * because books that can be edited are books nobody can rely on. Returns the new negative
 * row, not the original.
 */
export function reverseExpense(expenseId: string, reason?: string): Promise<ExpenseRecord> {
  return apiFetch<ExpenseRecord>(API.EXPENSE_REVERSE(expenseId), {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

export function getExpenseSummary(pgId: string, period?: string): Promise<ExpenseSummary> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (period) q.set("period", period);
  return apiFetch<ExpenseSummary>(`${API.EXPENSES_SUMMARY}?${q}`);
}

export function useExpenses() {
  return { listExpenses, logExpense, reverseExpense, getExpenseSummary };
}
