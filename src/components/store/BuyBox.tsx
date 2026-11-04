"use client";
import { useState } from "react";
import { QtyInput } from "./QtyInput";
import { AddToCartButton } from "./AddToCartButton";
import { WishButton } from "./WishButton";
import { useCart } from "./CartProvider";
import { Icon } from "../Icon";
import { StockAlertForm } from "./StockAlertForm";
import type { ProductCard } from "@/lib/catalog";

export function BuyBox({ product, maxQty, whatsapp, productUrl, userEmail = "" }: {
  product: Pick<ProductCard, "id" | "name" | "slug" | "price" | "image" | "stockStatus">; maxQty: number | null; whatsapp: string; productUrl: string; userEmail?: string;
}) {
  const [qty, setQty] = useState(1);
  const { toggleCompare, lines, ready, setDrawerOpen } = useCart();
  const inCart = ready ? lines.find((l) => l.id === product.id) : undefined;
  const wa = whatsapp.replace(/[^\d]/g, "");
  return (
    <div className="mt-5">
      {wa && (
        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I would like to order: ${product.name} (${productUrl})`)}`} target="_blank" rel="noopener"
          className="inline-flex h-[38px] items-center gap-2 rounded-form bg-[#2f9e44] px-4 text-sm font-semibold text-white hover:bg-[#2b8a3e]">Order on WhatsApp</a>
      )}
      {product.stockStatus !== "outofstock" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QtyInput value={qty} onChange={setQty} max={maxQty} />
          <AddToCartButton product={product} qty={qty} variant="green" stepper={false} className="!h-[46px] !px-8 !text-[15px]" />
          <WishButton id={product.id} className="!h-[46px] !w-[46px] !rounded-form" />
          <button type="button" onClick={() => toggleCompare(product.id)} aria-label="Add to compare" className="flex h-[46px] w-[46px] items-center justify-center rounded-form border border-line hover:border-primary hover:text-primary"><Icon name="compare" size={18} /></button>
        </div>
      )}
      {product.stockStatus === "outofstock" && <StockAlertForm productId={product.id} email={userEmail} />}
      <p className="mt-4 text-sm text-ink-soft">Buying for a project or in bulk?{" "}
        <a href={`/request-a-quote/?product=${product.id}&qty=${qty}`} className="font-semibold text-primary hover:underline">Request a quote</a></p>
      {inCart && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
          <Icon name="check" size={16} strokeWidth={3} />
          <span><strong>{inCart.qty}</strong> in your cart ·{" "}
            <button type="button" onClick={() => setDrawerOpen(true)} className="font-semibold text-primary hover:underline">View cart</button></span>
        </p>
      )}
    </div>
  );
}
