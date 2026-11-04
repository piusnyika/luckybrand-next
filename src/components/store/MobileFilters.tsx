"use client";
import { useState } from "react";
import { Icon } from "../Icon";
export function MobileFilters({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-form border border-line px-3 py-1.5 text-[13px] font-semibold lg:hidden"><Icon name="filter" size={16} />Filter</button>
      <div className={`fixed inset-0 z-[70] bg-black/40 transition lg:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`} onClick={() => setOpen(false)} />
      <aside className={`fixed left-0 top-0 z-[71] h-full w-[86%] max-w-[340px] overflow-y-auto bg-white p-5 transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        <div className="mb-5 flex items-center justify-between"><span className="text-lg font-semibold">Filter products</span><button type="button" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" /></button></div>
        {children}
      </aside>
    </>
  );
}
