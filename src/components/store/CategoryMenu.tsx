"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useHeaderScrolled } from "./StickyHeader";
import type { MenuNode } from "@/lib/catalog";
import { Icon } from "../Icon";

export function CategoryMenu({ items }: { items: MenuNode[] }) {
  const [open, setOpen] = useState(false);
  const scrolled = useHeaderScrolled();
  // homepage: open at the top, folds away while scrolling (sticky header), reopens back at the top
  const alwaysOpen = usePathname() === "/" && !scrolled;
  const show = alwaysOpen || open;
  useEffect(() => { if (!scrolled) setOpen(false); }, [scrolled]);
  return (
    <div className="relative w-[270px] shrink-0 self-stretch" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={show}
        className={`flex h-full w-full items-center gap-3 bg-brand px-4 text-[15px] font-semibold text-white transition-[border-radius] ${show ? "rounded-t-base" : "rounded-base"}`}>
        <Icon name="menu" size={20} /> <span className="flex-1 text-left">Browse Categories</span>
        <Icon name="chevronDown" size={18} className={`transition-transform duration-200 ${show ? "rotate-180" : ""}`} />
      </button>
      <div className={`absolute left-0 top-full z-50 w-full origin-top rounded-b-base bg-brand pb-2 shadow-xl transition duration-200 ${show ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}>
        <ul>
          {items.map((c) => (
            <li key={c.id} className="group/item relative">
              <Link href={c.url} className="flex items-center justify-between px-5 py-[9px] text-[14px] font-medium text-white hover:bg-white/10">
                {c.label}{c.children.length > 0 && <Icon name="chevronRight" size={14} />}
              </Link>
              {c.children.length > 0 && (
                <div className="invisible absolute left-full top-0 z-50 min-h-full w-[560px] rounded-base border border-line bg-white p-5 opacity-0 shadow-xl transition group-hover/item:visible group-hover/item:opacity-100">
                  <Link href={c.url} className="mb-3 block text-base font-semibold text-ink hover:text-primary">{c.label}</Link>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {c.children.map((s) => (
                      <div key={s.id}>
                        <Link href={s.url} className="block py-1 text-sm text-ink-soft hover:text-primary">{s.label}</Link>
                        {s.children.map((x) => <Link key={x.id} href={x.url} className="block py-0.5 pl-3 text-[13px] text-ink-muted hover:text-primary">{x.label}</Link>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
