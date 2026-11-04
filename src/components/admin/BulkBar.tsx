"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
/** Bulk-action bar for a table of checkboxes named "sel" (also wires the select-all checkbox). */
export function BulkBar({ options }: { options: [string, string][] }) {
  const ref = useRef<HTMLDivElement>(null); const [n, setN] = useState(0); const { pending } = useFormStatus();
  useEffect(() => {
    const form = ref.current?.closest("form"); if (!form) return;
    const all = form.querySelector<HTMLInputElement>("[data-select-all]");
    const boxes = () => [...form.querySelectorAll<HTMLInputElement>('input[name="sel"]')];
    const count = () => setN(form.dataset.allCount ? Number(form.dataset.allCount) : boxes().filter((b) => b.checked).length); // allCount: set by SelectAllButton
    const onAll = () => { boxes().forEach((b) => (b.checked = !!all?.checked)); count(); };
    all?.addEventListener("change", onAll); form.addEventListener("change", count);
    return () => { all?.removeEventListener("change", onAll); form.removeEventListener("change", count); };
  }, []);
  return (
    <div ref={ref} className="mb-3 flex items-center gap-2">
      <select name="bulk" className="field h-9 w-48 text-sm" defaultValue=""><option value="" disabled>Bulk actions</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <button disabled={!n || pending} className="btn-outline h-9 text-sm" onClick={(e) => { const sel = (e.currentTarget.form?.elements.namedItem("bulk") as HTMLSelectElement)?.value; if (!sel) { e.preventDefault(); return; } if (sel === "delete" && !confirm(`Delete ${n} item(s)? This cannot be undone.`)) e.preventDefault(); }}>Apply</button>
      <span className="text-xs text-ink-muted">{n ? `${n} selected` : ""}</span>
    </div>
  );
}
