"use client";
import { useRef, useState } from "react";
import { generateBatch, type BatchResult } from "@/app/admin/(panel)/seo/actions";

/** $ per million tokens in / out, for the cost estimate */
const PRICE: Record<string, [number, number]> = { "claude-fable-5-1": [10, 50], "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };

export function SeoBulkWriter({ groups, model, available }: { groups: { key: string; label: string; ids: number[] }[]; model: string; available: boolean }) {
  const [group, setGroup] = useState(groups[0]?.key);
  const [overwrite, setOverwrite] = useState(false);
  const [writeCopy, setWriteCopy] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0); const [total, setTotal] = useState(0);
  const [log, setLog] = useState<BatchResult[]>([]);
  const stop = useRef(false);
  const ids = groups.find((g) => g.key === group)?.ids ?? [];
  const [pin, pout] = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const cost = ids.length * ((1800 * pin + (writeCopy ? 1500 : 250) * pout) / 1e6);

  async function start() {
    if (!ids.length) return;
    if (!confirm(`Write SEO with AI for ${ids.length} product${ids.length === 1 ? "" : "s"}? Estimated cost about $${cost.toFixed(2)} on your Anthropic account.${overwrite ? " Existing SEO text will be REPLACED." : ""}`)) return;
    stop.current = false; setRunning(true); setDone(0); setTotal(ids.length); setLog([]);
    for (let i = 0; i < ids.length && !stop.current; i += 6) {
      try {
        const r = await generateBatch(ids.slice(i, i + 6), { overwrite, writeCopy });
        setLog((l) => [...r, ...l].slice(0, 200));
        // the same error on every product (e.g. no API key): no point carrying on
        if (r.length && r.every((x) => !x.ok) && new Set(r.map((x) => x.error)).size === 1 && i === 0) break;
      } catch (e) { setLog((l) => [{ id: 0, name: "Batch", ok: false, error: (e as Error).message, filled: [] }, ...l]); }
      setDone(Math.min(ids.length, i + 6));
    }
    setRunning(false);
  }

  const failed = log.filter((l) => !l.ok).length;
  return (
    <div className="space-y-4">
      {!available && <p className="rounded-form bg-amber-50 px-3 py-2 text-sm text-amber-800">Add <code>ANTHROPIC_API_KEY</code> to the server&apos;s .env (the same key as the chat assistant) to use AI writing.</p>}
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <label key={g.key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${group === g.key ? "border-primary bg-primary text-white" : "border-line bg-white"}`}>
            <input type="radio" name="group" className="hidden" checked={group === g.key} onChange={() => setGroup(g.key)} disabled={running} />{g.label} ({g.ids.length})
          </label>
        ))}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={writeCopy} onChange={(e) => setWriteCopy(e.target.checked)} disabled={running} className="mt-0.5 accent-primary" />
        <span>Also write a <strong>full description</strong> for products with fewer than 100 words (uses only the facts already on the product; read a few afterwards to check them).</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={running} className="mt-0.5 accent-primary" />
        <span><strong>Replace</strong> existing SEO titles, meta descriptions and keywords (off: only empty fields are filled).</span></label>
      <div className="flex flex-wrap items-center gap-3">
        {running ? <button type="button" onClick={() => (stop.current = true)} className="btn-outline">Stop after this batch</button>
          : <button type="button" onClick={start} disabled={!available || !ids.length} className="btn-primary">Write SEO for {ids.length} product{ids.length === 1 ? "" : "s"}</button>}
        <span className="text-sm text-ink-muted">Estimated cost: about ${cost.toFixed(2)} ({model})</span>
      </div>
      {total > 0 && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
          <p className="mt-1 text-sm text-ink-soft">{done} of {total} done{failed ? `, ${failed} failed` : ""}{!running && done < total ? " (stopped)" : ""}{!running && done >= total ? ". Refresh the page to see the new scores." : ""}</p>
        </div>
      )}
      {log.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-form border border-line p-3 text-xs">
          {log.map((l, i) => <li key={i} className={l.ok ? "" : "text-danger"}>{l.ok ? "✓" : "✗"} {l.id ? <a href={`/admin/products/${l.id}/`} className="hover:underline">{l.name}</a> : l.name}: {l.ok ? (l.filled.length ? `filled ${l.filled.join(", ")}` : "nothing to fill") : l.error}</li>)}
        </ul>
      )}
    </div>
  );
}
