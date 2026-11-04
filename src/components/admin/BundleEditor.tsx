"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { money } from "@/lib/format";

export type BundleRow = { productId: number; qty: number; name: string; sku: string; image: string | null; price: number; stock: string; missing?: boolean };
type Hit = { id: number; name: string; sku: string; image: string | null; price: number; stock: string; status: string };

/** Pick the products (by SKU or name) and quantities that make up a bundle. Saves as hidden input "bundleItems". */
export function BundleEditor({ initial }: { initial: BundleRow[] }) {
  const [rows, setRows] = useState<BundleRow[]>(initial);
  const [q, setQ] = useState(""); const [hits, setHits] = useState<Hit[]>([]); const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/products/search/?q=${encodeURIComponent(q.trim())}`);
      setHits(r.ok ? await r.json() : []); setOpen(true);
    }, 200);
  }, [q]);
  const add = (h: Hit) => {
    setRows((cur) => cur.some((r) => r.productId === h.id) ? cur.map((r) => (r.productId === h.id ? { ...r, qty: r.qty + 1 } : r))
      : [...cur, { productId: h.id, qty: 1, name: h.name, sku: h.sku, image: h.image, price: h.price, stock: h.stock }]);
    setQ(""); setHits([]); setOpen(false);
  };
  const combined = rows.reduce((a, r) => a + r.price * r.qty, 0);

  return (
    <div className="space-y-3">
      <input type="hidden" name="bundleItems" value={JSON.stringify(rows.map((r) => ({ productId: r.productId, qty: r.qty })))} />
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0]) add(hits[0]); } }}
          placeholder="Add a product: type its SKU or name, then Enter" className="field" aria-label="Search products to add to the bundle" />
        {open && hits.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-form border border-line bg-white shadow-lg">
            {hits.map((h) => (
              <li key={h.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.image ? <img src={h.image} alt="" className="h-9 w-9 rounded object-contain" /> : <span className="h-9 w-9 rounded bg-surface" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.name}</span><span className="text-xs text-ink-muted">{h.sku || "no SKU"} · {h.stock}{h.status === "draft" ? " · draft" : ""}</span></span>
                <span className="font-semibold">{money(h.price)}</span>
              </button></li>
            ))}
          </ul>
        )}
        {open && q.trim().length >= 2 && hits.length === 0 && <p className="mt-1 text-xs text-ink-muted">No matching products (bundles can't contain other bundles).</p>}
      </div>

      {rows.length === 0 ? <p className="rounded-form border border-dashed border-line p-4 text-center text-sm text-ink-muted">No products in this bundle yet.</p> : (
        <ul className="divide-y divide-line rounded-form border border-line">
          {rows.map((r, i) => (
            <li key={r.productId} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.missing ? "bg-red-50" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded object-contain" /> : <span className="h-10 w-10 rounded bg-surface" />}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span>
                <span className={`text-xs ${r.missing || r.stock === "Out of stock" ? "text-danger" : "text-ink-muted"}`}>{r.sku || "no SKU"} · {r.missing ? "deleted: remove it" : r.stock} · {money(r.price)} each</span></span>
              <label className="flex items-center gap-1 text-xs text-ink-soft">Qty
                <input type="number" min={1} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} className="field h-9 w-16 text-sm" /></label>
              <span className="w-20 text-right font-semibold">{money(r.price * r.qty)}</span>
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1 text-ink-muted hover:text-danger" aria-label={`Remove ${r.name}`}><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="rounded-form bg-surface px-3 py-2 text-sm">Bundle price: <strong>{money(combined)}</strong></div>
      )}
      <p className="text-xs text-ink-muted">The price is all these products combined and updates when their prices change. Stock comes from them too: if any item is out of stock, so is the bundle, and selling it reduces each item&apos;s stock.</p>
    </div>
  );
}
