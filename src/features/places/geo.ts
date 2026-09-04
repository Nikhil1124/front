/** Round for display and for sending — six decimals is ~11 cm, finer than any building. */
export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
