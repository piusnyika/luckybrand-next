"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "../Icon";

const GROUPS: { title?: string; items: { href: string; label: string; icon: string; badge?: "orders" | "messages" | "quotes" | "reviews"; admin?: boolean }[] }[] = [
  { items: [{ href: "/admin/", label: "Dashboard", icon: "dashboard" }] },
  { title: "Sales", items: [
    { href: "/admin/orders/", label: "Orders", icon: "receipt", badge: "orders" },
    { href: "/admin/quotes/", label: "Quote requests", icon: "edit", badge: "quotes" },
    { href: "/admin/customers/", label: "Customers", icon: "users" },
    { href: "/admin/coupons/", label: "Coupons", icon: "tag" },
    { href: "/admin/reports/", label: "Reports", icon: "chart" },
  ] },
  { title: "Catalogue", items: [
    { href: "/admin/products/", label: "Products", icon: "box" },
    { href: "/admin/categories/", label: "Categories", icon: "folder" },
    { href: "/admin/brands/", label: "Brands & tags", icon: "star" },
    { href: "/admin/media/", label: "Media library", icon: "image" },
    { href: "/admin/reviews/", label: "Reviews", icon: "star", badge: "reviews" },
    { href: "/admin/seo/", label: "SEO", icon: "search" },
  ] },
  { title: "Content", items: [
    { href: "/admin/homepage/", label: "Homepage", icon: "layout" },
    { href: "/admin/pages/", label: "Pages", icon: "file" },
    { href: "/admin/menus/", label: "Menus", icon: "menu" },
    { href: "/admin/messages/", label: "Messages", icon: "message", badge: "messages" },
  ] },
  { title: "Store", items: [
    { href: "/admin/settings/", label: "Settings", icon: "settings", admin: true },
    { href: "/admin/redirects/", label: "Redirects", icon: "link", admin: true },
    { href: "/admin/security/", label: "Two-step login", icon: "shield" },
  ] },
];

export function AdminNav({ user, logo, badges }: { user: { name: string; role: string }; logo: string; badges: { orders: number; messages: number; quotes: number; reviews: number } }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/admin/" ? path === "/admin" || path === "/admin/" : path.startsWith(h.replace(/\/$/, "")));
  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href="/admin/" className="rounded bg-white px-2 py-1"><img src={logo} alt="" className="h-7" /></Link>
        <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {GROUPS.map((g, i) => (
          <div key={i} className="mb-4">
            {g.title && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</div>}
            {g.items.filter((it) => !it.admin || user.role === "admin").map((it) => (
              <Link key={it.href} href={it.href} className={`flex items-center gap-3 rounded-form px-3 py-2 text-sm font-medium ${active(it.href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                <Icon name={it.icon} size={18} /><span className="flex-1">{it.label}</span>
                {it.badge && badges[it.badge] > 0 && <span className="rounded-full bg-accent px-2 text-[11px] font-bold text-ink">{badges[it.badge]}</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4 text-sm text-white/80">
        <div className="truncate font-medium text-white">{user.name}</div>
        <div className="text-xs capitalize text-white/50">{user.role}</div>
        <div className="mt-3 flex gap-3 text-xs">
          <a href="/" target="_blank" className="flex items-center gap-1 hover:text-white"><Icon name="external" size={14} />View store</a>
          <a href="/my-account/customer-logout/" className="flex items-center gap-1 hover:text-white"><Icon name="logout" size={14} />Log out</a>
        </div>
      </div>
    </nav>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-[#0b2a55] px-4 py-3 text-white lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Menu"><Icon name="menu" /></button><span className="font-semibold">Store admin</span>
      </div>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 bg-[#0b2a55] lg:block">{nav}</aside>
      <div className={`fixed inset-0 z-40 bg-black/40 lg:hidden ${open ? "block" : "hidden"}`} onClick={() => setOpen(false)} />
      <aside className={`fixed left-0 top-0 z-50 h-full w-[260px] bg-[#0b2a55] transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>{nav}</aside>
    </>
  );
}
