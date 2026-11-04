"use client";
import { useEffect, useState } from "react";

/** Description / Specifications tabs. Every panel stays in the HTML (hidden, not removed) so search engines see all of it. */
export function ProductTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  // links like #reviews open their tab
  useEffect(() => {
    const open = () => { const k = location.hash.slice(1); if (tabs.some((t) => t.key === k)) setActive(k); };
    open(); window.addEventListener("hashchange", open); return () => window.removeEventListener("hashchange", open);
  }, [tabs]);
  if (!tabs.length) return null;
  return (
    <section className="mt-16" id={tabs.some((t) => t.key === active) ? active : undefined}>
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`} aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-semibold transition-colors ${active === t.key ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={active !== t.key} className="mt-5">{t.content}</div>
      ))}
    </section>
  );
}
