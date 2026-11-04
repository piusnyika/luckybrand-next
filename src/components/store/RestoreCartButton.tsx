"use client";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "./CartProvider";

/** After a failed / cancelled payment: put the order's items back in the cart and go to checkout */
export function RestoreCartButton({ lines }: { lines: CartLine[] }) {
  const { lines: current, replace } = useCart();
  const router = useRouter();
  if (!lines.length) return null;
  const restore = () => {
    const merged = [...current];
    for (const l of lines) { const ex = merged.find((m) => m.id === l.id); if (ex) ex.qty = Math.max(ex.qty, l.qty); else merged.push(l); }
    replace(merged);
    router.push("/checkout/");
  };
  return <button type="button" onClick={restore} className="btn-primary mt-3 h-10 text-sm">Restore my cart and try again</button>;
}
