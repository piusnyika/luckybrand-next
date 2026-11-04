"use client";
import { useState } from "react";
import { SubmitButton } from "./ui-client";
import { Icon } from "../Icon";

type Item = { key: string; label: string; url: string; parentKey: string | null };
type Src = { label: string; url: string };
export function MenuEditor({ action, menu, initial, sources }: { action: (fd: FormData) => void; menu: string; initial: Item[]; sources: { categories: Src[]; pages: Src[] } }) {
  const [items, setItems] = useState(initial);
  const [cat, setCat] = useState(""); const [page, setPage] = useState(""); const [custom, setCustom] = useState({ label: "", url: "" });
  const depth = (it: Item): number => { let d = 0, p = it.parentKey; while (p) { d++; p = items.find((x) => x.key === p)?.parentKey ?? null; if (d > 5) break; } return d; };
  const upd = (k: string, patch: Partial<Item>) => setItems(items.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const add = (label: string, url: string) => setItems([...items, { key: "n" + Math.random().toString(36).slice(2), label, url, parentKey: null }]);
  const move = (i: number, d: number) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  const remove = (k: string) => setItems(items.filter((x) => x.key !== k).map((x) => (x.parentKey === k ? { ...x, parentKey: null } : x)));
  const indent = (i: number) => { const prev = items[i - 1]; if (prev) upd(items[i].key, { parentKey: depth(prev) >= depth(items[i]) ? prev.key : prev.parentKey }); };
  const outdent = (it: Item) => upd(it.key, { parentKey: items.find((x) => x.key === it.parentKey)?.parentKey ?? null });
  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="menu" value={menu} /><input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="rounded-base border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="font-semibold">Menu items</h2><SubmitButton className="btn-primary h-9 text-sm">Save menu</SubmitButton></div>
        {items.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">This menu is empty. Add items from the right.</p>}
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <li key={it.key} className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ paddingLeft: 16 + depth(it) * 28 }}>
              <input value={it.label} onChange={(e) => upd(it.key, { label: e.target.value })} className="field h-9 w-48 text-sm" aria-label="Label" />
              <input value={it.url} onChange={(e) => upd(it.key, { url: e.target.value })} className="field h-9 min-w-0 flex-1 text-sm" aria-label="URL" />
              <div className="flex items-center gap-0.5 text-ink-soft">
                <button type="button" title="Move up" onClick={() => move(i, -1)} className="rounded p-1.5 hover:bg-surface"><Icon name="chevronDown" size={16} className="rotate-180" /></button>
                <button type="button" title="Move down" onClick={() => move(i, 1)} className="rounded p-1.5 hover:bg-surface"><Icon name="chevronDown" size={16} /></button>
                <button type="button" title="Make sub-item" onClick={() => indent(i)} className="rounded p-1.5 hover:bg-surface"><Icon name="chevronRight" size={16} /></button>
                <button type="button" title="Move out a level" onClick={() => outdent(it)} disabled={!it.parentKey} className="rounded p-1.5 hover:bg-surface disabled:opacity-30"><Icon name="chevronLeft" size={16} /></button>
                <button type="button" title="Remove" onClick={() => remove(it.key)} className="rounded p-1.5 hover:bg-red-50 hover:text-danger"><Icon name="trash" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <Box title="Add category">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="field h-10 text-sm"><option value="">Choose…</option>{sources.categories.map((c) => <option key={c.url} value={c.url}>{c.label}</option>)}</select>
          <button type="button" disabled={!cat} onClick={() => { const c = sources.categories.find((x) => x.url === cat)!; add(c.label, c.url); setCat(""); }} className="btn-outline h-9 w-full text-sm">Add to menu</button>
        </Box>
        <Box title="Add page">
          <select value={page} onChange={(e) => setPage(e.target.value)} className="field h-10 text-sm"><option value="">Choose…</option>{sources.pages.map((c) => <option key={c.url} value={c.url}>{c.label}</option>)}</select>
          <button type="button" disabled={!page} onClick={() => { const c = sources.pages.find((x) => x.url === page)!; add(c.label, c.url); setPage(""); }} className="btn-outline h-9 w-full text-sm">Add to menu</button>
        </Box>
        <Box title="Custom link">
          <input value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="Label" className="field h-10 text-sm" />
          <input value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} placeholder="https:// or /path/ or tel: / mailto:" className="field h-10 text-sm" />
          <button type="button" disabled={!custom.label || !custom.url} onClick={() => { add(custom.label, custom.url); setCustom({ label: "", url: "" }); }} className="btn-outline h-9 w-full text-sm">Add to menu</button>
        </Box>
      </div>
    </form>
  );
}
const Box = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="space-y-2 rounded-base border border-line bg-white p-4"><h3 className="text-sm font-semibold">{title}</h3>{children}</div>;
