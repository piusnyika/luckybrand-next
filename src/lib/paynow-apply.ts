import "server-only";
import { setOrderStatus, addNote, getOrder } from "./orders";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Applies a (hash-verified) Paynow status to an order. Safe to call repeatedly: from the result URL,
 * the return page and the background payment check. `_current` is kept for older callers; the order is re-read.
 */
export async function applyPaynowStatus(orderId: number, _current: string, r: { status: string; paid: boolean; failed: boolean; paynowReference: string; amount: string }) {
  const o = await getOrder(orderId);
  if (!o) return;
  if (r.paynowReference && o.transactionId !== r.paynowReference) await db.update(s.orders).set({ transactionId: r.paynowReference }).where(eq(s.orders.id, orderId));
  const st = r.status.toLowerCase(), by = "Paynow", ref = `Paynow reference: ${r.paynowReference || "–"}`;
  const open = o.status === "pending" || o.status === "failed";

  if (r.paid) {
    const amountOk = !r.amount || Math.abs(Number(r.amount) - Number(o.total)) < 0.005;
    if (!amountOk) {
      if (open || o.status === "cancelled") await setOrderStatus(o.id, "on-hold", by, `Paynow payment received (${r.status}) but the amount ${r.amount} doesn't match the order total ${o.total}. Check it in Paynow. ${ref}.`);
    } else if (open) {
      await setOrderStatus(o.id, "processing", by, `Paynow payment received (${r.status}). ${ref}. Amount: ${r.amount}.`);
    } else if (o.status === "cancelled") {
      // e.g. paid after the checkout timed out: money was taken, so flag it rather than ignore it
      await setOrderStatus(o.id, "on-hold", by, `Paynow payment received AFTER the order was cancelled. Fulfil or refund it. ${ref}. Amount: ${r.amount}.`);
    }
  } else if (st === "refunded") {
    if (["processing", "completed", "on-hold"].includes(o.status)) await setOrderStatus(o.id, "refunded", by, `Paynow reports this payment was refunded. ${ref}.`);
  } else if (st === "disputed") {
    if (o.status !== "on-hold") await setOrderStatus(o.id, "on-hold", by, `Paynow reports this payment is DISPUTED. Check it in Paynow before fulfilling. ${ref}.`);
  } else if (r.failed) {
    if (o.status === "pending") await setOrderStatus(o.id, st === "failed" ? "failed" : "cancelled", by, `Paynow transaction ${st}. ${ref}.`);
  } else if (o.status === "pending") {
    // still in progress (Created / Sent): note it once, not on every check
    const note = `Paynow status: ${r.status}`;
    if (!o.notes.some((n) => n.content === note)) await addNote(o.id, note, false, by);
  }
}
