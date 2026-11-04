"use client";
import { useActionState, useState } from "react";
import { submitQuote } from "@/app/(store)/request-a-quote/actions";
import { useCart } from "./CartProvider";

type Item = { productId: number; name: string; image: string | null; qty: number };
type Init = { name: string; email: string; phone: string; company: string; city: string };

export function QuoteForm({ initialItems, initial }: { initialItems: Item[]; initial: Init }) {
  const [st, act, pending] = useActionState(submitQuote, undefined);
  const { lines, ready } = useCart();
  const [items, setItems] = useState<Item[]>(initialItems);
  const fromCart = lines.filter((l) => !items.some((i) => i.productId === l.id));
  const addCart = () => setItems((cur) => [...cur, ...fromCart.map((l) => ({ productId: l.id, name: l.name, image: l.image, qty: l.qty }))]);
  if (st?.ok) return <p className="mx-auto my-10 max-w-2xl rounded-base bg-green-50 px-5 py-4 text-green-800">{st.ok}</p>;
  const field = (k: keyof Init, label: string, req = false, type = "text", auto?: string) => (
    <label className="block"><span className="label">{label}{req && <span className="text-danger"> *</span>}</span>
      <input name={k} type={type} required={req} defaultValue={initial[k]} autoComplete={auto} className="field" /></label>
  );
  return (
    <form action={act} className="grid gap-8 pb-10 lg:grid-cols-[1fr_380px]">
      <div>
        {st?.error && <p className="mb-4 rounded-form bg-red-50 px-4 py-3 text-sm text-danger">{st.error}</p>}
        <h2 className="mb-3 text-lg font-semibold">Products</h2>
        {items.length ? (
          <ul className="divide-y divide-line rounded-base border border-line">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image ? <img src={i.image} alt="" className="h-12 w-12 rounded object-contain" /> : <span className="h-12 w-12 rounded bg-surface" />}
                <span className="min-w-0 flex-1 text-sm font-medium">{i.name}</span>
                <label className="flex items-center gap-1 text-sm">Qty
                  <input type="number" min={1} value={i.qty} onChange={(e) => setItems(items.map((x) => (x.productId === i.productId ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} className="field h-9 w-20" /></label>
                <button type="button" onClick={() => setItems(items.filter((x) => x.productId !== i.productId))} className="text-sm text-danger hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-base border border-dashed border-line p-4 text-sm text-ink-soft">No products added. Describe what you need below, or add items from your cart.</p>}
        {ready && fromCart.length > 0 && <button type="button" onClick={addCart} className="btn-outline mt-3 h-10 text-sm">Add {fromCart.length} item{fromCart.length === 1 ? "" : "s"} from my cart</button>}
        <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, qty: i.qty })))} />
        <label className="mt-6 block"><span className="label">Tell us about your project</span>
          <textarea name="message" rows={5} maxLength={5000} placeholder="e.g. delivery location, when you need it, installation, sizes or alternatives you'd consider" className="field h-auto py-2" /></label>
      </div>
      <div className="space-y-4 rounded-base border border-line p-5 lg:self-start">
        <h2 className="text-lg font-semibold">Your details</h2>
        {field("name", "Name", true, "text", "name")}
        {field("email", "Email", true, "email", "email")}
        {field("phone", "Phone / WhatsApp", true, "tel", "tel")}
        {field("company", "Company (optional)", false, "text", "organization")}
        {field("city", "Town / city", false, "text", "address-level2")}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button disabled={pending} className="btn-primary w-full">{pending ? "Sending…" : "Request quote"}</button>
        <p className="text-xs text-ink-muted">No payment needed. We&apos;ll reply with prices, availability and delivery options.</p>
      </div>
    </form>
  );
}
