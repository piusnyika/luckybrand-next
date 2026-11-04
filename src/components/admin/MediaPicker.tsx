"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

type M = { id: number; url: string; alt: string; title: string; width: number | null; height: number | null };

export function MediaModal({ open, onClose, onPick, multiple = false }: { open: boolean; onClose: () => void; onPick: (m: M[]) => void; multiple?: boolean }) {
  const [items, setItems] = useState<M[]>([]); const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [sel, setSel] = useState<M[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/media/?q=${encodeURIComponent(q)}&page=${page}`); const j = await r.json();
    setItems(j.items || []); setPages(j.pages || 1);
  }, [q, page]);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (!open) setSel([]); }, [open]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); setErr("");
    const fd = new FormData(); [...files].forEach((f) => fd.append("files", f));
    const r = await fetch("/api/admin/media/", { method: "POST", body: fd }); const j = await r.json();
    if (!r.ok) setErr(j.error || "Upload failed"); setBusy(false); setPage(1); await load();
    if (j.items?.length) { const fresh = j.items.map((x: { id: number; url: string }) => ({ ...x, alt: "", title: "", width: null, height: null })); setSel(multiple ? [...sel, ...fresh] : [fresh[0]]); }
  };
  if (!open) return null;
  const toggle = (m: M) => setSel((cur) => (cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : multiple ? [...cur, m] : [m]));
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-base bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h3 className="mr-auto text-lg font-semibold">Media library</h3>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search…" className="field h-10 w-48 text-sm" />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary h-10 text-sm" disabled={busy}><Icon name="upload" size={16} />{busy ? "Uploading…" : "Upload"}</button>
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
          <button type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {err && <p className="mx-4 mt-3 rounded-form bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-5 lg:grid-cols-8"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
          {items.map((m) => {
            const on = sel.some((x) => x.id === m.id);
            return (
              <button type="button" key={m.id} onClick={() => toggle(m)} onDoubleClick={() => { onPick([m]); onClose(); }}
                className={`relative aspect-square overflow-hidden rounded-form border-2 bg-surface ${on ? "border-primary" : "border-transparent"}`} title={m.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/\.pdf$/i.test(m.url) ? <span className="flex h-full items-center justify-center text-xs">PDF</span> : <img src={m.url} alt="" className="h-full w-full object-contain" loading="lazy" />}
                {on && <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-white"><Icon name="check" size={12} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line p-4">
          <div className="flex gap-1 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-outline h-9 px-3 text-xs">Prev</button>
            <span className="px-2 py-2 text-xs">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="btn-outline h-9 px-3 text-xs">Next</button>
          </div>
          <span className="ml-auto text-xs text-ink-muted">{sel.length} selected · drop files here to upload</span>
          <button type="button" disabled={!sel.length} onClick={() => { onPick(sel); onClose(); }} className="btn-primary h-10 text-sm">Use {multiple ? "selected" : "image"}</button>
        </div>
      </div>
    </div>
  );
}

/** Single image field: hidden input holds the URL */
export function ImageField({ name, defaultValue, label = "Image" }: { name: string; defaultValue?: string | null; label?: string }) {
  const [url, setUrl] = useState(defaultValue || ""); const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-form border border-dashed border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <Icon name="image" className="text-ink-muted" />}
        </button>
        <div className="flex flex-col gap-1 text-xs">
          <button type="button" onClick={() => setOpen(true)} className="text-left font-semibold text-primary">{url ? "Change" : "Choose image"}</button>
          {url && <button type="button" onClick={() => setUrl("")} className="text-left text-danger">Remove</button>}
        </div>
      </div>
      <MediaModal open={open} onClose={() => setOpen(false)} onPick={(m) => setUrl(m[0]?.url || "")} />
    </div>
  );
}
