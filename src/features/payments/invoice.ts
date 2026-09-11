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
 * ── The GSTIN ───────────────────────────────────────────────────────────────────────────────
 * A property's real GSTIN is used when one is recorded. Nothing records one yet, so the
 * document falls back to PLACEHOLDER_GSTIN, and that fallback sets `gstinIsPlaceholder`.
 *
 * Every surface that renders the invoice must honour that flag by stamping the document
 * SAMPLE, because a GSTIN is a real regulatory identifier issued to a real business: the
 * number below belongs to nobody, and a "tax invoice" carrying an unmarked one that belongs to
 * nobody is a forged credential rather than a placeholder. Marked, it is a demo document and
 * reads as one. Swap in the real GSTIN and the stamp disappears on its own.
 *
 * Kept free of runtime imports so `logic.check.ts` can reach it under plain node — the same
 * constraint upiUri.ts and roles.ts carry. Formatting belongs to whoever renders it.
 *
 * Residential accommodation let for use as a residence is exempt under Notification 12/2017
 * (Heading 9963/9972), which is why the tax line reads 0% rather than 18%. That is the common
 * case for a PG; a property that is registered and charging GST should pass its own rate in.
 */

export interface InvoiceParty {
  name: string;
  /** Optional — a PG address, a resident's room. Omitted from the document when empty. */
  line?: string;
  /** A real one if the property has it. Left empty, `buildInvoice` fills the placeholder. */
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
  /** True when `from.gstin` is PLACEHOLDER_GSTIN. Renderers must stamp the document SAMPLE. */
  gstinIsPlaceholder: boolean;
}

/**
 * Stands in until a property records its own GSTIN.
 *
 * Correctly shaped — 2-digit state code (29, Karnataka), 10-char PAN, entity digit, 'Z',
 * checksum — so layout and print output match a real document. The PAN block is deliberately
 * all A's and 0's: it is issued to nobody and reads as filler at a glance, which a
 * random-looking string would not.
 */
export const PLACEHOLDER_GSTIN = '29AAAAA0000A1Z5';

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

  const gstin = input.from.gstin?.trim() || PLACEHOLDER_GSTIN;

  return {
    number: `PGOW/${financialYear(date)}/${serial(input.paymentId)}`,
    issuedAt,
    from: { ...input.from, gstin },
    gstinIsPlaceholder: gstin === PLACEHOLDER_GSTIN,
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

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under1000(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]).trim();
  return (ONES[Math.floor(n / 100)] + ' Hundred ' + under1000(n % 100)).trim();
}

/**
 * The total spelled out, as an Indian tax invoice is expected to carry it.
 *
 * Grouped the Indian way — crore, lakh, thousand — not in millions: this document is read in
 * India, and "Twelve Lakh" is the form a reader here checks the figures against.
 */
export function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - whole) * 100);

  const groups: Array<[number, string]> = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1000, 'Thousand'],
  ];

  let rest = whole;
  const parts: string[] = [];
  for (const [size, name] of groups) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${under1000(count)} ${name}`);
      rest -= count * size;
    }
  }
  if (rest > 0) parts.push(under1000(rest));

  const rupees = parts.length > 0 ? parts.join(' ') : 'Zero';
  const tail = paise > 0 ? ` and ${under1000(paise)} Paise` : '';
  return `Rupees ${rupees}${tail} Only`;
}
