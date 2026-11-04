import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { db, schema as s } from "@/db";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { money, formatDateTime, STATUS_LABEL, STATUS_COLOR, ORDER_STATUSES } from "@/lib/format";
import { PageHeader, Badge, Table, th, td, Empty, FlashToast } from "@/components/admin/ui";
import { Pagination } from "@/components/store/ShopView";
import { BulkBar } from "@/components/admin/BulkBar";
import { bulkOrders } from "./actions";

export const metadata = { title: "Orders" };
export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams; const page = Math.max(1, Number(sp.page || 1)); const per = 30;
  const where: SQL[] = [];
  if (sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status)) where.push(eq(s.orders.status, sp.status as any));
  if (sp.q) where.push(or(like(s.orders.number, `%${sp.q}%`), like(s.orders.email, `%${sp.q}%`), like(s.orders.phone, `%${sp.q}%`), sql`JSON_UNQUOTE(JSON_EXTRACT(${s.orders.billing}, '$.lastName')) LIKE ${"%" + sp.q + "%"}`, sql`JSON_UNQUOTE(JSON_EXTRACT(${s.orders.billing}, '$.firstName')) LIKE ${"%" + sp.q + "%"}`)!);
  if (sp.from) where.push(sql`${s.orders.createdAt} >= ${sp.from}`);
  if (sp.to) where.push(sql`${s.orders.createdAt} < DATE_ADD(${sp.to}, INTERVAL 1 DAY)`);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }], counts] = await Promise.all([
    db.select({ o: s.orders, items: sql<number>`(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = ${s.orders.id})` }).from(s.orders).where(cond).orderBy(desc(s.orders.createdAt), desc(s.orders.id)).limit(per).offset((page - 1) * per),
    db.select({ total: sql<number>`COUNT(*)` }).from(s.orders).where(cond),
    db.select({ status: s.orders.status, n: sql<number>`COUNT(*)` }).from(s.orders).groupBy(s.orders.status),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, Number(x.n)])); const all = counts.reduce((a, x) => a + Number(x.n), 0);
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
