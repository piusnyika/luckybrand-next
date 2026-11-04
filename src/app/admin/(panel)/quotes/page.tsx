import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PageHeader, Table, th, td, Badge, Empty, FlashToast } from "@/components/admin/ui";
import { QUOTE_STATUS } from "./status";

export const metadata = { title: "Quote requests" };

export default async function Quotes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = sp.status && QUOTE_STATUS[sp.status] ? sp.status : undefined;
  const [rows, counts] = await Promise.all([
    prisma.quoteRequest.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const n = (s?: string) => counts.filter((c) => !s || c.status === s).reduce((a, c) => a + c._count._all, 0);
  const tab = (s: string | undefined, label: string) => <Link key={s ?? "all"} href={s ? `/admin/quotes/?status=${s}` : "/admin/quotes/"} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-primary text-white" : "bg-white text-ink-soft hover:text-ink"}`}>{label} <span className="opacity-70">({n(s)})</span></Link>;
  return (<>
    <FlashToast />
    <PageHeader title="Quote requests" subtitle="From the “Request a quote” page. Open one to create an order from it and email the customer their quote." />
    <div className="mb-5 flex flex-wrap gap-2">{tab(undefined, "All")}{Object.entries(QUOTE_STATUS).map(([k, [l]]) => tab(k, l))}</div>
    {rows.length === 0 ? <Empty>No quote requests yet. Customers find the form at /request-a-quote/ and on every product page.</Empty> : (
      <Table head={<><th className={th}>Request</th><th className={th}>Products</th><th className={th}>Status</th><th className={th}>Received</th></>}>
        {rows.map((q) => {
          const items = (q.items as { name: string; qty: number }[]) ?? [];
          return (
            <tr key={q.id} className="border-t border-line">
              <td className={td}><Link href={`/admin/quotes/${q.id}/`} className="font-semibold hover:text-primary">#{q.id} {q.name}</Link><div className="text-xs text-ink-muted">{q.company && `${q.company} · `}{q.email} · {q.phone}</div></td>
              <td className={`${td} text-sm`}>{items.length ? items.slice(0, 2).map((i) => `${i.qty} × ${i.name}`).join(", ") + (items.length > 2 ? ` +${items.length - 2} more` : "") : <span className="text-ink-muted">Described in message</span>}</td>
              <td className={td}><Badge className={QUOTE_STATUS[q.status]?.[1]}>{QUOTE_STATUS[q.status]?.[0] ?? q.status}</Badge></td>
              <td className={`${td} whitespace-nowrap text-sm`}>{formatDateTime(q.createdAt)}</td>
            </tr>
          );
        })}
      </Table>
    )}
  </>);
}
