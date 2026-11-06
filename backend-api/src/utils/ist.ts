/** India time helpers: the server runs in UTC, the business and its customers in IST. */
const IST_MS = 5.5 * 3600000;

/** "2026-11-06" for the IST calendar day of the given moment (now by default). */
export const istDay = (d: Date = new Date()) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
