import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import { PageHeader, Card, Field, Table, th, td, Badge, Empty, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { saveCoupon, deleteCoupon } from "./actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Coupons" };
export default async function Coupons({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const { edit } = await searchParams;
  const rows = await prisma.coupon.findMany({ orderBy: { id: "desc" } });
  const c = edit ? rows.find((r) => r.id === Number(edit)) : null;
  return (
    <>
      <FlashToast />
      <PageHeader title="Coupons" subtitle="Discount codes customers can enter in the cart." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>{rows.length === 0 ? <Empty>No coupons yet. Create one on the right.</Empty> : (
          <Table head={<><th className={th}>Code</th><th className={th}>Discount</th><th className={th}>Usage</th><th className={th}>Expires</th><th className={th}>Status</th><th className={th} /></>}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}><span className="rounded bg-surface px-2 py-1 font-mono text-xs font-semibold uppercase">{r.code}</span><div className="mt-1 text-xs text-ink-muted">{r.description}</div></td>
                <td className={td}>{r.type === "percent" ? `${Number(r.amount)}%` : money(r.amount)}{r.type === "fixed_product" && " per item"}{r.freeShipping && " + free shipping"}</td>
                <td className={td}>{r.usageCount}{r.usageLimit !== null && ` / ${r.usageLimit}`}</td>
                <td className={td}>{r.expiresAt ? formatDate(r.expiresAt) : "Never"}</td>
                <td className={td}>{r.active && (!r.expiresAt || r.expiresAt > new Date()) ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className={`${td} whitespace-nowrap text-right`}><Link href={`/admin/coupons/?edit=${r.id}`} className="mr-3 text-sm font-medium text-primary">Edit</Link>
                  <form action={deleteCoupon} className="inline"><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this coupon?">Delete</ConfirmButton></form></td>
              </tr>
            ))}
          </Table>
        )}</div>
        <Card title={c ? `Edit ${c.code.toUpperCase()}` : "New coupon"} actions={c && <Link href="/admin/coupons/" className="text-xs text-primary">+ New</Link>}>
          <form action={saveCoupon} className="space-y-4" key={c?.id ?? "new"}>
            <input type="hidden" name="id" value={c?.id ?? ""} />
            <Field label="Code"><input name="code" required defaultValue={c?.code} className="field uppercase" /></Field>
            <Field label="Description (internal)"><input name="description" defaultValue={c?.description} className="field" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><select name="type" defaultValue={c?.type ?? "percent"} className="field"><option value="percent">Percentage</option><option value="fixed_cart">Fixed cart</option><option value="fixed_product">Fixed per product</option></select></Field>
              <Field label="Amount"><input name="amount" type="number" step="0.01" required defaultValue={c ? Number(c.amount) : ""} className="field" /></Field>
              <Field label="Minimum spend"><input name="minSpend" type="number" step="0.01" defaultValue={c?.minSpend ?? ""} className="field" /></Field>
              <Field label="Maximum spend"><input name="maxSpend" type="number" step="0.01" defaultValue={c?.maxSpend ?? ""} className="field" /></Field>
              <Field label="Usage limit"><input name="usageLimit" type="number" defaultValue={c?.usageLimit ?? ""} className="field" /></Field>
              <Field label="Expiry date"><input name="expiresAt" type="date" defaultValue={c?.expiresAt?.toISOString().slice(0, 10)} className="field" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="freeShipping" defaultChecked={c?.freeShipping} className="accent-primary" /> Grants free shipping</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="accent-primary" /> Active</label>
            <SubmitButton className="btn-primary w-full">{c ? "Update coupon" : "Create coupon"}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
