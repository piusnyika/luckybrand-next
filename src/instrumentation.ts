/**
 * Runs once when the Next.js server starts. Schedules the background payment check every 5 minutes
 * (Paynow / N-Genius status for pending orders, timeout of abandoned checkouts). It calls the app's own
 * /api/cron/payments/ route so the check runs with the normal server code; the token stays in memory.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.PAYMENT_SYNC === "off") return;
  const g = globalThis as { __lbSyncToken?: string; __lbSyncTimer?: ReturnType<typeof setInterval> };
  if (g.__lbSyncTimer) return; // dev server reloads
  g.__lbSyncToken = crypto.randomUUID();
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/payments/`;
  const tick = () => fetch(url, { method: "POST", headers: { "x-sync-token": g.__lbSyncToken! } })
    .then(async (r) => { if (!r.ok) console.error("payment check:", r.status, await r.text()); })
    .catch((e) => console.error("payment check unreachable:", e.message));
  setTimeout(tick, 60_000);
  g.__lbSyncTimer = setInterval(tick, 5 * 60_000);
}
