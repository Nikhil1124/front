/**
 * The NPCI `upi://pay` deep link, on its own.
 *
 * Split out of `usePayments.ts` for one reason: that module imports `react-native`,
 * `expo-clipboard` and React Query, so nothing in it can be reached by a plain `node` check.
 * This is the highest-consequence pure function in the app — a malformed VPA sends a
 * resident's rent to whoever owns that address — so it is the one that most needs to stay
 * checkable. Same reasoning that keeps `data/mappers.ts` free of runtime imports.
 *
 * Deliberately dependency-free. Keep it that way.
 */

export interface LaunchUpiParams {
  upiId: string;
  payeeName?: string;
  amount: number;
  note?: string;
}

/**
 * Build the deep link, or null when the VPA is missing or incomplete.
 *
 * Never completes a partial VPA. Appending a default handle to `nikhil` would send the money
 * to whoever really owns `nikhil@ybl` — a real person, just not this owner. The backend
 * already rejects a VPA without '@', so reaching here without one means the stored data is
 * wrong and the only safe move is to refuse.
 */
export function buildUpiUri({
  upiId,
  payeeName = "PG Co Living",
  amount,
  note = "PG Rent Payment",
}: LaunchUpiParams): string | null {
  const cleanUpi = upiId.trim().toLowerCase();
  if (!cleanUpi || !cleanUpi.includes("@")) return null;

  const cleanName = payeeName.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "PG Co Living";
  const cleanNote = note.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "PG Rent";
  const formattedAmount = Number(amount).toFixed(2);
  const txnRef = `PGOW${Date.now()}`;
  const txnId = `T${Date.now()}`;

  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
    cleanName
  )}&mc=0000&tr=${txnRef}&tid=${txnId}&tn=${encodeURIComponent(
    cleanNote
  )}&am=${formattedAmount}&cu=INR`;
}
