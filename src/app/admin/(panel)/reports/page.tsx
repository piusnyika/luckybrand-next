import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { reportRange, salesReport } from "@/lib/admin/reports";
import { money } from "@/lib/format";
import { PageHeader, Card, Table, th, td, Empty } from "@/components/admin/ui";

export const metadata = { title: "Reports" };

const monthLabel = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff();
  const r = reportRange(await searchParams);
  const rep = await salesReport(r);
  const qs = `from=${r.fromStr}&to=${r.toStr}`;
  const csv = (type: string) => <a href={`/api/admin/reports-export/?type=${type}&${qs}`} className="text-sm font-medium text-primary hover:underline">Download CSV</a>;
  const max = Math.max(1, ...rep.months.map((m) => m.revenue));
  const share = (v: number) => (rep.summary.revenue ? `${((v / rep.summary.revenue) * 100).toFixed(1)}%` : "–");
  const presets: [string, string, string][] = (() => {
    const t = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10);
    const y = t.getUTCFullYear(), m = t.getUTCMonth();
    return [["This month", iso(new Date(Date.UTC(y, m, 1))), iso(t)], ["Last month", iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))],
      ["This year", iso(new Date(Date.UTC(y, 0, 1))), iso(t)], ["Last 12 months", iso(new Date(Date.UTC(y - 1, m + 1, 1))), iso(t)]];
  })();
  return (<>
    <PageHeader title="Reports" subtitle="Sales from paid orders (processing, on hold and completed). Cancelled, failed, refunded and unpaid orders are left out." />
    <Card className="mb-6">
      <form className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">From</span><input type="date" name="from" defaultValue={r.fromStr} className="field" /></label>
        <label className="block"><span className="label">To</span><input type="date" name="to" defaultValue={r.toStr} className="field" /></label>
        <button className="btn-primary h-11">Show</button>
        <span className="flex flex-wrap gap-2">{presets.map(([l, f, t]) => <Link key={l} href={`/admin/reports/?from=${f}&to=${t}`} className="rounded-full bg-surface px-3 py-1.5 text-sm hover:text-primary">{l}</Link>)}</span>
      </form>
    </Card>

    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Revenue", money(rep.summary.revenue)], ["Orders", String(rep.summary.orders)], ["Average order", money(rep.summary.average)], ["Items sold", String(rep.summary.items)]].map(([l, v]) => (
        <Card key={l}><p className="text-sm text-ink-soft">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></Card>
      ))}
    </div>

    {rep.summary.orders === 0 ? <Empty>No paid orders between these dates.</Empty> : (<div className="grid gap-6">
      <Card title="Revenue by month" actions={csv("months")}>
        <div className="flex h-48 items-end gap-1.5" aria-hidden>
          {rep.months.map((m) => <div key={m.month} title={`${monthLabel(m.month)}: ${money(m.revenue)}`} className="flex-1 rounded-t bg-primary/80 hover:bg-primary" style={{ height: `${Math.max(2, (m.revenue / max) * 100)}%` }} />)}
        </div>
        <Table head={<><th className={th}>Month</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Revenue</th></>}>
          {rep.months.map((m) => <tr key={m.month} className="border-t border-line"><td className={td}>{monthLabel(m.month)}</td><td className={`${td} text-right`}>{m.orders}</td><td className={`${td} text-right font-medium`}>{money(m.revenue)}</td></tr>)}
        </Table>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="By category" actions={csv("categories")}>
          <Table head={<><th className={th}>Main category</th><th className={`${th} text-right`}>Items</th><th className={`${th} text-right`}>Sales</th><th className={`${th} text-right`}>Share</th></>}>
            {rep.categories.map((c) => <tr key={c.category} className="border-t border-line"><td className={td}>{c.category}</td><td className={`${td} text-right`}>{c.qty}</td><td className={`${td} text-right font-medium`}>{money(c.revenue)}</td><td className={`${td} text-right text-ink-soft`}>{share(c.revenue)}</td></tr>)}
          </Table>
          <p className="mt-2 text-xs text-ink-muted">Product totals before order-level discounts and shipping.</p>
        </Card>
        <Card title="By payment method" actions={csv("payments")}>
          <Table head={<><th className={th}>Method</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Revenue</th><th className={`${th} text-right`}>Share</th></>}>
            {rep.payments.map((p) => <tr key={p.method} className="border-t border-line"><td className={td}>{p.method}</td><td className={`${td} text-right`}>{p.orders}</td><td className={`${td} text-right font-medium`}>{money(p.revenue)}</td><td className={`${td} text-right text-ink-soft`}>{share(p.revenue)}</td></tr>)}
          </Table>
        </Card>
      </div>
      <Card title="Top products" actions={csv("products")}>
        <Table head={<><th className={th}>Product</th><th className={`${th} text-right`}>Sold</th><th className={`${th} text-right`}>Sales</th></>}>
          {rep.products.map((p) => <tr key={p.name} className="border-t border-line"><td className={td}>{p.productId ? <Link href={`/admin/products/${p.productId}/`} className="hover:text-primary">{p.name}</Link> : p.name}{p.sku && <span className="ml-1 text-xs text-ink-muted">{p.sku}</span>}</td><td className={`${td} text-right`}>{p.qty}</td><td className={`${td} text-right font-medium`}>{money(p.revenue)}</td></tr>)}
        </Table>
      </Card>
    </div>)}
  </>);
}
