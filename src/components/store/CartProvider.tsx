"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";

export type CartLine = { id: number; qty: number; name: string; slug: string; price: number; image: string | null };
type Toast = { id: number; text: string; href?: string };
type AddedToast = { key: number; name: string; image: string | null; qty: number };
type Ctx = {
  lines: CartLine[]; count: number; subtotal: number; ready: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void; setQty: (id: number, qty: number) => void;
  remove: (id: number) => void; clear: () => void; replace: (lines: CartLine[]) => void;
  drawerOpen: boolean; setDrawerOpen: (v: boolean) => void;
  wishlist: number[]; toggleWish: (id: number) => void; compare: number[]; toggleCompare: (id: number) => void;
  toast: (text: string, href?: string) => void;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = "lb_cart_v1", WKEY = "lb_wishlist_v1", CKEY = "lb_compare_v1";

function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [compare, setCompare] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const [added, setAdded] = useState<AddedToast | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideAddedIn = useCallback((ms: number) => { clearTimeout(addedTimer.current); addedTimer.current = setTimeout(() => setAdded(null), ms); }, []);

  useEffect(() => {
    setLines(load(KEY, [])); setWishlist(load(WKEY, [])); setCompare(load(CKEY, [])); setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setLines(load(KEY, [])); };
    window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { if (ready) save(KEY, lines); }, [lines, ready]);
  // logged-in customers: keep a copy on the server (other devices, abandoned-cart email). Guests: the server ignores it.
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const key = JSON.stringify(lines.map((l) => [l.id, l.qty]));
    if (synced.current === null) {
      synced.current = key;
      // empty here but maybe filled on another device: bring it over once per visit
      let asked = true; try { asked = !!sessionStorage.getItem("lb_cart_restored"); sessionStorage.setItem("lb_cart_restored", "1"); } catch {}
      if (lines.length) fetch("/api/cart/saved/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) }).catch(() => {});
      else if (!asked) fetch("/api/cart/saved/").then((r) => r.json()).then((j: { lines: CartLine[] }) => { if (j.lines?.length) { synced.current = JSON.stringify(j.lines.map((l) => [l.id, l.qty])); setLines((cur) => (cur.length ? cur : j.lines)); } }).catch(() => {});
      return;
    }
    if (key === synced.current) return;
    const t = setTimeout(() => {
      synced.current = key;
      fetch("/api/cart/saved/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }), keepalive: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [lines, ready]);
  useEffect(() => { if (ready) save(WKEY, wishlist); }, [wishlist, ready]);
  useEffect(() => { if (ready) save(CKEY, compare); }, [compare, ready]);

  const toast = useCallback((text: string, href?: string) => {
    const id = ++tid.current; setToasts((t) => [...t, { id, text, href }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const value = useMemo<Ctx>(() => ({
    lines, ready, count: lines.reduce((a, l) => a + l.qty, 0), subtotal: lines.reduce((a, l) => a + l.qty * l.price, 0),
    add: (line, qty = 1) => {
      setLines((ls) => { const ex = ls.find((l) => l.id === line.id); return ex ? ls.map((l) => (l.id === line.id ? { ...l, ...line, qty: l.qty + qty } : l)) : [...ls, { ...line, qty }]; });
      setAdded({ key: ++tid.current, name: line.name, image: line.image, qty });
      hideAddedIn(4000);
    },
    setQty: (id, qty) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty } : l)))),
    remove: (id) => setLines((ls) => ls.filter((l) => l.id !== id)),
    clear: () => setLines([]), replace: (ls) => setLines(ls),
    drawerOpen, setDrawerOpen,
    wishlist, toggleWish: (id) => setWishlist((w) => { const has = w.includes(id); toast(has ? "Removed from wishlist" : "Added to wishlist", has ? undefined : "/wishlist/"); return has ? w.filter((x) => x !== id) : [...w, id]; }),
    compare, toggleCompare: (id) => setCompare((c) => { const has = c.includes(id); toast(has ? "Removed from compare" : "Added to compare", has ? undefined : "/compare/"); return has ? c.filter((x) => x !== id) : [...c, id].slice(-4); }),
    toast,
  }), [lines, ready, drawerOpen, wishlist, compare, toast, hideAddedIn]);
  const count = lines.reduce((a, l) => a + l.qty, 0), subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0);

  return (
    <CartCtx.Provider value={value}>
      {children}
      {/* "Added to cart" toast: top-right on desktop, above the bottom bar on mobile */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-20 z-[80] flex justify-center sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-36 lg:top-40">
        {added && (
          <div key={added.key} onMouseEnter={() => clearTimeout(addedTimer.current)} onMouseLeave={() => hideAddedIn(2000)}
            className="pointer-events-auto w-full max-w-sm animate-toast-in rounded-base border border-line bg-white p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-form border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {added.image && <img src={added.image} alt="" className="h-full w-full object-contain" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                  Added to cart
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink">{added.qty > 1 && <strong>{added.qty} × </strong>}{added.name}</p>
                <p className="mt-1 text-xs text-ink-muted">Cart: {count} item{count === 1 ? "" : "s"} · {money(subtotal)}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setAdded(null)} className="-mr-1 -mt-1 p-1 text-ink-muted hover:text-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setAdded(null); setDrawerOpen(true); }} className="rounded-form border border-line py-2 text-sm font-semibold hover:border-primary">View cart</button>
              <a href="/checkout/" className="rounded-form bg-primary py-2 text-center text-sm font-semibold text-white hover:bg-primary-700">Checkout</a>
            </div>
          </div>
        )}
      </div>
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-form bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            {t.text}{t.href && <a href={t.href} className="underline underline-offset-2">View</a>}
          </div>
        ))}
      </div>
    </CartCtx.Provider>
  );
}
export function useCart() { const c = useContext(CartCtx); if (!c) throw new Error("useCart outside CartProvider"); return c; }
