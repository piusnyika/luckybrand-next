"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { money } from "@/lib/format";

type Hit = { id: number; name: string; slug: string; price: number; image: string | null };
export function SearchBox() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("s") ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    timer.current = setTimeout(async () => {
      try { const r = await fetch(`/api/search/?q=${encodeURIComponent(q)}`); setHits(await r.json()); setOpen(true); } catch {}
    }, 220);
  }, [q]);
  return (
    <form className="relative w-full" onSubmit={(e) => { e.preventDefault(); setOpen(false); router.push(`/shop/?s=${encodeURIComponent(q.trim())}`); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTimeout(() => setOpen(false), 150); }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)}
        placeholder="Search for products..." aria-label="Search for products"
        className="h-12 w-full rounded-form border-2 border-brand bg-white pl-4 pr-12 text-[15px] font-medium outline-none placeholder:text-ink-muted focus:border-primary" />
      <button type="submit" aria-label="Search" className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-ink"><Icon name="search" size={22} /></button>
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-base border border-line bg-white shadow-xl">
          {hits.map((h) => (
            <Link key={h.id} href={`/product/${h.slug}/`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {h.image ? <img src={h.image} alt="" className="h-11 w-11 object-contain" /> : <span className="h-11 w-11 bg-surface" />}
              <span className="flex-1 text-sm font-medium">{h.name}</span>
              <span className="text-sm font-bold">{money(h.price)}</span>
            </Link>
          ))}
          <button type="submit" className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-primary hover:bg-surface">See all results for “{q}”</button>
        </div>
      )}
    </form>
  );
}
