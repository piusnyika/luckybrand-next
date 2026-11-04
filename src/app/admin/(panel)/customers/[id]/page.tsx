import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth";
import { money, formatDate, STATUS_LABEL, STATUS_COLOR } from "@/lib/format";
import { PageHeader, Card, Field, Badge, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { saveCustomer, blockCustomer, deleteCustomer } from "../actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Customer" };
export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const u = await prisma.user.findUnique({ where: { id: Number((await params).id) } });
  if (!u) notFound();
  const me = await getCurrentUser();
  // same rules as lib/admin/customers (last-admin check happens there)
  const canManage = !!me && me.id !== u.id && (me.role === "admin" || u.role === "customer");
  const orders = await prisma.order.findMany({ where: { OR: [{ userId: u.id }, { email: { equals: u.email, mode: "insensitive" } }] }, orderBy: { createdAt: "desc" } });
  const b = u.billing ?? {};
  return (
    <>
      <FlashToast />
      <PageHeader back="/admin/customers/" title={`${u.firstName} ${u.lastName}`.trim() || u.email} subtitle={`Customer since ${formatDate(u.createdAt)}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <form action={saveCustomer}>
          <input type="hidden" name="id" value={u.id} />
          <Card title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name"><input name="firstName" defaultValue={u.firstName} className="field" /></Field>
              <Field label="Last name"><input name="lastName" defaultValue={u.lastName} className="field" /></Field>
              <Field label="Email"><input name="email" type="email" required defaultValue={u.email} className="field" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={u.phone || b.phone} className="field" /></Field>
              <Field label="Company" className="sm:col-span-2"><input name="company" defaultValue={b.company} className="field" /></Field>
              <Field label="Address" className="sm:col-span-2"><input name="address1" defaultValue={b.address1} className="field" /></Field>
              <Field label="Address line 2" className="sm:col-span-2"><input name="address2" defaultValue={b.address2} className="field" /></Field>
              <Field label="City"><input name="city" defaultValue={b.city} className="field" /></Field>
              <Field label="Province"><input name="state" defaultValue={b.state} className="field" /></Field>
              {me?.role === "admin" && <Field label="Role" hint="Shop managers can use the admin except Settings and Redirects."><select name="role" defaultValue={u.role} disabled={me.id === u.id} className="field"><option value="customer">Customer</option><option value="manager">Shop manager</option><option value="admin">Administrator</option></select></Field>}
              <Field label="Set new password" hint="Leave blank to keep the current password."><input name="password" type="password" autoComplete="new-password" className="field" /></Field>
            </div>
            <div className="mt-6 flex justify-end"><SubmitButton>Save customer</SubmitButton></div>
          </Card>
        </form>
        <div className="space-y-6">
        {canManage && (
          <Card title="Account access">
            {u.blocked && <p className="mb-3 rounded-form bg-red-50 px-3 py-2 text-sm text-danger"><strong>Blocked.</strong> This person can't log in.</p>}
            <form className="flex flex-wrap items-center justify-between gap-3">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="block" value={u.blocked ? "0" : "1"} />
              <SubmitButton formAction={blockCustomer} className="btn-outline h-10 text-sm" pendingText="Saving…">{u.blocked ? "Unblock account" : "Block account"}</SubmitButton>
              <ConfirmButton formAction={deleteCustomer} message={`Delete ${u.email}'s account permanently? Their ${orders.length} order(s) will be kept. This cannot be undone.`}>Delete account</ConfirmButton>
            </form>
            <p className="mt-3 text-xs text-ink-muted">Blocking stops logins (password and Google) and signs them out straight away, and you can undo it. Deleting removes the account for good; their orders stay in Orders.</p>
          </Card>
        )}
        <Card title={`Orders (${orders.length})`}>
          {orders.length === 0 ? <p className="text-sm text-ink-muted">No orders yet.</p> : <div className="-m-5 divide-y divide-line">
            {orders.map((o) => <Link key={o.id} href={`/admin/orders/${o.id}/`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface"><span className="font-semibold">#{o.number}<span className="block text-xs font-normal text-ink-muted">{formatDate(o.createdAt)}</span></span><Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge><span className="font-semibold">{money(o.total)}</span></Link>)}
          </div>}
        </Card>
        </div>
      </div>
    </>
  );
}
