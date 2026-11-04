import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { money, formatDate, STATUS_LABEL, STATUS_COLOR } from "@/lib/format";
import { PageHeader, Card, Badge, FlashToast } from "@/components/admin/ui";
import { prisma, Prisma } from "@/lib/prisma";

export const metadata = { title: "Dashboard" };
const PAID = ["processing", "completed", "on-hold"] as const;

export default async function Dashboard() {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const since30 = new Date(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10) + "T00:00:00Z");
  const paid = { status: { in: [...PAID] } };
  const sum = (from: Date, to?: Date) => prisma.order.aggregate({ where: { ...paid, createdAt: { gte: from, ...(to ? { lte: to } : {}) } }, _sum: { total: true }, _count: { _all: true } })
    .then((r) => ({ total: Number(r._sum.total ?? 0), n: r._count._all }));
  const [month, last, products, customers, statusCounts, recent, lowStock, daily, top, messages] = await Promise.all([
    sum(monthStart), sum(lastMonthStart, monthStart),
    prisma.product.count({ where: { status: "published" } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.$queryRaw<{ id: number; name: string; stockQty: number | null; stockStatus: string }[]>`SELECT id, name, stock_qty AS "stockQty", stock_status AS "stockStatus" FROM products
      WHERE status = 'published' AND (stock_status = 'outofstock' OR (manage_stock AND stock_qty <= COALESCE(low_stock_amount, 2)))
      ORDER BY stock_qty ASC NULLS FIRST LIMIT 8`,
    prisma.$queryRaw<{ d: string; total: string; n: bigint }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, SUM(total)::text AS total, COUNT(*) AS n FROM orders
      WHERE status IN (${Prisma.join([...PAID])}) AND created_at >= ${since30} GROUP BY 1`,
    prisma.$queryRaw<{ name: string; qty: bigint; total: string }[]>`SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.total)::text AS total FROM order_items oi
      JOIN orders o ON o.id = oi.order_id WHERE o.status IN (${Prisma.join([...PAID])}) AND o.created_at >= ${new Date(Date.now() - 90 * 864e5)}
      GROUP BY oi.name ORDER BY SUM(oi.total) DESC LIMIT 5`,
    prisma.contactMessage.findMany({ where: { read: false }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const sc = Object.fromEntries(statusCounts.map((x) => [x.status, x._count._all]));
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5); const key = d.toISOString().slice(0, 10); const row = daily.find((x) => String(x.d) === key); return { key, d, total: Number(row?.total ?? 0) }; });
  const max = Math.max(1, ...days.map((d) => d.total));
  const change = Number(last.total) ? ((Number(month.total) - Number(last.total)) / Number(last.total)) * 100 : null;

  return (
    <>
      <FlashToast />
      <PageHeader title="Dashboard" subtitle={now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<><Link href="/admin/products/new/" className="btn-primary h-10 text-sm">+ Add product</Link><Link href="/admin/orders/" className="btn-outline h-10 text-sm">View orders</Link></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sales this month" value={money(month.total)} sub={change === null ? `${month.n} orders` : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}% vs last month · ${month.n} orders`} />
        <Kpi label="Orders to process" value={String(sc.processing ?? 0)} sub={`${sc["on-hold"] ?? 0} on hold · ${sc.pending ?? 0} pending payment`} href="/admin/orders/?status=processing" />
        <Kpi label="Published products" value={String(products)} sub={`${lowStock.length} low / out of stock`} href="/admin/products/" />
        <Kpi label="Customers" value={String(customers)} href="/admin/customers/" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Sales – last 30 days">
          <div className="flex h-48 items-end gap-1">
            {days.map((d) => (
              <div key={d.key} className="group relative flex-1">
                <div className="w-full rounded-t bg-primary/80 hover:bg-primary" style={{ height: `${Math.max(2, (d.total / max) * 180)}px` }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-white group-hover:block">{formatDate(d.d)}: {money(d.total)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink-muted"><span>{formatDate(days[0].d)}</span><span>Today</span></div>
        </Card>
        <Card title="Top sellers (90 days)">
          {top.length === 0 ? <p className="text-sm text-ink-muted">No sales yet.</p> : <ol className="space-y-3 text-sm">
            {top.map((t, i) => <li key={t.name} className="flex gap-3"><span className="text-ink-muted">{i + 1}.</span><span className="flex-1">{t.name}<span className="block text-xs text-ink-muted">{Number(t.qty)} sold</span></span><span className="font-semibold">{money(t.total)}</span></li>)}
          </ol>}
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Recent orders" actions={<Link href="/admin/orders/" className="text-xs font-semibold text-primary">All orders</Link>}>
          <div className="-m-5 divide-y divide-line">
            {recent.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}/`} className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-surface">
                <span className="w-16 font-semibold">#{o.number}</span>
                <span className="flex-1 truncate">{o.billing?.firstName} {o.billing?.lastName}<span className="block text-xs text-ink-muted">{formatDate(o.createdAt)}</span></span>
                <Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                <span className="w-24 text-right font-semibold">{money(o.total)}</span>
              </Link>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Stock alerts">
            {lowStock.length === 0 ? <p className="text-sm text-ink-muted">All good.</p> : <ul className="space-y-2 text-sm">
              {lowStock.map((p) => <li key={p.id} className="flex justify-between gap-2"><Link href={`/admin/products/${p.id}/`} className="truncate hover:text-primary">{p.name}</Link><span className={p.stockStatus === "outofstock" ? "text-danger" : "text-amber-600"}>{p.stockStatus === "outofstock" ? "Out" : p.stockQty}</span></li>)}
            </ul>}
          </Card>
          <Card title="Unread messages" actions={<Link href="/admin/messages/" className="text-xs font-semibold text-primary">Inbox</Link>}>
            {messages.length === 0 ? <p className="text-sm text-ink-muted">No new messages.</p> : <ul className="space-y-3 text-sm">
              {messages.map((m) => <li key={m.id}><Link href={`/admin/messages/?id=${m.id}`} className="font-medium hover:text-primary">{m.name}</Link><p className="truncate text-xs text-ink-muted">{m.message}</p></li>)}
            </ul>}
          </Card>
        </div>
      </div>
    </>
  );
}
function Kpi({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = <div className="h-full rounded-base border border-line bg-white p-5 transition hover:border-primary/40"><div className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div>{sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}</div>;
  return href ? <Link href={href}>{body}</Link> : body;
}
