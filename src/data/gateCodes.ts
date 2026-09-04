/**
 * ADR-004's gate codes, and the one decision that reads them.
 *
 * Zero imports, deliberately — that is what lets a plain `node` check reach this. The rule
 * decides whether a resident is shown "pay to unlock meals" or a generic failure, and those
 * are not interchangeable: one has a next step, the other doesn't.
 *
 * `GATE_CODES` lives here rather than in `config.ts` because it is the gate's own vocabulary,
 * not an endpoint or an environment value. `config.ts` re-exports it so every existing import
 * path keeps working.
 */

/** The 403 codes the server uses to say "you may not do this *yet*" — mirrors
 *  `pg-backend/app/core/errors.py`'s gate reasons plus the forced-password-change case. */
export const GATE_CODES = [
  "PASSWORD_CHANGE_REQUIRED",
  "KYC_REQUIRED",
  "KYC_PENDING",
  "KYC_REJECTED",
  "RENT_UNPAID",
] as const;

export type GateCode = (typeof GATE_CODES)[number];

/**
 * Is this an ADR-004 gate, and which one?
 *
 * Both halves matter. A 403 that is NOT a gate code (a manager attempting an owner-only
 * action, say) must fall through to ordinary error handling rather than be dressed up as
 * "submit your KYC" — and a gate code arriving on any status other than 403 is not something
 * the server does, so honouring it would mean trusting a shape we never agreed on.
 */
export function gateCodeFrom(httpStatus: number, code: string | undefined): GateCode | null {
  if (httpStatus !== 403 || !code) return null;
  return (GATE_CODES as readonly string[]).includes(code) ? (code as GateCode) : null;
}
