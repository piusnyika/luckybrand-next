"use client";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { Icon } from "../Icon";
import type { ProductCard } from "@/lib/catalog";

/**
 * Add to cart with a − qty + control beside it (unless stepper={false}, e.g. the product page has its own).
 * Not in the cart yet: the control picks how many to add. In the cart: it shows and changes the cart quantity.
 */
export function AddToCartButton({ product, className = "", qty = 1, label = "Add to cart", variant = "primary", stepper = true }:
  { product: Pick<ProductCard, "id" | "name" | "slug" | "price" | "image" | "stockStatus">; className?: string; qty?: number; label?: string; variant?: "primary" | "green"; stepper?: boolean }) {
  const { add, lines, setQty, ready, setDrawerOpen } = useCart();
  const [pick, setPick] = useState(1);
  if (product.stockStatus === "outofstock") {
    return (
      <a href={`/product/${product.slug}/`} className={`inline-flex h-[35px] items-center justify-center gap-1.5 rounded-form bg-primary px-[18px] text-[13px] font-semibold text-white hover:bg-primary-700 ${className}`}>
        Read more <Icon name="cart" size={15} />
      </a>
    );
  }
  const color = variant === "green" ? "bg-[#2f9e44] hover:bg-[#2b8a3e]" : "bg-primary hover:bg-primary-700";
  const addNow = (n: number) => add({ id: product.id, name: product.name, slug: product.slug, price: product.price, image: product.image }, n);
  if (!stepper) {
    return (
      <button type="button" onClick={() => addNow(qty)} className={`inline-flex h-[35px] items-center justify-center rounded-form px-[18px] text-[13px] font-semibold text-white transition ${color} ${className}`}>
        {label}
      </button>
    );
  }

  const inCart = ready ? lines.find((l) => l.id === product.id) : undefined;
  const value = inCart ? inCart.qty : pick;
  const change = (n: number) => (inCart ? setQty(product.id, n) : setPick(Math.max(1, n)));
  const step = "flex w-7 items-center justify-center text-ink-soft transition hover:bg-surface hover:text-primary disabled:opacity-40";
  const qtyControl = (
    <div className={`inline-flex h-[35px] shrink-0 items-stretch overflow-hidden rounded-form border ${inCart ? "border-primary" : "border-line"}`}>
      <button type="button" onClick={() => change(value - 1)} disabled={!inCart && value <= 1} className={step}
        aria-label={inCart && value === 1 ? `Remove ${product.name} from cart` : "Decrease quantity"}>
        <Icon name={inCart && value === 1 ? "trash" : "minus"} size={14} strokeWidth={2.5} />
      </button>
      <span className={`flex min-w-[26px] items-center justify-center text-[13px] font-semibold ${inCart ? "text-primary" : "text-ink"}`} aria-live="polite"
        aria-label={inCart ? `${value} in cart` : `Quantity ${value}`}>{value}</span>
      <button type="button" onClick={() => change(value + 1)} className={step} aria-label="Increase quantity">
        <Icon name="plus" size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
  // button on the left, quantity control on the right
  return (
    <div className={`flex items-stretch gap-1.5 ${className}`}>
      {inCart ? (
        <button type="button" onClick={() => setDrawerOpen(true)} title="View cart"
          className="inline-flex h-[35px] min-w-0 flex-1 items-center justify-center gap-1 rounded-form border border-primary bg-primary-50 px-2 text-[13px] font-semibold text-primary transition hover:bg-primary hover:text-white">
          <Icon name="check" size={15} strokeWidth={3} /><span className="hidden truncate sm:inline">In cart</span>
        </button>
      ) : (
        <button type="button" onClick={() => { addNow(pick); setPick(1); }} title={label} aria-label={label}
          className={`inline-flex h-[35px] min-w-0 flex-1 items-center justify-center gap-1 rounded-form px-2 text-[13px] font-semibold text-white transition ${color}`}>
          <Icon name="cart" size={15} className="sm:hidden" /><span className="hidden truncate sm:inline">{label}</span>
        </button>
      )}
      {qtyControl}
    </div>
  );
}
