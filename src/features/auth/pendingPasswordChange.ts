/**
 * The temporary password, held in memory between the sign-in screen and the set-password
 * screen — and nowhere else.
 *
 * `changePassword` needs `current_password`, which is the temporary one the user just typed.
 * Carrying it across a route boundary has exactly two wrong answers and one right one:
 *
 *   - a route param puts a live credential into navigation state, where it can surface in a
 *     deep link, a log line, or a crash report;
 *   - `useAuthStore` is persisted through SecureStore/AsyncStorage, so parking it there
 *     writes the password to disk;
 *   - a module-level value lives only as long as the JS context, which is precisely the
 *     lifetime this needs.
 *
 * `take()` reads and clears in one step, so the value cannot outlive the one submit that
 * consumes it.
 */
let pending: string | null = null;

export function setPendingTempPassword(value: string): void {
  pending = value;
}

/** Read once and forget. Returns null if there is nothing pending. */
export function takePendingTempPassword(): string | null {
  const v = pending;
  pending = null;
  return v;
}

export function hasPendingTempPassword(): boolean {
  return pending !== null;
}

export function clearPendingTempPassword(): void {
  pending = null;
}
