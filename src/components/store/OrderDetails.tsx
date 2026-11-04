import Link from "next/link";
import type { FullOrder } from "@/lib/orders";
import { money, formatDate, STATUS_LABEL } from "@/lib/format";

export function OrderDetails({ o }: { o: FullOrder }) {
  const b = o.billing || {}; const sh = o.shipping;
  return (
    <div className="space-y-8">
      <ul className="grid gap-4 rounded-base border border-dashed border-line p-5 text-sm sm:grid-cols-5">
        <li><div className="text-xs text-ink-muted">Order number</div><strong>{o.number}</strong></li>
        <li><div className="text-xs text-ink-muted">Date</div><strong>{formatDate(o.createdAt)}</strong></li>
        <li><div className="text-xs text-ink-muted">Status</div><strong>{STATUS_LABEL[o.status]}</strong></li>
        <li><div className="text-xs text-ink-muted">Total</div><strong>{money(o.total)}</strong></li>
        <li><div className="text-xs text-ink-muted">Payment method</div><strong>{o.paymentMethodTitle}</strong></li>
      </ul>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Order details</h2>
        <table className="w-full overflow-hidden rounded-base border border-line text-sm">
          <thead className="bg-surface text-left"><tr><th className="p-3">Product</th><th className="p-3 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-line">
            {o.items.map((i) => <tr key={i.id}><td className="p-3">{i.slug ? <Link href={`/product/${i.slug}/`} className="text-primary">{i.name}</Link> : i.name} <strong>× {i.quantity}</strong>
              {i.bundle?.length ? <span className="mt-0.5 block text-xs text-ink-muted">Includes: {i.bundle.map((b) => `${b.qty * i.quantity} × ${b.name}`).join(", ")}</span> : null}</td><td className="p-3 text-right">{money(i.total)}</td></tr>)}
            <tr><th className="p-3 text-left font-medium">Subtotal:</th><td className="p-3 text-right">{money(o.subtotal)}</td></tr>
            {Number(o.discountTotal) > 0 && <tr><th className="p-3 text-left font-medium">Discount{o.couponCode ? ` (${o.couponCode})` : ""}:</th><td className="p-3 text-right">-{money(o.discountTotal)}</td></tr>}
            <tr><th className="p-3 text-left font-medium">Shipping:</th><td className="p-3 text-right">{Number(o.shippingTotal) > 0 ? money(o.shippingTotal) : ""} {o.shippingMethod}</td></tr>
            <tr><th className="p-3 text-left font-medium">Payment method:</th><td className="p-3 text-right">{o.paymentMethodTitle}</td></tr>
            <tr><th className="p-3 text-left font-semibold">Total:</th><td className="p-3 text-right font-bold">{money(o.total)}</td></tr>
            {o.customerNote && <tr><th className="p-3 text-left font-medium">Note:</th><td className="p-3 text-right">{o.customerNote}</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="grid gap-6 sm:grid-cols-2">
        <Addr title="Billing address" a={b} extra={[o.phone, o.email]} />
        {sh && <Addr title="Shipping address" a={sh} />}
      </section>
    </div>
  );
}
function Addr({ title, a, extra = [] }: { title: string; a: Record<string, any>; extra?: string[] }) {
  return (
    <div><h3 className="mb-2 text-base font-semibold">{title}</h3>
      <address className="rounded-base border border-line p-4 text-sm not-italic leading-relaxed">
        {[`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(), a.company, a.address1, a.address2, a.city, a.state, a.postcode].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
        {extra.filter(Boolean).map((l) => <div key={l} className="mt-1">{l}</div>)}
      </address>
    </div>
  );
}
