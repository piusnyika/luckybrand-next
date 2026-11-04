"use client";
import { useState, useTransition } from "react";
import { analyzeProduct, gradeColor, type SeoInput } from "@/lib/seo-score";
import { suggestForForm } from "@/app/admin/(panel)/seo/actions";

/** Live SEO score + checklist for the product editor, with "Suggest with AI" */
export function SeoPanel({ input, productId, attributes, onSuggest }: {
  input: SeoInput; productId?: number; attributes: { name: string; values: string[] }[];
  onSuggest: (s: { focusKeyword: string; seoTitle: string; metaDescription: string; shortDescription?: string; description?: string }) => void;
}) {
  const r = analyzeProduct(input);
  const [pending, start] = useTransition();
  const [error, setError] = useState(""); const [note, setNote] = useState("");
  const [writeCopy, setWriteCopy] = useState(false);
  const suggest = () => start(async () => {
    setError(""); setNote("");
    const res = await suggestForForm({ id: productId, name: input.name, shortDescription: input.shortDescription, description: input.description, specification: input.specification,
      attributes, writeCopy });
    if (res.error || !res.ok) { setError(res.error || "No suggestion"); return; }
    onSuggest(res.ok);
    setNote(`Filled in${res.ok.description ? " the description, short description," : ""} the keyword, title and meta description. Check them, then Save.`);
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${gradeColor(r.grade)}`}>{r.score}</span>
        <div><p className="font-semibold">{r.grade === "good" ? "Good" : r.grade === "ok" ? "Needs work" : "Poor"} SEO</p><p className="text-xs text-ink-muted">Updates as you type</p></div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {r.checks.map((c) => (
          <li key={c.id} className="flex gap-2">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.status === "good" ? "bg-success" : c.status === "ok" ? "bg-amber-500" : "bg-danger"}`} aria-label={c.status} />
            <span>{c.label}{c.tip && <span className="block text-xs text-ink-muted">{c.tip}</span>}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-form border border-line p-3">
        <label className="mb-2 flex items-start gap-2 text-xs"><input type="checkbox" checked={writeCopy} onChange={(e) => setWriteCopy(e.target.checked)} className="mt-0.5 accent-primary" />
          Also rewrite the description and short description (replaces what&apos;s in the editor)</label>
        <button type="button" onClick={suggest} disabled={pending} className="btn-outline h-10 w-full text-sm">{pending ? "Writing…" : "✨ Suggest with AI"}</button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        {note && <p className="mt-2 text-xs text-success">{note}</p>}
      </div>
    </div>
  );
}
