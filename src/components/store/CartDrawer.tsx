"use client";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { Icon } from "../Icon";
import { money } from "@/lib/format";
import { QtyInput } from "./QtyInput";

export function CartDrawer({ freeShipping }: { freeShipping: { threshold: number | null; message: string; success: string } }) {
  const { lines, subtotal, drawerOpen, setDrawerOpen, setQty, remove } = useCart();
  return (
    <>
      <div className={`fixed inset-0 z-[70] bg-black/40 transition ${drawerOpen ? "visible opacity-100" : "invisible opacity-0"}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`fixed right-0 top-0 z-[71] flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl transition-transform ${drawerOpen ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!drawerOpen}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">Shopping Cart</h2>
          <button type="button" aria-label="Close cart" onClick={() => setDrawerOpen(false)}><Icon name="close" /></button>
        </div>
        {freeShipping.threshold ? <ShippingBar subtotal={subtotal} {...freeShipping} threshold={freeShipping.threshold} /> : null}
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-ink-soft">
            <Icon name="bag" size={48} strokeWidth={1.2} />
            <p>No products in the cart.</p>
            <Link href="/shop/" onClick={() => setDrawerOpen(false)} className="rounded-form bg-primary px-5 py-2.5 text-sm font-semibold text-white">Return to shop</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => (
                <li key={l.id} className="flex gap-3 py-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image ? <img src={l.image} alt="" className="h-16 w-16 shrink-0 object-contain" /> : <div className="h-16 w-16 bg-surface" />}
                  <div className="flex-1">
                    <Link href={`/product/${l.slug}/`} onClick={() => setDrawerOpen(false)} className="line-clamp-2 text-sm font-semibold hover:text-primary">{l.name}</Link>
                    <div className="mt-1 text-sm font-bold">{money(l.price)}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <QtyInput value={l.qty} onChange={(q) => setQty(l.id, q)} small />
                      <button type="button" onClick={() => remove(l.id)} className="text-ink-muted hover:text-danger" aria-label="Remove"><Icon name="trash" size={16} /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-5">
              <div className="mb-4 flex justify-between text-base"><span className="font-medium">Subtotal:</span><span className="font-bold">{money(subtotal)}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/cart/" onClick={() => setDrawerOpen(false)} className="rounded-form border border-line py-3 text-center text-sm font-semibold hover:border-primary">View cart</Link>
                <Link href="/checkout/" onClick={() => setDrawerOpen(false)} className="rounded-form bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary-700">Checkout</Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
export function ShippingBar({ subtotal, threshold, message, success }: { subtotal: number; threshold: number; message: string; success: string }) {
  const pct = Math.min(100, (subtotal / threshold) * 100);
  const remaining = Math.max(0, threshold - subtotal);
  const done = remaining <= 0;
  // admin message: [remainder] or [remaining] = amount still needed
  const html = done ? success : message.replace(/\[(remainder|remaining)\]/g, `<strong>${money(remaining)}</strong>`);
  return (
    <div className={`border-b border-line px-5 py-3 text-[13px] leading-relaxed ${done ? "bg-green-50 text-green-900" : ""}`}>
      <p className="mb-2 flex gap-2">
        {done && <svg className="mt-0.5 shrink-0 text-success" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>}
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-success transition-all" style={{ width: pct + "%" }} /></div>
    </div>
  );
}
