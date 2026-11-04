"use client";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import type { Quote } from "@/lib/orders";

/** Re-prices the local cart on the server whenever it changes; syncs price/stock fixes back into the cart. */
export function useQuote(coupon: string | null, shippingMethodId: number | null) {
  const { lines, ready, replace } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(lines.map((l) => [l.id, l.qty]));
  useEffect(() => {
    if (!ready) return;
    let cancel = false; setLoading(true);
    fetch("/api/cart/quote/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: lines.map((l) => ({ id: l.id, qty: l.qty })), coupon, shippingMethodId }) })
      .then((r) => r.json()).then((q: Quote) => {
        if (cancel) return; setQuote(q); setLoading(false);
        const fresh = q.lines.map((l) => ({ id: l.id, qty: l.qty, name: l.name, slug: l.slug, price: l.price, image: l.image }));
        const changed = fresh.length !== lines.length || fresh.some((f, i) => f.price !== lines[i]?.price || f.name !== lines[i]?.name);
        if (changed) replace(fresh);
      }).catch(() => setLoading(false));
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, coupon, shippingMethodId]);
  return { quote, loading };
}
