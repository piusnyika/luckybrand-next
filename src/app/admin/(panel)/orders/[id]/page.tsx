import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { money, formatDateTime, STATUS_LABEL, STATUS_COLOR, ORDER_STATUSES } from "@/lib/format";
import { PageHeader, Card, Badge, Field, SubmitButton, FlashToast } from "@/components/admin/ui";
import { updateOrder, addOrderNote, resendEmail } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: `Order ${(await params).id}` }; }
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const o = await getOrder(Number((await params).id));
  if (!o) notFound();
  const b = o.billing || {};
  return (
    <>
      <FlashToast />
      <PageHeader back="/admin/orders/" title={`Order #${o.number}`} subtitle={<>Placed {formatDateTime(o.createdAt)} · {o.paymentMethodTitle}{o.transactionId && ` · Ref ${o.transactionId}`} {o.paidAt && `· Paid ${formatDateTime(o.paidAt)}`} · IP {o.ipAddress || "–"}</>}
        actions={<>
          <a href={`/admin/invoice/${o.id}/`} target="_blank" className="btn-outline h-10 text-sm">Print invoice</a>
          <form action={resendEmail}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-outline h-10 text-sm" pendingText="Sending…">Email to customer</SubmitButton></form>
        </>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <form action={updateOrder}>
            <input type="hidden" name="id" value={o.id} />
            <Card title="Details" actions={<Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge>}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status"><select name="status" defaultValue={o.status} className="field">{ORDER_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}</select></Field>
                <Field label="Customer">{o.userId ? <Link href={`/admin/customers/${o.userId}/`} className="field flex items-center text-primary">View customer profile</Link> : <div className="field flex items-center text-ink-muted">Guest</div>}</Field>
                <Field label="Transaction ID"><input name="transactionId" defaultValue={o.transactionId} className="field" /></Field>
              </div>
              <h3 className="mb-3 mt-6 text-sm font-semibold">Billing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="b_firstName" defaultValue={b.firstName} placeholder="First name" className="field" aria-label="First name" />
                <input name="b_lastName" defaultValue={b.lastName} placeholder="Last name" className="field" aria-label="Last name" />
                <input name="b_company" defaultValue={b.company} placeholder="Company" className="field sm:col-span-2" aria-label="Company" />
                <input name="b_address1" defaultValue={b.address1} placeholder="Address" className="field sm:col-span-2" aria-label="Address" />
                <input name="b_address2" defaultValue={b.address2} placeholder="Address line 2" className="field sm:col-span-2" aria-label="Address line 2" />
                <input name="b_city" defaultValue={b.city} placeholder="City" className="field" aria-label="City" />
                <input name="b_state" defaultValue={b.state} placeholder="Province" className="field" aria-label="Province" />
                <input name="email" defaultValue={o.email} placeholder="Email" className="field" aria-label="Email" />
                <input name="phone" defaultValue={o.phone} placeholder="Phone" className="field" aria-label="Phone" />
              </div>
              {o.shipping && <div className="mt-4 rounded-form bg-surface p-3 text-sm"><strong>Ship to:</strong> {[`${o.shipping.firstName ?? ""} ${o.shipping.lastName ?? ""}`, o.shipping.address1, o.shipping.address2, o.shipping.city, o.shipping.state].filter(Boolean).join(", ")}</div>}
              {o.customerNote && <div className="mt-4 rounded-form bg-amber-50 p-3 text-sm"><strong>Customer note:</strong> {o.customerNote}</div>}
              <div className="mt-6 flex justify-end"><SubmitButton>Update order</SubmitButton></div>
            </Card>
          </form>
          <Card title="Items">
            <div className="-m-5">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {o.items.map((i) => (
                    <tr key={i.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <td className="w-16 px-5 py-3">{i.image ? <img src={i.image} alt="" className="h-12 w-12 rounded border border-line object-contain" /> : <div className="h-12 w-12 rounded bg-surface" />}</td>
                      <td className="py-3">{i.productId ? <Link href={`/admin/products/${i.productId}/`} className="font-medium hover:text-primary">{i.name}</Link> : i.name}{i.sku && <div className="text-xs text-ink-muted">SKU: {i.sku}</div>}
                        {i.bundle?.length ? <ul className="mt-1 space-y-0.5 border-l-2 border-line pl-2 text-xs text-ink-soft">{i.bundle.map((b) => <li key={b.productId}><strong>{b.qty * i.quantity} ×</strong> {b.name}{b.sku && <span className="text-ink-muted"> ({b.sku})</span>}</li>)}</ul> : null}</td>
                      <td className="py-3 text-ink-soft">{money(i.unitPrice)} × {i.quantity}</td>
                      <td className="px-5 py-3 text-right font-semibold">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
                <Row l="Subtotal" v={money(o.subtotal)} />
                {Number(o.discountTotal) > 0 && <Row l={`Coupon${o.couponCode ? ` (${o.couponCode})` : ""}`} v={"-" + money(o.discountTotal)} />}
                <Row l={`Shipping${o.shippingMethod ? ` (${o.shippingMethod})` : ""}`} v={money(o.shippingTotal)} />
                <div className="flex justify-between pt-2 text-base font-bold"><span>Total</span><span>{money(o.total)}</span></div>
              </div>
            </div>
          </Card>
        </div>
        <Card title="Order notes">
          <form action={addOrderNote} className="mb-5 space-y-2">
            <input type="hidden" name="id" value={o.id} />
            <textarea name="note" rows={3} required placeholder="Add a note…" className="field text-sm" />
            <div className="flex gap-2"><select name="type" className="field h-10 flex-1 text-sm"><option value="private">Private note</option><option value="customer">Note to customer (emails them)</option></select><SubmitButton className="btn-primary h-10 text-sm" pendingText="…">Add</SubmitButton></div>
          </form>
          <ol className="space-y-3">
            {[...o.notes].reverse().map((n) => (
              <li key={n.id} className={`rounded-form p-3 text-sm ${n.isCustomer ? "bg-blue-50" : "bg-surface"}`}>
                <div className="whitespace-pre-wrap">{n.content}</div>
                <div className="mt-1 text-[11px] text-ink-muted">{formatDateTime(n.createdAt)} · {n.author}{n.isCustomer && " · sent to customer"}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
const Row = ({ l, v }: { l: string; v: string }) => <div className="flex justify-between text-ink-soft"><span>{l}</span><span className="text-ink">{v}</span></div>;
