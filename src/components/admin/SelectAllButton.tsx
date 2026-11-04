"use client";
import { useEffect, useRef, useState } from "react";

/** "Select all" for a BulkBar form: ticks every checkbox named "sel" on the page, then offers to select all `total` matching items across pages. */
export function SelectAllButton({ total, onPage, noun = "files" }: { total: number; onPage: number; noun?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"none" | "page" | "all">("none");
  const form = () => ref.current?.closest("form") ?? null;

  const apply = (next: typeof mode) => {
    const f = form(); if (!f) return;
    f.querySelectorAll<HTMLInputElement>('input[name="sel"]').forEach((b) => (b.checked = next !== "none"));
    if (next === "all") f.dataset.allCount = String(total); else delete f.dataset.allCount;
    setMode(next);
    f.dispatchEvent(new Event("change", { bubbles: true })); // lets BulkBar update its count
  };

  useEffect(() => {
    const f = form(); if (!f) return;
    const onChange = (e: Event) => {
      if ((e.target as HTMLInputElement).name !== "sel") return;
      const wasAll = !!f.dataset.allCount; delete f.dataset.allCount;
      setMode([...f.querySelectorAll<HTMLInputElement>('input[name="sel"]')].some((b) => b.checked) ? "page" : "none");
      if (wasAll) f.dispatchEvent(new Event("change", { bubbles: true }));
    };
    f.addEventListener("change", onChange);
    return () => f.removeEventListener("change", onChange);
  }, []);

  return (
    <div ref={ref} className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      {mode === "all" && <input type="hidden" name="allMatching" value="1" />}
      {mode === "none"
        ? <button type="button" onClick={() => apply("page")} className="btn-outline h-9 text-sm">Select all</button>
        : <button type="button" onClick={() => apply("none")} className="btn-outline h-9 text-sm">Clear selection</button>}
      {mode === "page" && total > onPage && <button type="button" onClick={() => apply("all")} className="font-semibold text-primary hover:underline">Select all {total} {noun}</button>}
      {mode === "all" && <span className="font-medium">All {total} {noun} selected (every page)</span>}
    </div>
  );
}
