"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Announcement } from "@/lib/settings";
import { Icon } from "../Icon";

/** "**bold**" → <strong>; everything else is plain text (never HTML) */
export function richText(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-bold">{part}</strong> : part));
}

/** One message's content, shared with the admin preview */
export function AnnouncementContent({ m }: { m: Pick<Announcement, "label" | "text" | "linkLabel" | "link"> }) {
  return (<>
    {m.label && <strong className="mr-1.5 font-bold">{m.label}</strong>}
    <span>{richText(m.text)}</span>
    {m.link && m.linkLabel && <span className="ml-2 whitespace-nowrap font-semibold underline underline-offset-2">{m.linkLabel} →</span>}
  </>);
}

const STORE_KEY = "lb_announce_closed";

/** Rotating messages at the very top of the store. Pauses while hovered or focused; closing hides it until the messages change. */
export function AnnouncementBar({ items, seconds, dismissible }: { items: Announcement[]; seconds: number; dismissible: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [closed, setClosed] = useState(false);
  const signature = items.map((m) => m.id + m.text).join("|");

  useEffect(() => {
    try { if (dismissible && localStorage.getItem(STORE_KEY) === signature) setClosed(true); } catch { /* storage blocked */ }
  }, [signature, dismissible]);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), Math.max(3, seconds) * 1000);
    return () => clearInterval(t);
  }, [items.length, paused, seconds]);

  if (!items.length || closed) return null;
  const m = items[i % items.length];
  const go = (d: number) => setI((n) => (n + d + items.length) % items.length);
  const close = () => { setClosed(true); try { localStorage.setItem(STORE_KEY, signature); } catch { /* ignore */ } };
  const external = /^https?:\/\//.test(m.link);

  return (
    <div role="region" aria-label="Announcements" className="relative overflow-hidden text-[13px] transition-colors duration-500" style={{ background: m.bg || "#ed1b24", color: m.color || "#fff" }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="container flex min-h-[38px] items-center gap-2 py-[7px]">
        {/* balances the close button so a single message stays centred */}
        {dismissible && items.length < 2 && <span className="w-[15px] shrink-0" aria-hidden />}
        {items.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous announcement" className="hidden shrink-0 opacity-70 hover:opacity-100 sm:block"><Icon name="chevronLeft" size={16} /></button>
        )}
        <div key={m.id} aria-live={paused ? "polite" : "off"} className="min-w-0 flex-1 announce-in text-center leading-snug">
          {m.link
            ? <Link href={m.link} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} className="hover:opacity-90"><AnnouncementContent m={m} /></Link>
            : <AnnouncementContent m={m} />}
        </div>
        {items.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next announcement" className="hidden shrink-0 opacity-70 hover:opacity-100 sm:block"><Icon name="chevronRight" size={16} /></button>
        )}
        {dismissible && (
          <button type="button" onClick={close} aria-label="Close announcements" className="shrink-0 opacity-70 hover:opacity-100"><Icon name="close" size={15} /></button>
        )}
      </div>
    </div>
  );
}
