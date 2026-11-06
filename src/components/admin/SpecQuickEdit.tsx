"use client";
import { useEffect, useRef, useState } from "react";
import { RichText } from "./RichText";
import { SubmitButton } from "./ui-client";
import { Icon } from "../Icon";
import { specificationOf } from "@/app/admin/(panel)/specifications/actions";

type Hit = { id: number; name: string; sku: string; image: string | null };
const STARTER = "<table><tbody><tr><td>Model</td><td></td></tr><tr><td>Power</td><td></td></tr><tr><td>Voltage</td><td></td></tr><tr><td>Weight</td><td></td></tr><tr><td>Warranty</td><td></td></tr></tbody></table>";

/** "Edit specs" button on Admin → Specifications: edits one product's Specifications in a pop-up, optionally starting from another product's */
export function SpecQuickEdit({ id, name, initial, qs, action, label = "Edit" }: {
  id: number; name: string; initial: string; qs: string; action: (fd: FormData) => Promise<void>; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState(initial);
  const [key, setKey] = useState(0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    timer.current = setTimeout(async () => {
      try { const r = await fetch(`/api/admin/products/search/?q=${encodeURIComponent(q.trim())}`); setHits(((await r.json()) as Hit[]).filter((h) => h.id !== id).slice(0, 6)); } catch { /* offline */ }
    }, 250);
  }, [q, id]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const replace = (v: string, msg: string) => { setHtml(v); setKey((k) => k + 1); setNote(msg); };
  const copyFrom = async (h: Hit) => {
    const r = await specificationOf(h.id);
    if (!r?.specification.trim()) { setNote(`“${h.name}” has no specifications to copy.`); return; }
    if (html.replace(/<[^>]+>|&nbsp;|\s/g, "") && !confirm(`Replace the current specifications with those of “${r.name}”?`)) return;
    replace(r.specification, `Copied from “${r.name}”. Change the values that differ, then save.`);
    setQ(""); setHits([]);
  };

  return (<>
    <button type="button" onClick={() => { setHtml(initial); setKey((k) => k + 1); setNote(""); setOpen(true); }} className="btn-outline h-8 px-3 text-xs">{label}</button>
    {open && (
      <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto whitespace-normal bg-black/40 p-4 text-left sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <form action={action} className="w-full max-w-3xl rounded-base bg-white shadow-2xl">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="qs" value={qs} />
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Specifications</div><div className="truncate font-semibold">{name}</div></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:bg-surface"><Icon name="close" size={20} /></button>
          </div>
          <div className="space-y-4 p-5">
            <div className="relative">
              <span className="label">Copy from another product (optional)</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a similar product by name or SKU, e.g. the next size up…" className="field" />
              {hits.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-form border border-line bg-white shadow-lg">
                  {hits.map((h) => (
                    <button key={h.id} type="button" onClick={() => copyFrom(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.image ? <img src={h.image} alt="" className="h-8 w-8 rounded border border-line object-contain" /> : <span className="h-8 w-8 rounded bg-surface" />}
                      <span className="min-w-0 flex-1 truncate">{h.name}</span><span className="text-xs text-ink-muted">{h.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">Specification table</span>
                {!html.replace(/<[^>]+>|&nbsp;|\s/g, "") && <button type="button" onClick={() => replace(STARTER, "Starter table added: fill in the values, and add or remove rows as needed.")} className="text-xs font-semibold text-primary hover:underline">Start with a blank table</button>}
              </div>
              <RichText key={key} name="specification" defaultValue={html} onChange={setHtml} minHeight={260} />
              <p className="mt-1 text-xs text-ink-muted">Tip: paste a table straight from Excel or a supplier’s PDF. Click in a table and use <strong>HTML</strong> to add rows quickly.</p>
            </div>
            {note && <p className="text-sm text-success">{note}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline h-10 text-sm">Cancel</button>
            <SubmitButton className="btn-primary h-10 text-sm">Save specifications</SubmitButton>
          </div>
        </form>
      </div>
    )}
  </>);
}
