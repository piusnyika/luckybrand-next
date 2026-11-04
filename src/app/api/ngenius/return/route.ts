import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { syncNgeniusOrder, cancelUnpaidNgeniusOrder } from "@/lib/ngenius";

/** Customer comes back from the N-Genius payment page: /api/ngenius/return/?order=ID&key=ACCESS_KEY[&cancel=1] (N-Genius adds &ref=…) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = await getOrder(Number(sp.get("order")));
  if (!o || o.accessKey !== sp.get("key")) redirect("/");
  try {
    if (sp.get("cancel")) await cancelUnpaidNgeniusOrder(o.id);
    else await syncNgeniusOrder(o.id);
  } catch (e) { console.error("N-Genius return:", e); } // the order page shows "waiting for payment" and re-checks
  redirect(`/checkout/order-received/${o.id}/?key=${o.accessKey}`);
}
