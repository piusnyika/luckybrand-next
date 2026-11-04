"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "./CartProvider";
import { GoogleButton } from "./GoogleButton";
import { useQuote } from "./useQuote";
import { Totals } from "./CartView";
import { placeOrder } from "@/app/(store)/checkout/actions";
import { money } from "@/lib/format";

type Init = { firstName: string; lastName: string; company: string; address1: string; address2: string; city: string; state: string; postcode: string; email: string; phone: string };
type Method = { id: "paynow" | "cod" | "bacs" | "ngenius"; title: string; description: string; details: string; mobile?: boolean };
/** Econet 077/078 → EcoCash, NetOne 071 → OneMoney (same rule as lib/paynow guessMethod) */
const networkFor = (phone: string) => { const d = phone.replace(/[^d]/g, "").replace(/^263/, "0"); return /^0?71/.test(d) ? "onemoney" : "ecocash"; };

export function CheckoutForm({ initial, methods, loggedIn, google = false }: { initial: Init; methods: Method[]; loggedIn: boolean; google?: boolean }) {
  const { lines, ready, clear } = useCart();
  const [coupon] = useState<string | null>(() => (typeof window !== "undefined" ? sessionStorage.getItem("lb_coupon") : null));
  const [ship, setShip] = useState<number | null>(null);
  const { quote, loading } = useQuote(coupon, ship);
  const [f, setF] = useState(initial);
  const [shipDiff, setShipDiff] = useState(false);
  const [sf, setSf] = useState({ firstName: "", lastName: "", address1: "", address2: "", city: "", state: "" });
  const [note, setNote] = useState("");
  const [pm, setPm] = useState<Method["id"]>(methods[0]?.id ?? "paynow");
  const [payVia, setPayVia] = useState<"web" | "mobile">("web");
  const [mPhone, setMPhone] = useState(initial.phone);
  const [mMethod, setMMethod] = useState<"ecocash" | "onemoney">(networkFor(initial.phone));
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  if (!ready) return <div className="py-20 text-center text-ink-muted">Loading…</div>;
  if (!lines.length) return <div className="py-20 text-center"><p className="mb-5 text-lg">Your cart is currently empty.</p><Link href="/shop/" className="btn-primary">Return to shop</Link></div>;

  const inp = (k: keyof Init, label: string, req = true, type = "text", auto?: string) => (
    <label className="block"><span className="label">{label}{req && <span className="text-danger"> *</span>}</span>
      <input className="field" type={type} required={req} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErrors([]);
    start(async () => {
      const r = await placeOrder({
        lines: lines.map((l) => ({ id: l.id, qty: l.qty })), coupon, shippingMethodId: ship ?? quote?.shippingMethodId ?? null,
        billing: { firstName: f.firstName, lastName: f.lastName, company: f.company, address1: f.address1, address2: f.address2, city: f.city, state: f.state, postcode: f.postcode, country: "ZW" },
        email: f.email, phone: f.phone, shipToDifferent: shipDiff, shipping: shipDiff ? { ...sf, country: "ZW" } : undefined,
        note, paymentMethod: pm, createAccount, password,
        paynowMobile: pm === "paynow" && payVia === "mobile" ? { phone: mPhone, method: mMethod } : undefined,
      });
      if (r.ok) { clear(); try { sessionStorage.removeItem("lb_coupon"); } catch {} window.location.href = r.redirect; }
      else { setErrors(r.errors); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-10 pb-6 lg:grid-cols-[1fr_440px]">
      <div>
        {!loggedIn && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-form bg-surface px-4 py-3 text-sm">
            <p>Returning customer? <Link href="/my-account/?next=/checkout/" className="font-semibold text-primary">Click here to login</Link></p>
            {google && <GoogleButton next="/checkout/" className="h-10 text-sm" />}
          </div>
        )}
        {errors.length > 0 && <ul className="mb-6 space-y-1 rounded-form border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <h2 className="mb-5 text-xl font-semibold">Billing details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {inp("firstName", "First name", true, "text", "given-name")}{inp("lastName", "Last name", true, "text", "family-name")}
          <div className="sm:col-span-2">{inp("company", "Company name (optional)", false, "text", "organization")}</div>
          <div className="sm:col-span-2"><span className="label">Country / Region</span><div className="field flex items-center bg-surface">Zimbabwe</div></div>
          <div className="sm:col-span-2">{inp("address1", "Street address", true, "text", "address-line1")}</div>
          <div className="sm:col-span-2"><input className="field" placeholder="Apartment, suite, unit, etc. (optional)" value={f.address2} onChange={(e) => setF({ ...f, address2: e.target.value })} autoComplete="address-line2" /></div>
          {inp("city", "Town / City", true, "text", "address-level2")}{inp("state", "Province (optional)", false, "text", "address-level1")}
          {inp("phone", "Phone", true, "tel", "tel")}{inp("email", "Email address", true, "email", "email")}
        </div>
        {!loggedIn && (
          <div className="mt-5">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="accent-primary" /> Create an account?</label>
            {createAccount && <label className="mt-3 block max-w-sm"><span className="label">Create account password *</span><input type="password" className="field" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>}
          </div>
        )}
        <label className="mt-8 flex items-center gap-2 text-lg font-semibold"><input type="checkbox" checked={shipDiff} onChange={(e) => setShipDiff(e.target.checked)} className="accent-primary" /> Ship to a different address?</label>
        {shipDiff && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["firstName", "lastName", "address1", "address2", "city", "state"] as const).map((k) => (
              <label key={k} className={k.startsWith("address") ? "sm:col-span-2" : ""}><span className="label">{{ firstName: "First name", lastName: "Last name", address1: "Street address", address2: "Apartment, suite, unit (optional)", city: "Town / City", state: "Province" }[k]}</span>
                <input className="field" required={!["address2", "state"].includes(k)} value={sf[k]} onChange={(e) => setSf({ ...sf, [k]: e.target.value })} /></label>
            ))}
          </div>
        )}
        <label className="mt-6 block"><span className="label">Order notes (optional)</span>
          <textarea className="field" rows={4} placeholder="Notes about your order, e.g. special notes for delivery." value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>

      <aside className="h-fit rounded-base border border-line p-6">
        <h2 className="mb-4 text-lg font-semibold">Your order</h2>
        <ul className="mb-4 divide-y divide-line border-b border-line text-sm">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2.5"><span>{l.name} <strong>× {l.qty}</strong>{l.includes?.length ? <span className="block text-xs text-ink-muted">Includes: {l.includes.map((b) => `${b.qty * l.qty} × ${b.name}`).join(", ")}</span> : null}{l.error && <span className="block text-xs text-danger">{l.error}</span>}</span><span className="font-medium">{money(l.total)}</span></li>
          ))}
        </ul>
        <Totals quote={quote} loading={loading} ship={ship} setShip={setShip} />
        <div className="mt-6 space-y-2">
          {methods.length === 0 && <p className="text-sm text-danger">No payment methods are enabled. Please contact us.</p>}
          {methods.map((m) => (
            <div key={m.id} className={`rounded-form border ${pm === m.id ? "border-primary bg-primary-50/50" : "border-line"}`}>
              <label className="flex cursor-pointer items-center gap-2 p-3 text-sm font-semibold"><input type="radio" name="pm" checked={pm === m.id} onChange={() => setPm(m.id)} className="accent-primary" />{m.title}</label>
              {pm === m.id && (m.description || m.details) && <div className="px-3 pb-3 text-[13px] text-ink-soft">{m.description}{m.details && <pre className="mt-2 whitespace-pre-wrap font-sans">{m.details}</pre>}</div>}
              {pm === m.id && m.id === "paynow" && m.mobile && (
                <div className="space-y-2 border-t border-line px-3 py-3 text-[13px]">
                  <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="payVia" checked={payVia === "web"} onChange={() => setPayVia("web")} className="mt-0.5 accent-primary" />
                    <span><strong>Pay on the Paynow website</strong><span className="block text-ink-soft">EcoCash, OneMoney, InnBucks, Visa / Mastercard</span></span></label>
                  <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="payVia" checked={payVia === "mobile"} onChange={() => setPayVia("mobile")} className="mt-0.5 accent-primary" />
                    <span><strong>EcoCash / OneMoney prompt on my phone</strong><span className="block text-ink-soft">Approve the payment with your PIN; you stay on this site</span></span></label>
                  {payVia === "mobile" && (
                    <div className="grid grid-cols-[1fr_auto] gap-2 pl-6 pt-1">
                      <label><span className="sr-only">Mobile money number</span>
                        <input type="tel" inputMode="tel" required value={mPhone} placeholder="0771 234 567" autoComplete="tel"
                          onChange={(e) => { setMPhone(e.target.value); setMMethod(networkFor(e.target.value)); }} className="field h-10 text-sm" /></label>
                      <select value={mMethod} onChange={(e) => setMMethod(e.target.value as "ecocash" | "onemoney")} className="field h-10 w-32 text-sm" aria-label="Mobile money network">
                        <option value="ecocash">EcoCash</option><option value="onemoney">OneMoney</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">Your personal data will be used to process your order and for other purposes described in our <Link href="/privacy-policy/" className="text-primary">privacy policy</Link>.</p>
        <button disabled={pending || !quote || loading || !!quote?.errors.length || !methods.length} className="btn-primary mt-4 w-full">
          {pending ? "Processing…" : pm === "paynow" ? (payVia === "mobile" ? `Send ${mMethod === "onemoney" ? "OneMoney" : "EcoCash"} prompt` : "Pay with Paynow") : pm === "ngenius" ? "Pay by card" : "Place order"}
        </button>
      </aside>
    </form>
  );
}
