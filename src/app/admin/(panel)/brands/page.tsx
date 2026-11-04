import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { db, schema as s } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import { PageHeader, Card, Field, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/MediaPicker";
import { saveTerm, deleteTerm } from "./actions";

export const metadata = { title: "Brands & tags" };
export default async function Brands({ searchParams }: { searchParams: Promise<{ brand?: string; tag?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams;
  const [brands, tags] = await Promise.all([
    db.select({ b: s.brands, n: sql<number>`(SELECT COUNT(*) FROM product_brands pb WHERE pb.brand_id = ${s.brands.id})` }).from(s.brands).orderBy(asc(s.brands.name)),
    db.select({ t: s.tags, n: sql<number>`(SELECT COUNT(*) FROM product_tags pt WHERE pt.tag_id = ${s.tags.id})` }).from(s.tags).orderBy(asc(s.tags.name)),
  ]);
  const b = sp.brand ? brands.find((x) => x.b.id === Number(sp.brand))?.b : null;
  const t = sp.tag ? tags.find((x) => x.t.id === Number(sp.tag))?.t : null;
  return (
    <>
      <FlashToast />
      <PageHeader title="Brands & tags" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Brands (${brands.length})`}>
          <form action={saveTerm} className="mb-5 space-y-3 rounded-form bg-surface p-4" key={b?.id ?? "nb"}>
            <input type="hidden" name="kind" value="brand" /><input type="hidden" name="id" value={b?.id ?? ""} />
            <div className="grid grid-cols-2 gap-3"><Field label={b ? "Edit brand" : "New brand"}><input name="name" required defaultValue={b?.name} className="field" /></Field><Field label="Slug"><input name="slug" defaultValue={b?.slug} className="field" /></Field></div>
            <ImageField name="image" defaultValue={b?.image} label="Logo" />
            <div className="flex justify-between">{b ? <Link href="/admin/brands/" className="self-center text-xs text-ink-soft">Cancel</Link> : <span />}<SubmitButton className="btn-primary h-10 text-sm">{b ? "Update" : "Add brand"}</SubmitButton></div>
          </form>
          <ul className="divide-y divide-line text-sm">{brands.map(({ b: x, n }) => (
            <li key={x.id} className="flex items-center gap-3 py-2"><Link href={`/admin/brands/?brand=${x.id}`} className="flex-1 font-medium hover:text-primary">{x.name}</Link><span className="text-xs text-ink-muted">{Number(n)} products</span>
              <form action={deleteTerm}><input type="hidden" name="kind" value="brand" /><input type="hidden" name="id" value={x.id} /><ConfirmButton message="Delete this brand?" className="text-xs text-danger">Delete</ConfirmButton></form></li>
          ))}</ul>
        </Card>
        <Card title={`Tags (${tags.length})`}>
          <form action={saveTerm} className="mb-5 flex items-end gap-3 rounded-form bg-surface p-4" key={t?.id ?? "nt"}>
            <input type="hidden" name="kind" value="tag" /><input type="hidden" name="id" value={t?.id ?? ""} />
            <Field label={t ? "Edit tag" : "New tag"} className="flex-1"><input name="name" required defaultValue={t?.name} className="field" /></Field>
            <SubmitButton className="btn-primary text-sm">{t ? "Update" : "Add"}</SubmitButton>
          </form>
          <div className="flex flex-wrap gap-2">{tags.map(({ t: x, n }) => (
            <span key={x.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
              <Link href={`/admin/brands/?tag=${x.id}`} className="hover:text-primary">{x.name}</Link><span className="text-xs text-ink-muted">{Number(n)}</span>
              <form action={deleteTerm} className="inline"><input type="hidden" name="kind" value="tag" /><input type="hidden" name="id" value={x.id} /><ConfirmButton message="Delete this tag?" className="text-xs text-ink-muted hover:text-danger">×</ConfirmButton></form>
            </span>
          ))}</div>
        </Card>
      </div>
    </>
  );
}
