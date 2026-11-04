import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { AccountShell } from "@/components/store/AccountShell";
import { OrderDetails } from "@/components/store/OrderDetails";
import { formatDateTime } from "@/lib/format";

export default async function ViewOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser(`/my-account/view-order/${id}/`);
  const o = await getOrder(Number(id));
  if (!o || o.userId !== u.id) notFound();
  const notes = o.notes.filter((n) => n.isCustomer);
  return (
    <AccountShell active="/my-account/orders/" title={`Order #${o.number}`}>
      {notes.length > 0 && <div className="mb-8"><h2 className="mb-3 text-lg font-semibold">Order updates</h2>
        <ol className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-base bg-surface p-4 text-sm"><div className="text-xs text-ink-muted">{formatDateTime(n.createdAt)}</div>{n.content}</li>)}</ol></div>}
      <OrderDetails o={o} />
    </AccountShell>
  );
}
