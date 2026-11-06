"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

export type HeaderContact = { name: string; role: string; phone: string; whatsapp: boolean };

const digits = (p: string) => p.replace(/\D/g, "").replace(/^0/, "263");
const pretty = (p: string) => {
  const d = digits(p);
  return /^263\d{9}$/.test(d) ? `+263 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : p;
};

/** Header "Call Us" button: hover (desktop) or tap (touch) opens the sales team with Call / WhatsApp buttons. */
export function SalesContacts({ contacts, hours }: { contacts: HeaderContact[]; hours: string[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!contacts.length) return null;
  return (
    <div ref={box} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}
        className="flex flex-col items-center text-[11px] font-medium text-ink hover:text-primary">
        <Icon name="phone" size={24} /><span className="mt-1 hidden sm:block">Call Us</span>
      </button>
      {open && (
        <div className="absolute right-[-44px] top-full z-50 pt-3 sm:right-[-120px] lg:right-auto lg:left-1/2 lg:-translate-x-1/2">
          <div className="w-[300px] animate-toast-in rounded-base border border-line bg-white shadow-xl">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-semibold">Talk to our sales team</div>
              {hours.length > 0 && (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-ink-soft">
                  <Icon name="clock" size={14} className="mt-px shrink-0" /><span>{hours.join(" · ")}</span>
                </div>
              )}
            </div>
            <ul className="divide-y divide-line">
              {contacts.map((c) => (
                <li key={c.phone} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{c.name}</div>
                    <div className="text-xs text-ink-soft">{pretty(c.phone)}</div>
                  </div>
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink hover:border-primary hover:text-primary">
                    <Icon name="phone" size={15} />
                  </a>
                  {c.whatsapp && (
                    <a href={`https://wa.me/${digits(c.phone)}?text=${encodeURIComponent(`Hello ${c.name.split(" ")[0]}, I have a question about your products.`)}`}
                      target="_blank" rel="noopener" aria-label={`WhatsApp ${c.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25d366] text-white hover:opacity-90">
                      <Icon name="whatsapp" size={15} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
