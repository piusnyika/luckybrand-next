import "server-only";
import { prisma } from "@/lib/prisma";
import { setOrderStatus } from "./orders";
import { poll } from "./paynow";
import { applyPaynowStatus } from "./paynow-apply";
import { syncNgeniusOrder } from "./ngenius";
import { refreshBundleStock } from "./bundles";

/** Unpaid gateway orders are cancelled (stock released) after this long. Override with PAYMENT_TIMEOUT_MINUTES. */
const timeoutMinutes = () => Math.max(10, Number(process.env.PAYMENT_TIMEOUT_MINUTES) || 60);

/**
 * Background payment check (every 5 minutes, see src/instrumentation.ts, or via /api/cron/payments/):
 * asks Paynow / N-Genius for the status of every pending order, so orders get their final status even when
 * the customer never returns and a gateway notification is lost. Also re-checks unpaid orders cancelled in the
 * last 24h so a late payment is flagged "On hold" instead of being missed.
 */
export async function syncPendingPayments() {
  await refreshBundleStock(); // an item's scheduled sale may have started or ended
  const now = Date.now();
  const rows = (await prisma.order.findMany({
    where: {
      paymentMethod: { in: ["paynow", "ngenius"] },
      createdAt: { gt: new Date(now - 7 * 86_400_000) },
      OR: [{ status: "pending" }, { status: "cancelled", paidAt: null, createdAt: { gt: new Date(now - 86_400_000) } }],
    },
    select: { id: true, status: true, paymentMethod: true, createdAt: true, paynowPollUrl: true, transactionId: true },
    take: 100,
  })).map((o) => ({ id: o.id, status: o.status, method: o.paymentMethod, createdAt: o.createdAt, pollUrl: o.paynowPollUrl, ref: o.transactionId }));
  const out = { checked: 0, paid: 0, failed: 0, timedOut: 0, errors: 0 };
  for (const r of rows) {
    if (now - r.createdAt.getTime() < 60_000) continue; // give fresh checkouts a minute
    try {
      if (r.method === "paynow" && r.pollUrl) { const st = await poll(r.pollUrl); if (st) await applyPaynowStatus(r.id, r.status, st); }
      else if (r.method === "ngenius" && r.ref) await syncNgeniusOrder(r.id);
      out.checked++;
    } catch (e) { out.errors++; console.error(`payment check, order ${r.id}:`, (e as Error).message); }
    const after = await prisma.order.findUnique({ where: { id: r.id }, select: { status: true } });
    if (!after || after.status === r.status) {
      if (after?.status === "pending" && now - r.createdAt.getTime() > timeoutMinutes() * 60_000) {
        await setOrderStatus(r.id, "cancelled", r.method === "ngenius" ? "N-Genius" : "Paynow",
          `No payment received within ${timeoutMinutes()} minutes, so the order was cancelled and its stock released. If the payment arrives later, the order will be put On hold for you to check.`, false);
        out.timedOut++;
      }
      continue;
    }
    if (["processing", "on-hold", "completed"].includes(after.status)) out.paid++;
    else if (["failed", "cancelled"].includes(after.status)) out.failed++;
  }
  return out;
}
