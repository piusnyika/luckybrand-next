"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../Icon";

export function ShopToolbar({ orderby, perPage, view }: { orderby: string; perPage: number; view: "grid" | "list" }) {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const set = (k: string, v: string | null) => {
    const u = new URLSearchParams(sp.toString()); if (v === null) u.delete(k); else u.set(k, v); u.delete("paged");
    router.push(path + (u.toString() ? "?" + u : ""), { scroll: false });
  };
  const sel = "h-9 cursor-pointer appearance-none bg-transparent pr-6 text-[13px] font-medium outline-none";
  return (
    <div className="flex items-center gap-5 text-[13px]">
      <label className="relative flex items-center gap-1.5"><span className="hidden text-ink-muted sm:inline">Sort:</span>
        <select value={orderby} onChange={(e) => set("orderby", e.target.value === "date" ? null : e.target.value)} className={sel}>
          <option value="date">Sort by latest</option><option value="popularity">Sort by popularity</option>
          <option value="price">Sort by price: low to high</option><option value="price-desc">Sort by price: high to low</option>
        </select><Icon name="chevronDown" size={14} className="pointer-events-none absolute right-0" />
      </label>
      <label className="relative hidden items-center gap-1.5 sm:flex"><span className="text-ink-muted">Show:</span>
        <select value={perPage} onChange={(e) => set("per_page", e.target.value === "20" ? null : e.target.value)} className={sel}>
          {[12, 20, 30, 40, 60].map((n) => <option key={n} value={n}>{n} Items</option>)}
        </select><Icon name="chevronDown" size={14} className="pointer-events-none absolute right-0" />
      </label>
      <div className="hidden items-center gap-1 sm:flex">
        <button type="button" aria-label="Grid view" onClick={() => set("view", null)} className={`rounded p-1.5 ${view === "grid" ? "bg-surface text-ink" : "text-ink-muted"}`}><Icon name="grid" size={16} /></button>
        <button type="button" aria-label="List view" onClick={() => set("view", "list")} className={`rounded p-1.5 ${view === "list" ? "bg-surface text-ink" : "text-ink-muted"}`}><Icon name="list" size={16} /></button>
      </div>
    </div>
  );
}
