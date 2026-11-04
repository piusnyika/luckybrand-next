import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Card, Empty, Table, th, td, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { deleteMessage, deleteSubscriber } from "./actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";
export default async function Messages({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams;
  if (sp.tab === "subscribers") {
    const subs = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
    return (<>
      <FlashToast />
      <PageHeader title="Newsletter subscribers" subtitle={`${subs.length} subscribers`} actions={<><Link href="/admin/messages/" className="btn-outline h-10 text-sm">Contact messages</Link><a href="/api/admin/subscribers-export/" className="btn-primary h-10 text-sm">Export CSV</a></>} />
      {subs.length === 0 ? <Empty>No subscribers yet.</Empty> : <Table head={<><th className={th}>Email</th><th className={th}>Subscribed</th><th className={th} /></>}>
        {subs.map((x) => <tr key={x.id}><td className={td}>{x.email}</td><td className={`${td} text-ink-soft`}>{formatDateTime(x.createdAt)}</td><td className={`${td} text-right`}><form action={deleteSubscriber}><input type="hidden" name="id" value={x.id} /><ConfirmButton message="Remove subscriber?" className="text-xs text-danger">Remove</ConfirmButton></form></td></tr>)}
      </Table>}
    </>);
  }
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const cur = sp.id ? rows.find((r) => r.id === Number(sp.id)) : rows[0];
  if (cur && !cur.read) await prisma.contactMessage.update({ where: { id: cur.id }, data: { read: true } });
  return (<>
    <FlashToast />
    <PageHeader title="Contact messages" actions={<Link href="/admin/messages/?tab=subscribers" className="btn-outline h-10 text-sm">Newsletter subscribers</Link>} />
    {rows.length === 0 ? <Empty>No messages yet. Messages sent from the Contact page appear here.</Empty> : (
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="divide-y divide-line overflow-hidden rounded-base border border-line bg-white">
          {rows.map((m) => <Link key={m.id} href={`/admin/messages/?id=${m.id}`} className={`block px-4 py-3 text-sm ${cur?.id === m.id ? "bg-primary-50" : "hover:bg-surface"}`}>
            <div className="flex justify-between gap-2"><span className={m.read ? "" : "font-bold"}>{m.name}</span><span className="text-xs text-ink-muted">{formatDateTime(m.createdAt)}</span></div>
            <div className="truncate text-xs text-ink-soft">{m.subject || m.message}</div></Link>)}
        </div>
        {cur && <Card title={cur.subject || "Message"} actions={<form action={deleteMessage}><input type="hidden" name="id" value={cur.id} /><ConfirmButton message="Delete this message?" className="text-xs text-danger">Delete</ConfirmButton></form>}>
          <div className="mb-4 text-sm"><strong>{cur.name}</strong> · <a href={`mailto:${cur.email}`} className="text-primary">{cur.email}</a>{cur.phone && <> · <a href={`tel:${cur.phone}`} className="text-primary">{cur.phone}</a></>}<div className="text-xs text-ink-muted">{formatDateTime(cur.createdAt)}</div></div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{cur.message}</p>
          <a href={`mailto:${cur.email}?subject=${encodeURIComponent("Re: " + (cur.subject || "Your message"))}`} className="btn-primary mt-6 h-10 text-sm">Reply by email</a>
        </Card>}
      </div>
    )}
  </>);
}
