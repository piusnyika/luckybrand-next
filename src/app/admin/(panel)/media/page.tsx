import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { db, schema as s } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { PageHeader, Card, Field, SubmitButton, ConfirmButton, FlashToast } from "@/components/admin/ui";
import { Pagination } from "@/components/store/ShopView";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { BulkBar } from "@/components/admin/BulkBar";
import { SelectAllButton } from "@/components/admin/SelectAllButton";
import { mediaWhere } from "@/lib/admin/media";
import { updateMedia, removeMedia, bulkMedia } from "./actions";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Media library" };
export const dynamic = "force-dynamic";
export default async function Media({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; id?: string; show?: string }> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams; const page = Math.max(1, Number(sp.page || 1)); const per = 60;
  const unused = sp.show === "unused";
  const where = mediaWhere(sp.q, unused);
  const keep = { ...(sp.q ? { q: sp.q } : {}), ...(unused ? { show: "unused" } : {}) };
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(s.media).where(where).orderBy(desc(s.media.id)).limit(per).offset((page - 1) * per),
    db.select({ total: sql<number>`COUNT(*)` }).from(s.media).where(where),
  ]);
  const sel = sp.id ? await db.query.media.findFirst({ where: eq(s.media.id, Number(sp.id)) }) : null;
  const usedBy = sel ? await db.select({ id: s.products.id, name: s.products.name }).from(s.productImages).innerJoin(s.products, eq(s.products.id, s.productImages.productId)).where(eq(s.productImages.mediaId, sel.id)) : [];
  return (
    <>
      <FlashToast />
      <PageHeader title="Media library" subtitle={`${total} ${unused ? "unused " : ""}files`} actions={<MediaUploader />} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search files…" className="field h-10 w-64 text-sm" />
        <select name="show" defaultValue={sp.show} className="field h-10 w-64 text-sm"><option value="">All files</option><option value="unused">Unused (not on any product or page)</option></select>
        <button className="btn-outline h-10 text-sm">Search</button>
      </form>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <form action={bulkMedia}>
          <input type="hidden" name="qs" value={new URLSearchParams({ ...keep, page: String(page) }).toString()} />
          <input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="show" value={sp.show ?? ""} />
          {rows.length > 0 && <div className="flex flex-wrap items-center gap-x-4">
            <SelectAllButton total={Number(total)} onPage={rows.length} />
            <BulkBar options={[["delete", "Delete permanently"]]} />
          </div>}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {rows.map((m) => (
              <div key={m.id} className={`relative aspect-square overflow-hidden rounded-form border-2 bg-white has-[:checked]:border-danger has-[:checked]:ring-2 has-[:checked]:ring-danger/30 ${sel?.id === m.id ? "border-primary" : "border-line hover:border-primary/40"}`}>
                <Link href={`/admin/media/?${new URLSearchParams({ ...keep, page: String(page), id: String(m.id) })}`} scroll={false} className="block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/\.pdf$/i.test(m.url) ? <span className="flex h-full items-center justify-center text-xs font-semibold">PDF</span> : <img src={m.url} alt="" loading="lazy" className="h-full w-full object-contain" />}
                </Link>
                <label className="absolute left-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded bg-white/90 shadow-sm" title="Select">
                  <input type="checkbox" name="sel" value={m.id} className="h-4 w-4 accent-primary" aria-label={`Select ${m.title || m.url}`} />
                </label>
              </div>
            ))}
          </div>
        </form>
        {sel ? (
          <Card title="File details">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.url} alt="" className="mb-4 max-h-56 w-full rounded-form bg-surface object-contain" />
            <dl className="mb-4 space-y-1 text-xs text-ink-soft">
              <div>Uploaded {formatDate(sel.createdAt)}</div>{sel.width && <div>{sel.width} × {sel.height}px</div>}{sel.size && <div>{(sel.size / 1024).toFixed(0)} KB</div>}
              <div className="break-all"><a href={sel.url} target="_blank" className="text-primary">{sel.url}</a></div>
            </dl>
            <form action={updateMedia} className="space-y-3">
              <input type="hidden" name="id" value={sel.id} />
              <Field label="Alt text" hint="Describes the image for SEO and screen readers."><input name="alt" defaultValue={sel.alt} className="field" /></Field>
              <Field label="Title"><input name="title" defaultValue={sel.title} className="field" /></Field>
              <div className="flex items-center justify-between"><ConfirmButton formAction={removeMedia} message="Delete this file permanently? It will be removed from any products using it.">Delete permanently</ConfirmButton><SubmitButton className="btn-primary h-10 text-sm">Save</SubmitButton></div>
            </form>
            {usedBy.length > 0 && <div className="mt-4 text-xs"><div className="mb-1 font-semibold">Used by</div>{usedBy.map((p) => <Link key={p.id} href={`/admin/products/${p.id}/`} className="block text-primary">{p.name}</Link>)}</div>}
          </Card>
        ) : <div className="hidden rounded-base border border-dashed border-line p-8 text-center text-sm text-ink-muted xl:block">Select a file to see its details.</div>}
      </div>
      <Pagination page={page} pages={Math.ceil(Number(total) / per)} href={(n) => `/admin/media/?${new URLSearchParams({ ...keep, page: String(n) })}`} />
    </>
  );
}
