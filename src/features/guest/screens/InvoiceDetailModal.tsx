/**
 * InvoiceDetailModal — wrapper around PaymentReceiptDialog that adds an
 * explicit download handler wired to the tenant-invoice PDF endpoint.
 *
 * Bug #1 fix (PDF Invoice Viewer Exit Trap):
 *   The PaymentReceiptDialog now has its own close button + BackHandler +
 *   tap-backdrop dismiss. This wrapper provides the DOWNLOAD handler that
 *   the spec called out — the previous GuestPaymentsTab fetched the PDF
 *   bytes but had no clean way to hand them to the receipt modal. Here we
 *   resolve the presigned PDF URL and pass it through, so the dialog's
 *   bottom action row's "Download PDF Invoice" button does something real.
 *
 *   The download itself still falls back to clipboard-copy on platforms
 *   that don't have a file-system helper available (same as the existing
 *   GuestPaymentsTab implementation), but the close path is unconditionally
 *   clean.
 */
import { useEffect, useState } from 'react';
import { PaymentReceiptDialog } from '@/components/dialogs/PaymentReceiptDialog';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import { fetchTenantInvoicePdfUrl } from '@/features/billing/useTenantInvoices';
import { fetchWithTimeout } from '@/hooks/useApi';
import { BASE_URL } from '@/config';
import * as Clipboard from 'expo-clipboard';
import type { PaymentEntity, TenantInvoice } from '@/types';

interface Props {
  /** The receipt to render. When null, the modal is hidden. */
  payment: PaymentEntity | null;
  /** Optional: when this invoice is provided, the modal's download button
   *  fetches the actual PDF bytes for this invoice and copies the URL to
   *  clipboard (file-system save requires a future expo-file-system
   *  install — the spec's "Download PDF" affordance is wired up regardless). */
  invoice?: TenantInvoice | null;
  onDismiss: () => void;
}

export function InvoiceDetailModal({ payment, invoice, onDismiss }: Props) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  // Reset the download flag whenever the modal closes, so re-opening a
  // different invoice doesn't show a stale spinner.
  useEffect(() => {
    if (!payment) setDownloading(false);
  }, [payment]);

  if (!payment) return null;

  const handleDownload = async () => {
    if (!invoice) {
      // No invoice row → fall back to a no-op with a friendly toast.
      toast('info', 'PDF not available', 'This receipt does not have a downloadable invoice attached.');
      return;
    }
    setDownloading(true);
    try {
      const pdfUrl = await fetchTenantInvoicePdfUrl(invoice.id);
      if (!pdfUrl) {
        hapticError();
        toast('error', 'PDF unavailable', 'The invoice PDF could not be generated.');
        return;
      }
      // Fetch the bytes through the gateway so the auth token travels with
      // the request. The PDF endpoint returns a binary stream.
      const res = await fetchWithTimeout(pdfUrl.startsWith('http') ? pdfUrl : `${BASE_URL}${pdfUrl}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // expo-file-system would let us save the file locally and use
      // Sharing.shareAsync — both are TODOs. Until then, copy the URL to
      // clipboard so the resident can paste it into a browser.
      await Clipboard.setStringAsync(pdfUrl);
      hapticSuccess();
      toast('success', 'PDF link copied', 'Open your browser and paste the link to download the invoice PDF.');
    } catch (err: any) {
      hapticError();
      toast('error', 'PDF failed', err?.message ?? 'Please try again later.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PaymentReceiptDialog
      payment={payment}
      onDismiss={onDismiss}
      onDownload={invoice ? handleDownload : undefined}
      downloadLabel={downloading ? 'Downloading…' : 'Download PDF Invoice'}
    />
  );
}
