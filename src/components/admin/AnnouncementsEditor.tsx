"use client";
import { useState } from "react";
import type { Announcement, AnnouncementSettings } from "@/lib/settings";
import { AnnouncementContent } from "../store/AnnouncementBar";
import { Icon } from "../Icon";
import { SubmitButton } from "./ui-client";

const PRESETS = [
  { name: "Red", bg: "#ed1b24", color: "#ffffff" }, { name: "Blue", bg: "#004798", color: "#ffffff" },
  { name: "Yellow", bg: "#f9d309", color: "#1b1f22" }, { name: "Green", bg: "#2f9e44", color: "#ffffff" }, { name: "Dark", bg: "#1b1f22", color: "#ffffff" },
];

const blank = (): Announcement => ({
  id: Math.random().toString(36).slice(2, 10), label: "", text: "", link: "", linkLabel: "",
  bg: "#004798", color: "#ffffff", startsOn: "", endsOn: "", enabled: true,
});

function status(m: Announcement, today: string): [string, string] {
  if (!m.enabled) return ["Off", "bg-gray-100 text-gray-600"];
  if (!m.text.trim()) return ["No text", "bg-gray-100 text-gray-600"];
  if (m.startsOn && m.startsOn > today) return [`Starts ${m.startsOn}`, "bg-blue-50 text-blue-700"];
  if (m.endsOn && m.endsOn < today) return ["Ended", "bg-gray-100 text-gray-600"];
  return ["Showing", "bg-green-50 text-green-700"];
}

export function AnnouncementsEditor({ initial, today, action }: { initial: AnnouncementSettings; today: string; action: (fd: FormData) => Promise<void> }) {
  const [s, setS] = useState(initial);
  const set = (patch: Partial<AnnouncementSettings>) => setS((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<Announcement>) => set({ items: s.items.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const move = (i: number, d: number) => {
    const items = [...s.items]; const j = i + d; if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]]; set({ items });
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="data" value={JSON.stringify(s)} />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-base border border-line bg-white p-5">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="accent-primary" /> Show the announcement bar</label>
        <label className="flex items-center gap-2 text-sm">Change message every
          <input type="number" min={3} max={60} value={s.seconds} onChange={(e) => set({ seconds: Number(e.target.value) || 6 })} className="field w-20" /> seconds</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.dismissible} onChange={(e) => set({ dismissible: e.target.checked })} className="accent-primary" /> Visitors can close it (it comes back when you change the messages)</label>
      </div>

      {s.items.length === 0 && <div className="rounded-base border border-dashed border-line bg-white p-10 text-center text-sm text-ink-soft">No messages yet. Add one below.</div>}

      {s.items.map((m, i) => {
        const [label, cls] = status(m, today);
        return (
          <div key={m.id} className="overflow-hidden rounded-base border border-line bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <span className="text-sm font-semibold">Message {i + 1}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
              <div className="ml-auto flex items-center gap-1">
                <label className="mr-3 flex items-center gap-1.5 text-xs"><input type="checkbox" checked={m.enabled} onChange={(e) => setItem(i, { enabled: e.target.checked })} className="accent-primary" /> On</label>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1.5 hover:bg-surface disabled:opacity-30"><Icon name="chevronLeft" size={14} className="rotate-90" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === s.items.length - 1} aria-label="Move down" className="rounded p-1.5 hover:bg-surface disabled:opacity-30"><Icon name="chevronRight" size={14} className="rotate-90" /></button>
                <button type="button" onClick={() => { if (confirm("Delete this message?")) set({ items: s.items.filter((_, k) => k !== i) }); }} aria-label="Delete" className="rounded p-1.5 text-danger hover:bg-surface"><Icon name="trash" size={14} /></button>
              </div>
            </div>

            {/* live preview */}
            <div className="px-4 py-[9px] text-center text-[13px] leading-snug" style={{ background: m.bg, color: m.color }}>
              {m.text.trim() ? <AnnouncementContent m={m} /> : <span className="opacity-60">Preview appears here</span>}
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-[160px_1fr]">
              <label><span className="label">Tag (optional)</span><input value={m.label} maxLength={30} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="NOTICE" className="field" /></label>
              <label><span className="label">Message</span>
                <input value={m.text} maxLength={200} onChange={(e) => setItem(i, { text: e.target.value })} placeholder="We have moved to **164 Mutare Road, Msasa**" className="field" />
                <span className="mt-1 block text-xs text-ink-muted">Put **double asterisks** around words to make them bold. {m.text.length}/200</span>
              </label>
              <label><span className="label">Link text (optional)</span><input value={m.linkLabel} maxLength={30} onChange={(e) => setItem(i, { linkLabel: e.target.value })} placeholder="Get directions" className="field" /></label>
              <label><span className="label">Link (optional)</span><input value={m.link} maxLength={500} onChange={(e) => setItem(i, { link: e.target.value })} placeholder="/shop/?on_sale=1 or https://maps.google.com/…" className="field" />
                <span className="mt-1 block text-xs text-ink-muted">Makes the whole message clickable.</span></label>
              <div className="md:col-span-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                <label><span className="label">Show from (optional)</span><input type="date" value={m.startsOn} onChange={(e) => setItem(i, { startsOn: e.target.value })} className="field" /></label>
                <label><span className="label">Show until (optional)</span><input type="date" value={m.endsOn} onChange={(e) => setItem(i, { endsOn: e.target.value })} className="field" /></label>
                <div><span className="label">Colours</span>
                  <div className="flex h-[46px] items-center gap-2">
                    {PRESETS.map((p) => (
                      <button key={p.name} type="button" title={p.name} onClick={() => setItem(i, { bg: p.bg, color: p.color })}
                        className={`h-7 w-7 rounded-full border-2 ${m.bg === p.bg ? "border-ink" : "border-white shadow"}`} style={{ background: p.bg }} />
                    ))}
                    <label title="Background" className="ml-1"><input type="color" value={m.bg} onChange={(e) => setItem(i, { bg: e.target.value })} className="h-8 w-9 cursor-pointer" /></label>
                    <label title="Text colour"><input type="color" value={m.color} onChange={(e) => setItem(i, { color: e.target.value })} className="h-8 w-9 cursor-pointer" /></label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => set({ items: [...s.items, blank()] })} className="btn-outline h-10 text-sm"><Icon name="plus" size={16} />Add message</button>
        <SubmitButton>Save announcements</SubmitButton>
      </div>
    </form>
  );
}
