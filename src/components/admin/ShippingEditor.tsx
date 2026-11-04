"use client";
import { useState } from "react";
import { SubmitButton } from "./ui-client";
type M = { id?: number; name: string; type: "free" | "flat" | "pickup"; cost: string; minAmount: string; note: string; enabled: boolean; remove?: boolean };
export function ShippingEditor({ action, initial }: { action: (fd: FormData) => void; initial: M[] }) {
  const [rows, setRows] = useState<M[]>(initial);
  const up = (i: number, p: Partial<M>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  return (
    <form action={action} className="rounded-base border border-line bg-white">
      <input type="hidden" name="methods" value={JSON.stringify(rows)} />
      <div className="border-b border-line px-5 py-3.5 text-sm text-ink-soft">Shipping options offered at checkout, in order. Free shipping with a minimum only appears once the cart reaches it.</div>
      <div className="divide-y divide-line">
        {rows.map((r, i) => r.remove ? null : (
          <div key={i} className="grid items-end gap-3 p-4 md:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_auto]">
            <label><span className="label">Name</span><input value={r.name} onChange={(e) => up(i, { name: e.target.value })} className="field h-10 text-sm" /></label>
            <label><span className="label">Type</span><select value={r.type} onChange={(e) => up(i, { type: e.target.value as M["type"] })} className="field h-10 text-sm"><option value="free">Free shipping</option><option value="flat">Flat rate</option><option value="pickup">Local pickup</option></select></label>
            <label><span className="label">Cost ($)</span><input type="number" step="0.01" value={r.cost} disabled={r.type === "free"} onChange={(e) => up(i, { cost: e.target.value })} className="field h-10 text-sm" /></label>
            <label><span className="label">Min. order ($)</span><input type="number" step="0.01" value={r.minAmount} disabled={r.type !== "free"} onChange={(e) => up(i, { minAmount: e.target.value })} className="field h-10 text-sm" /></label>
            <label><span className="label">Internal note / zone</span><input value={r.note} onChange={(e) => up(i, { note: e.target.value })} className="field h-10 text-sm" /></label>
            <div className="flex items-center gap-3 pb-2.5 text-sm"><label className="flex items-center gap-1.5"><input type="checkbox" checked={r.enabled} onChange={(e) => up(i, { enabled: e.target.checked })} className="accent-primary" />On</label>
              <button type="button" onClick={() => (r.id ? up(i, { remove: true }) : setRows(rows.filter((_, k) => k !== i)))} className="text-danger">Remove</button></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-line p-4">
        <button type="button" onClick={() => setRows([...rows, { name: "Flat rate delivery", type: "flat", cost: "10", minAmount: "", note: "", enabled: true }])} className="text-sm font-semibold text-primary">+ Add shipping method</button>
        <SubmitButton>Save shipping</SubmitButton>
      </div>
    </form>
  );
}
