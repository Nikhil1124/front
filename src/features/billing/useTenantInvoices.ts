/**
 * Tenant invoice hooks — `GET /v1/billing/tenant-invoices` plus pay + PDF.
 *
 * Mirrors `useBilling.ts`'s pattern: React Query for reads, `useMutation` for
 * writes with targeted cache invalidation. The "PDF" endpoint returns a binary
 * stream that we hand off to `expo-sharing` (already a dependency) so the
 * resident can save or share it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toTenantInvoice } from "../../data/mappers";
import type { TenantInvoice } from "../../types";

// ─── Plain functions ─────────────────────────────────────────────────────────

export async function listTenantInvoices(
  pgId: string,
  opts?: { tenantMembershipId?: string; status?: string },
): Promise<TenantInvoice[]> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts?.tenantMembershipId) params.append("tenant_membership_id", opts.tenantMembershipId);
  if (opts?.status) params.append("status", opts.status);
  const page = await apiFetch<Page<any>>(`${API.BILLING_TENANT_INVOICES}?${params.toString()}`);
  return page.items.map(toTenantInvoice);
}

export function payTenantInvoice(
  invoiceId: string,
  params: { method: "upi_intent" | "upi_manual" | "bank_transfer"; upi_ref?: string },
): Promise<TenantInvoice> {
  return apiFetch<TenantInvoice>(API.BILLING_TENANT_INVOICE_PAY(invoiceId), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Fetch the PDF bytes as a Blob and return a blob: URL the caller can hand to
 * `expo-sharing`. The backend signs a fresh S3 URL server-side; we proxy
 * through the API rather than constructing the URL client-side so the token
 * travels with the request.
 */
export async function fetchTenantInvoicePdfUrl(invoiceId: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(API.BILLING_TENANT_INVOICE_PDF(invoiceId));
  return res?.url ?? "";
}

// ─── React bindings ──────────────────────────────────────────────────────────

export function useTenantInvoices(pgId: string | null, tenantMembershipId?: string) {
  return useQuery({
    queryKey: qk.billing.tenantInvoices({ pgId: pgId ?? "", tenantMembershipId }),
    queryFn: () => listTenantInvoices(pgId!, { tenantMembershipId }),
    enabled: !!pgId,
  });
}

export function usePayTenantInvoice(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      invoiceId: string;
      method: "upi_intent" | "upi_manual" | "bank_transfer";
      upi_ref?: string;
    }) => payTenantInvoice(params.invoiceId, { method: params.method, upi_ref: params.upi_ref }),
    onSuccess: () => {
      // Any filter combination could have changed; clear the whole bucket.
      qc.invalidateQueries({ queryKey: qk.billing.tenantInvoicesAll() });
    },
  });
}
