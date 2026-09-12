/**
 * The invoice as a real PDF.
 *
 * Both invoice surfaces — a rent receipt and a finished laundry order — used to hand the share
 * sheet a block of plain text, because nothing here could produce a document. A resident
 * forwards this to an employer or a landlord, and those readers expect a file.
 *
 * HTML through `expo-print` rather than a PDF library: the platform print pipeline
 * (UIPrintPageRenderer on iOS, PrintManager on Android) already paginates, embeds fonts and
 * handles page size, so the whole job is laying out one page of HTML. A JS PDF builder would
 * mean shipping a parser and doing our own font metrics to produce something worse.
 *
 * ── Print is not the browser ────────────────────────────────────────────────────────────────
 * Three things here exist only because this is printed, and each is silent when missed:
 *
 *  - `print-color-adjust: exact`. Without it the renderer drops every background fill as an
 *    ink-saving courtesy, and the masthead, the total bar and the SAMPLE stamp all come out
 *    white-on-white. The document looks fine on screen right up until it is a PDF.
 *  - `@page { margin: 0 }` with the padding moved onto the page element, so the masthead can
 *    bleed to the paper edge. A page margin would box it in with a white gutter.
 *  - No webfonts. A `@font-face` fetch inside the print WebView races the render and loses
 *    silently, so the document would ship in a fallback face anyway; better to choose the
 *    fallback deliberately. Plus Jakarta Sans is the app's face, not this document's.
 *
 * `Print.printToFileAsync` writes to the cache directory, which is the right place: the file
 * exists to be handed to the share sheet, and the OS may reclaim it afterwards. Nothing here
 * needs it a second time — the same invoice regenerates byte-identically from the same payment,
 * since every value on it is derived (see invoice.ts).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Colors } from '@/theme';
import { formatINR } from '@/utils/format';
import { amountInWords, type Invoice } from './invoice';

/** Extra rows printed under the totals — payment mode, reference, receipt id. */
export type InvoiceExtras = Array<[label: string, value: string]>;

/** HTML escaping. Every value below is user or property data, so none of it is trusted markup. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * The document's palette, taken from the app's own tokens (src/theme/colors.ts) so a resident
 * who saves this recognises it as the same product. Two deliberate departures: the page is
 * true white rather than the app's warm canvas, because paper already supplies the warmth and
 * a tinted page fights whatever it is printed on; and the ink is a step darker than the app's
 * `textPrimary`, which is tuned for a backlit screen and prints weak.
 */
const C = {
  /** A step darker than `textPrimary`, which is tuned for a backlit screen and prints weak. */
  ink: '#1F2420',
  inkSoft: Colors.textSecondary,
  /** Between `textMuted` and `separator` — eyebrow labels that must recede without vanishing. */
  inkFaint: '#8C877C',
  forest: Colors.primaryDark,
  green: Colors.primary,
  clay: Colors.terracotta,
  panel: Colors.surfaceMuted,
  rule: Colors.borderSubtle,
  ruleFaint: Colors.separator,
  /** Reversed-out type on `forest`. Off-palette by necessity — nothing in a palette built for
   *  dark-on-light reads correctly on a dark band. Both clear AA on it. */
  onForest: '#EEF1EA',
  onForestSoft: '#A8BCA2',
  /** The caveat strip: terracotta at page-background weight, which the palette stops short of. */
  noticeFill: '#F6ECE2',
  noticeRule: '#E2CDB9',
  noticeInk: '#6E3A1E',
  tagFill: '#EFE0D3',
};

const SANS = `-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const SERIF = `"Iowan Old Style", Palatino, "Palatino Linotype", Georgia, "Noto Serif", serif`;

function invoiceHtml(inv: Invoice, extras: InvoiceExtras): string {
  const party = (label: string, p: Invoice['from'], sampleGstin: boolean) => `
    <div class="party">
      <div class="eyebrow">${label}</div>
      <div class="party-name">${esc(p.name)}</div>
      ${p.line ? `<div class="party-line">${esc(p.line)}</div>` : ''}
      ${p.gstin
        ? `<div class="party-gstin">GSTIN <span class="mono">${esc(p.gstin)}</span>${
            sampleGstin ? ' <span class="tag">sample</span>' : ''
          }</div>`
        : ''}
    </div>`;

  // A Qty column only when some row actually has one — an all-blank column on a rent
  // invoice reads as missing data rather than as not applicable.
  const anyQty = inv.lines.some((l) => l.qty != null);

  const statusNote = inv.gstinIsPlaceholder
    ? `<strong>Sample document.</strong> The GSTIN shown is a placeholder and is not registered
       to this business. Not valid as a tax invoice.`
    : !inv.isFinal
      ? `<strong>Provisional.</strong> This payment has not been verified by the property yet.`
      : '';

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  /* Bleed to the paper edge: the page element supplies its own padding instead. */
  @page { size: A4; margin: 0; }
  html, body {
    margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  * { box-sizing: border-box; }
  body { font-family: ${SANS}; color: ${C.ink}; font-size: 10.5pt; line-height: 1.5; }

  .page { position: relative; min-height: 297mm; padding: 0 0 16mm; }

  /* ── masthead ───────────────────────────────────────────────────────────── */
  .masthead {
    background: ${C.forest}; color: ${C.onForest};
    padding: 14mm 16mm 11mm; display: flex;
    justify-content: space-between; align-items: flex-start;
  }
  .wordmark { font-family: ${SERIF}; font-size: 27pt; line-height: 1;
              letter-spacing: -0.6px; color: ${C.onForest}; }
  .tagline { margin-top: 5px; font-size: 8pt; letter-spacing: 2.4px;
             text-transform: uppercase; color: ${C.onForestSoft}; }
  .doc-meta { text-align: right; }
  .doc-type { font-size: 12pt; letter-spacing: 3.4px; text-transform: uppercase;
              color: ${C.onForestSoft}; }
  .doc-number { font-size: 15pt; font-weight: 700; margin-top: 7px;
                font-variant-numeric: tabular-nums; color: ${C.onForest}; }
  .doc-date { font-size: 9.5pt; color: ${C.onForestSoft}; margin-top: 3px; }

  /* A single strip carries whichever caveat applies. Both matter enough to stop a reader
     before the figures, so it sits directly under the masthead, not in a footnote. */
  .status { padding: 7px 16mm; font-size: 9pt; color: ${C.noticeInk};
            background: ${C.noticeFill}; border-bottom: 1px solid ${C.noticeRule}; }

  .body { padding: 0 16mm; }

  /* ── parties ────────────────────────────────────────────────────────────── */
  .parties { display: flex; margin-top: 11mm; }
  .party { width: 50%; padding-right: 10mm; }
  .party + .party { border-left: 1px solid ${C.ruleFaint}; padding-left: 10mm;
                    padding-right: 0; }
  .eyebrow { font-size: 7.5pt; letter-spacing: 1.9px; text-transform: uppercase;
             color: ${C.inkFaint}; margin-bottom: 5px; }
  .party-name { font-size: 12.5pt; font-weight: 600; line-height: 1.3; }
  .party-line { color: ${C.inkSoft}; font-size: 9.5pt; margin-top: 3px; }
  .party-gstin { font-size: 9pt; color: ${C.inkSoft}; margin-top: 5px; }
  .mono { font-variant-numeric: tabular-nums; letter-spacing: 0.4px; font-weight: 600;
          color: ${C.ink}; }
  .tag { background: ${C.tagFill}; color: ${C.clay}; border-radius: 2px; padding: 1px 5px;
         font-size: 7pt; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }

  /* ── line items ─────────────────────────────────────────────────────────── */
  table.items { width: 100%; border-collapse: collapse; margin-top: 10mm; }
  table.items thead th {
    font-size: 7.5pt; letter-spacing: 1.9px; text-transform: uppercase; color: ${C.inkFaint};
    text-align: left; font-weight: 600; padding: 0 0 6px;
    border-bottom: 1.5px solid ${C.ink};
  }
  table.items thead th.num, table.items td.num { text-align: right; }
  table.items th.qty, table.items td.qty { width: 16mm; padding-right: 8mm; }
  table.items td { padding: 11px 0; border-bottom: 1px solid ${C.ruleFaint};
                   vertical-align: top; }
  .item-desc { font-weight: 600; font-size: 11pt; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* ── totals ─────────────────────────────────────────────────────────────── */
  /* Kept whole across a page break: a total severed from the tax line it sums is unreadable. */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 7mm;
                 page-break-inside: avoid; }
  .totals { width: 78mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0;
                 font-size: 10pt; color: ${C.inkSoft}; }
  .totals .row span:last-child { font-variant-numeric: tabular-nums; color: ${C.ink}; }
  .grand { display: flex; justify-content: space-between; align-items: baseline;
           background: ${C.green}; color: ${C.onForest}; padding: 9px 11px; margin-top: 7px;
           border-radius: 3px; }
  .grand .label { font-size: 8.5pt; letter-spacing: 1.7px; text-transform: uppercase; }
  .grand .value { font-size: 16pt; font-weight: 700; font-variant-numeric: tabular-nums; }

  .words { margin-top: 6mm; padding: 8px 11px; background: ${C.panel};
           border-left: 3px solid ${C.green}; border-radius: 2px;
           font-size: 9.5pt; page-break-inside: avoid; }
  .words .eyebrow { margin-bottom: 2px; }

  /* ── payment details ────────────────────────────────────────────────────── */
  .details { margin-top: 8mm; page-break-inside: avoid; }
  .details table { width: 100%; border-collapse: collapse; margin-top: 5px; }
  .details td { padding: 5px 0; font-size: 9.5pt; border-bottom: 1px solid ${C.ruleFaint}; }
  .details td:first-child { color: ${C.inkFaint}; width: 38mm; }
  .details td:last-child { color: ${C.ink}; font-variant-numeric: tabular-nums; }

  /* ── footer ─────────────────────────────────────────────────────────────── */
  .foot { margin-top: 12mm; padding: 7mm 16mm 0; border-top: 1px solid ${C.rule};
          font-size: 8.5pt; color: ${C.inkFaint}; line-height: 1.65; }
  .foot .note { margin-bottom: 5px; }

  /* The stamp sits behind the content and repeats on every page. Large and pale rather than
     a corner badge: it has to survive being photographed or forwarded as an image. */
  .stamp {
    position: fixed; top: 38%; left: 50%;
    transform: translate(-50%, -50%) rotate(-24deg);
    font-family: ${SERIF}; font-size: 68pt; font-weight: 700; letter-spacing: 6px;
    color: ${C.clay}; opacity: 0.07; white-space: nowrap; z-index: 0;
  }
  .content { position: relative; z-index: 1; }
</style></head>
<body>
${inv.gstinIsPlaceholder ? '<div class="stamp">SAMPLE</div>' : ''}
<div class="page"><div class="content">

  <div class="masthead">
    <div>
      <div class="wordmark">PGow</div>
      <div class="tagline">Co-living, managed</div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">Tax Invoice</div>
      <div class="doc-number">${esc(inv.number)}</div>
      <div class="doc-date">Issued ${esc(formatDate(inv.issuedAt))}</div>
    </div>
  </div>

  ${statusNote ? `<div class="status">${statusNote}</div>` : ''}

  <div class="body">
    <div class="parties">
      ${party('Billed by', inv.from, inv.gstinIsPlaceholder)}
      ${party('Billed to', inv.to, false)}
    </div>

    <table class="items">
      <thead><tr>
        <th>Description</th>
        ${anyQty ? '<th class="num qty">Qty</th>' : ''}
        <th class="num">Amount</th>
      </tr></thead>
      <tbody>${inv.lines
        .map(
          (l) => `<tr>
            <td><div class="item-desc">${esc(l.description)}</div></td>
            ${anyQty ? `<td class="num qty">${l.qty ?? ''}</td>` : ''}
            <td class="num">${esc(formatINR(l.amount))}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table>

    <div class="totals-wrap"><div class="totals">
      <div class="row"><span>Taxable value</span><span>${esc(formatINR(inv.taxableValue))}</span></div>
      <div class="row"><span>GST @ ${inv.taxRate}%</span><span>${esc(formatINR(inv.taxAmount))}</span></div>
      <div class="grand">
        <span class="label">Total</span>
        <span class="value">${esc(formatINR(inv.total))}</span>
      </div>
    </div></div>

    <div class="words">
      <div class="eyebrow">Amount in words</div>
      ${esc(amountInWords(inv.total))}
    </div>

    ${extras.length
      ? `<div class="details">
           <div class="eyebrow">Payment details</div>
           <table>${extras
             .map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`)
             .join('')}</table>
         </div>`
      : ''}
  </div>

  <div class="foot">
    ${inv.taxNote ? `<div class="note">${esc(inv.taxNote)}</div>` : ''}
    <div>Computer-generated document — no signature required. Generated by PGow.</div>
  </div>

</div></div>
</body></html>`;
}

/**
 * Render the invoice and hand it to the share sheet.
 *
 * Throws if sharing is unavailable so the caller can toast — silently doing nothing after a
 * button press is the one outcome worse than an error.
 */
export async function shareInvoicePdf(inv: Invoice, extras: InvoiceExtras = []): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(inv, extras) });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    // Android's chooser shows this; without it the sheet is titled with the temp filename.
    dialogTitle: `Invoice ${inv.number}`,
    UTI: 'com.adobe.pdf',
  });
}
