"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

type Contact = { name: string; role: string; phone: string };
type Msg = { role: "user" | "assistant"; content: string; failed?: boolean };
type View = "menu" | "whatsapp" | "assistant";
const STORE = "lb_chat";
const SUGGESTIONS = ["Help me choose a solar system", "What inverters do you have?", "Which products are on sale?"];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

/** Floating chat button: pick the AI assistant or a salesperson on WhatsApp. */
export function ChatBubble({ contacts, assistant, storeName }: { contacts: Contact[]; assistant: { name: string; greeting: string } | null; storeName: string }) {
  const path = usePathname();
  const single = !assistant ? "whatsapp" : !contacts.length ? "assistant" : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(single ?? "menu");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { try { const s = sessionStorage.getItem(STORE); if (s) setMsgs(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { if (!busy) try { sessionStorage.setItem(STORE, JSON.stringify(msgs)); } catch {} }, [msgs, busy]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, looking, open, view]);
  useEffect(() => { if (open && view === "assistant") field.current?.focus(); }, [open, view]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  if (path.startsWith("/checkout")) return null; // keep the order button clear

  async function send(text: string) {
    text = text.trim();
    if (!text || busy) return;
    const history = [...msgs.filter((m) => !m.failed), { role: "user" as const, content: text }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true); setLooking(true);
    const write = (fn: (cur: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
    abort.current = new AbortController();
    try {
      const r = await fetch("/api/assistant/", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.current.signal,
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), page: path }) });
      if (!r.ok || !r.body) { write((m) => ({ ...m, failed: true, content: "" })); const j = await r.json().catch(() => ({})); write((m) => ({ ...m, content: j.message || "Sorry, I couldn't answer just now. Please try again." })); return; }
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n"); buf = parts.pop() ?? "";
        for (const line of parts.filter(Boolean)) {
          const e = JSON.parse(line) as { t: string; v?: string };
          if (e.t === "status") setLooking(true);
          if (e.t === "text") { setLooking(false); write((m) => ({ ...m, content: m.content + e.v })); }
          if (e.t === "error") write((m) => ({ ...m, failed: true, content: m.content ? `${m.content}\n\n${e.v}` : e.v! }));
        }
      }
    } catch {
      write((m) => (m.content ? m : { ...m, failed: true, content: "Sorry, I lost the connection. Please try again." }));
    } finally { setBusy(false); setLooking(false); }
  }

  const productUrl = path.startsWith("/product/") && typeof window !== "undefined" ? window.location.href : "";
  const waLink = (c: Contact) => `https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${c.name.split(" ")[0]}, I have a question${productUrl ? ` about this product: ${productUrl}` : ""}`)}`;
  const title = view === "assistant" ? assistant?.name : view === "whatsapp" ? "Chat on WhatsApp" : "How can we help?";
  const subtitle = view === "assistant" ? "AI assistant · replies instantly" : view === "whatsapp" ? "Choose who you'd like to talk to" : storeName;

  return (
    <div className="fixed bottom-[72px] right-4 z-[60] flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open && (
        <section role="dialog" aria-label={title} className="flex max-h-[min(620px,calc(100dvh-160px))] w-[calc(100vw-32px)] origin-bottom-right animate-[lb-pop_.18s_ease-out] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_60px_rgba(0,30,70,.28)] sm:w-[380px]">
          <header className="flex items-center gap-2 bg-gradient-to-br from-primary to-brand px-4 py-3.5 text-white">
            {view !== "menu" && !single && <button type="button" onClick={() => setView("menu")} aria-label="Back" className="-ml-1 rounded-full p-1 hover:bg-white/15"><Icon name="chevronLeft" size={20} /></button>}
            <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-semibold">{title}</h2><p className="truncate text-xs text-white/80">{subtitle}</p></div>
          </header>

          {view === "menu" && (
            <div className="space-y-2.5 p-4">
              <button type="button" onClick={() => setView("assistant")} className="flex w-full items-center gap-3 rounded-xl border border-line p-3.5 text-left transition hover:border-primary hover:shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary"><Sparkle /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">Ask the AI assistant</strong><span className="block text-xs text-ink-soft">Instant answers about products and specifications</span></span>
                <Icon name="chevronRight" size={16} />
              </button>
              <button type="button" onClick={() => setView("whatsapp")} className="flex w-full items-center gap-3 rounded-xl border border-line p-3.5 text-left transition hover:border-[#25d366] hover:shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white"><Icon name="whatsapp" size={24} /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">Chat on WhatsApp</strong><span className="block text-xs text-ink-soft">Talk to a member of our sales team</span></span>
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          )}

          {view === "whatsapp" && (
            <ul className="space-y-2 overflow-y-auto p-4">
              {contacts.map((c) => (
                <li key={c.phone + c.name}>
                  <a href={waLink(c)} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-[#25d366] hover:shadow-md">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary">{initials(c.name)}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{c.name}</strong><span className="block truncate text-xs text-ink-soft">{c.role}</span></span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white"><Icon name="whatsapp" size={20} /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {view === "assistant" && assistant && (<>
            <div className="min-h-[280px] flex-1 space-y-3 overflow-y-auto bg-surface p-4" aria-live="polite">
              <Bubble role="assistant">{assistant.greeting}</Bubble>
              {msgs.length === 0 && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((q) => <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-50">{q}</button>)}</div>}
              {msgs.map((m, i) => m.content ? <Bubble key={i} role={m.role} failed={m.failed}>{m.content}</Bubble> : null)}
              {looking && <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm" aria-label="Thinking">{[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />)}</div>}
              <div ref={end} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-line bg-white p-3">
              <textarea ref={field} rows={1} value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask about a product…" aria-label="Your message" className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-line px-3 py-2 text-base outline-none focus:border-primary sm:text-sm" />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition enabled:hover:bg-primary-600 disabled:opacity-40"><Icon name="chevronRight" size={20} /></button>
            </form>
            <p className="bg-white px-3 pb-2 text-center text-[10px] text-ink-muted">AI can make mistakes. Please confirm important details with our sales team.</p>
          </>)}
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close chat" : "Open chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand text-white shadow-[0_8px_24px_rgba(0,71,152,.45)] transition hover:scale-105 active:scale-95">
        <Icon name={open ? "close" : "message"} size={open ? 24 : 26} />
      </button>
    </div>
  );
}

function Sparkle() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9L11 3Zm7 11l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" /></svg>;
}

function Bubble({ role, failed, children }: { role: Msg["role"]; failed?: boolean; children: string }) {
  const mine = role === "user";
  return (
    <div className={`w-fit max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? "ml-auto rounded-br-sm bg-primary text-white" : `rounded-bl-sm bg-white ${failed ? "text-danger" : "text-ink"}`}`}>
      {mine ? children : <Rich text={children} />}
    </div>
  );
}

/** Only **bold** and links to this site's own pages; everything else stays plain text */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g).map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = part.match(/^\[(.+)\]\((.+)\)$/);
    if (link) return /^\/(?!\/)/.test(link[2]) ? <Link key={i} href={link[2]} className="font-medium text-primary underline underline-offset-2">{link[1]}</Link> : <span key={i}>{link[1]}</span>;
    return part;
  })}</>;
}
