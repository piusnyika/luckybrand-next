"use client";
import Link from "next/link";
import { useState } from "react";
import type { MenuNode } from "@/lib/catalog";
import { Icon } from "../Icon";

export function MobileNav({ main, cats, site }: { main: MenuNode[]; cats: MenuNode[]; site: { logo: string; name: string; phones: { label: string; tel: string }[] } }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false); // the long category list is only built on first use
  const [tab, setTab] = useState<"menu" | "cats">("cats");
  return (
    <>
      <button type="button" aria-label="Open menu" onClick={() => { setOpened(true); setOpen(true); }} className="lg:hidden"><Icon name="menu" size={26} /></button>
      <div className={`fixed inset-0 z-[70] bg-black/40 transition lg:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`} onClick={() => setOpen(false)} />
      <aside className={`fixed left-0 top-0 z-[71] flex h-full w-[86%] max-w-[360px] flex-col bg-white transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-line p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.logo} alt={site.name} className="h-8 w-auto" />
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="grid grid-cols-2 border-b border-line text-sm font-semibold">
          {(["cats", "menu"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`py-3 ${tab === t ? "border-b-2 border-primary text-primary" : "text-ink-soft"}`}>{t === "cats" ? "Categories" : "Menu"}</button>
          ))}
        </div>
        <nav className="flex-1 overflow-y-auto p-2" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {opened && (tab === "cats" ? cats : main).map((m) => <Item key={m.id} m={m} />)}
          <Link href="/my-account/" className="mt-2 block border-t border-line px-3 py-3 text-[15px] font-semibold">My Account</Link>
          <Link href="/wishlist/" className="block px-3 py-2 text-[15px] font-semibold">Wishlist</Link>
        </nav>
        <div className="border-t border-line p-4 text-sm">
          {site.phones.slice(0, 2).map((p) => <a key={p.tel} href={`tel:${p.tel}`} className="flex items-center gap-2 py-1 text-ink-soft"><Icon name="phone" size={16} />{p.label}</a>)}
        </div>
      </aside>
    </>
  );
}
function Item({ m, depth = 0 }: { m: MenuNode; depth?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center">
        <Link href={m.url} className={`flex-1 rounded px-3 py-2.5 ${depth ? "text-sm text-ink-soft" : "text-[15px] font-semibold"}`} style={{ paddingLeft: 12 + depth * 14 }}>{m.label}</Link>
        {m.children.length > 0 && <button type="button" aria-label="Expand" onClick={() => setOpen(!open)} className="p-2"><Icon name={open ? "minus" : "plus"} size={16} /></button>}
      </div>
      {open && m.children.map((c) => <Item key={c.id} m={c} depth={depth + 1} />)}
    </div>
  );
}
