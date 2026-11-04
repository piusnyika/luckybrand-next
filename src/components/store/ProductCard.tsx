import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/format";
import type { ProductCard as Card } from "@/lib/catalog";
import { AddToCartButton } from "./AddToCartButton";
import { WishButton } from "./WishButton";

export function Price({ p, className = "" }: { p: Pick<Card, "price" | "regularPrice" | "onSale">; className?: string }) {
  return (
    <span className={`font-bold text-ink ${className}`}>
      {p.onSale && <del className="mr-1.5 text-[0.8em] font-medium text-ink-muted">{money(p.regularPrice)}</del>}
      <span className={p.onSale ? "text-danger" : ""}>{money(p.price)}</span>
    </span>
  );
}

/** Just what the cart button needs: this data is sent to the browser once per card */
const forCart = ({ id, name, slug, price, image, stockStatus }: Card) => ({ id, name, slug, price, image, stockStatus });

function Thumb({ p, sizes }: { p: Card; sizes: string }) {
  return (
    <Link href={`/product/${p.slug}/`} className="relative block aspect-square overflow-hidden">
      {p.image ? (
        <Image src={p.image} alt={p.imageAlt} fill sizes={sizes} className="object-contain transition duration-300 group-hover:scale-[1.03]" />
      ) : <div className="flex h-full items-center justify-center bg-surface text-xs text-ink-muted">No image</div>}
      <span className="absolute left-0 top-0 flex flex-col items-start gap-1">
        {(p.onSale || p.badgeText) && (
          <span className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {p.badgeText || `-${Math.round((1 - p.price / p.regularPrice) * 100)}%`}
          </span>
        )}
        {p.isBundle && <span className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">Bundle</span>}
      </span>
    </Link>
  );
}

/** Card used in shop / category listings (bordered card with stock status) */
export function ProductCard({ p }: { p: Card }) {
  return (
    <div className="group relative flex h-full flex-col rounded-base border border-line bg-white p-3 transition hover:shadow-[0_6px_24px_rgba(0,0,0,.06)] sm:p-5">
      <WishButton id={p.id} className="absolute right-3 top-3 z-10 opacity-0 group-hover:opacity-100 max-lg:opacity-100" />
      <Thumb p={p} sizes="(max-width: 640px) 45vw, 230px" />
      <div className="mt-4 flex flex-1 flex-col">
        <span className={`text-xs font-semibold ${p.stockStatus === "outofstock" ? "text-danger" : "text-success"}`}>
          {p.stockStatus === "outofstock" ? "Out of stock" : p.stockStatus === "onbackorder" ? "On backorder" : "In Stock"}
        </span>
        <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-[1.3] sm:text-sm">
          <Link href={`/product/${p.slug}/`} className="hover:text-primary">{p.name}</Link>
        </h3>
        <Price p={p} className="mt-1.5 text-base sm:text-lg" />
        <div className="mt-auto pt-3"><AddToCartButton product={forCart(p)} className="w-full" /></div>
      </div>
    </div>
  );
}

/** Compact cell used in the homepage grids/carousels (price first, small button) */
export function ProductCell({ p }: { p: Card }) {
  return (
    <div className="group relative flex h-full flex-col bg-white p-3 sm:p-5">
      <WishButton id={p.id} className="absolute right-3 top-3 z-10 opacity-0 group-hover:opacity-100 max-lg:opacity-100" />
      <Thumb p={p} sizes="(max-width: 640px) 45vw, 200px" />
      <div className="mt-4 flex flex-1 flex-col">
        <Price p={p} className="text-base sm:text-lg" />
        <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-[1.3] sm:text-sm">
          <Link href={`/product/${p.slug}/`} className="hover:text-primary">{p.name}</Link>
        </h3>
        <div className="mt-auto pt-3"><AddToCartButton product={forCart(p)} /></div>
      </div>
    </div>
  );
}

/** Horizontal row for list view */
export function ProductRow({ p }: { p: Card }) {
  return (
    <div className="group flex gap-5 rounded-base border border-line bg-white p-4">
      <div className="w-32 shrink-0 sm:w-44"><Thumb p={p} sizes="180px" /></div>
      <div className="flex flex-1 flex-col justify-center">
        <span className={`text-xs font-semibold ${p.stockStatus === "outofstock" ? "text-danger" : "text-success"}`}>{p.stockStatus === "outofstock" ? "Out of stock" : "In Stock"}</span>
        <h3 className="mt-1 text-base font-semibold"><Link href={`/product/${p.slug}/`} className="hover:text-primary">{p.name}</Link></h3>
        {p.sku && <div className="mt-1 text-xs text-ink-muted">SKU: {p.sku}</div>}
        <Price p={p} className="mt-2 text-lg" />
        <div className="mt-3"><AddToCartButton product={forCart(p)} className="max-w-[260px]" /></div>
      </div>
    </div>
  );
}
