import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { getSite } from "@/lib/settings";
import { money, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Invoice", robots: { index: false } };
export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const [o, site] = await Promise.all([getOrder(Number((await params).id)), getSite()]);
  if (!o) notFound();
  const b = o.billing || {};
  return (
    <div className="mx-auto max-w-[800px] bg-white p-10 font-sans text-[13px] text-ink print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      <div className="flex items-start justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt={site.name} className="h-12" />
        <div className="text-right text-xs leading-relaxed">{site.name}<br />{site.address}<br />{site.email}<br />{site.phones[0]?.label}</div>
      </div>
      <h1 className="mt-10 text-2xl font-bold uppercase tracking-wide">Invoice</h1>
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div><div className="mb-1 text-xs font-semibold uppercase text-ink-muted">Bill to</div>
          {[`${b.firstName ?? ""} ${b.lastName ?? ""}`, b.company, b.address1, b.address2, b.city, b.state].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}<div>{o.email}</div><div>{o.phone}</div></div>
        <table className="ml-auto text-sm"><tbody>
          <tr><td className="pr-6 text-ink-muted">Invoice number:</td><td>{o.number}</td></tr>
          <tr><td className="pr-6 text-ink-muted">Invoice date:</td><td>{formatDate(new Date())}</td></tr>
          <tr><td className="pr-6 text-ink-muted">Order number:</td><td>{o.number}</td></tr>
          <tr><td className="pr-6 text-ink-muted">Order date:</td><td>{formatDate(o.createdAt)}</td></tr>
          <tr><td className="pr-6 text-ink-muted">Payment method:</td><td>{o.paymentMethodTitle}</td></tr>
        </tbody></table>
      </div>
      <table className="mt-8 w-full border-collapse">
        <thead><tr className="bg-[#0b2a55] text-left text-white"><th className="p-2.5">Product</th><th className="p-2.5">SKU</th><th className="p-2.5 text-right">Qty</th><th className="p-2.5 text-right">Price</th><th className="p-2.5 text-right">Total</th></tr></thead>
        <tbody>{o.items.map((i) => <tr key={i.id} className="border-b border-line"><td className="p-2.5">{i.name}</td><td className="p-2.5">{i.sku}</td><td className="p-2.5 text-right">{i.quantity}</td><td className="p-2.5 text-right">{money(i.unitPrice)}</td><td className="p-2.5 text-right">{money(i.total)}</td></tr>)}</tbody>
      </table>
      <table className="ml-auto mt-4 w-72 text-sm"><tbody>
        <tr><td className="py-1">Subtotal</td><td className="text-right">{money(o.subtotal)}</td></tr>
        {Number(o.discountTotal) > 0 && <tr><td className="py-1">Discount</td><td className="text-right">-{money(o.discountTotal)}</td></tr>}
        <tr><td className="py-1">Shipping{o.shippingMethod && ` (${o.shippingMethod})`}</td><td className="text-right">{money(o.shippingTotal)}</td></tr>
        <tr className="border-t-2 border-ink text-base font-bold"><td className="py-2">Total</td><td className="text-right">{money(o.total)}</td></tr>
      </tbody></table>
      {o.customerNote && <p className="mt-8"><strong>Customer note:</strong> {o.customerNote}</p>}
      <p className="mt-16 text-center text-xs text-ink-muted">Thank you for your business.</p>
    </div>
  );
}
