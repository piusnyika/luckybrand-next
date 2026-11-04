import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/store/AccountShell";
import { money, formatDate, STATUS_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function Orders() {
  const u = await requireUser("/my-account/orders/");
  const rows = (await prisma.order.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { items: { select: { quantity: true } } } }))
    .map(({ items, ...o }) => ({ o, items: items.reduce((a, i) => a + i.quantity, 0) }));
  return (
    <AccountShell active="/my-account/orders/" title="Orders">
      {rows.length === 0 ? <p className="rounded-base bg-surface p-5 text-sm">No order has been made yet. <Link href="/shop/" className="font-semibold text-primary">Browse products</Link></p> : (
        <div className="overflow-x-auto rounded-base border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left"><tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Total</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ o, items }) => (
                <tr key={o.id}><td className="p-3 font-semibold">#{o.number}</td><td className="p-3">{formatDate(o.createdAt)}</td><td className="p-3">{STATUS_LABEL[o.status]}</td>
                  <td className="p-3">{money(o.total)} for {Number(items)} item{Number(items) === 1 ? "" : "s"}</td>
                  <td className="p-3 text-right"><Link href={`/my-account/view-order/${o.id}/`} className="rounded-form bg-primary px-4 py-2 text-xs font-semibold text-white">View</Link></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
