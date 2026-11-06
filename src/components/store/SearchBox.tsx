"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { money } from "@/lib/format";

type Hit = { id: number; name: string; slug: string; price: number; image: string | null; stock: string };
type Group = { name: string; url: string; count: number };
type Result = { q: string; products: Hit[]; total: number; partial: boolean; categories: Group[]; brands: Group[] };

const STOCK: Record<string, [string, string]> = {
  instock: ["In stock", "text-success"], outofstock: ["Out of stock", "text-danger"], onbackorder: ["On backorder", "text-amber-600"],
};

export function SearchBox({ placeholder = "Search for products...", whatsapp = "" }: { placeholder?: string; whatsapp?: string }) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("s") ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();

  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setRes(null); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await r.json();
        setRes({ q: term, ...data }); setActive(-1); setLoading(false);
      } catch { /* aborted or offline */ }
    }, 220);
    return () => { ctrl.abort(); clearTimeout(timer.current); };
  }, [q]);

  // everything the arrow keys can move through, in screen order
  const options: { key: string; href: string }[] = res ? [
    ...res.categories.map((c) => ({ key: "c" + c.url, href: c.url })),
    ...res.brands.map((b) => ({ key: "b" + b.url, href: b.url })),
    ...res.products.map((p) => ({ key: "p" + p.id, href: `/product/${p.slug}/` })),
    ...(res.products.length ? [{ key: "all", href: `/shop/?s=${encodeURIComponent(res.q)}` }] : []),
  ] : [];
  const idx = (key: string) => options.findIndex((o) => o.key === key);
  const optProps = (key: string) => ({
    id: `${listId}-${idx(key)}`, role: "option", "aria-selected": active === idx(key),
    onMouseEnter: () => setActive(idx(key)), onClick: () => setOpen(false),
  });
  const hl = (key: string) => (active === idx(key) ? "bg-surface" : "");

  const submit = () => {
    const term = q.trim(); if (!term) return;
    setOpen(false); router.push(`/shop/?s=${encodeURIComponent(term)}`);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); setOpen(false); router.push(options[active].href); }
  };

  const nothing = res && !res.products.length && !res.categories.length && !res.brands.length;
  const show = open && q.trim().length >= 2 && (res || loading);
  const wa = whatsapp.replace(/\D/g, "").replace(/^0/, "263");
  const section = "px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

  return (
    <form role="search" className="relative w-full" onSubmit={(e) => { e.preventDefault(); submit(); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTimeout(() => setOpen(false), 150); }}>
      <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder={placeholder} aria-label="Search for products" role="combobox" aria-expanded={!!show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off"
        className="h-12 w-full rounded-form border-2 border-brand bg-white pl-4 pr-12 text-[15px] font-medium outline-none placeholder:text-ink-muted focus:border-primary" />
      <button type="submit" aria-label="Search" className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-ink">
        {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" /> : <Icon name="search" size={22} />}
      </button>
      {show && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-base border border-line bg-white shadow-xl">
          {!res ? <div className="px-4 py-4 text-sm text-ink-muted">Searching…</div> : nothing ? (
            <div className="px-5 py-6 text-center">
              <div className="text-sm font-semibold">No products found for “{res.q}”</div>
              <p className="mx-auto mt-1 max-w-[340px] text-[13px] text-ink-soft">Try a shorter or different word, or ask us: we stock more than what’s online and can source equipment for you.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I'm looking for: ${res.q}`)}`} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-form bg-[#25d366] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"><Icon name="whatsapp" size={15} />Ask on WhatsApp</a>}
                <Link href="/request-a-quote/" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-form border border-line px-3.5 py-2 text-[13px] font-semibold hover:border-primary hover:text-primary"><Icon name="edit" size={15} />Request a quote</Link>
              </div>
            </div>
          ) : (<>
            {res.categories.length > 0 && (<>
              <div className={section}>Categories</div>
              {res.categories.map((c) => (
                <Link key={c.url} href={c.url} {...optProps("c" + c.url)} className={`flex items-center gap-2 px-4 py-2 text-sm ${hl("c" + c.url)}`}>
                  <Icon name="folder" size={16} className="text-ink-muted" /><span className="flex-1 font-medium">{c.name}</span><span className="text-xs text-ink-muted">{c.count} products</span>
                </Link>
              ))}
            </>)}
            {res.brands.length > 0 && (<>
              <div className={section}>Brands</div>
              {res.brands.map((b) => (
                <Link key={b.url} href={b.url} {...optProps("b" + b.url)} className={`flex items-center gap-2 px-4 py-2 text-sm ${hl("b" + b.url)}`}>
                  <Icon name="star" size={16} className="text-ink-muted" /><span className="flex-1 font-medium">{b.name}</span><span className="text-xs text-ink-muted">{b.count} products</span>
                </Link>
              ))}
            </>)}
            {res.products.length > 0 && (<>
              <div className={section}>{res.partial ? "No exact match. Closest products" : "Products"}</div>
              {res.products.map((h) => {
                const [label, cls] = STOCK[h.stock] ?? STOCK.instock;
                return (
                  <Link key={h.id} href={`/product/${h.slug}/`} {...optProps("p" + h.id)} className={`flex items-center gap-3 px-4 py-2 ${hl("p" + h.id)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {h.image ? <img src={h.image} alt="" className="h-11 w-11 shrink-0 object-contain" /> : <span className="h-11 w-11 shrink-0 bg-surface" />}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium leading-snug">{h.name}</span>
                      <span className={`text-[11px] font-semibold ${cls}`}>{label}</span>
                    </span>
                    <span className="text-sm font-bold">{money(h.price)}</span>
                  </Link>
                );
              })}
              <Link href={`/shop/?s=${encodeURIComponent(res.q)}`} {...optProps("all")} className={`block border-t border-line px-4 py-2.5 text-sm font-semibold text-primary ${hl("all")}`}>
                See all {res.total} results for “{res.q}”
              </Link>
            </>)}
          </>)}
        </div>
      )}
    </form>
  );
}
