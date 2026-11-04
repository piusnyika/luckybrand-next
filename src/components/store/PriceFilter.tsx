"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PriceFilter({ min, max, curMin, curMax }: { min: number; max: number; curMin?: string; curMax?: string }) {
  const [lo, setLo] = useState(curMin ?? String(min));
  const [hi, setHi] = useState(curMax ?? String(max));
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const apply = () => {
    const u = new URLSearchParams(sp.toString()); u.delete("paged");
    Number(lo) > min ? u.set("min_price", lo) : u.delete("min_price");
    Number(hi) < max ? u.set("max_price", hi) : u.delete("max_price");
    router.push(path + (u.toString() ? "?" + u : ""), { scroll: false });
  };
  const pctLo = max > min ? ((Number(lo) - min) / (max - min)) * 100 : 0, pctHi = max > min ? ((Number(hi) - min) / (max - min)) * 100 : 100;
  return (
    <div>
      <div className="flex items-end gap-2">
        <label className="flex-1 text-[11px] text-ink-muted">Min price<input type="number" value={lo} onChange={(e) => setLo(e.target.value)} className="field mt-1 h-10 text-sm" /></label>
        <span className="pb-2.5">-</span>
        <label className="flex-1 text-[11px] text-ink-muted">Max price<input type="number" value={hi} onChange={(e) => setHi(e.target.value)} className="field mt-1 h-10 text-sm" /></label>
      </div>
      <div className="relative my-5 h-1 rounded bg-line">
        <div className="absolute h-1 rounded bg-ink" style={{ left: pctLo + "%", right: 100 - pctHi + "%" }} />
        <input type="range" min={min} max={max} value={lo} onChange={(e) => setLo(String(Math.min(Number(e.target.value), Number(hi))))} className="pointer-events-none absolute -top-1.5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink" aria-label="Minimum price" />
        <input type="range" min={min} max={max} value={hi} onChange={(e) => setHi(String(Math.max(Number(e.target.value), Number(lo))))} className="pointer-events-none absolute -top-1.5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink" aria-label="Maximum price" />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-soft">Price: ${lo} — ${hi}</span>
        <button type="button" onClick={apply} className="rounded-form bg-surface px-4 py-2 text-xs font-semibold hover:bg-line">FILTER</button>
      </div>
    </div>
  );
}
