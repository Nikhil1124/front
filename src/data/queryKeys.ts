/**
 * Every React Query cache key in one place.
 *
 * Keys are built as arrays so a prefix invalidates everything beneath it:
 * `invalidateQueries({ queryKey: qk.guests.all(pgId) })` clears both the list and every
 * detail under that property.
 *
 * Almost everything is scoped by `pgId`. That is not decoration — the property switcher
 * changes what every screen is looking at, and a key that omits the property would serve
 * one property's roster to another after a switch. It is the same mistake as an aggregate
 * that filters after summing, one layer up.
 */

export const qk = {
  session: () => ["session"] as const,

  properties: {
    all: () => ["properties"] as const,
    list: () => ["properties", "list"] as const,
    detail: (pgId: string) => ["properties", "detail", pgId] as const,
    upiIds: (pgId: string) => ["properties", "upi", pgId] as const,
    // Task 7 — floor/room/bed layout for the BookMyShow-style seat map.
    // Keyed separately from `detail` because the layout is a heavier payload
    // that changes on a different cadence (assign/vacate) than the property
    // metadata (rename, address edit).
    layout: (pgId: string) => ["properties", "layout", pgId] as const,
    // The owner's cross-property rollup. Keyed by the sorted, comma-joined id list rather
    // than the array itself — two calls with the same properties in a different order (or a
    // fresh array reference from a re-render) must hit the same cache entry, not refetch.
    portfolio: (pgIds: string) => ["properties", "portfolio", pgIds] as const,
    portfolioTeaser: (pgIds: string) => ["properties", "portfolio", "teaser", pgIds] as const,
  },

  guests: {
    all: (pgId: string) => ["guests", pgId] as const,
    list: (pgId: string) => ["guests", pgId, "list"] as const,
    detail: (pgId: string, id: string) => ["guests", pgId, "detail", id] as const,
  },

  staff: {
    all: (pgId: string) => ["staff", pgId] as const,
    list: (pgId: string) => ["staff", pgId, "list"] as const,
    detail: (pgId: string, id: string) => ["staff", pgId, "detail", id] as const,
  },

  kyc: {
    all: (pgId: string) => ["kyc", pgId] as const,
    pending: (pgId: string) => ["kyc", pgId, "pending"] as const,
  },

  meals: {
    all: (pgId: string) => ["meals", pgId] as const,
    list: (pgId: string) => ["meals", pgId, "list"] as const,
    detail: (pgId: string, id: string) => ["meals", pgId, "detail", id] as const,
    myResponse: (pgId: string, id: string) => ["meals", pgId, "response", id] as const,
    summary: (pgId: string, id: string) => ["meals", pgId, "summary", id] as const,
    // The named roster — who answered what, and who has not. Staff only.
    responses: (pgId: string, id: string) => ["meals", pgId, "responses", id] as const,
    // Task 7 — day-of-week menu, today's headcount split, and the savings
    // analytics window. The window keys include start/end so two windows the
    // owner toggles between do not bleed into one cached answer.
    menu: (pgId: string) => ["meals", "menu", pgId] as const,
    todaySummary: (pgId: string) => ["meals", "todaySummary", pgId] as const,
    savings: (pgId: string, start: string, end: string) =>
      ["meals", "savings", pgId, start, end] as const,
    rsvpTrends: (pgId: string, start: string, end: string) =>
      ["meals", "rsvpTrends", pgId, start, end] as const,
  },

  expenses: {
    all: (pgId: string) => ["expenses", pgId] as const,
    list: (pgId: string) => ["expenses", pgId, "list"] as const,
    // Keyed by period as well: last month's P&L and this month's are different answers, and
    // a shared key would serve one as the other after a month rolls over.
    summary: (pgId: string, period: string) =>
      ["expenses", pgId, "summary", period] as const,
  },

  payments: {
    all: (pgId: string) => ["payments", pgId] as const,
    list: (pgId: string) => ["payments", pgId, "list"] as const,
    due: (pgId: string) => ["payments", pgId, "due"] as const,
  },

  requests: {
    all: (pgId: string) => ["requests", pgId] as const,
    list: (pgId: string) => ["requests", pgId, "list"] as const,
    detail: (pgId: string, id: string) => ["requests", pgId, "detail", id] as const,
  },

  ads: {
    all: (pgId: string) => ["ads", pgId] as const,
    metrics: (pgId: string) => ["ads", pgId, "metrics"] as const,
    config: (pgId: string) => ["ads", pgId, "config"] as const,
  },

  rewards: {
    all: (pgId: string) => ["rewards", pgId] as const,
    leaderboard: (pgId: string) => ["rewards", pgId, "leaderboard"] as const,
    mine: (pgId: string) => ["rewards", pgId, "me"] as const,
  },

  billing: {
    // Scoped by pgId like everything else — a chain's owner switching properties must not
    // see the previous one's subscription. Plans are the exception: PGow sells the same
    // list to everybody, so that key carries no property.
    all: (pgId: string) => ["billing", pgId] as const,
    plans: () => ["billing", "plans"] as const,
    quote: (pgId: string, planCode: string) =>
      ["billing", pgId, "quote", planCode] as const,
    subscription: (pgId: string) => ["billing", pgId, "subscription"] as const,
    invoices: (pgId: string) => ["billing", pgId, "invoices"] as const,
    // Task 7 — tenant-facing invoices, the property ledger over a window, and
    // the 3m/6m/1y P&L. `tenantInvoices` is a list query so it carries the
    // filter object (status, month) the screen asked with, the same way the
    // procurement orders key does. The ledger and PnL keys include their
    // window/interval so toggling the selector does not serve the previous
    // answer from cache.
    tenantInvoices: (filters?: Record<string, unknown>) =>
      ["billing", "tenantInvoices", filters ?? {}] as const,
    // The invalidation-only prefix: matches every filtered tenantInvoices() list, so a
    // mutation can clear "all of them" without hand-typing the ["billing","tenantInvoices"]
    // literal (which would silently stop matching if the shape above ever changes).
    tenantInvoicesAll: () => ["billing", "tenantInvoices"] as const,
    pnl: (pgId: string, interval: string) =>
      ["billing", "pnl", pgId, interval] as const,
    ledger: (pgId: string, start: string, end: string) =>
      ["billing", "ledger", pgId, start, end] as const,
  },

  notifications: {
    all: (pgId: string) => ["notifications", pgId] as const,
    list: (pgId: string) => ["notifications", pgId, "list"] as const,
    unreadCount: (pgId: string) => ["notifications", pgId, "unread"] as const,
  },

  // ── Task 7 — new module keys ──────────────────────────────────────────────

  procurement: {
    // The catalog is global (not pg-scoped) on the server — every property
    // shares the same item list — so the key carries no pgId.
    catalog: () => ["procurement", "catalog"] as const,
    // Orders are pg-scoped and filterable (status, orderType). The filter
    // object is part of the key so two filtered views do not collide.
    orders: (filters?: Record<string, unknown>) =>
      ["procurement", "orders", filters ?? {}] as const,
    // Invalidation-only prefix — see billing.tenantInvoicesAll for why this exists
    // alongside orders() instead of hand-typing ["procurement", "orders"].
    ordersAll: () => ["procurement", "orders"] as const,
  },

  panic: {
    // The active queue (active + acknowledged). Resolved history is a separate
    // query the manager fetches on demand, so it does not need its own key here
    // — pass `resolved` in the status filter at the call site.
    activeAlerts: (pgId: string) => ["panic", "active", pgId] as const,
  },

  attendance: {
    // Shifts are pg-scoped; staffId is optional so a manager listing all
    // staff shifts and a staff member listing their own share the same
    // namespace without colliding (null vs the membership id).
    shifts: (pgId: string, staffId?: string | null) =>
      ["attendance", "shifts", pgId, staffId ?? null] as const,
    // Punches are pg-scoped and windowed. start/end are ISO date strings or
    // null when unbounded, so a "this week" view and a "all time" view do not
    // serve one another's cached rows.
    punches: (pgId: string, staffId?: string | null, start?: string | null, end?: string | null) =>
      ["attendance", "punches", pgId, staffId ?? null, start ?? null, end ?? null] as const,
    weekly: (pgId: string, staffId: string, weekStartDate: string) =>
      ["attendance", "weekly", pgId, staffId, weekStartDate] as const,
  },
} as const;
