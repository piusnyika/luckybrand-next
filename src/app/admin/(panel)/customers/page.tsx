import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { db, schema as s } from "@/db";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { money, formatDate } from "@/lib/format";
import { PageHeader, Table, th, td, Empty, Badge, FlashToast } from "@/components/admin/ui";
import { Pagination } from "@/components/store/ShopView";
import { BulkBar } from "@/components/admin/BulkBar";
import { bulkCustomers } from "./actions";

export const metadata = { title: "Customers" };
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams; const page = Math.max(1, Number(sp.page || 1)); const per = 30;
  const where: SQL[] = [];
  if (sp.q) where.push(or(like(s.users.email, `%${sp.q}%`), like(s.users.firstName, `%${sp.q}%`), like(s.users.lastName, `%${sp.q}%`), like(s.users.phone, `%${sp.q}%`))!);
  if (sp.role === "admin" || sp.role === "manager" || sp.role === "customer") where.push(eq(s.users.role, sp.role));
  if (sp.role === "blocked") where.push(eq(s.users.blocked, true));
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select({ u: s.users, orders: sql<number>`(SELECT COUNT(*) FROM orders o WHERE o.user_id = ${s.users.id} OR o.email = ${s.users.email})`,
      spent: sql<number>`(SELECT COALESCE(SUM(total),0) FROM orders o WHERE (o.user_id = ${s.users.id} OR o.email = ${s.users.email}) AND o.status IN ('processing','completed','on-hold'))` })
      .from(s.users).where(cond).orderBy(desc(s.users.createdAt)).limit(per).offset((page - 1) * per),
    db.select({ total: sql<number>`COUNT(*)` }).from(s.users).where(cond),
  ]);
  return (
    <>
      <FlashToast />
      <PageHeader title="Customers" subtitle={`${total} accounts`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="field h-10 w-64 text-sm" />
        <select name="role" defaultValue={sp.role} className="field h-10 w-40 text-sm"><option value="">All roles</option><option value="customer">Customers</option><option value="manager">Shop managers</option><option value="admin">Admins</option><option value="blocked">Blocked</option></select>
        <button className="btn-outline h-10 text-sm">Filter</button>
      </form>
      {rows.length === 0 ? <Empty>No customers found.</Empty> : (
        <form action={bulkCustomers}>
        <input type="hidden" name="qs" value={new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString()} />
        <BulkBar options={[["block", "Block (can't log in)"], ["unblock", "Unblock"], ["delete", "Delete account (orders are kept)"]]} />
        <Table head={<><th className={`${th} w-8`}><input type="checkbox" data-select-all className="accent-primary" aria-label="Select all" /></th><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Phone</th><th className={th}>Registered</th><th className={th}>Orders</th><th className={`${th} text-right`}>Total spent</th></>}>
          {rows.map(({ u, orders, spent }) => (
            <tr key={u.id} className={`hover:bg-surface/60 ${u.blocked ? "opacity-60" : ""}`}>
              <td className={td}><input type="checkbox" name="sel" value={u.id} className="accent-primary" aria-label={`Select ${u.email}`} /></td>
              <td className={td}><Link href={`/admin/customers/${u.id}/`} className="font-semibold hover:text-primary">{`${u.firstName} ${u.lastName}`.trim() || u.displayName || "—"}</Link>{u.role !== "customer" && <Badge className="ml-2 bg-blue-100 text-blue-800">{u.role}</Badge>}{u.blocked && <Badge className="ml-2 bg-red-100 text-red-700">Blocked</Badge>}</td>
              <td className={`${td} text-ink-soft`}>{u.email}</td><td className={`${td} text-ink-soft`}>{u.phone || u.billing?.phone || "–"}</td>
              <td className={`${td} text-ink-soft`}>{formatDate(u.createdAt)}</td><td className={td}>{Number(orders)}</td><td className={`${td} text-right font-semibold`}>{money(spent)}</td>
            </tr>
          ))}
        </Table>
        </form>
      )}
      <Pagination page={page} pages={Math.ceil(Number(total) / per)} href={(n) => `/admin/customers/?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(n) })}`} />
    </>
  );
}
