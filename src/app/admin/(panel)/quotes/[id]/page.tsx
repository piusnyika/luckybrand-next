import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin/guard";
import { quoteCart } from "@/lib/orders";
import { formatDateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Badge, SubmitButton, FlashToast } from "@/components/admin/ui";
import { QUOTE_STATUS } from "../status";
import { saveQuote, quoteToOrder, emailQuote } from "../actions";

export const metadata = { title: "Quote request" };

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const q = await prisma.quoteRequest.findUnique({ where: { id: Number((await params).id) }, include: { order: { select: { id: true, number: true, total: true, status: true, accessKey: true } } } });
  if (!q) notFound();
  const items = (q.items as { productId: number; name: string; sku: string; qty: number }[]) ?? [];
  const priced = items.length ? await quoteCart(items.map((i) => ({ id: i.productId, qty: i.qty }))) : null;
  const base = process.env.SITE_URL || "";
  return (<>
    <FlashToast />
    <PageHeader title={`Quote request #${q.id}`} subtitle={`Received ${formatDateTime(q.createdAt)}`} back="/admin/quotes/" />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card title="Products">
          {items.length === 0 ? <p className="text-sm text-ink-soft">No products picked; see the message.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-soft"><th className="py-2">Product</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Today&apos;s price</th><th className="py-2 text-right">Total</th></tr></thead>
              <tbody>{items.map((i) => { const l = priced?.lines.find((x) => x.id === i.productId); return (
                <tr key={i.productId} className="border-t border-line">
                  <td className="py-2"><Link href={`/admin/products/${i.productId}/`} className="hover:text-primary">{i.name}</Link>{i.sku && <span className="ml-1 text-xs text-ink-muted">{i.sku}</span>}
                    {l?.error && <span className="block text-xs text-danger">{l.error}</span>}{!l && <span className="block text-xs text-danger">No longer for sale</span>}</td>
                  <td className="py-2 text-right">{i.qty}</td><td className="py-2 text-right">{l ? money(l.price) : "–"}</td><td className="py-2 text-right">{l ? money(l.total) : "–"}</td>
                </tr>); })}</tbody>
              {priced && <tfoot><tr className="border-t border-line font-semibold"><td className="py-2" colSpan={3}>Subtotal at today&apos;s prices</td><td className="py-2 text-right">{money(priced.subtotal)}</td></tr></tfoot>}
            </table>
          )}
        </Card>
        {q.message && <Card title="Message"><p className="whitespace-pre-line text-sm">{q.message}</p></Card>}
        <Card title="Order">
          {q.order ? (<>
            <p className="text-sm">Order <Link href={`/admin/orders/${q.order.id}/`} className="font-semibold text-primary">#{q.order.number}</Link> · {money(q.order.total)} · {q.order.status}.
              Adjust it in the order (items, shipping, discount) before sending.</p>
            <p className="mt-2 break-all text-xs text-ink-muted">Customer link: {base}/checkout/order-received/{q.order.id}/?key={q.order.accessKey}</p>
            <form className="mt-4 space-y-3"><input type="hidden" name="id" value={q.id} />
              <Field label="Message to the customer (optional)"><textarea name="message" rows={3} className="field h-auto py-2" placeholder="e.g. delivery to Gweru included; installation available" /></Field>
              <SubmitButton formAction={emailQuote} pendingText="Sending…">Email the quote to {q.email}</SubmitButton>
            </form>
          </>) : (
            <form><input type="hidden" name="id" value={q.id} />
              <p className="mb-3 text-sm text-ink-soft">Creates a pending order with these products at today&apos;s prices and reserves the stock. Cancel the order if the customer says no, and the stock goes back.</p>
              <SubmitButton formAction={quoteToOrder} pendingText="Creating…" className="btn-primary">Create order from this request</SubmitButton>
            </form>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Customer">
          <p className="text-sm font-semibold">{q.name}</p>
          {q.company && <p className="text-sm">{q.company}</p>}
          <p className="text-sm"><a href={`mailto:${q.email}`} className="text-primary">{q.email}</a></p>
          <p className="text-sm"><a href={`tel:${q.phone}`} className="text-primary">{q.phone}</a> · <a href={`https://wa.me/${q.phone.replace(/\D/g, "").replace(/^0/, "263")}`} target="_blank" className="text-success">WhatsApp</a></p>
          {q.city && <p className="text-sm text-ink-soft">{q.city}</p>}
        </Card>
        <Card title="Follow-up">
          <form className="space-y-3"><input type="hidden" name="id" value={q.id} />
            <Field label="Status"><select name="status" defaultValue={q.status} className="field">{Object.entries(QUOTE_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Staff notes (not shown to the customer)"><textarea name="staffNote" defaultValue={q.staffNote} rows={4} className="field h-auto py-2" /></Field>
            <div className="flex items-center justify-between"><Badge className={QUOTE_STATUS[q.status]?.[1]}>{QUOTE_STATUS[q.status]?.[0]}</Badge><SubmitButton formAction={saveQuote}>Save</SubmitButton></div>
          </form>
        </Card>
      </div>
    </div>
  </>);
}
