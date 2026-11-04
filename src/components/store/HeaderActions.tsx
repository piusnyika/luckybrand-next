"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { ShippingBar } from "./CartDrawer";
import { Icon } from "../Icon";
import { money } from "@/lib/format";

type FreeShipping = { threshold: number | null; message: string; success: string };

export function HeaderActions({ loggedIn, name, freeShipping }: { loggedIn: boolean; name: string; freeShipping: FreeShipping }) {
  const { count, setDrawerOpen, drawerOpen, ready } = useCart();
  // desktop: hovering "My Cart" previews the cart (small delay so moving onto the panel doesn't close it)
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = () => { clearTimeout(timer.current); setHover(true); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setHover(false), 180); };
  useEffect(() => { if (drawerOpen) setHover(false); }, [drawerOpen]);
  return (
    <div className="ml-auto flex items-center gap-5 lg:ml-0">
      <Link href="/my-account/" className="hidden flex-col items-center text-[11px] font-medium text-ink hover:text-primary sm:flex">
        <Icon name="userCircle" size={24} /><span className="mt-1">{loggedIn ? (name ? `Hi, ${name}` : "My Account") : "My Account"}</span>
      </Link>
      <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
        <button type="button" onClick={() => { setHover(false); setDrawerOpen(true); }} aria-haspopup="true" aria-expanded={hover}
          className="relative flex flex-col items-center text-[11px] font-medium text-ink hover:text-primary">
          <Icon name="bag" size={24} /><span className="mt-1 hidden sm:block">My Cart</span>
          <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{ready ? count : 0}</span>
        </button>
        {hover && ready && <MiniCart freeShipping={freeShipping} close={() => setHover(false)} />}
      </div>
    </div>
  );
}

function MiniCart({ freeShipping, close }: { freeShipping: FreeShipping; close: () => void }) {
  const { lines, count, subtotal, remove } = useCart();
  return (
    <div className="absolute right-0 top-full z-50 hidden pt-3 lg:block">
      <div className="w-[360px] animate-toast-in rounded-base border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">My Cart <span className="font-normal text-ink-muted">({count} item{count === 1 ? "" : "s"})</span></span>
        </div>
        {lines.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-soft">
            <Icon name="bag" size={36} strokeWidth={1.2} className="mx-auto mb-2 text-ink-muted" />
            Your cart is empty.
            <Link href="/shop/" onClick={close} className="mt-3 block font-semibold text-primary hover:underline">Start shopping</Link>
          </div>
        ) : (<>
          <ul className="max-h-[300px] divide-y divide-line overflow-y-auto px-4">
            {lines.map((l) => (
              <li key={l.id} className="flex gap-3 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-form border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image && <img src={l.image} alt="" className="h-full w-full object-contain" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${l.slug}/`} onClick={close} className="line-clamp-2 text-[13px] font-semibold leading-snug hover:text-primary">{l.name}</Link>
                  <div className="mt-0.5 text-xs text-ink-soft">{l.qty} × {money(l.price)}</div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <span className="text-[13px] font-bold">{money(l.qty * l.price)}</span>
                  <button type="button" onClick={() => remove(l.id)} aria-label={`Remove ${l.name}`} className="text-ink-muted hover:text-danger"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line px-4 py-3 text-sm"><span className="font-medium">Subtotal</span><span className="font-bold">{money(subtotal)}</span></div>
          {freeShipping.threshold ? <ShippingBar subtotal={subtotal} threshold={freeShipping.threshold} message={freeShipping.message} success={freeShipping.success} /> : null}
          <div className="grid grid-cols-2 gap-2 p-4">
            <Link href="/cart/" onClick={close} className="rounded-form border border-line py-2.5 text-center text-sm font-semibold hover:border-primary">View cart</Link>
            <Link href="/checkout/" onClick={close} className="rounded-form bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-700">Checkout</Link>
          </div>
        </>)}
      </div>
    </div>
  );
}
