"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { useQuote } from "./useQuote";
import { QtyInput } from "./QtyInput";
import { ShippingBar } from "./CartDrawer";
import { Icon } from "../Icon";
import { money } from "@/lib/format";

export function CartView({ freeShipping }: { freeShipping: { threshold: number | null; message: string; success: string } }) {
  const { lines, setQty, remove, ready } = useCart();
  const [coupon, setCoupon] = useState<string | null>(() => (typeof window !== "undefined" ? sessionStorage.getItem("lb_coupon") : null));
  const [code, setCode] = useState("");
  const [ship, setShip] = useState<number | null>(null);
  const { quote, loading } = useQuote(coupon, ship);
  const applyCoupon = (c: string | null) => { setCoupon(c); try { c ? sessionStorage.setItem("lb_coupon", c) : sessionStorage.removeItem("lb_coupon"); } catch {} };

  if (!ready) return <div className="py-20 text-center text-ink-muted">Loading cart…</div>;
  if (!lines.length) return (
    <div className="flex flex-col items-center gap-5 py-20 text-center">
      <Icon name="bag" size={64} strokeWidth={1} className="text-ink-muted" />
      <p className="text-lg">Your cart is currently empty.</p>
      <Link href="/shop/" className="btn-primary">Return to shop</Link>
    </div>
  );
  return (
    <div className="grid gap-8 pb-6 lg:grid-cols-[1fr_380px]">
      <div>
        {freeShipping.threshold ? <div className="mb-4 rounded-base border border-line"><ShippingBar subtotal={quote?.subtotal ?? 0} threshold={freeShipping.threshold} message={freeShipping.message} success={freeShipping.success} /></div> : null}
        {quote?.errors.map((e) => <p key={e} className="mb-3 rounded-form bg-red-50 px-4 py-3 text-sm text-danger">{e}</p>)}
        <div className="overflow-hidden rounded-base border border-line">
          <table className="w-full text-sm">
            <thead className="hidden bg-surface text-left text-xs uppercase tracking-wide text-ink-soft sm:table-header-group">
              <tr><th className="p-4" colSpan={2}>Product</th><th className="p-4">Price</th><th className="p-4">Quantity</th><th className="p-4 text-right">Subtotal</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => {
                const q = quote?.lines.find((x) => x.id === l.id);
                return (
                  <tr key={l.id} className="flex flex-wrap items-center gap-3 p-4 sm:table-row sm:p-0">
                    <td className="sm:p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image ? <img src={l.image} alt="" className="h-16 w-16 object-contain" /> : <div className="h-16 w-16 bg-surface" />}
                    </td>
                    <td className="flex-1 sm:p-4"><Link href={`/product/${l.slug}/`} className="font-semibold hover:text-primary">{l.name}</Link>
                      {q?.error && <div className="mt-1 text-xs text-danger">{q.error}</div>}</td>
                    <td className="hidden sm:table-cell sm:p-4">{money(l.price)}</td>
                    <td className="sm:p-4"><QtyInput value={l.qty} onChange={(v) => setQty(l.id, v)} max={q?.maxQty} small /></td>
                    <td className="font-semibold sm:p-4 sm:text-right">{money(l.price * l.qty)}</td>
                    <td className="sm:p-4"><button type="button" onClick={() => remove(l.id)} aria-label="Remove" className="text-ink-muted hover:text-danger"><Icon name="trash" size={18} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form className="mt-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) applyCoupon(code.trim()); }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon code" className="field" aria-label="Coupon code" />
          <button className="btn-outline shrink-0">Apply coupon</button>
        </form>
        {quote?.couponError && <p className="mt-2 text-sm text-danger">{quote.couponError}</p>}
      </div>
      <aside className="h-fit rounded-base border border-line p-6">
        <h2 className="mb-4 text-lg font-semibold">Cart totals</h2>
        <Totals quote={quote} loading={loading} ship={ship} setShip={setShip} onRemoveCoupon={() => applyCoupon(null)} />
        <Link href="/checkout/" className={`btn-primary mt-6 w-full ${quote?.errors.length ? "pointer-events-none opacity-50" : ""}`}>Proceed to checkout</Link>
      </aside>
    </div>
  );
}

export function Totals({ quote, loading, ship, setShip, onRemoveCoupon }: { quote: ReturnType<typeof useQuote>["quote"]; loading: boolean; ship: number | null; setShip: (n: number) => void; onRemoveCoupon?: () => void }) {
  if (!quote) return <div className="py-6 text-center text-sm text-ink-muted">Calculating…</div>;
  return (
    <div className={`space-y-3 text-sm transition ${loading ? "opacity-60" : ""}`}>
      <Row label="Subtotal" value={money(quote.subtotal)} />
      {quote.coupon && <Row label={<>Coupon: {quote.coupon.code} {onRemoveCoupon && <button type="button" onClick={onRemoveCoupon} className="ml-1 text-xs text-danger underline">[Remove]</button>}</>} value={"-" + money(quote.discount)} />}
      <div className="border-t border-line pt-3">
        <div className="mb-2 font-medium">Shipping</div>
        {quote.shippingOptions.length === 0 ? <p className="text-ink-muted">No shipping options available.</p> : quote.shippingOptions.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center justify-between gap-2 py-1">
            <span className="flex items-center gap-2"><input type="radio" name="shipping" checked={(ship ?? quote.shippingMethodId) === o.id} onChange={() => setShip(o.id)} className="accent-primary" />{o.name}</span>
            <span>{o.cost > 0 ? money(o.cost) : ""}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><span>Total</span><span>{money(quote.total)}</span></div>
    </div>
  );
}
const Row = ({ label, value }: { label: React.ReactNode; value: string }) => <div className="flex justify-between"><span className="text-ink-soft">{label}</span><span className="font-medium">{value}</span></div>;
