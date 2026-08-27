/**
 * Which trade a complaint needs, and what to say when booking one.
 *
 * The owner is escalating to an area manager who has never seen the property and cannot see
 * this ticket's photos — `GET /v1/requests/escalated` is their whole view of it. So the note
 * is the brief. Making the owner compose one from a blank box at the moment they are annoyed
 * about a leak is how you get notes that read "fix tap", which costs a phone call to turn
 * into a dispatchable job.
 *
 * The draft is a starting point, not a submission: it is pre-filled and fully editable, and
 * the category it keys off is the one the resident already picked when they raised the
 * ticket, so nothing new is asked of anybody.
 */

export type Trade = "electrician" | "plumber" | "carpenter" | "appliance" | "pest" | "technician";

export interface TradeSpec {
  trade: Trade;
  /** What the button says: "Book an electrician", not a generic "Escalate". */
  label: string;
  icon: string;
  /** Pre-filled, editable note sent to the area manager as the job brief. */
  draft: string;
}

const SPECS: Record<Trade, Omit<TradeSpec, "trade">> = {
  electrician: {
    label: "Book an electrician",
    icon: "flash-outline",
    draft:
      "Electrical fault reported by a resident. Please arrange a licensed electrician. " +
      "Access is available during the day; the resident's contact is on the ticket.",
  },
  plumber: {
    label: "Book a plumber",
    icon: "water-outline",
    draft:
      "Plumbing fault reported by a resident. Please arrange a plumber. Water supply to the " +
      "affected fixture can be isolated if needed; the resident's contact is on the ticket.",
  },
  carpenter: {
    label: "Book a carpenter",
    icon: "hammer-outline",
    draft:
      "Furniture or fitting damage reported by a resident. Please arrange a carpenter to " +
      "inspect and repair.",
  },
  appliance: {
    label: "Book an appliance engineer",
    icon: "construct-outline",
    draft:
      "Appliance fault reported by a resident. Please arrange an engineer for the affected " +
      "unit. Make and model can be confirmed on site.",
  },
  pest: {
    label: "Book pest control",
    icon: "bug-outline",
    draft:
      "Pest issue reported by a resident. Please arrange pest control treatment for the " +
      "affected room and adjacent areas.",
  },
  technician: {
    label: "Book a technician",
    icon: "build-outline",
    draft:
      "Maintenance issue reported by a resident that cannot be handled by on-site staff. " +
      "Please arrange an appropriate technician.",
  },
};

/**
 * Category text → trade. Substring matching on lowercase, because `category` is free text
 * from the resident's picker rather than an enum, and the picker's wording has already
 * changed once. An unrecognised category falls to the generic technician rather than
 * guessing — a wrong trade wastes a call-out fee.
 */
const RULES: [RegExp, Trade][] = [
  [/electric|wiring|socket|switch|light|fan|power|short circuit|mcb|inverter/i, "electrician"],
  [/plumb|water|tap|leak|pipe|drain|flush|toilet|geyser|sink|basin|seepage/i, "plumber"],
  [/carpent|furniture|door|window|cupboard|wardrobe|bed frame|hinge|lock/i, "carpenter"],
  [/appliance|fridge|refrigerat|washing machine|microwave|ac\b|air.?condition|cooler|chimney/i, "appliance"],
  [/pest|cockroach|rodent|rat\b|termite|bedbug|bed bug|mosquito|ant\b/i, "pest"],
];

export function tradeForComplaint(category?: string | null, title?: string | null): TradeSpec {
  const haystack = `${category ?? ""} ${title ?? ""}`;
  const hit = RULES.find(([pattern]) => pattern.test(haystack));
  const trade: Trade = hit ? hit[1] : "technician";
  return { trade, ...SPECS[trade] };
}

/** The full pre-filled brief, with the ticket's own details folded in. */
export function draftNoteFor(
  spec: TradeSpec,
  ticket: { title?: string | null; roomNo?: string | null; description?: string | null }
): string {
  const room = ticket.roomNo ? `Room ${ticket.roomNo}` : "Room not recorded";
  const what = ticket.title?.trim() || "Issue reported";
  const detail = ticket.description?.trim();
  return [
    `${room} — ${what}.`,
    detail ? `Resident's description: ${detail}` : null,
    "",
    spec.draft,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
