import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { syncNgeniusOrder } from "@/lib/ngenius";

/**
 * N-Genius webhook (set in the N-Genius portal: Settings → Webhooks). Optional shared secret:
 * add a custom header "X-Webhook-Secret" with the value of NGENIUS_WEBHOOK_SECRET.
 * The body is only used to find the order; its status is always re-fetched from the N-Genius API.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.NGENIUS_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) return new NextResponse("forbidden", { status: 403 });
  const b = await req.json().catch(() => ({}));
  const ref = String(b?.order?.reference || b?.orderReference || "");
  if (!ref) return NextResponse.json({ ok: true, ignored: "no order reference" });
  const o = await db.query.orders.findFirst({ where: and(eq(s.orders.transactionId, ref), eq(s.orders.paymentMethod, "ngenius")) });
  if (!o) return NextResponse.json({ ok: true, ignored: "unknown order" });
  try { await syncNgeniusOrder(o.id); }
  catch (e) { console.error("N-Genius webhook:", e); return new NextResponse("retry", { status: 500 }); }
  return NextResponse.json({ ok: true });
}
