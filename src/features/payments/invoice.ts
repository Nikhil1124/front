/**
 * The invoice details for one payment.
 *
 * A payment already had a receipt screen whose footer called it an "official co-living
 * verified tax invoice", but it carried none of what makes a document one: no invoice number,
 * no bill-from/bill-to, no taxable value, no tax line. This derives those from the payment
 * itself so every payment has an invoice, with nothing new to store.
 *
 * ── Derived, never generated ────────────────────────────────────────────────────────────────
 * The number is a pure function of the payment's own id and date. That matters more than it
 * looks: an invoice number that changed between two viewings of the same payment — which any
 * `Math.random()` or `Date.now()` would do — is worse than no number at all, because the
 * resident forwards one to an employer and the owner reads a different one off their screen.
 * Same payment, same number, on every device, forever.
 *
 * ── What this does NOT invent ───────────────────────────────────────────────────────────────
 * No GSTIN. A GSTIN is a real regulatory identifier issued to a real business; printing a
 * plausible-looking one on something headed "tax invoice" is not a placeholder, it is a forged
 * credential. It appears only if the property genuinely has one recorded — `gstin` below is
 * passed in, never fabricated — and the document says "not GST registered" when it does not.
 *
 * Residential accommodation let for use as a residence is exempt under Notification 12/2017
 * (Heading 9963/9972), which is why the tax line reads 0% rather than 18%. That is the common
 * case for a PG; a property that is registered and charging GST should pass its own rate in.
 */
import { formatINR } from '@/utils/format';

export interface InvoiceParty {
  name: string;
  /** Optional — a PG address, a resident's room. Omitted from the document when empty. */
  line?: string;
  /** Only ever a real one. See the header: this is not filled with a placeholder. */
  gstin?: string;
}

export interface Invoice {
  number: string;
  /** The date the invoice is issued for — when the money was verified, else when it was paid. */
  issuedAt: number;
  from: InvoiceParty;
  to: InvoiceParty;
  description: string;
  /** Rupees, exclusive of tax. Equal to `total` while the rate is 0. */
  taxableValue: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  /** False until the owner verifies — an unverified payment is a claim, not a document. */
  isFinal: boolean;
}

/**
 * India's financial year for a given date, as "2026-27". Invoice series restart each April,
 * so the year belongs in the number.
 */
function financialYear(d: Date): string {
  const y = d.getFullYear();
  // April (month 3) starts the new year; Jan–Mar still belong to the previous one.
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The payment's id, folded to six stable digits. Not a counter — the client cannot know the
 *  property's sequence — but unique per payment and identical on every device. */
function serial(paymentId: string): string {
  let hash = 0;
  for (let i = 0; i < paymentId.length; i += 1) {
    hash = (hash * 31 + paymentId.charCodeAt(i)) % 1_000_000;
  }
  return String(hash).padStart(6, '0');
}

export interface BuildInvoiceInput {
  paymentId: string;
  amount: number;
  monthYear: string;
  paymentType: string;
  /** Verified date if there is one, else the paid date. */
  issuedAt: number;
  isVerified: boolean;
  from: InvoiceParty;
  to: InvoiceParty;
  /** Percent. Defaults to 0 — see the header on why residential rent is exempt. */
  taxRate?: number;
}

export function buildInvoice(input: BuildInvoiceInput): Invoice {
  const issuedAt = input.issuedAt || Date.now();
  const date = new Date(issuedAt);
  const taxRate = input.taxRate ?? 0;
  // The amount collected is what the resident paid, so it is tax-INCLUSIVE — the taxable value
  // is backed out of it rather than added on top, which is how a receipt for money already
  // taken has to work. At 0% the two are the same number.
  const taxableValue = taxRate > 0 ? input.amount / (1 + taxRate / 100) : input.amount;
  const taxAmount = input.amount - taxableValue;

  return {
    number: `PGOW/${financialYear(date)}/${serial(input.paymentId)}`,
    issuedAt,
    from: input.from,
    to: input.to,
    description: describe(input.paymentType, input.monthYear),
    taxableValue: round2(taxableValue),
    taxRate,
    taxAmount: round2(taxAmount),
    total: input.amount,
    isFinal: input.isVerified,
  };
}

function describe(paymentType: string, monthYear: string): string {
  const t = paymentType.toUpperCase();
  if (t.includes('LAUNDRY')) return `Laundry service — ${monthYear}`;
  if (t.includes('FOOD')) return `Food and mess charges — ${monthYear}`;
  if (t.includes('SUBSCRIPTION')) return `PGow subscription — ${monthYear}`;
  if (t.includes('DEPOSIT')) return `Security deposit — ${monthYear}`;
  return `Accommodation charges — ${monthYear}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The invoice as shareable text. Mirrors what the screen shows, in the order it shows it. */
export function invoiceAsText(inv: Invoice): string {
  return [
    `TAX INVOICE  ${inv.number}`,
    inv.isFinal ? null : '(PROVISIONAL — awaiting verification)',
    '',
    `From: ${inv.from.name}${inv.from.line ? `, ${inv.from.line}` : ''}`,
    inv.from.gstin ? `GSTIN: ${inv.from.gstin}` : null,
    `To:   ${inv.to.name}${inv.to.line ? `, ${inv.to.line}` : ''}`,
    '',
    inv.description,
    `Taxable value: ${formatINR(inv.taxableValue)}`,
    `GST @ ${inv.taxRate}%: ${formatINR(inv.taxAmount)}`,
    `Total: ${formatINR(inv.total)}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
