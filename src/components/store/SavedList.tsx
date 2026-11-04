"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { AddToCartButton } from "./AddToCartButton";
import { Icon } from "../Icon";
import { money, stripHtml } from "@/lib/format";

type P = { id: number; name: string; slug: string; price: number; regularPrice: number; image: string | null; stockStatus: "instock" | "outofstock" | "onbackorder"; sku: string | null; brand?: string; categories?: string[]; attributes?: { name: string; values: string[] }[] | null; shortDescription?: string; weight?: string };

function useProducts(ids: number[], full = false) {
  const [items, setItems] = useState<P[] | null>(null);
  const key = ids.join(",");
  useEffect(() => { if (!key) { setItems([]); return; } fetch(`/api/products/?ids=${key}${full ? "&full=1" : ""}`).then((r) => r.json()).then(setItems); }, [key, full]);
  return items;
}

export function WishlistView() {
  const { wishlist, toggleWish, ready } = useCart();
  const items = useProducts(ready ? wishlist : []);
  if (!ready || items === null) return <p className="py-16 text-center text-ink-muted">Loading…</p>;
  if (!items.length) return <Empty text="Your wishlist is currently empty." />;
  return (
    <div className="overflow-x-auto rounded-base border border-line">
      <table className="w-full text-sm"><tbody className="divide-y divide-line">
        {items.map((p) => (
          <tr key={p.id}>
            <td className="w-10 p-3"><button onClick={() => toggleWish(p.id)} aria-label="Remove" className="text-ink-muted hover:text-danger"><Icon name="close" size={18} /></button></td>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <td className="w-20 p-3">{p.image && <img src={p.image} alt="" className="h-16 w-16 object-contain" />}</td>
            <td className="p-3"><Link href={`/product/${p.slug}/`} className="font-semibold hover:text-primary">{p.name}</Link></td>
            <td className="p-3 font-semibold">{money(p.price)}</td>
            <td className={`p-3 text-xs font-semibold ${p.stockStatus === "outofstock" ? "text-danger" : "text-success"}`}>{p.stockStatus === "outofstock" ? "Out of stock" : "In Stock"}</td>
            <td className="p-3"><AddToCartButton product={p} className="ml-auto max-w-[240px]" /></td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function CompareView() {
  const { compare, toggleCompare, ready } = useCart();
  const items = useProducts(ready ? compare : [], true);
  if (!ready || items === null) return <p className="py-16 text-center text-ink-muted">Loading…</p>;
  if (!items.length) return <Empty text="No products added to compare." />;
  const attrNames = [...new Set(items.flatMap((p) => (p.attributes ?? []).map((a) => a.name)))];
  const row = (label: string, cell: (p: P) => React.ReactNode) => (
    <tr><th className="w-40 bg-surface p-3 text-left text-xs font-semibold uppercase text-ink-soft">{label}</th>{items.map((p) => <td key={p.id} className="min-w-[200px] p-3 align-top">{cell(p)}</td>)}</tr>
  );
  return (
    <div className="overflow-x-auto rounded-base border border-line">
      <table className="w-full text-sm"><tbody className="divide-y divide-line">
        {row("Product", (p) => <div>
          <button onClick={() => toggleCompare(p.id)} className="mb-2 text-xs text-ink-muted hover:text-danger">× Remove</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.image && <img src={p.image} alt="" className="mb-2 h-32 w-32 object-contain" />}
          <Link href={`/product/${p.slug}/`} className="font-semibold hover:text-primary">{p.name}</Link></div>)}
        {row("Price", (p) => <strong>{money(p.price)}</strong>)}
        {row("Availability", (p) => <span className={p.stockStatus === "outofstock" ? "text-danger" : "text-success"}>{p.stockStatus === "outofstock" ? "Out of stock" : "In Stock"}</span>)}
        {row("Brand", (p) => p.brand || "—")}
        {row("SKU", (p) => p.sku || "—")}
        {row("Description", (p) => <span className="text-ink-soft">{stripHtml(p.shortDescription).slice(0, 200) || "—"}</span>)}
        {attrNames.map((n) => row(n, (p) => (p.attributes ?? []).find((a) => a.name === n)?.values.join(", ") || "—"))}
        {row("", (p) => <AddToCartButton product={p} />)}
      </tbody></table>
    </div>
  );
}
const Empty = ({ text }: { text: string }) => <div className="flex flex-col items-center gap-5 py-16 text-center"><p className="text-lg">{text}</p><Link href="/shop/" className="btn-primary">Return to shop</Link></div>;
