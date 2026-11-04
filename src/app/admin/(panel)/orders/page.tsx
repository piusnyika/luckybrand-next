import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { money, formatDateTime, STATUS_LABEL, STATUS_COLOR, ORDER_STATUSES } from "@/lib/format";
import { PageHeader, Badge, Table, th, td, Empty, FlashToast } from "@/components/admin/ui";
import { Pagination } from "@/components/store/ShopView";
import { BulkBar } from "@/components/admin/BulkBar";
import { bulkOrders } from "./actions";
import { prisma, Prisma } from "@/lib/prisma";

export const metadata = { title: "Orders" };
export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams; const page = Math.max(1, Number(sp.page || 1)); const per = 30;
  const day = (v: string | undefined, add = 0) => { const d = v ? new Date(v + "T00:00:00Z") : null; return d && !isNaN(d.getTime()) ? new Date(d.getTime() + add * 86_400_000) : undefined; };
  const from = day(sp.from), to = day(sp.to, 1);
  const q = sp.q ? { contains: sp.q, mode: "insensitive" as const } : null;
  // customer name lives in the billing JSON
  const byName = sp.q ? (await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM orders WHERE billing->>'lastName' ILIKE ${"%" + sp.q + "%"} OR billing->>'firstName' ILIKE ${"%" + sp.q + "%"}`).map((r) => r.id) : [];
  const cond: Prisma.OrderWhereInput = {
    ...(sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? { status: sp.status } : {}),
    ...(q ? { OR: [{ number: q }, { email: q }, { phone: q }, { id: { in: byName } }] } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.order.findMany({ where: cond, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: per, skip: (page - 1) * per, include: { items: { select: { quantity: true } } } })
      .then((r) => r.map(({ items, ...o }) => ({ o, items: items.reduce((a, i) => a + i.quantity, 0) }))),
    prisma.order.count({ where: cond }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all])); const all = counts.reduce((a, x) => a + x._count._all, 0);
  const tab = (st: string | undefined, label: string, n: number) => <Link key={st ?? "all"} href={st ? `/admin/orders/?status=${st}` : "/admin/orders/"} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${sp.status === st ? "bg-primary text-white" : "bg-white text-ink-soft hover:text-ink"}`}>{label} <span className="opacity-70">({n})</span></Link>;
  const exportQs = new URLSearchParams(Object.entries({ status: sp.status, q: sp.q, from: sp.from, to: sp.to }).filter(([, v]) => v) as [string, string][]);
  return (
    <>
      <FlashToast />
      <PageHeader title="Orders" actions={<a href={`/api/admin/orders-export/?${exportQs}`} className="btn-outline h-10 text-sm">Export CSV</a>} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{tab(undefined, "All", all)}{ORDER_STATUSES.map((st) => c[st] ? tab(st, STATUS_LABEL[st], c[st]) : null)}</div>
      <form className="mb-4 flex flex-wrap gap-2">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <input name="q" defaultValue={sp.q} placeholder="Order #, name, email or phone" className="field h-10 w-64 text-sm" />
        <input type="date" name="from" defaultValue={sp.from} className="field h-10 w-40 text-sm" aria-label="From" />
        <input type="date" name="to" defaultValue={sp.to} className="field h-10 w-40 text-sm" aria-label="To" />
        <button className="btn-outline h-10 text-sm">Filter</button>
      </form>
      {rows.length === 0 ? <Empty>No orders found.</Empty> : (
        <form action={bulkOrders}>
          <BulkBar options={[["processing", "Mark processing"], ["on-hold", "Mark on hold"], ["completed", "Mark completed"], ["cancelled", "Mark cancelled"], ["delete", "Delete"]]} />
          <Table head={<><th className={`${th} w-8`}><input type="checkbox" data-select-all className="accent-primary" aria-label="Select all" /></th><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Payment</th><th className={`${th} text-right`}>Total</th></>}>
            {rows.map(({ o, items }) => (
              <tr key={o.id} className="hover:bg-surface/60">
                <td className={td}><input type="checkbox" name="sel" value={o.id} className="accent-primary" aria-label={`Select order ${o.number}`} /></td>
                <td className={td}><Link href={`/admin/orders/${o.id}/`} className="font-semibold hover:text-primary">#{o.number} {o.billing?.firstName} {o.billing?.lastName}</Link><div className="text-xs text-ink-muted">{o.email} · {Number(items)} item(s)</div></td>
                <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDateTime(o.createdAt)}</td>
                <td className={td}><Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                <td className={`${td} text-ink-soft`}>{o.paymentMethodTitle}</td>
                <td className={`${td} text-right font-semibold`}>{money(o.total)}</td>
              </tr>
            ))}
          </Table>
        </form>
      )}
      <Pagination page={page} pages={Math.ceil(Number(total) / per)} href={(n) => `/admin/orders/?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(n) })}`} />
    </>
  );
}
